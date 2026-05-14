import { useQuery } from "@tanstack/react-query";
import { VaultRow, VAULT_GRID_COLS } from "@/components/VaultRow";
import { cn } from "@/lib/utils";
import { NewVaultDialog } from "@/components/NewVaultDialog";
import { StatsCards } from "@/components/StatsCards";
import { EmptyVaults } from "@/components/EmptyVaults";
import { supabase } from "@/integrations/supabase/client";
import { useAuthReady } from "@/hooks/useAuthReady";
import { Vault } from "@/data/mockVaults";

interface SignatureRow {
  vault_id: string;
  metadata: { ip?: string } | null;
}

export default function Vaults() {
  const { user, isReady } = useAuthReady();

  const { data: vaults, isLoading, isError } = useQuery({
    queryKey: ["vaults", user?.id],
    enabled: isReady && !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vaults")
        .select("*")
        .eq("owner_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Vault[];
    },
  });

  const vaultIds = vaults?.map((v) => v.id) ?? [];

  const { data: signatures } = useQuery({
    queryKey: ["vault-signatures", user?.id, vaultIds.length],
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
    <div className="space-y-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Cofres
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gestão completa das suas entregas e cobranças.
          </p>
        </div>
        <div className="w-full sm:w-auto">
          <NewVaultDialog />
        </div>
      </header>

      {!isLoading && vaults && vaults.length > 0 && <StatsCards vaults={vaults} />}

      {isLoading && (
        <div className="rounded-2xl border border-border bg-card p-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-14 animate-pulse border-b border-border last:border-b-0"
            />
          ))}
        </div>
      )}

      {isError && (
        <p className="text-sm text-destructive">
          Não foi possível carregar seus cofres. Tente novamente.
        </p>
      )}

      {!isLoading && !isError && vaults && vaults.length === 0 && <EmptyVaults />}

      {!isLoading && vaults && vaults.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-border bg-card">
          {/* Header só no desktop */}
          <div className="hidden grid-cols-[110px_minmax(0,1fr)_120px_90px_90px_180px_auto] gap-3 border-b border-border bg-muted/30 px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground md:grid">
            <span>Status</span>
            <span>Projeto / Cliente</span>
            <span>Valor</span>
            <span>Criado</span>
            <span>Expira</span>
            <span>Assinatura</span>
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
      )}
    </div>
  );
}
