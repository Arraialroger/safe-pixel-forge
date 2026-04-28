import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { z } from "npm:zod@3.23.8";

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
      .select("id, status, file_path")
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

    return json({ signed_url: signed.signedUrl });
  } catch (err) {
    console.error("get-download-url: unexpected error", err);
    return json({ error: "Erro inesperado" }, 500);
  }
});
