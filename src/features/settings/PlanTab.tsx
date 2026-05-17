import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { useAuthReady } from "@/hooks/useAuthReady";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";

export function PlanTab() {
  const { user } = useAuthReady();
  const queryClient = useQueryClient();
  const { status, isActive, isOverdue, isLoading, refetch } = useSubscription();
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

  const cpfQuery = useQuery({
    queryKey: ["profile-cpf", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("cpf_cnpj")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const hasCpfCnpj = !!(cpfQuery.data?.cpf_cnpj ?? "").trim();

  const asaasEnv = (import.meta.env.VITE_ASAAS_ENV ?? "sandbox") as string;
  const customerPortalUrl =
    asaasEnv === "production"
      ? "https://www.asaas.com/customerInvoices"
      : "https://sandbox.asaas.com/customerInvoices";

  async function handleCheckout() {
    if (!hasCpfCnpj) {
      toast({
        title: "CPF ou CNPJ obrigatório",
        description:
          "Preencha o seu CPF ou CNPJ na aba Perfil antes de assinar.",
        variant: "destructive",
      });
      return;
    }
    setCheckoutLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("asaas-checkout", {
        body: {},
      });
      if (error) throw error;
      const invoiceUrl = (data as { invoiceUrl?: string } | null)?.invoiceUrl;
      if (!invoiceUrl) {
        toast({
          title: "Fatura ainda não disponível",
          description: "Aguarde alguns segundos e tente novamente.",
        });
        return;
      }
      window.open(invoiceUrl, "_blank", "noopener,noreferrer");
      toast({
        title: "Fatura aberta",
        description: "Após o pagamento, clique em 'Atualizar status'.",
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Tente novamente.";
      toast({
        title: "Erro ao iniciar checkout",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setCheckoutLoading(false);
    }
  }

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke("cancel-subscription", {
        body: {},
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Assinatura cancelada",
        description: "Você voltou ao plano PayGo. Continue vendendo normalmente.",
      });
      setCancelDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["subscription", user?.id] });
      refetch();
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Tente novamente.";
      toast({
        title: "Erro ao cancelar",
        description: msg,
        variant: "destructive",
      });
    },
  });

  const activeBadge = (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-500">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      Ativo
    </span>
  );

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-6">
      <div className="mb-5">
        <h2 className="text-sm font-semibold text-foreground">Seu Plano</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {isLoading
            ? "Carregando status da assinatura..."
            : "Gerencie seu plano e taxas da plataforma."}
        </p>
      </div>

      {isLoading ? (
        <Skeleton className="h-20 w-full" />
      ) : isActive ? (
        <div className="space-y-4">
          <div>
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-foreground">Plano Atual: Pro</span>
              {activeBadge}
            </div>
            <p className="text-xs text-muted-foreground">
              Taxa da plataforma zerada (0%). Você lucra 100% nas suas entregas.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(customerPortalUrl, "_blank", "noopener,noreferrer")}
            >
              <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
              Histórico de Faturas
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setCancelDialogOpen(true)}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              Cancelar Assinatura
            </Button>
          </div>
        </div>
      ) : isOverdue ? (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-foreground">Plano Pro</span>
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-500">
                Pagamento em atraso
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Sua assinatura está pendente de pagamento. Pague a fatura em aberto para
              manter a taxa zerada da plataforma.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={checkoutLoading}>
              Atualizar status
            </Button>
            <Button size="sm" onClick={handleCheckout} disabled={checkoutLoading}>
              {checkoutLoading && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              Pagar fatura
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-foreground">Plano Atual: PayGo</span>
              {activeBadge}
            </div>
            <p className="text-xs text-muted-foreground">
              Sem mensalidade. Você paga apenas a taxa de 2,9% por pagamento aprovado.
            </p>
          </div>

          <div className="border-t border-border" />

          <div>
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-foreground">PixelSafe Pro</span>
              <span className="inline-flex items-center rounded-full bg-vault/15 px-2 py-0.5 text-[11px] font-medium text-vault">
                <Sparkles className="mr-1 h-3 w-3" />
                R$ 39/mês
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Zere a taxa da plataforma (0%) e lucre 100% nas suas entregas.
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={checkoutLoading}>
                Atualizar status
              </Button>
              <Button size="sm" onClick={handleCheckout} disabled={checkoutLoading || isLoading}>
                {checkoutLoading && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                Assinar Plano Pro
              </Button>
            </div>

            {!cpfQuery.isLoading && !hasCpfCnpj ? (
              <p className="mt-3 text-[11px] text-amber-500">
                Preencha seu CPF/CNPJ na aba Perfil para liberar a assinatura.
              </p>
            ) : null}
          </div>
        </div>
      )}

      {status && status !== "active" && status !== "overdue" && status !== "inactive" ? (
        <p className="mt-3 text-[11px] text-muted-foreground">
          Status atual: <code className="font-mono">{status}</code>
        </p>
      ) : null}

      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar assinatura PixelSafe Pro?</AlertDialogTitle>
            <AlertDialogDescription>
              Você voltará automaticamente ao plano PayGo. Continuará podendo criar e
              vender cofres, mas a taxa de 2,9% sobre cada pagamento aprovado voltará a
              ser cobrada. Esta ação é imediata.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelMutation.isPending}>
              Manter Pro
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                cancelMutation.mutate();
              }}
              disabled={cancelMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancelMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Sim, cancelar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
