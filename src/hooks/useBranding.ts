import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthReady } from "@/hooks/useAuthReady";

interface Branding {
  logoUrl: string | null;
  displayName: string | null;
}

/** Branding do owner autenticado (usado na Sidebar). */
export function useOwnerBranding() {
  const { user, isReady } = useAuthReady();

  const query = useQuery({
    queryKey: ["owner-branding", user?.id],
    enabled: isReady && !!user?.id,
    staleTime: 60_000,
    queryFn: async (): Promise<Branding> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("custom_logo_url, full_name")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return {
        logoUrl: data?.custom_logo_url ?? null,
        displayName: data?.full_name ?? null,
      };
    },
  });

  // Cache-bust derivado do dataUpdatedAt: muda só quando a query refaz fetch
  // (ex.: após mutation invalidar). Permite o <img> recarregar sem poluir o banco.
  const rawUrl = query.data?.logoUrl ?? null;
  const logoUrl = rawUrl
    ? `${rawUrl}${rawUrl.includes("?") ? "&" : "?"}v=${query.dataUpdatedAt}`
    : null;

  return {
    logoUrl,
    displayName: query.data?.displayName ?? null,
    isLoading: query.isLoading,
  };
}

/** Branding público de um owner específico (usado no Checkout). */
export function usePublicOwnerBranding(ownerId: string | null | undefined) {
  const query = useQuery({
    queryKey: ["public-owner-branding", ownerId],
    enabled: !!ownerId,
    staleTime: 60_000,
    queryFn: async (): Promise<Branding> => {
      const { data, error } = await supabase.functions.invoke<{
        custom_logo_url: string | null;
        full_name: string | null;
      }>("get-owner-branding", { body: { owner_id: ownerId } });
      if (error) throw error;
      return {
        logoUrl: data?.custom_logo_url ?? null,
        displayName: data?.full_name ?? null,
      };
    },
  });

  return {
    logoUrl: query.data?.logoUrl ?? null,
    displayName: query.data?.displayName ?? null,
    isLoading: query.isLoading,
  };
}
