import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { z } from "npm:zod@3.23.8";
import { recordVaultEvent } from "../_shared/events.ts";

// Allowlist: somente eventos passivos do lado público.
// payment_approved e downloaded são gravados internamente (mp-webhook / get-download-url).
const PublicEventEnum = z.enum(["page_viewed", "checkout_started"]);

const BodySchema = z.object({
  vault_id: z.string().uuid(),
  event_type: PublicEventEnum,
});

const DEDUPE_WINDOW_SECONDS = 60;

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
      return json({ error: "Payload inválido" }, 400);
    }
    const { vault_id, event_type } = parsed.data;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Confere existência do cofre antes de inserir (não vaza info: sempre 200).
    const { data: vault, error: vaultErr } = await supabase
      .from("vaults")
      .select("id")
      .eq("id", vault_id)
      .maybeSingle();

    if (vaultErr) {
      console.error("log-vault-event: vault lookup error", vaultErr);
      return json({ ok: true });
    }
    if (!vault) {
      console.warn("log-vault-event: vault not found", vault_id);
      return json({ ok: true });
    }

    // Dedupe: ignora o mesmo event_type para o mesmo vault dentro de 60s.
    const cutoff = new Date(Date.now() - DEDUPE_WINDOW_SECONDS * 1000).toISOString();
    const { data: recent, error: recentErr } = await supabase
      .from("vault_events")
      .select("id")
      .eq("vault_id", vault_id)
      .eq("event_type", event_type)
      .gte("created_at", cutoff)
      .limit(1)
      .maybeSingle();

    if (recentErr) {
      console.error("log-vault-event: dedupe lookup error", recentErr);
    } else if (recent) {
      return json({ ok: true, deduped: true });
    }

    await recordVaultEvent(supabase, vault_id, event_type);
    return json({ ok: true });
  } catch (err) {
    console.error("log-vault-event: unexpected error", err);
    return json({ ok: true });
  }
});
