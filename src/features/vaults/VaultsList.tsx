import { useQuery } from "@tanstack/react-query";
import { VaultRow, VAULT_GRID_COLS } from "@/components/VaultRow";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import type { Vault } from "@/data/mockVaults";

interface SignatureRow {
  vault_id: string;
  metadata: { ip?: string } | null;
}

interface VaultsListProps {
  vaults: Vault[];
}

export function VaultsList({ vaults }: VaultsListProps) {
  const vaultIds = vaults.map((v) => v.id);

  const { data: signatures } = useQuery({
    queryKey: ["vault-signatures", vaultIds.length],
    enabled: vaultIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vault_events")
        .select("vault_id, metadata")
        .eq("event_type", "digital_signature_accepted")
        .in("vault_id", vaultIds);
      if (error) throw error;
      return data as unknown as SignatureRow[];
    },
  });

  const signatureMap = new Map<string, string | null>();
  signatures?.forEach((s) => {
    signatureMap.set(s.vault_id, s.metadata?.ip ?? null);
  });

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <div
        className={cn(
          "hidden gap-3 border-b border-border bg-muted/30 px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground md:grid",
          VAULT_GRID_COLS,
        )}
      >
        <span>Status</span>
        <span>Projeto / Cliente</span>
        <span className="text-right">Valor</span>
        <span className="text-right">Expira</span>
        <span className="text-center">Assinatura</span>
        <span className="text-right">Ações</span>
      </div>

      <div className="space-y-3 p-3 md:space-y-0 md:p-0">
        {vaults.map((v) => (
          <VaultRow
            key={v.id}
            vault={v}
            signatureIp={
              signatureMap.has(v.id) ? signatureMap.get(v.id) ?? null : undefined
            }
          />
        ))}
      </div>
    </section>
  );
}
