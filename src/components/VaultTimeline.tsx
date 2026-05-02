import { useQuery } from "@tanstack/react-query";
import { Eye, ShoppingCart, CheckCircle2, Download, History, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type VaultEventType = "page_viewed" | "checkout_started" | "payment_approved" | "downloaded";

interface VaultEvent {
  id: string;
  event_type: VaultEventType;
  created_at: string;
}

interface VaultTimelineProps {
  vaultId: string;
}

const EVENT_META: Record<
  VaultEventType,
  { Icon: typeof Eye; label: string; iconClass: string; bgClass: string }
> = {
  page_viewed: {
    Icon: Eye,
    label: "Cliente abriu o link",
    iconClass: "text-muted-foreground",
    bgClass: "bg-muted",
  },
  checkout_started: {
    Icon: ShoppingCart,
    label: "Iniciou o pagamento",
    iconClass: "text-primary",
    bgClass: "bg-primary/10",
  },
  payment_approved: {
    Icon: CheckCircle2,
    label: "Pagamento aprovado",
    iconClass: "text-success",
    bgClass: "bg-success/10",
  },
  downloaded: {
    Icon: Download,
    label: "Arquivo baixado",
    iconClass: "text-vault",
    bgClass: "bg-vault/10",
  },
};

export function VaultTimeline({ vaultId }: VaultTimelineProps) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["vault-events", vaultId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vault_events")
        .select("id, event_type, created_at")
        .eq("vault_id", vaultId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as VaultEvent[];
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }

  if (isError) {
    return (
      <p className="py-6 text-center text-sm text-destructive">
        Não foi possível carregar o histórico.
      </p>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
        <History className="h-8 w-8 text-muted-foreground/60" />
        <p className="text-sm text-muted-foreground">
          Nenhum evento ainda. Assim que o cliente abrir o link, aparecerá aqui.
        </p>
      </div>
    );
  }

  return (
    <ol className="relative space-y-4 border-l border-border pl-6">
      {data.map((event) => {
        const meta = EVENT_META[event.event_type];
        const Icon = meta.Icon;
        return (
          <li key={event.id} className="relative">
            <span
              className={cn(
                "absolute -left-[34px] flex h-6 w-6 items-center justify-center rounded-full border border-border",
                meta.bgClass,
              )}
            >
              <Icon className={cn("h-3.5 w-3.5", meta.iconClass)} strokeWidth={2.25} />
            </span>
            <p className="text-sm font-medium text-foreground">{meta.label}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(event.created_at), {
                addSuffix: true,
                locale: ptBR,
              })}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
