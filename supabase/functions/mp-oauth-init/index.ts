import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

// Função autenticada. Gera um nonce server-side em oauth_states e devolve a URL
// de autorização do Mercado Pago com state=nonce (anti-CSRF, sem expor auth.uid()).

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "missing auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const clientId = Deno.env.get("MP_CLIENT_ID");

    if (!clientId) {
      console.error("mp-oauth-init: MP_CLIENT_ID missing");
      return new Response(JSON.stringify({ error: "server misconfigured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceRole);

    const token = authHeader.replace(/^Bearer\s+/i, "");
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user?.id) {
      return new Response(JSON.stringify({ error: "invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ownerId = userData.user.id;

    // Limpeza oportunista de nonces expirados deste usuário.
    await admin
      .from("oauth_states")
      .delete()
      .eq("owner_id", ownerId)
      .lt("expires_at", new Date().toISOString());

    const { data: inserted, error: insErr } = await admin
      .from("oauth_states")
      .insert({ owner_id: ownerId })
      .select("nonce")
      .single();

    if (insErr || !inserted?.nonce) {
      console.error("mp-oauth-init: insert failed", insErr);
      return new Response(JSON.stringify({ error: "failed to create state" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const redirectUri = `${supabaseUrl}/functions/v1/mp-oauth-callback`;
    const authUrl =
      `https://auth.mercadopago.com.br/authorization` +
      `?client_id=${encodeURIComponent(clientId)}` +
      `&response_type=code` +
      `&platform_id=mp` +
      `&state=${encodeURIComponent(inserted.nonce)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}`;

    return new Response(JSON.stringify({ authUrl }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("mp-oauth-init: unexpected", err);
    return new Response(JSON.stringify({ error: "unexpected" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
