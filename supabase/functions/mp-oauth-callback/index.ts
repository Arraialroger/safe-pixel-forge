import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

// Endpoint público — não exige JWT.
// Recebe ?code=...&state=<auth.uid()> do Mercado Pago,
// troca o code por tokens e grava no workspace do usuário (state).

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state"); // nonce de oauth_states
  const errorParam = url.searchParams.get("error");

  const appUrl =
    Deno.env.get("PUBLIC_APP_URL") ?? "https://app.pixelsafe.com.br";
  const redirectOk = `${appUrl}/configuracoes?mp_connected=true`;
  const redirectFail = `${appUrl}/configuracoes?mp_connected=false`;

  if (errorParam || !code || !state) {
    console.error("mp-oauth-callback missing params", { errorParam, hasCode: !!code, hasState: !!state });
    return Response.redirect(redirectFail, 302);
  }

  try {
    const clientId = Deno.env.get("MP_CLIENT_ID")!;
    const clientSecret = Deno.env.get("MP_CLIENT_SECRET")!;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const redirectUri = `${supabaseUrl}/functions/v1/mp-oauth-callback`;

    const admin = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1) Valida e consome o nonce (uso único, anti-CSRF).
    // UUID v4 sanity check para evitar erros de cast no .eq().
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRe.test(state)) {
      console.warn("mp-oauth-callback: state not a uuid");
      return Response.redirect(redirectFail, 302);
    }

    const { data: stateRow, error: stateErr } = await admin
      .from("oauth_states")
      .delete()
      .eq("nonce", state)
      .select("owner_id, expires_at")
      .maybeSingle();

    if (stateErr || !stateRow) {
      console.warn("mp-oauth-callback: invalid/used state", stateErr);
      return Response.redirect(redirectFail, 302);
    }
    if (new Date(stateRow.expires_at).getTime() < Date.now()) {
      console.warn("mp-oauth-callback: state expired");
      return Response.redirect(redirectFail, 302);
    }
    const ownerId = stateRow.owner_id as string;

    const tokenRes = await fetch("https://api.mercadopago.com/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }).toString(),
    });

    const tokenData = await tokenRes.json().catch(() => ({}));
    if (!tokenRes.ok) {
      console.error("MP oauth token error", tokenRes.status, tokenData);
      return Response.redirect(redirectFail, 302);
    }

    const access_token: string | undefined = tokenData.access_token;
    const refresh_token: string | undefined = tokenData.refresh_token;
    const public_key: string | undefined = tokenData.public_key;
    const user_id = tokenData.user_id != null ? String(tokenData.user_id) : null;

    if (!access_token) {
      console.error("MP oauth missing access_token", tokenData);
      return Response.redirect(redirectFail, 302);
    }

    const admin = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Atualiza dados não-sensíveis no workspace e recupera o id.
    const { data: ws, error: updErr } = await admin
      .from("workspaces")
      .update({
        mp_public_key: public_key ?? null,
        mp_user_id: user_id,
      })
      .eq("owner_id", state)
      .select("id")
      .maybeSingle();

    if (updErr || !ws) {
      console.error("workspace update error", updErr);
      return Response.redirect(redirectFail, 302);
    }

    // Grava tokens sensíveis na tabela segregada (RLS bloqueia o frontend).
    const { error: secErr } = await admin
      .from("workspace_secrets")
      .upsert({
        workspace_id: ws.id,
        mp_access_token: access_token,
        mp_refresh_token: refresh_token ?? null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "workspace_id" });

    if (secErr) {
      console.error("workspace_secrets upsert error", secErr);
      return Response.redirect(redirectFail, 302);
    }

    return Response.redirect(redirectOk, 302);
  } catch (err) {
    console.error("mp-oauth-callback unexpected error", err);
    return Response.redirect(redirectFail, 302);
  }
});
