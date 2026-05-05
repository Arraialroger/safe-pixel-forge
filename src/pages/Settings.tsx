import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ImagePlus, Loader2, Trash2, Lock, KeyRound, Sparkles, CheckCircle2, ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

import { toast } from "@/hooks/use-toast";
import { useAuthReady } from "@/hooks/useAuthReady";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";

// ----- Schemas -----
const profileSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(1, "Informe um nome")
    .max(100, "Máximo de 100 caracteres"),
  cpf_cnpj: z
    .string()
    .trim()
    .min(1, "Informe seu CPF ou CNPJ")
    .transform((v) => v.replace(/\D/g, ""))
    .refine(
      (v) => v.length === 11 || v.length === 14,
      "Documento inválido. Use 11 dígitos (CPF) ou 14 dígitos (CNPJ).",
    ),
});
type ProfileForm = z.infer<typeof profileSchema>;

// (Token manual removido — agora é via OAuth)

const ALLOWED_LOGO_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2MB

/** Concatena ?v= sem persistir no banco (apenas para invalidar cache do <img>). */
function withCacheBust(url: string | null | undefined, version: number | string): string | null {
  if (!url) return null;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}v=${version}`;
}

export default function Settings() {
  const { user, isReady } = useAuthReady();

  if (!isReady || !user?.id) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Configurações
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ajuste seu perfil, marca e integrações.
        </p>
      </header>

      <div className="space-y-4">
        <ProfileCard userId={user.id} />
        <MercadoPagoCard userId={user.id} />
        <PlanCard />
      </div>
    </div>
  );
}

// ============================================================
// Profile + Logo
// ============================================================

function ProfileCard({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  // Versão local para cache-bust após salvar (não persistida).
  const [logoVersion, setLogoVersion] = useState<number>(0);

  const profileQuery = useQuery({
    queryKey: ["profile-settings", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, email, custom_logo_url, cpf_cnpj")
        .eq("id", userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const form = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: { full_name: "", cpf_cnpj: "" },
  });

  useEffect(() => {
    if (profileQuery.data) {
      form.reset({
        full_name: profileQuery.data.full_name ?? "",
        cpf_cnpj: profileQuery.data.cpf_cnpj ?? "",
      });
    }
  }, [profileQuery.data, form]);

  // Cleanup do object URL do preview
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const saveMutation = useMutation({
    mutationFn: async (values: ProfileForm) => {
      let nextLogoUrl: string | null | undefined = undefined;

      if (pendingFile) {
        const ext = (pendingFile.name.split(".").pop() ?? "").toLowerCase();
        const safeExt = ext ? `.${ext}` : "";
        const path = `${userId}/logo_imagem${safeExt}`;

        const { error: upErr } = await supabase.storage
          .from("logos")
          .upload(path, pendingFile, {
            upsert: true,
            contentType: pendingFile.type,
            cacheControl: "3600",
          });
        if (upErr) throw upErr;

        const { data: pub } = supabase.storage.from("logos").getPublicUrl(path);
        // Persistimos a URL limpa; cache-bust é aplicado só na renderização.
        nextLogoUrl = pub.publicUrl;
      }

      const update: Record<string, unknown> = {
        full_name: values.full_name,
        cpf_cnpj: values.cpf_cnpj,
      };
      if (nextLogoUrl !== undefined) update.custom_logo_url = nextLogoUrl;

      const { error } = await supabase
        .from("profiles")
        .update(update)
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Perfil atualizado", description: "Suas informações foram salvas." });
      setPendingFile(null);
      setPreviewUrl(null);
      setLogoVersion(Date.now());
      if (fileInputRef.current) fileInputRef.current.value = "";
      queryClient.invalidateQueries({ queryKey: ["profile-settings", userId] });
      queryClient.invalidateQueries({ queryKey: ["profile-cpf", userId] });
      queryClient.invalidateQueries({ queryKey: ["owner-branding", userId] });
      queryClient.invalidateQueries({ queryKey: ["public-owner-branding", userId] });
    },
    onError: (err: unknown) => {
      console.error(err);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível atualizar o perfil. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const removeLogoMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("profiles")
        .update({ custom_logo_url: null })
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Logo removida" });
      queryClient.invalidateQueries({ queryKey: ["profile-settings", userId] });
      queryClient.invalidateQueries({ queryKey: ["owner-branding", userId] });
      queryClient.invalidateQueries({ queryKey: ["public-owner-branding", userId] });
    },
    onError: (err: unknown) => {
      console.error(err);
      toast({
        title: "Erro ao remover logo",
        variant: "destructive",
      });
    },
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
      toast({
        title: "Formato não suportado",
        description: "Use PNG, JPG, WEBP ou SVG.",
        variant: "destructive",
      });
      e.target.value = "";
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      toast({
        title: "Arquivo muito grande",
        description: "Limite de 2MB.",
        variant: "destructive",
      });
      e.target.value = "";
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPendingFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  const isLoading = profileQuery.isLoading;
  const savedLogo = profileQuery.data?.custom_logo_url ?? null;
  const currentLogo =
    previewUrl ?? withCacheBust(savedLogo, logoVersion || (savedLogo ? "saved" : ""));
  const email = profileQuery.data?.email ?? "";

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-6">
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-foreground">Perfil e marca</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Sua logo aparece na barra lateral e nas páginas de checkout dos seus clientes.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-16 w-16 rounded-md" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-32" />
        </div>
      ) : (
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((v) => saveMutation.mutate(v))}
            className="space-y-5"
          >
            {/* Logo */}
            <div className="flex items-start gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-background">
                {currentLogo ? (
                  <img
                    src={currentLogo}
                    alt="Logo"
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <Lock className="h-6 w-6 text-vault" strokeWidth={2.25} />
                )}
              </div>
              <div className="flex-1 space-y-2">
                <Label className="text-xs text-muted-foreground">Logo da agência</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ALLOWED_LOGO_TYPES.join(",")}
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <ImagePlus className="mr-1.5 h-3.5 w-3.5" />
                    {currentLogo ? "Trocar logo" : "Enviar logo"}
                  </Button>
                  {savedLogo && !pendingFile && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeLogoMutation.mutate()}
                      disabled={removeLogoMutation.isPending}
                    >
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                      Remover
                    </Button>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  PNG, JPG, WEBP ou SVG · até 2MB.
                </p>
              </div>
            </div>

            {/* Nome */}
            <FormField
              control={form.control}
              name="full_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome completo</FormLabel>
                  <FormControl>
                    <Input placeholder="Seu nome ou nome da agência" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* CPF / CNPJ */}
            <FormField
              control={form.control}
              name="cpf_cnpj"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>CPF ou CNPJ</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="000.000.000-00 ou 00.000.000/0000-00"
                      inputMode="numeric"
                      autoComplete="off"
                      {...field}
                    />
                  </FormControl>
                  <p className="text-[11px] text-muted-foreground">
                    Obrigatório para emitir as faturas da sua assinatura PixelSafe Pro.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Email read-only */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Email</Label>
              <Input value={email} disabled />
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Salvar perfil
              </Button>
            </div>
          </form>
        </Form>
      )}
    </section>
  );
}

// ============================================================
// Mercado Pago
// ============================================================

function MercadoPagoCard({ userId }: { userId: string }) {
  const queryClient = useQueryClient();

  const workspaceQuery = useQuery({
    queryKey: ["workspace", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workspaces")
        .select("mp_access_token, mp_user_id")
        .eq("owner_id", userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Lê ?mp_connected=true|false e mostra toast.
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
  const isConnected = !!workspaceQuery.data?.mp_access_token;
  const mpUserId = workspaceQuery.data?.mp_user_id ?? null;

  function handleConnect() {
    const clientId = import.meta.env.VITE_MP_CLIENT_ID as string | undefined;
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
    if (!clientId) {
      toast({
        title: "Configuração ausente",
        description: "VITE_MP_CLIENT_ID não está definido.",
        variant: "destructive",
      });
      return;
    }
    const redirectUri = `${supabaseUrl}/functions/v1/mp-oauth-callback`;
    const authUrl =
      `https://auth.mercadopago.com.br/authorization` +
      `?client_id=${encodeURIComponent(clientId)}` +
      `&response_type=code` +
      `&platform_id=mp` +
      `&state=${encodeURIComponent(userId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}`;
    window.location.href = authUrl;
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

