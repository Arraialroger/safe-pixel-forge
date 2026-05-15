import { useQuery } from "@tanstack/react-query";
import { VaultsHeader } from "@/features/vaults/VaultsHeader";
import { VaultsList } from "@/features/vaults/VaultsList";
import { VaultsEmptyState } from "@/features/vaults/VaultsEmptyState";
import { StatsCards } from "@/components/StatsCards";
import { StatsCardSkeleton } from "@/components/skeletons/VaultCardSkeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuthReady } from "@/hooks/useAuthReady";
import type { Vault } from "@/data/mockVaults";

export default function Home() {
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
      <VaultsHeader />

      {isLoading && (
        <>
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <StatsCardSkeleton key={`stat-${i}`} />
            ))}
          </section>
          <div className="rounded-2xl border border-border bg-card p-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-14 animate-pulse border-b border-border last:border-b-0"
              />
            ))}
          </div>
        </>
      )}

      {isError && (
        <p className="text-sm text-destructive">
          Não foi possível carregar seus cofres. Tente novamente.
        </p>
      )}

      {!isLoading && !isError && vaults && vaults.length === 0 && (
        <VaultsEmptyState />
      )}

      {!isLoading && vaults && vaults.length > 0 && (
        <>
          <StatsCards vaults={vaults} />
          <VaultsList vaults={vaults} />
        </>
      )}
    </div>
  );
}
