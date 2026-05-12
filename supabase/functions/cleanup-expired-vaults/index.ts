import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cleanup-secret",
};

const BUCKET = "vault-files";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // --- Auth: shared secret ---
    const expected = Deno.env.get("CLEANUP_SECRET");
    if (!expected) {
      console.error("CLEANUP_SECRET not configured");
      return new Response(
        JSON.stringify({ error: "Server misconfigured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const authHeader = req.headers.get("authorization") ?? "";
    const bearer = authHeader.toLowerCase().startsWith("bearer ")
      ? authHeader.slice(7).trim()
      : "";
    const headerSecret = req.headers.get("x-cleanup-secret") ?? "";
    const provided = bearer || headerSecret;

    if (!provided || provided !== expected) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // --- Sweep: find expired vaults that still have a file_path ---
    const nowIso = new Date().toISOString();
    const { data: expired, error: selectError } = await supabase
      .from("vaults")
      .select("id, file_path")
      .lt("expires_at", nowIso)
      .not("file_path", "is", null);

    if (selectError) {
      console.error("Select error:", selectError);
      return new Response(
        JSON.stringify({ error: "Failed to query vaults", details: selectError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let cleaned = 0;
    const failures: Array<{ id: string; reason: string }> = [];

    for (const vault of expired ?? []) {
      try {
        const { error: removeError } = await supabase
          .storage
          .from(BUCKET)
          .remove([vault.file_path as string]);

        if (removeError) {
          console.error(`Storage remove failed for vault ${vault.id}:`, removeError);
          failures.push({ id: vault.id, reason: removeError.message });
          continue;
        }

        const { error: updateError } = await supabase
          .from("vaults")
          .update({ file_path: null, file_name: null })
          .eq("id", vault.id);

        if (updateError) {
          console.error(`DB update failed for vault ${vault.id}:`, updateError);
          failures.push({ id: vault.id, reason: updateError.message });
          continue;
        }

        cleaned += 1;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`Unexpected error for vault ${vault.id}:`, msg);
        failures.push({ id: vault.id, reason: msg });
      }
    }

    // --- Sweep 2: delete stale drafts (>1h, no file uploaded) ---
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: staleDrafts, error: draftErr } = await supabase
      .from("vaults")
      .select("id")
      .eq("status", "draft")
      .is("file_path", null)
      .lt("created_at", oneHourAgo);

    let draftsDeleted = 0;
    if (draftErr) {
      console.error("Stale drafts query error:", draftErr);
    } else if (staleDrafts && staleDrafts.length > 0) {
      const ids = staleDrafts.map((v) => v.id);
      const { error: delErr } = await supabase
        .from("vaults")
        .delete()
        .in("id", ids);
      if (delErr) {
        console.error("Stale drafts delete error:", delErr);
      } else {
        draftsDeleted = ids.length;
      }
    }

    return new Response(
      JSON.stringify({
        cleaned_vaults: cleaned,
        scanned: expired?.length ?? 0,
        drafts_deleted: draftsDeleted,
        failures,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Fatal error:", msg);
    return new Response(
      JSON.stringify({ error: "Internal error", details: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
