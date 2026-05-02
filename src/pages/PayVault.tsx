import { useEffect, useRef } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Clock, Download, Loader2, Lock, Mail, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { formatBRL, statusLabel, VaultStatus } from "@/data/mockVaults";
import { isExpiringSoon, expiringLabel } from "@/utils/vault";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { usePublicOwnerBranding } from "@/hooks/useBranding";
import { CheckoutCardSkeleton } from "@/components/skeletons/CheckoutCardSkeleton";
import { logVaultEvent } from "@/lib/events";

const PROCESSING_STATUSES = new Set(["pending", "in_process", "in_mediation"]);

interface PublicVault {
  id: string;
  title: string;
  client_name: string;
  price: number;
  status: VaultStatus;
  public_slug: string;
  file_name: string | null;
  owner_id: string;
  expires_at: string | null;
}

function isVaultExpired(v: Pick<PublicVault, "expires_at">): boolean {
  if (!v.expires_at) return false;
  return new Date(v.expires_at).getTime() < Date.now();
}

export default function PayVault() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const mpStatus = searchParams.get("status");
  const isProcessingFromUrl = !!mpStatus && PROCESSING_STATUSES.has(mpStatus);
  // branding hook is called inside the render below once we have data

  const { data, isLoading, isError } = useQuery({
    queryKey: ["public-vault", slug],
    enabled: !!slug,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vaults")
        .select("id, title, client_name, price, status, public_slug, file_name, owner_id, expires_at")
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

  // Dispara page_viewed uma única vez por sessão (com guard contra Strict Mode).
  const viewedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!data?.id) return;
    if (viewedRef.current === data.id) return;
    if (isVaultExpired(data) || data.status === "paid") return;
    viewedRef.current = data.id;
    void logVaultEvent(data.id, "page_viewed");
  }, [data]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-8 sm:py-10">
      <CheckoutHeader ownerId={data?.owner_id ?? null} />

      <div className="w-full max-w-md">
        {isLoading && <CheckoutCardSkeleton />}

        {!isLoading && (isError || !data) && (
          <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-soft-lg">
            <h1 className="text-base font-semibold text-foreground">
              Cofre não encontrado
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              O link que você abriu é inválido ou foi removido.
            </p>
          </div>
        )}

        {data && (
          isVaultExpired(data)
            ? <ExpiredCard vault={data} ownerId={data.owner_id} />
            : data.status === "paid"
              ? <SuccessCard vault={data} />
              : isProcessingFromUrl
                ? <ProcessingCard vault={data} />
                : <CheckoutCard vault={data} />
        )}
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
      // Fire-and-forget: registra que o cliente iniciou o checkout antes do redirect.
      void logVaultEvent(vault.id, "checkout_started");
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
    <article className="rounded-2xl border border-border bg-card p-8 shadow-soft-lg">
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

      {isExpiringSoon(vault) && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-[12px] leading-relaxed text-amber-700 dark:text-amber-300">
            <strong className="font-semibold">Atenção:</strong>{" "}
            {expiringLabel(vault)?.toLowerCase() ?? "este link expira em breve"}.
            Garanta seu acesso agora.
          </p>
        </div>
      )}

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

      <div className="mt-4 rounded-xl border border-border bg-muted/40 p-3 text-center">
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          <ShieldCheck className="mr-1 inline h-3 w-3 -translate-y-px" />
          Por motivos de segurança, o arquivo ficará disponível para download por
          {" "}<strong className="text-foreground/80">7 dias</strong> após a confirmação do pagamento.
        </p>
      </div>
    </article>
  );
}

function ExpiredCard({ vault, ownerId }: { vault: PublicVault; ownerId: string | null }) {
  const { email: ownerEmail, displayName } = usePublicOwnerBranding(ownerId);

  const mailtoHref = ownerEmail
    ? `mailto:${ownerEmail}?subject=${encodeURIComponent(
        `Link expirado - ${vault.title}`,
      )}&body=${encodeURIComponent(
        `Olá${displayName ? `, ${displayName}` : ""}!\n\n` +
          `O link de pagamento do projeto "${vault.title}" expirou e não consigo mais acessar o arquivo.\n` +
          `Você poderia gerar uma nova entrega para mim?\n\nObrigado!`,
      )}`
    : null;

  return (
    <article className="rounded-2xl border border-border bg-card p-8 text-center shadow-soft-lg">
      <div className="mb-6 flex flex-col items-center">
        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full border border-destructive/30 bg-destructive/10">
          <AlertTriangle className="h-7 w-7 text-destructive" strokeWidth={2.25} />
        </div>
        <p className="text-[11px] font-medium uppercase tracking-wide text-destructive">
          Cofre expirado
        </p>
      </div>

      <h1 className="text-lg font-semibold text-foreground">{vault.title}</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        Este cofre expirou e o arquivo foi removido dos nossos servidores por
        segurança.
      </p>

      {mailtoHref && (
        <Button asChild variant="outline" className="mt-6 w-full">
          <a href={mailtoHref}>
            <Mail className="mr-2 h-4 w-4" />
            Falar com o profissional
          </a>
        </Button>
      )}

      <p className="mt-4 text-[11px] text-muted-foreground/80">
        Solicite uma nova entrega para acessar o arquivo novamente.
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
    <article className="rounded-2xl border border-success/40 bg-success/5 p-8 shadow-soft-lg">
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

function ProcessingCard({ vault }: { vault: PublicVault }) {
  return (
    <article className="rounded-2xl border border-vault/40 bg-vault/5 p-8 shadow-soft-lg">
      <div className="mb-6 flex flex-col items-center text-center">
        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full border border-vault/40 bg-vault/10">
          <Clock className="h-7 w-7 text-vault" strokeWidth={2.25} />
        </div>
        <p className="text-[11px] font-medium uppercase tracking-wide text-vault">
          Aguardando confirmação
        </p>
      </div>

      <div className="mb-2 text-center">
        <h1 className="text-lg font-semibold text-foreground">{vault.title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Recebemos o seu pedido! Estamos aguardando a confirmação do Mercado Pago.
          Assim que o pagamento for processado (boletos podem levar até 2 dias úteis),
          o arquivo será liberado aqui e enviaremos um aviso para o seu e-mail.
        </p>
      </div>

      <div className="mt-6 flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Esta página atualiza automaticamente.
      </div>

      <p className="mt-4 text-center text-[11px] text-muted-foreground/80">
        Você pode fechar esta página com segurança.
      </p>
    </article>
  );
}

function CheckoutHeader({ ownerId }: { ownerId: string | null }) {
  const { logoUrl, displayName } = usePublicOwnerBranding(ownerId);
  return (
    <div className="mb-8">
      <Logo
        size="md"
        customLogoUrl={logoUrl}
        customLogoAlt={displayName ?? undefined}
      />
    </div>
  );
}
