// Helper compartilhado para registrar eventos do cofre (vault_events).
// Usado pelas edge functions internas (mp-webhook, get-download-url) com service_role.
// Eventos públicos (page_viewed, checkout_started) passam pela função `log-vault-event`.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

export type VaultEventType =
  | "page_viewed"
  | "checkout_started"
  | "payment_approved"
  | "downloaded";

export async function recordVaultEvent(
  supabase: SupabaseClient,
  vaultId: string,
  eventType: VaultEventType,
): Promise<void> {
  const { error } = await supabase
    .from("vault_events")
    .insert({ vault_id: vaultId, event_type: eventType });
  if (error) {
    console.error(`recordVaultEvent: failed to insert ${eventType} for ${vaultId}`, error);
  }
}
