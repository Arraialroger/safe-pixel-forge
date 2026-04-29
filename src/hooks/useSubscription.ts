import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthReady } from "@/hooks/useAuthReady";

export type SubscriptionStatus = "active" | "overdue" | "inactive" | string;

export function useSubscription() {
  const { user, isReady } = useAuthReady();

  const query = useQuery({
    queryKey: ["subscription", user?.id],
    enabled: isReady && !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("subscription_status, asaas_customer_id, asaas_subscription_id")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const status: SubscriptionStatus = (query.data?.subscription_status ?? "inactive") as SubscriptionStatus;

  return {
    status,
    isActive: status === "active",
    isOverdue: status === "overdue",
    isInactive: status !== "active" && status !== "overdue",
    isLoading: query.isLoading,
    isReady: isReady && !!user?.id,
    data: query.data,
    refetch: query.refetch,
  };
}
