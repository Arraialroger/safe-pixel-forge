import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { z } from "npm:zod@3.23.8";

// Reenvio manual (sob demanda) do e-mail de cofre.
// - Apenas o dono autenticado pode disparar (verify_jwt = true).
// - Branch por status: pending => template de cobrança/liberação,
//                       paid    => template de download liberado.

const PUBLIC_APP_URL =
  Deno.env.get("PUBLIC_APP_URL") ?? "https://safe-pixel-forge.lovable.app";
const FROM_EMAIL = "PixelSafe <suporte@pixelsafe.com.br>";

const BodySchema = z.object({
  vault_id: z.string().uuid(),
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Cofre pendente — equivalente ao template do `send-vault-created`.
function buildPendingHtml(title: string, clientName: string, link: string): string {
  const safeTitle = escapeHtml(title);
  const safeName = escapeHtml(clientName || "");
  const greeting = safeName ? `Olá, ${safeName}!` : "Olá!";
  return `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;padding:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f7;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;padding:32px;max-width:480px;">
            <tr><td>
              <h1 style="margin:0 0 12px;font-size:20px;color:#0a0a0a;">Seu projeto está pronto 🔐</h1>
              <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#4b5563;">
                ${greeting}
              </p>
              <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#4b5563;">
                O arquivo do projeto <strong>${safeTitle}</strong> está disponível para liberação.
                Acesse o link seguro abaixo para concluir o pagamento e baixar imediatamente o seu arquivo.
              </p>
              <p style="margin:0 0 24px;">
                <a href="${link}" style="display:inline-block;background:#0a0a0a;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-size:14px;font-weight:600;">
                  Acessar página segura
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

// Cofre pago — equivalente ao template do `mp-webhook`.
function buildPaidHtml(title: string, link: string): string {
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
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims?.sub) {
      return json({ error: "Unauthorized" }, 401);
    }
    const userId = claimsData.claims.sub as string;

    const parsed = BodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return json({ error: "vault_id inválido" }, 400);
    }
    const { vault_id } = parsed.data;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: vault, error: vaultErr } = await admin
      .from("vaults")
      .select("id, owner_id, title, client_name, client_email, public_slug, status")
      .eq("id", vault_id)
      .maybeSingle();

    if (vaultErr) {
      console.error("resend-vault-email: vault lookup error", vaultErr);
      return json({ error: "Erro ao buscar cofre" }, 500);
    }
    if (!vault) return json({ error: "Cofre não encontrado" }, 404);
    if (vault.owner_id !== userId) {
      return json({ error: "Forbidden" }, 403);
    }
    if (!vault.client_email) {
      return json({ error: "Cliente sem e-mail cadastrado" }, 400);
    }

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      console.error("resend-vault-email: RESEND_API_KEY missing");
      return json({ error: "Configuração de e-mail ausente" }, 500);
    }

    const link = `${PUBLIC_APP_URL}/pay/${vault.public_slug}`;
    const isPaid = vault.status === "paid";
    const subject = isPaid
      ? `Seu arquivo "${vault.title}" está liberado! 🔓`
      : `Arquivo de ${vault.title} disponível para liberação 🔐`;
    const html = isPaid
      ? buildPaidHtml(vault.title, link)
      : buildPendingHtml(vault.title, vault.client_name, link);

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [vault.client_email],
        subject,
        html,
      }),
    });

    if (!resendRes.ok) {
      const errBody = await resendRes.text().catch(() => "");
      console.error("resend-vault-email: resend error", resendRes.status, errBody);
      return json({ error: "Falha ao enviar e-mail" }, 502);
    }

    await resendRes.text().catch(() => "");
    return json({ success: true, kind: isPaid ? "paid" : "pending" });
  } catch (err) {
    console.error("resend-vault-email: unexpected error", err);
    return json({ error: "Erro inesperado" }, 500);
  }
});
