import { useQuery } from "@tanstack/react-query";
import { VaultCard } from "@/components/VaultCard";
import { NewVaultDialog } from "@/components/NewVaultDialog";
import { StatsCards } from "@/components/StatsCards";
import {
  VaultCardSkeleton,
  StatsCardSkeleton,
} from "@/components/skeletons/VaultCardSkeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuthReady } from "@/hooks/useAuthReady";
import { Vault } from "@/data/mockVaults";
import { EmptyVaults } from "@/components/EmptyVaults";

export default function Dashboard() {
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

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Cofres
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gerencie as entregas e pagamentos dos seus projetos.
          </p>
        </div>
        <div className="w-full sm:w-auto">
          <NewVaultDialog />
        </div>
      </header>

      {isLoading && (
        <>
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <StatsCardSkeleton key={`stat-${i}`} />
            ))}
          </section>
          <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <VaultCardSkeleton key={`vault-${i}`} />
            ))}
          </section>
        </>
      )}

      {isError && (
        <p className="text-sm text-destructive">
          Não foi possível carregar seus cofres. Tente novamente.
        </p>
      )}

      {!isLoading && !isError && vaults && vaults.length === 0 && (
        <EmptyVaults />
      )}

      {!isLoading && vaults && vaults.length > 0 && (
        <>
          <StatsCards vaults={vaults} />
          <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {vaults.map((vault) => (
              <VaultCard key={vault.id} vault={vault} />
            ))}
          </section>
        </>
      )}
    </div>
  );
}
