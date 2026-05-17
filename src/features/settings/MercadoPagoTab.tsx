import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ExternalLink, Info, KeyRound } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export function MercadoPagoTab({ userId }: { userId: string }) {
  const queryClient = useQueryClient();

  const workspaceQuery = useQuery({
    queryKey: ["workspace", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workspaces")
        .select("mp_user_id")
        .eq("owner_id", userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const flag = params.get("mp_connected");
    if (flag === "true") {
      toast({
        title: "Mercado Pago conectado",
        description: "Sua conta foi vinculada com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ["workspace", userId] });
    } else if (flag === "false") {
      toast({
        title: "Falha ao conectar",
        description: "Não foi possível vincular sua conta do Mercado Pago. Tente novamente.",
        variant: "destructive",
      });
    }
    if (flag) {
      params.delete("mp_connected");
      const qs = params.toString();
      const newUrl = window.location.pathname + (qs ? `?${qs}` : "");
      window.history.replaceState({}, "", newUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isLoading = workspaceQuery.isLoading;
  const isConnected = !!workspaceQuery.data?.mp_user_id;
  const mpUserId = workspaceQuery.data?.mp_user_id ?? null;

  async function handleConnect() {
    const { data, error } = await supabase.functions.invoke("mp-oauth-init");
    if (error || !data?.authUrl) {
      toast({
        title: "Erro ao conectar",
        description: "Não foi possível iniciar a conexão com o Mercado Pago. Tente novamente.",
        variant: "destructive",
      });
      return;
    }
    window.location.href = data.authUrl as string;
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            Integração financeira — Mercado Pago
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Conecte sua conta do Mercado Pago via OAuth. As cobranças dos seus cofres caem direto na sua conta.
          </p>
        </div>
        <KeyRound className="h-4 w-4 text-muted-foreground" />
      </div>

      <Alert className="mb-4 border-vault/30 bg-vault/5">
        <Info className="h-4 w-4 text-vault" />
        <AlertDescription className="text-xs leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground">💡 Como funcionam as taxas?</span>{" "}
          Para processar seus pagamentos com segurança, o PixelSafe utiliza a
          infraestrutura do Mercado Pago. O valor das suas vendas cai direto na sua
          conta, sendo descontadas apenas as taxas padrão de gateway do Mercado Pago
          (que variam conforme seu prazo de recebimento) e a taxa da plataforma
          PixelSafe (apenas se você estiver no plano PayGo).
        </AlertDescription>
      </Alert>

      {isLoading ? (
        <Skeleton className="h-9 w-full" />
      ) : isConnected ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span className="font-medium text-foreground">Conectado</span>
              {mpUserId && (
                <code className="ml-2 font-mono text-xs text-muted-foreground">
                  ID: {mpUserId.slice(0, 4)}…{mpUserId.slice(-4)}
                </code>
              )}
            </div>
            <Button type="button" variant="secondary" size="sm" onClick={handleConnect}>
              <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
              Reconectar
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Sua autorização é guardada com segurança e usada apenas para criar as cobranças dos seus cofres.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <Button type="button" onClick={handleConnect}>
            <ExternalLink className="mr-2 h-4 w-4" />
            Conectar Mercado Pago
          </Button>
          <p className="text-[11px] text-muted-foreground">
            Você será redirecionado para o Mercado Pago para autorizar o PixelSafe a criar cobranças em sua conta.
          </p>
        </div>
      )}
    </section>
  );
}
