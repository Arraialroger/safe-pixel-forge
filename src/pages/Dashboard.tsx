import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { NewVaultDialog } from "@/components/NewVaultDialog";
import { StatsCards } from "@/components/StatsCards";
import { VaultRecentItem } from "@/components/VaultRecentItem";
import { StatsCardSkeleton } from "@/components/skeletons/VaultCardSkeleton";
import { Button } from "@/components/ui/button";
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

  const recent = vaults?.slice(0, 3) ?? [];

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Visão geral das suas entregas e pagamentos.
          </p>
        </div>
        <div className="w-full sm:w-auto">
          <NewVaultDialog />
        </div>
      </header>

      {isLoading && (
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <StatsCardSkeleton key={`stat-${i}`} />
          ))}
        </section>
      )}

      {isError && (
        <p className="text-sm text-destructive">
          Não foi possível carregar seus cofres. Tente novamente.
        </p>
      )}

      {!isLoading && !isError && vaults && vaults.length === 0 && <EmptyVaults />}

      {!isLoading && vaults && vaults.length > 0 && (
        <>
          <StatsCards vaults={vaults} />

          <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  Cofres recentes
                </h2>
                <p className="text-xs text-muted-foreground">
                  Os últimos {recent.length} cofres criados.
                </p>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link to="/cofres">
                  Ver todos
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>

            <div className="space-y-1">
              {recent.map((v) => (
                <VaultRecentItem key={v.id} vault={v} />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
