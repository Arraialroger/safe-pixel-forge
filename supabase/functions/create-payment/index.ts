import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { z } from "npm:zod@3.23.8";

const BodySchema = z.object({
  vault_id: z.string().uuid(),
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const parsed = BodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return json({ error: "vault_id inválido" }, 400);
    }
    const { vault_id } = parsed.data;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: vault, error: vaultErr } = await supabase
      .from("vaults")
      .select("id, owner_id, title, price, status, public_slug")
      .eq("id", vault_id)
      .maybeSingle();

    if (vaultErr) {
      console.error("vault lookup error", vaultErr);
      return json({ error: "Erro ao buscar cofre" }, 500);
    }
    if (!vault) return json({ error: "Cofre não encontrado" }, 404);
    if (vault.status === "paid") {
      return json({ error: "Cofre já foi pago" }, 409);
    }

    const { data: workspace, error: wsErr } = await supabase
      .from("workspaces")
      .select("mp_access_token")
      .eq("owner_id", vault.owner_id)
      .maybeSingle();

    if (wsErr) {
      console.error("workspace lookup error", wsErr);
      return json({ error: "Erro ao buscar credenciais do vendedor" }, 500);
    }
    if (!workspace?.mp_access_token) {
      return json(
        { error: "Vendedor ainda não conectou o Mercado Pago." },
        400,
      );
    }

    const origin =
      req.headers.get("origin") ?? `https://${vault.public_slug}.lovable.app`;

    const preferenceBody = {
      items: [
        {
          title: vault.title,
          quantity: 1,
          currency_id: "BRL",
          unit_price: Number(vault.price),
        },
      ],
      external_reference: vault.id,
      back_urls: {
        success: `${origin}/pay/${vault.public_slug}?status=success`,
        failure: `${origin}/pay/${vault.public_slug}?status=failure`,
        pending: `${origin}/pay/${vault.public_slug}?status=pending`,
      },
      auto_return: "approved",
    };

    const mpRes = await fetch(
      "https://api.mercadopago.com/checkout/preferences",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${workspace.mp_access_token}`,
        },
        body: JSON.stringify(preferenceBody),
      },
    );

    const mpData = await mpRes.json().catch(() => ({}));

    if (!mpRes.ok) {
      console.error("Mercado Pago error", mpRes.status, mpData);
      return json(
        { error: "Falha ao criar preferência no Mercado Pago" },
        502,
      );
    }

    return json({
      init_point: mpData.init_point,
      preference_id: mpData.id,
    });
  } catch (err) {
    console.error("create-payment unexpected error", err);
    return json({ error: "Erro inesperado" }, 500);
  }
});
