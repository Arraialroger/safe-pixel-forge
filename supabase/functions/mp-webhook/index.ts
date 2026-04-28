import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

// Webhook público — Mercado Pago não envia JWT.
// Sempre responde 200 para evitar reentrega infinita; erros são apenas logados.

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS" || req.method === "GET") {
    return new Response("ok", { status: 200 });
  }

  try {
    const url = new URL(req.url);
    const vaultId = url.searchParams.get("vault_id");

    // Drena o body para evitar resource leak; conteúdo é ignorado.
    await req.text().catch(() => "");

    if (!vaultId) {
      console.warn("mp-webhook: missing vault_id");
      return new Response("ok", { status: 200 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Idempotente: só atualiza (e devolve linha) se ainda estava pendente.
    const { data: updated, error: updErr } = await supabase
      .from("vaults")
      .update({ status: "paid" })
      .eq("id", vaultId)
      .neq("status", "paid")
      .select("title, client_email, public_slug")
      .maybeSingle();

    if (updErr) {
      console.error("mp-webhook: update error", updErr);
      return new Response("ok", { status: 200 });
    }

    if (!updated) {
      console.log("mp-webhook: vault already paid or not found", vaultId);
      return new Response("ok", { status: 200 });
    }

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      console.error("mp-webhook: RESEND_API_KEY missing");
      return new Response("ok", { status: 200 });
    }

    if (!updated.client_email) {
      console.warn("mp-webhook: vault has no client_email", vaultId);
      return new Response("ok", { status: 200 });
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

    return new Response("ok", { status: 200 });
  } catch (err) {
    console.error("mp-webhook: unexpected error", err);
    return new Response("ok", { status: 200 });
  }
});
