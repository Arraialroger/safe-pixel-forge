import { useState, useRef, DragEvent } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, UploadCloud, FileText, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { toast } from "@/hooks/use-toast";
import { formatBRLInput, parseBRLToNumber } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { formatBRPhone, isValidBRPhone, normalizeBRPhone, onlyDigits } from "@/lib/phone";
import { useNavigate } from "react-router-dom";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const FREE_PLAN_LIMIT = 1;

const schema = z.object({
  title: z
    .string()
    .trim()
    .min(2, "Informe o nome do projeto.")
    .max(80, "Máximo de 80 caracteres."),
  client_name: z
    .string()
    .trim()
    .min(2, "Informe o nome do cliente.")
    .max(80, "Máximo de 80 caracteres."),
  client_email: z
    .string()
    .trim()
    .email("E-mail inválido.")
    .max(120, "Máximo de 120 caracteres."),
  client_whatsapp: z
    .string()
    .trim()
    .max(16, "Número muito longo.")
    .optional()
    .or(z.literal(""))
    .refine(
      (v) => !v || isValidBRPhone(v),
      "Use DDD + número, ex.: (11) 99999-9999.",
    ),
  price_masked: z
    .string()
    .min(1, "Informe o valor.")
    .refine((v) => parseBRLToNumber(v) >= 0.5, "Valor mínimo de R$ 0,50.")
    .refine(
      (v) => parseBRLToNumber(v) <= 9_999_999,
      "Valor muito alto."
    ),
  allowed_payment_methods: z.enum(["pix", "all"], {
    required_error: "Escolha como você quer receber.",
  }),
  notify_client: z.boolean().default(true),
});

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

