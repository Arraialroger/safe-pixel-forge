import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { z } from "npm:zod@3.23.8";
import { sendResendEmail, escapeHtml, PUBLIC_APP_URL } from "../_shared/resend.ts";
import { recordVaultEvent } from "../_shared/events.ts";

const BodySchema = z.object({
  slug: z.string().min(1).max(64),
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
      return json({ error: "slug inválido" }, 400);
    }
    const { slug } = parsed.data;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: vault, error } = await supabase
      .from("vaults")
      .select("id, status, file_path, downloaded_at, owner_id, client_name, title")
      .eq("public_slug", slug)
      .maybeSingle();

    if (error) {
      console.error("get-download-url: lookup error", error);
      return json({ error: "Erro ao buscar cofre" }, 500);
    }
    if (!vault) return json({ error: "Cofre não encontrado" }, 404);
    if (vault.status !== "paid") {
      return json({ error: "Pagamento não confirmado" }, 403);
    }
    if (!vault.file_path) {
      return json({ error: "Arquivo não disponível" }, 409);
    }

    const { data: signed, error: signErr } = await supabase.storage
      .from("vault-files")
      .createSignedUrl(vault.file_path, 900);

    if (signErr || !signed?.signedUrl) {
      console.error("get-download-url: sign error", signErr);
      return json({ error: "Falha ao gerar link de download" }, 500);
    }

    // Trava atômica: só marca como baixado (e dispara e-mail) se ainda não tinha sido.
    // O UPDATE com .neq garante que apenas UMA chamada ganha a corrida.
    if (!vault.downloaded_at) {
      const nowIso = new Date().toISOString();
      const { data: claimed, error: claimErr } = await supabase
        .from("vaults")
        .update({ downloaded_at: nowIso })
        .eq("id", vault.id)
        .is("downloaded_at", null)
        .select("id")
        .maybeSingle();

      if (claimErr) {
        console.error("get-download-url: claim error", claimErr);
      } else if (claimed) {
        // Ganhamos a corrida: registra evento de download e envia e-mail ao profissional.
        await recordVaultEvent(supabase, vault.id, "downloaded");
        try {
          const { data: ownerProfile, error: profErr } = await supabase
            .from("profiles")
            .select("email, full_name")
            .eq("id", vault.owner_id)
            .maybeSingle();

          if (profErr) {
            console.error("get-download-url: owner profile lookup error", profErr);
          } else if (ownerProfile?.email) {
            const dashboardUrl = `${PUBLIC_APP_URL}/dashboard`;
            const safeTitle = escapeHtml(vault.title);
            const safeClient = escapeHtml(vault.client_name);
            const greeting = ownerProfile.full_name
              ? `Olá, ${escapeHtml(ownerProfile.full_name.split(" ")[0])}! 📥`
              : "Arquivo entregue! 📥";

            const result = await sendResendEmail({
              to: ownerProfile.email,
              subject: `📥 Cliente baixou: ${vault.title}`,
              heading: greeting,
              bodyHtml: `<p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#4b5563;">
                  Seu cliente <strong>${safeClient}</strong> acabou de realizar o primeiro download do arquivo <strong>${safeTitle}</strong>.
                </p>
                <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#4b5563;">
                  Entrega concluída com sucesso! ✅
                </p>`,
              ctaLabel: "Ver no Dashboard",
              ctaUrl: dashboardUrl,
            });
            if (!result.ok) {
              console.error("get-download-url: owner email failed", result.status, result.error);
            } else {
              console.log("get-download-url: owner download email sent", vault.id);
            }
          } else {
            console.warn("get-download-url: owner has no email", vault.owner_id);
          }
        } catch (mailErr) {
          console.error("get-download-url: email unexpected error", mailErr);
        }
      } else {
        // Outra requisição venceu a corrida — apenas log, sem reenviar e-mail.
        console.log("get-download-url: download already claimed by concurrent request", vault.id);
      }
    }

    return json({ signed_url: signed.signedUrl });
  } catch (err) {
    console.error("get-download-url: unexpected error", err);
    return json({ error: "Erro inesperado" }, 500);
  }
});
