// Helper compartilhado para envio de e-mails via Resend.
// Mantém o boilerplate HTML em um único lugar para evitar duplicação.

const FROM_EMAIL = "PixelSafe <suporte@pixelsafe.com.br>";
const PUBLIC_APP_URL =
  Deno.env.get("PUBLIC_APP_URL") ?? "https://safe-pixel-forge.lovable.app";

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

interface EmailLayoutOptions {
  heading: string;
  bodyHtml: string; // HTML interno (já sanitizado pelo chamador)
  ctaLabel?: string;
  ctaUrl?: string;
  secondaryCtaLabel?: string;
  secondaryCtaUrl?: string;
  footerNote?: string;
}

function buildLayout({ heading, bodyHtml, ctaLabel, ctaUrl, secondaryCtaLabel, secondaryCtaUrl, footerNote }: EmailLayoutOptions): string {
  const ctaBlock = ctaLabel && ctaUrl
    ? `<p style="margin:0 0 12px;">
        <a href="${ctaUrl}" style="display:inline-block;background:#0a0a0a;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-size:14px;font-weight:600;">
          ${escapeHtml(ctaLabel)}
        </a>
      </p>`
    : "";

  const secondaryCtaBlock = secondaryCtaLabel && secondaryCtaUrl
    ? `<p style="margin:0 0 16px;">
        <a href="${secondaryCtaUrl}" style="display:inline-block;background:#ffffff;color:#0a0a0a;text-decoration:none;padding:11px 19px;border:1px solid #e5e7eb;border-radius:8px;font-size:14px;font-weight:600;">
          ${escapeHtml(secondaryCtaLabel)}
        </a>
      </p>`
    : "";

  const linkHelp = ctaUrl
    ? `<p style="margin:0 0 8px;font-size:12px;color:#9ca3af;">
        Se o botão não funcionar, copie e cole este link no navegador:<br/>
        <span style="color:#6b7280;">${ctaUrl}</span>
      </p>`
    : "";

  const footerBlock = footerNote
    ? `<p style="margin:16px 0 0;font-size:12px;color:#9ca3af;">${footerNote}</p>`
    : "";

  return `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;padding:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f7;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;padding:32px;max-width:480px;">
            <tr><td>
              <h1 style="margin:0 0 12px;font-size:20px;color:#0a0a0a;">${escapeHtml(heading)}</h1>
              ${bodyHtml}
              ${ctaBlock}
              ${secondaryCtaBlock}
              ${linkHelp}
              ${footerBlock}
            </td></tr>
          </table>
          <p style="margin:16px 0 0;font-size:11px;color:#9ca3af;">PixelSafe · Entrega segura de arquivos</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

interface SendEmailParams {
  to: string;
  subject: string;
  heading: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
  secondaryCtaLabel?: string;
  secondaryCtaUrl?: string;
  footerNote?: string;
}

export async function sendResendEmail(params: SendEmailParams): Promise<{ ok: boolean; status: number; error?: string }> {
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) {
    return { ok: false, status: 0, error: "RESEND_API_KEY missing" };
  }

  const html = buildLayout({
    heading: params.heading,
    bodyHtml: params.bodyHtml,
    ctaLabel: params.ctaLabel,
    ctaUrl: params.ctaUrl,
    secondaryCtaLabel: params.secondaryCtaLabel,
    secondaryCtaUrl: params.secondaryCtaUrl,
    footerNote: params.footerNote,
  });

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [params.to],
      subject: params.subject,
      html,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    return { ok: false, status: res.status, error: errBody };
  }
  await res.text().catch(() => "");
  return { ok: true, status: res.status };
}

export { PUBLIC_APP_URL };