// ============================================================
// Plano (Asaas)
// ============================================================

function PlanCard() {
  const { user } = useAuthReady();
  const { status, isActive, isOverdue, isLoading, refetch } = useSubscription();
  const [checkoutLoading, setCheckoutLoading] = useState(false);

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
          "Preencha o seu CPF ou CNPJ no card de Perfil acima antes de assinar.",
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

  let badge: { label: string; cls: string } | null = null;
  if (isActive) badge = { label: "Assinatura ativa", cls: "bg-emerald-500/15 text-emerald-500" };
  else if (isOverdue) badge = { label: "Pagamento em atraso", cls: "bg-amber-500/15 text-amber-500" };

  const description = isActive
    ? "Você tem cofres ilimitados. Gerencie suas faturas e dados de pagamento na área do cliente Asaas."
    : isOverdue
      ? "Sua assinatura está pendente de pagamento. Pague a fatura em aberto para reativar a criação de cofres."
      : "Crie cofres ilimitados por R$ 39/mês. Pague via Pix, boleto ou cartão — você escolhe na hora do checkout.";

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-foreground">Plano Pro</h2>
            {badge ? (
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${badge.cls}`}>
                {badge.label}
              </span>
            ) : (
              <span className="rounded-full bg-vault/15 px-2 py-0.5 text-[11px] font-medium text-vault">
                <Sparkles className="mr-1 inline h-3 w-3" />
                R$ 39/mês
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {isLoading ? "Carregando status da assinatura..." : description}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {isActive ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => window.open(customerPortalUrl, "_blank", "noopener,noreferrer")}
              className="w-full sm:w-auto"
            >
              Gerenciar assinatura
            </Button>
          ) : isOverdue ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refetch()}
                disabled={checkoutLoading}
              >
                Atualizar status
              </Button>
              <Button size="sm" onClick={handleCheckout} disabled={checkoutLoading} className="w-full sm:w-auto">
                {checkoutLoading && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                Pagar fatura
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refetch()}
                disabled={checkoutLoading}
              >
                Atualizar status
              </Button>
              <Button size="sm" onClick={handleCheckout} disabled={checkoutLoading || isLoading} className="w-full sm:w-auto">
                {checkoutLoading && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                Assinar Plano Pro
              </Button>
            </>
          )}
        </div>
      </div>
      {!isActive && !cpfQuery.isLoading && !hasCpfCnpj ? (
        <p className="mt-3 text-[11px] text-amber-500">
          Preencha seu CPF/CNPJ no card de Perfil acima para liberar a assinatura.
        </p>
      ) : null}
      {status && status !== "active" && status !== "overdue" && status !== "inactive" ? (
        <p className="mt-3 text-[11px] text-muted-foreground">
          Status atual: <code className="font-mono">{status}</code>
        </p>
      ) : null}
    </section>
  );
}
