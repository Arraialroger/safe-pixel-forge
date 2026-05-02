import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { sendResendEmail, escapeHtml, PUBLIC_APP_URL } from "../_shared/resend.ts";
import { recordVaultEvent } from "../_shared/events.ts";

// Webhook público — Mercado Pago não envia JWT.
// Sempre responde 200 para evitar reentrega infinita; erros são apenas logados.

function ok() {
  return new Response("ok", { status: 200 });
}

function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
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

    const mpRes = await fetch(
      `https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`,
      {
        headers: { Authorization: `Bearer ${workspace.mp_access_token}` },
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

    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: updated, error: updErr } = await supabase
      .from("vaults")
      .update({ status: "paid", expires_at: newExpiresAt })
      .eq("id", vaultId)
      .neq("status", "paid")
      .select("title, client_email, client_name, public_slug, owner_id, price")
      .maybeSingle();

    if (updErr) {
      console.error("mp-webhook: update error", updErr);
      return ok();
    }
    if (!updated) {
      console.log("mp-webhook: race — vault already paid", vaultId);
      return ok();
    }

    // Registra evento de pagamento aprovado (após o UPDATE atômico).
    await recordVaultEvent(supabase, vaultId, "payment_approved");


    // 1) E-mail para o CLIENTE (já existia)
    if (updated.client_email) {
      const link = `${PUBLIC_APP_URL}/pay/${updated.public_slug}`;
      const safeTitle = escapeHtml(updated.title);
      const result = await sendResendEmail({
        to: updated.client_email,
        subject: `Seu arquivo "${updated.title}" está liberado! 🔓`,
        heading: "Pagamento confirmado 🔓",
        bodyHtml: `<p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#4b5563;">
          Recebemos seu pagamento e o arquivo <strong>${safeTitle}</strong> já está liberado para download.
        </p>`,
        ctaLabel: "Acessar e baixar arquivo",
        ctaUrl: link,
      });
      if (!result.ok) {
        console.error("mp-webhook: client email failed", result.status, result.error);
      } else {
        console.log("mp-webhook: client release email sent", vaultId);
      }
    } else {
      console.warn("mp-webhook: vault has no client_email", vaultId);
    }

    // 2) E-mail para o PROFISSIONAL (dono do cofre)
    try {
      const { data: ownerProfile, error: profErr } = await supabase
        .from("profiles")
        .select("email, full_name")
        .eq("id", updated.owner_id)
        .maybeSingle();

      if (profErr) {
        console.error("mp-webhook: owner profile lookup error", profErr);
      } else if (!ownerProfile?.email) {
        console.warn("mp-webhook: owner has no email", updated.owner_id);
      } else {
        const dashboardUrl = `${PUBLIC_APP_URL}/dashboard`;
        const safeTitle = escapeHtml(updated.title);
        const safeClient = escapeHtml(updated.client_name);
        const priceStr = formatBRL(Number(updated.price));
        const greeting = ownerProfile.full_name
          ? `Olá, ${escapeHtml(ownerProfile.full_name.split(" ")[0])}! 💸`
          : "Pix recebido! 💸";

        const result = await sendResendEmail({
          to: ownerProfile.email,
          subject: `💸 Pix recebido: ${updated.title} (${priceStr})`,
          heading: greeting,
          bodyHtml: `<p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#4b5563;">
              O pagamento do cofre <strong>${safeTitle}</strong> foi confirmado.
            </p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:8px;padding:16px;margin:0 0 24px;">
              <tr><td style="font-size:13px;color:#4b5563;line-height:1.8;">
                <strong>Cliente:</strong> ${safeClient}<br/>
                <strong>Valor:</strong> ${priceStr}<br/>
                <strong>Cofre:</strong> ${safeTitle}
              </td></tr>
            </table>`,
          ctaLabel: "Ver no Dashboard",
          ctaUrl: dashboardUrl,
          footerNote: "Você receberá outro aviso quando o cliente baixar o arquivo.",
        });
        if (!result.ok) {
          console.error("mp-webhook: owner email failed", result.status, result.error);
        } else {
          console.log("mp-webhook: owner payment email sent", vaultId);
        }
      }
    } catch (ownerErr) {
      console.error("mp-webhook: owner email unexpected error", ownerErr);
    }

    return ok();
  } catch (err) {
    console.error("mp-webhook: unexpected error", err);
    return ok();
  }
});
