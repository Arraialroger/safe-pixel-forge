import { useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, Clock, Download, Loader2, Lock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { formatBRL, statusLabel, VaultStatus } from "@/data/mockVaults";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const PROCESSING_STATUSES = new Set(["pending", "in_process", "in_mediation"]);

interface PublicVault {
  id: string;
  title: string;
  client_name: string;
  price: number;
  status: VaultStatus;
  public_slug: string;
  file_name: string | null;
}

export default function PayVault() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const mpStatus = searchParams.get("status");
  const isProcessingFromUrl = !!mpStatus && PROCESSING_STATUSES.has(mpStatus);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["public-vault", slug],
    enabled: !!slug,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vaults")
        .select("id, title, client_name, price, status, public_slug, file_name")
        .eq("public_slug", slug!)
        .maybeSingle();
      if (error) throw error;
      return data as PublicVault | null;
    },
    // Enquanto está em "processando", faz polling para flipar para Sucesso quando o webhook confirmar.
    refetchInterval: (query) => {
      const v = query.state.data as PublicVault | null | undefined;
      if (!v) return false;
      if (v.status === "paid") return false;
      return isProcessingFromUrl ? 10_000 : false;
    },
  });

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <div className="mb-8">
        <Logo size="md" />
      </div>

      <div className="w-full max-w-md">
        {isLoading && (
          <div className="rounded-lg border border-border bg-card p-8">
            <Skeleton className="mx-auto mb-6 h-14 w-14 rounded-full" />
            <Skeleton className="mx-auto mb-3 h-4 w-40" />
            <Skeleton className="mx-auto mb-8 h-7 w-56" />
            <Skeleton className="mb-3 h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        )}

        {!isLoading && (isError || !data) && (
          <div className="rounded-lg border border-border bg-card p-8 text-center">
            <h1 className="text-base font-semibold text-foreground">
              Cofre não encontrado
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              O link que você abriu é inválido ou foi removido.
            </p>
          </div>
        )}

        {data && (data.status === "paid" ? <SuccessCard vault={data} /> : <CheckoutCard vault={data} />)}
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Protegido por PixelSafe
      </p>
    </main>
  );
}

function CheckoutCard({ vault }: { vault: PublicVault }) {
  const payMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke<{
        init_point: string;
        error?: string;
      }>("create-payment", {
        body: { vault_id: vault.id },
      });
      if (error) throw error;
      if (!data?.init_point) {
        throw new Error(data?.error ?? "Resposta inválida do servidor");
      }
      return data.init_point;
    },
    onSuccess: (initPoint) => {
      window.location.href = initPoint;
    },
    onError: (err: unknown) => {
      console.error(err);
      toast({
        title: "Não foi possível iniciar o pagamento",
        description: "Tente novamente em instantes.",
        variant: "destructive",
      });
    },
  });

  const isLoading = payMutation.isPending;

  return (
    <article className="rounded-lg border border-border bg-card p-8 shadow-none">
      <div className="mb-6 flex flex-col items-center text-center">
        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full border border-border bg-background">
          <Lock className="h-6 w-6 text-vault" strokeWidth={2.25} />
        </div>
        <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" />
          Pagamento seguro
        </p>
      </div>

      <div className="mb-6 text-center">
        <h1 className="text-lg font-semibold text-foreground">{vault.title}</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Cliente · <span className="text-foreground/80">{vault.client_name}</span>
        </p>
      </div>

      <div className="mb-6 flex items-center justify-center gap-3">
        <p className="text-4xl font-semibold tracking-tight text-foreground">
          {formatBRL(Number(vault.price))}
        </p>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[11px] font-medium",
            "bg-primary/15 text-primary",
          )}
        >
          {statusLabel(vault.status)}
        </span>
      </div>

      <Button
        className="w-full"
        disabled={isLoading}
        onClick={() => payMutation.mutate()}
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Redirecionando...
          </>
        ) : (
          "Pagar e Liberar Arquivo"
        )}
      </Button>

      <p className="mt-4 text-center text-[11px] text-muted-foreground">
        Após confirmar o pagamento, o arquivo é liberado automaticamente.
      </p>
    </article>
  );
}

function SuccessCard({ vault }: { vault: PublicVault }) {
  const downloadMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke<{
        signed_url: string;
        error?: string;
      }>("get-download-url", {
        body: { slug: vault.public_slug },
      });
      if (error) throw error;
      if (!data?.signed_url) {
        throw new Error(data?.error ?? "Resposta inválida do servidor");
      }
      return data.signed_url;
    },
    onSuccess: (signedUrl) => {
      window.open(signedUrl, "_blank", "noopener,noreferrer");
    },
    onError: (err: unknown) => {
      console.error(err);
      toast({
        title: "Não foi possível gerar o link de download",
        description: "Tente novamente em instantes.",
        variant: "destructive",
      });
    },
  });

  const isLoading = downloadMutation.isPending;

  return (
    <article className="rounded-lg border border-success/40 bg-success/5 p-8 shadow-none">
      <div className="mb-6 flex flex-col items-center text-center">
        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full border border-success/40 bg-success/10">
          <CheckCircle2 className="h-7 w-7 text-success" strokeWidth={2.25} />
        </div>
        <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-success">
          Pagamento confirmado
        </p>
      </div>

      <div className="mb-6 text-center">
        <h1 className="text-lg font-semibold text-foreground">{vault.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Seu arquivo está pronto para download.
        </p>
        {vault.file_name && (
          <p className="mt-1 text-xs text-muted-foreground/80 truncate">
            {vault.file_name}
          </p>
        )}
      </div>

      <Button
        className="w-full"
        disabled={isLoading}
        onClick={() => downloadMutation.mutate()}
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Gerando link seguro...
          </>
        ) : (
          <>
            <Download className="mr-2 h-4 w-4" />
            Baixar arquivo
          </>
        )}
      </Button>

      <p className="mt-4 text-center text-[11px] text-muted-foreground">
        O link de download é válido por 15 minutos.
      </p>
    </article>
  );
}
