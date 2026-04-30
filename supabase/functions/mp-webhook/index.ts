import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

// Webhook público — Mercado Pago não envia JWT.
// Sempre responde 200 para evitar reentrega infinita; erros são apenas logados.
//
// Regra crítica: o MP dispara o webhook em vários estados (pending, in_process,
// approved, rejected...). Só liberamos o cofre se a API confirmar
// status === "approved" E o external_reference bater com o vault_id da URL.

const PUBLIC_APP_URL =
  Deno.env.get("PUBLIC_APP_URL") ?? "https://safe-pixel-forge.lovable.app";
const FROM_EMAIL = "PixelSafe <suporte@pixelsafe.com.br>";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildEmailHtml(title: string, link: string): string {
  const safeTitle = escapeHtml(title);
  return `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;padding:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f7;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;padding:32px;max-width:480px;">
            <tr><td>
              <h1 style="margin:0 0 12px;font-size:20px;color:#0a0a0a;">Pagamento confirmado 🔓</h1>
              <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#4b5563;">
                Recebemos seu pagamento e o arquivo <strong>${safeTitle}</strong> já está liberado para download.
              </p>
              <p style="margin:0 0 24px;">
                <a href="${link}" style="display:inline-block;background:#0a0a0a;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-size:14px;font-weight:600;">
                  Acessar e baixar arquivo
                </a>
              </p>
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                Se o botão não funcionar, copie e cole este link no navegador:<br/>
                <span style="color:#6b7280;">${link}</span>
              </p>
            </td></tr>
          </table>
          <p style="margin:16px 0 0;font-size:11px;color:#9ca3af;">PixelSafe · Entrega segura de arquivos</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function ok() {
  return new Response("ok", { status: 200 });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS" || req.method === "GET") {
    return ok();
  }

  try {
    const url = new URL(req.url);
    const vaultId = url.searchParams.get("vault_id");

    let body: Record<string, unknown> = {};
    try {
      const raw = await req.text();
      if (raw) body = JSON.parse(raw);
    } catch (_e) {
      body = {};
    }

    if (!vaultId) {
      console.warn("mp-webhook: missing vault_id in query");
      return ok();
    }

    // O MP envia notificações para diversos tópicos (payment, merchant_order, plan...).
    // Só nos interessa "payment".
    const type =
      (body.type as string | undefined) ??
      (body.topic as string | undefined) ??
      (typeof body.action === "string"
        ? (body.action as string).split(".")[0]
        : undefined);

    if (type !== "payment") {
      console.log("mp-webhook: ignoring non-payment notification", { type, vaultId });
      return ok();
    }

    const data = body.data as { id?: string | number } | undefined;
    const paymentId = data?.id ? String(data.id) : null;
    if (!paymentId) {
      console.warn("mp-webhook: payment notification without data.id", vaultId);
      return ok();
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Busca dono do cofre para resolver o access_token correto.
    const { data: vaultRow, error: vaultErr } = await supabase
      .from("vaults")
      .select("id, owner_id, status")
      .eq("id", vaultId)
      .maybeSingle();

    if (vaultErr) {
      console.error("mp-webhook: vault lookup error", vaultErr);
      return ok();
    }
    if (!vaultRow) {
      console.warn("mp-webhook: vault not found", vaultId);
      return ok();
    }
    if (vaultRow.status === "paid") {
      console.log("mp-webhook: vault already paid, skipping", vaultId);
      return ok();
    }

    const { data: workspace, error: wsErr } = await supabase
      .from("workspaces")
      .select("mp_access_token")
      .eq("owner_id", vaultRow.owner_id)
      .maybeSingle();

    if (wsErr || !workspace?.mp_access_token) {
      console.error("mp-webhook: missing access token for owner", vaultRow.owner_id, wsErr);
      return ok();
    }

    // Validação real do pagamento na API do Mercado Pago.
    const mpRes = await fetch(
      `https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`,
      {
        headers: {
          Authorization: `Bearer ${workspace.mp_access_token}`,
        },
      },
    );

    if (!mpRes.ok) {
      const errBody = await mpRes.text().catch(() => "");
      console.error("mp-webhook: MP payment lookup failed", mpRes.status, errBody);
      return ok();
    }

    const payment = await mpRes.json().catch(() => null) as
      | { status?: string; external_reference?: string }
      | null;

    if (!payment) {
      console.error("mp-webhook: invalid MP response");
      return ok();
    }

    // Cross-check: external_reference precisa bater com o vault_id (anti-spoof).
    if (payment.external_reference && payment.external_reference !== vaultId) {
      console.warn("mp-webhook: external_reference mismatch", {
        expected: vaultId,
        got: payment.external_reference,
      });
      return ok();
    }

    if (payment.status !== "approved") {
      console.log("mp-webhook: payment not approved yet", {
        vaultId,
        paymentId,
        status: payment.status,
      });
      return ok();
    }

    // Idempotente: só atualiza (e devolve linha) se ainda estava pendente.
    // Sobrescreve expires_at para 7 dias a partir da confirmação (regra do pagante).
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: updated, error: updErr } = await supabase
      .from("vaults")
      .update({ status: "paid", expires_at: newExpiresAt })
      .eq("id", vaultId)
      .neq("status", "paid")
      .select("title, client_email, public_slug")
      .maybeSingle();

    if (updErr) {
      console.error("mp-webhook: update error", updErr);
      return ok();
    }
    if (!updated) {
      console.log("mp-webhook: race — vault already paid", vaultId);
      return ok();
    }

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      console.error("mp-webhook: RESEND_API_KEY missing");
      return ok();
    }
    if (!updated.client_email) {
      console.warn("mp-webhook: vault has no client_email", vaultId);
      return ok();
    }

    const link = `${PUBLIC_APP_URL}/pay/${updated.public_slug}`;
    const subject = `Seu arquivo "${updated.title}" está liberado! 🔓`;

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [updated.client_email],
        subject,
        html: buildEmailHtml(updated.title, link),
      }),
    });

    if (!resendRes.ok) {
      const errBody = await resendRes.text().catch(() => "");
      console.error("mp-webhook: resend error", resendRes.status, errBody);
    } else {
      await resendRes.text().catch(() => "");
      console.log("mp-webhook: release email sent", vaultId);
    }

    return ok();
  } catch (err) {
    console.error("mp-webhook: unexpected error", err);
    return ok();
  }
});
