import { useQuery } from "@tanstack/react-query";
import { VaultCard } from "@/components/VaultCard";
import { NewVaultDialog } from "@/components/NewVaultDialog";
import { StatsCards } from "@/components/StatsCards";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Vault } from "@/data/mockVaults";
import { EmptyVaults } from "@/components/EmptyVaults";

export default function Dashboard() {
  const { user } = useAuth();

  const { data: vaults, isLoading, isError } = useQuery({
    queryKey: ["vaults", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vaults")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Vault[];
    },
  });

  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Cofres
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gerencie as entregas e pagamentos dos seus projetos.
          </p>
        </div>
        <NewVaultDialog />
      </header>

      {isLoading && (
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-[140px] w-full rounded-lg" />
          ))}
        </section>
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
