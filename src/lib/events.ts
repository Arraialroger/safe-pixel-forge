import { supabase } from "@/integrations/supabase/client";

export type PublicVaultEventType = "page_viewed" | "checkout_started";

/**
 * Dispara um evento público (fire-and-forget) para a Edge Function `log-vault-event`.
 * Nunca lança — falhas são apenas logadas no console para não quebrar a UX do checkout.
 */
export async function logVaultEvent(
  vaultId: string,
  eventType: PublicVaultEventType,
): Promise<void> {
  try {
    const { error } = await supabase.functions.invoke("log-vault-event", {
      body: { vault_id: vaultId, event_type: eventType },
    });
    if (error) {
      console.warn("logVaultEvent failed", eventType, error.message);
    }
  } catch (err) {
    console.warn("logVaultEvent threw", eventType, err);
  }
}
