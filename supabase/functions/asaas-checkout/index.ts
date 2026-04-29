import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

// Edge Function: asaas-checkout
// Garante (idempotente) o Customer e a Subscription no Asaas e devolve a invoiceUrl
// da fatura mais recente para o frontend abrir em nova aba.

const PLAN_VALUE = 39.0;
const PLAN_DESCRIPTION = "PixelSafe Pro — Assinatura mensal";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function asaasBaseUrl(): string {
  const env = (Deno.env.get("ASAAS_ENV") ?? "sandbox").toLowerCase();
  return env === "production" || env === "prod"
    ? "https://api.asaas.com/v3"
    : "https://api-sandbox.asaas.com/v3";
}

function tomorrowISODate(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return json({ error: "Unauthorized" }, 401);
    }
    const userId = claimsData.claims.sub as string;

    const apiKey = Deno.env.get("ASAAS_API_KEY");
    if (!apiKey) {
      console.error("asaas-checkout: ASAAS_API_KEY missing");
      return json({ error: "Integração Asaas não configurada." }, 500);
    }

    // Service-role client para escrever em profiles sem depender de RLS.
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: profile, error: profileErr } = await admin
      .from("profiles")
      .select(
        "id, full_name, email, cpf_cnpj, asaas_customer_id, asaas_subscription_id, subscription_status",
      )
      .eq("id", userId)
      .maybeSingle();

    if (profileErr || !profile) {
      console.error("asaas-checkout: profile lookup error", profileErr);
      return json({ error: "Perfil não encontrado." }, 404);
    }

    const cpfCnpj = (profile.cpf_cnpj ?? "").toString().replace(/\D/g, "");
    if (cpfCnpj.length !== 11 && cpfCnpj.length !== 14) {
      return json(
        { error: "CPF/CNPJ obrigatório. Preencha em Configurações antes de assinar." },
        400,
      );
    }

    const baseUrl = asaasBaseUrl();
    const asaasHeaders = {
      "Content-Type": "application/json",
      access_token: apiKey,
    };

    // 1) Garante Customer ----------------------------------------------------
    let customerId = profile.asaas_customer_id ?? null;
    if (!customerId) {
      const name = (profile.full_name ?? profile.email ?? "Cliente PixelSafe").toString();
      const email = (profile.email ?? "").toString();
      if (!email) {
        return json({ error: "Perfil sem e-mail. Atualize seu perfil antes de assinar." }, 400);
      }

      const custRes = await fetch(`${baseUrl}/customers`, {
        method: "POST",
        headers: asaasHeaders,
        body: JSON.stringify({
          name,
          email,
          externalReference: userId,
        }),
      });
      const custData = await custRes.json().catch(() => ({}));
      if (!custRes.ok || !custData?.id) {
        console.error("asaas-checkout: create customer failed", custRes.status, custData);
        return json({ error: "Falha ao criar cliente no Asaas." }, 502);
      }
      customerId = custData.id as string;

      const { error: updErr } = await admin
        .from("profiles")
        .update({ asaas_customer_id: customerId })
        .eq("id", userId);
      if (updErr) console.error("asaas-checkout: persist customer_id error", updErr);
    }

    // 2) Garante Subscription -----------------------------------------------
    let subscriptionId = profile.asaas_subscription_id ?? null;
    if (!subscriptionId) {
      const subRes = await fetch(`${baseUrl}/subscriptions`, {
        method: "POST",
        headers: asaasHeaders,
        body: JSON.stringify({
          customer: customerId,
          billingType: "UNDEFINED",
          value: PLAN_VALUE,
          nextDueDate: tomorrowISODate(),
          cycle: "MONTHLY",
          description: PLAN_DESCRIPTION,
          externalReference: userId,
        }),
      });
      const subData = await subRes.json().catch(() => ({}));
      if (!subRes.ok || !subData?.id) {
        console.error("asaas-checkout: create subscription failed", subRes.status, subData);
        return json({ error: "Falha ao criar assinatura no Asaas." }, 502);
      }
      subscriptionId = subData.id as string;

      const { error: updErr } = await admin
        .from("profiles")
        .update({ asaas_subscription_id: subscriptionId })
        .eq("id", userId);
      if (updErr) console.error("asaas-checkout: persist subscription_id error", updErr);
    }

    // 3) Busca a fatura mais recente para devolver a invoiceUrl --------------
    const payRes = await fetch(
      `${baseUrl}/subscriptions/${encodeURIComponent(subscriptionId)}/payments?limit=10`,
      { headers: asaasHeaders },
    );
    const payData = await payRes.json().catch(() => ({}));
    if (!payRes.ok) {
      console.error("asaas-checkout: list payments failed", payRes.status, payData);
      return json({ error: "Falha ao buscar fatura no Asaas." }, 502);
    }

    const items: Array<{ invoiceUrl?: string; status?: string; dueDate?: string }> =
      Array.isArray(payData?.data) ? payData.data : [];

    // Prioriza faturas em aberto/atrasadas; depois a mais recente.
    const openable = items.find((p) =>
      ["PENDING", "OVERDUE", "AWAITING_RISK_ANALYSIS"].includes((p.status ?? "").toUpperCase()),
    );
    const chosen = openable ?? items[0];
    const invoiceUrl = chosen?.invoiceUrl ?? null;

    if (!invoiceUrl) {
      return json(
        { error: "Assinatura criada, mas a fatura ainda não está disponível. Tente novamente em instantes." },
        202,
      );
    }

    return json({
      invoiceUrl,
      customerId,
      subscriptionId,
      alreadyActive: profile.subscription_status === "active",
    });
  } catch (err) {
    console.error("asaas-checkout unexpected error", err);
    return json({ error: "Erro inesperado" }, 500);
  }
});
