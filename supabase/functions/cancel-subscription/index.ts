import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

// Edge Function: cancel-subscription
// Cancela a assinatura PixelSafe Pro do usuário autenticado no Asaas
// e marca o subscription_status como 'inactive' (volta ao plano PayGo).

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
      console.error("cancel-subscription: ASAAS_API_KEY missing");
      return json({ error: "Integração Asaas não configurada." }, 500);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: profile, error: profileErr } = await admin
      .from("profiles")
      .select("asaas_subscription_id, subscription_status")
      .eq("id", userId)
      .maybeSingle();

    if (profileErr || !profile) {
      console.error("cancel-subscription: profile lookup error", profileErr);
      return json({ error: "Perfil não encontrado." }, 404);
    }

    const subscriptionId = profile.asaas_subscription_id;
    if (!subscriptionId) {
      return json({ error: "Sem assinatura ativa para cancelar." }, 400);
    }

    // DELETE no Asaas — 404 é tratado como sucesso idempotente.
    const delRes = await fetch(
      `${asaasBaseUrl()}/subscriptions/${encodeURIComponent(subscriptionId)}`,
      {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          access_token: apiKey,
        },
      },
    );

    if (!delRes.ok && delRes.status !== 404) {
      const errBody = await delRes.json().catch(() => ({}));
      console.error("cancel-subscription: Asaas DELETE failed", delRes.status, errBody);
      return json({ error: "Falha ao cancelar assinatura no Asaas." }, 502);
    }

    const { error: updErr } = await admin
      .from("profiles")
      .update({ subscription_status: "inactive" })
      .eq("id", userId);

    if (updErr) {
      console.error("cancel-subscription: status update error", updErr);
      return json({ error: "Cancelado no Asaas, mas falha ao atualizar status local." }, 500);
    }

    return json({ success: true });
  } catch (err) {
    console.error("cancel-subscription unexpected error", err);
    return json({ error: "Erro inesperado" }, 500);
  }
});