type FormValues = z.infer<typeof schema>;

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function NewVaultDialog() {
  const { user } = useAuth();
  const { isActive: subscriptionActive } = useSubscription();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const countQuery = useQuery({
    queryKey: ["vaults-count", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("vaults")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", user!.id);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: {
      title: "",
      client_name: "",
      client_email: "",
      client_whatsapp: "",
      price_masked: "",
      allowed_payment_methods: "pix",
      notify_client: true,
    },
  });

  function resetAll() {
    form.reset();
    setFile(null);
    setDragActive(false);
  }

  function handleNewClick() {
    const c = countQuery.data ?? 0;
    if (c >= FREE_PLAN_LIMIT && !subscriptionActive) {
      setPaywallOpen(true);
      return;
    }
    setOpen(true);
  }

  function handleFile(f: File | null) {
    if (!f) {
      setFile(null);
      return;
    }
    if (f.size > MAX_FILE_SIZE) {
      toast({
        title: "Arquivo muito grande",
        description: "O limite é de 50MB por arquivo.",
        variant: "destructive",
      });
      return;
    }
    setFile(f);
  }

  function onDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragActive(false);
    const f = e.dataTransfer.files?.[0] ?? null;
    handleFile(f);
  }

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      if (!user) throw new Error("Sessão expirada. Faça login novamente.");

      // Defesa em profundidade: refaz a contagem antes do INSERT.
      const { count: currentCount, error: countErr } = await supabase
        .from("vaults")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", user.id);
      if (countErr) throw countErr;
      if ((currentCount ?? 0) >= FREE_PLAN_LIMIT && !subscriptionActive) {
        throw new Error(
          "Limite do plano gratuito atingido. Assine o Plano Pro para criar mais cofres.",
        );
      }

      const price = parseBRLToNumber(values.price_masked);

      // 1. Insert vault
      const whatsapp = values.client_whatsapp ? normalizeBRPhone(values.client_whatsapp) : "";
      const clientEmail = values.client_email.trim();
      const { data: vault, error: insertErr } = await supabase
        .from("vaults")
        .insert({
          title: values.title.trim(),
          client_name: values.client_name.trim(),
          client_email: clientEmail,
          client_whatsapp: whatsapp ? whatsapp : null,
          price,
          allowed_payment_methods: values.allowed_payment_methods,
          owner_id: user.id,
        })
        .select()
        .single();
      if (insertErr) throw insertErr;

      // 2. Upload file (if any)
      if (file) {
        const safeName = file.name.replace(/[^\w.\-]+/g, "_");
        const path = `${user.id}/${vault.id}/${safeName}`;
        const { error: upErr } = await supabase.storage
          .from("vault-files")
          .upload(path, file, { upsert: false });
        if (upErr) {
          // rollback
          await supabase.from("vaults").delete().eq("id", vault.id);
          throw upErr;
        }

        // 3. Update vault with file refs
        const { error: updErr } = await supabase
          .from("vaults")
          .update({ file_path: path, file_name: file.name })
          .eq("id", vault.id);
        if (updErr) throw updErr;
      }

      // 4. Optional: dispara e-mail inicial. NÃO falha o cofre se o e-mail falhar.
      let emailError: string | null = null;
      if (values.notify_client && clientEmail) {
        try {
          const { error: fnErr } = await supabase.functions.invoke(
            "send-vault-created",
            { body: { vault_id: vault.id } },
          );
          if (fnErr) emailError = fnErr.message;
        } catch (e) {
          emailError = e instanceof Error ? e.message : "erro desconhecido";
        }
      }

      return { vault, emailError };
    },
    onSuccess: ({ emailError }) => {
      queryClient.invalidateQueries({ queryKey: ["vaults"] });
      queryClient.invalidateQueries({ queryKey: ["vaults-count", user?.id] });
      if (emailError) {
        toast({
          title: "Cofre criado",
          description: "Não foi possível enviar o e-mail agora. Você pode reenviar manualmente.",
        });
      } else {
        toast({
          title: "Cofre criado",
          description: "Seu cofre foi salvo com sucesso.",
        });
      }
      resetAll();
      setOpen(false);
    },
    onError: (err: Error) => {
      toast({
        title: "Erro ao criar cofre",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  function onSubmit(values: FormValues) {
    mutation.mutate(values);
  }

  return (
    <>
      <Button onClick={handleNewClick} className="w-full sm:w-auto">
        <Plus className="mr-1.5 h-4 w-4" />
        Novo Cofre
      </Button>

      <AlertDialog open={paywallOpen} onOpenChange={setPaywallOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Limite do plano gratuito atingido</AlertDialogTitle>
            <AlertDialogDescription>
              Você já utilizou o seu cofre gratuito. Assine o Plano Pro (R$ 39/mês)
              para criar cofres ilimitados e continuar recebendo pagamentos com segurança.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() => {
                setPaywallOpen(false);
                navigate("/configuracoes");
              }}
            >
              Assinar agora
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (mutation.isPending) return;
          setOpen(o);
          if (!o) resetAll();
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto bg-card sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo cofre</DialogTitle>
            <DialogDescription>
              Crie um cofre para entregar o arquivo final do job e receber com segurança.
            </DialogDescription>
          </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem className="space-y-1.5">
                  <FormLabel className="text-xs text-muted-foreground">
                    Nome do projeto / job
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ex.: Identidade Visual — Café Raízes"
                      className="bg-background"
                      disabled={mutation.isPending}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="client_name"
              render={({ field }) => (
                <FormItem className="space-y-1.5">
                  <FormLabel className="text-xs text-muted-foreground">
                    Nome do cliente
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ex.: Marina Souza (Café Raízes)"
                      className="bg-background"
                      disabled={mutation.isPending}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="client_email"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-xs text-muted-foreground">
                      E-mail do cliente
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="cliente@email.com"
                        className="bg-background"
                        disabled={mutation.isPending}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="client_whatsapp"
                render={({ field }) => {
                  const digits = onlyDigits(field.value ?? "");
                  const showCounter = digits.length > 0 && !isValidBRPhone(field.value ?? "");
                  return (
                    <FormItem className="space-y-1.5">
                      <FormLabel className="text-xs text-muted-foreground">
                        WhatsApp <span className="text-muted-foreground/60">(opcional)</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          inputMode="tel"
                          autoComplete="tel"
                          maxLength={16}
                          placeholder="(11) 99999-9999"
                          className="bg-background"
                          disabled={mutation.isPending}
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(formatBRPhone(e.target.value))}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                        />
                      </FormControl>
                      {showCounter ? (
                        <p className="text-[10px] text-muted-foreground">
                          {digits.length}/11 dígitos
                        </p>
                      ) : null}
                      <FormMessage className="text-xs" />
                    </FormItem>
                  );
                }}
              />
            </div>

            <FormField
              control={form.control}
              name="price_masked"
              render={({ field }) => (
                <FormItem className="space-y-1.5">
                  <FormLabel className="text-xs text-muted-foreground">
                    Valor
                  </FormLabel>
                  <FormControl>
                    <Input
                      inputMode="numeric"
                      placeholder="R$ 0,00"
                      className="bg-background"
                      disabled={mutation.isPending}
                      value={field.value}
                      onChange={(e) =>
                        field.onChange(formatBRLInput(e.target.value))
                      }
                    />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="allowed_payment_methods"
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel className="text-xs text-muted-foreground">
                    Como você quer receber?
                  </FormLabel>
                  <FormControl>
                    <RadioGroup
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={mutation.isPending}
                      className="gap-2"
                    >
                      <label
                        htmlFor="pm-pix"
                        className={cn(
                          "flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-background/50 p-3 transition-colors",
                          field.value === "pix" && "border-primary/60 bg-accent/30",
                        )}
                      >
                        <RadioGroupItem id="pm-pix" value="pix" className="mt-0.5" />
                        <div className="space-y-0.5">
                          <p className="text-xs font-medium text-foreground">
                            Apenas Pix{" "}
                            <span className="ml-1 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-500">
                              Recomendado
                            </span>
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            Taxas menores e aprovação instantânea.
                          </p>
                        </div>
                      </label>
                      <label
                        htmlFor="pm-all"
                        className={cn(
                          "flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-background/50 p-3 transition-colors",
                          field.value === "all" && "border-primary/60 bg-accent/30",
                        )}
                      >
                        <RadioGroupItem id="pm-all" value="all" className="mt-0.5" />
                        <div className="space-y-0.5">
                          <p className="text-xs font-medium text-foreground">
                            Pix, Boleto e Cartão
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            Sujeito a taxas de parcelamento do gateway.
                          </p>
                        </div>
                      </label>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            <ReceivingSimulator
              priceMasked={form.watch("price_masked")}
              isPro={subscriptionActive}
            />

            {/* Dropzone */}
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Arquivo de entrega</p>
              {!file ? (
                <label
                  htmlFor="vault-file"
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragActive(true);
                  }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={onDrop}
                  className={cn(
                    "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-background/50 px-4 py-6 text-center transition-colors",
                    "hover:border-muted-foreground/40 hover:bg-accent/30",
                    dragActive && "border-primary/60 bg-accent/40"
                  )}
                >
                  <UploadCloud className="h-5 w-5 text-muted-foreground" />
                  <div className="space-y-0.5">
                    <p className="text-xs font-medium text-foreground">
                      Arraste um arquivo ou clique para selecionar
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Até 50MB · qualquer formato
                    </p>
                  </div>
                  <input
                    ref={inputRef}
                    id="vault-file"
                    type="file"
                    className="sr-only"
                    disabled={mutation.isPending}
                    onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                  />
                </label>
              ) : (
                <div className="flex items-center gap-3 rounded-lg border border-border bg-background/60 px-3 py-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card">
                    <FileText className="h-4 w-4 text-vault" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-foreground">
                      {file.name}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {formatBytes(file.size)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFile(null)}
                    disabled={mutation.isPending}
                    className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    aria-label="Remover arquivo"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>

            <FormField
              control={form.control}
              name="notify_client"
              render={({ field }) => (
                <FormItem className="flex items-start gap-2.5 rounded-md border border-border bg-background/50 p-3">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={(v) => field.onChange(v === true)}
                      disabled={mutation.isPending}
                      className="mt-0.5"
                    />
                  </FormControl>
                  <div className="space-y-0.5">
                    <FormLabel className="cursor-pointer text-xs font-medium text-foreground">
                      Enviar link por e-mail para o cliente agora
                    </FormLabel>
                    <p className="text-[11px] text-muted-foreground">
                      Você poderá reenviar manualmente depois.
                    </p>
                  </div>
                </FormItem>
              )}
            />

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
                disabled={mutation.isPending}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={mutation.isPending || !form.formState.isValid}
              >
                {mutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Criar cofre
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
    </>
  );
}

function ReceivingSimulator({
  priceMasked,
  isPro,
}: {
  priceMasked: string;
  isPro: boolean;
}) {
  const price = parseBRLToNumber(priceMasked || "");
  if (!price || price <= 0) return null;

  const platformFee = isPro ? 0 : Math.round(price * 0.029 * 100) / 100;
  const net = price - platformFee;

  return (
    <div className="space-y-2 rounded-lg border border-border bg-background/50 p-3">
      <div className="flex items-center gap-1.5">
        <Sparkles className="h-3.5 w-3.5 text-vault" />
        <p className="text-xs font-medium text-foreground">Simulação de recebimento</p>
      </div>
      <div className="space-y-1 text-[11px]">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Valor da venda</span>
          <span className="font-medium text-foreground">{formatBRL(price)}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground">
            Taxa PixelSafe{" "}
            {isPro ? (
              <span className="text-vault">(Plano Pro ✨)</span>
            ) : (
              <>
                (2,9%){" "}
                <span className="text-[10px] text-vault">
                  · Zere com o Plano Pro
                </span>
              </>
            )}
          </span>
          <span className="font-medium text-foreground">
            {isPro ? "R$ 0,00" : `- ${formatBRL(platformFee)}`}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Taxa Mercado Pago</span>
          <span className="text-muted-foreground">variável (prazo)</span>
        </div>
        <div className="mt-1 flex items-center justify-between border-t border-border pt-1.5">
          <span className="font-medium text-foreground">Você recebe</span>
          <span className="font-semibold text-foreground">~ {formatBRL(net)}</span>
        </div>
      </div>
    </div>
  );
}

