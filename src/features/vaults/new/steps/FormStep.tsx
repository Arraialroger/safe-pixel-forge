import { DragEvent, RefObject } from "react";
import { UseFormReturn } from "react-hook-form";
import { UploadCloud, FileText, X, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { formatBRLInput, parseBRLToNumber } from "@/lib/currency";
import { formatBRPhone, isValidBRPhone, onlyDigits } from "@/lib/phone";
import type { FormValues } from "../schema";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

interface FormStepProps {
  form: UseFormReturn<FormValues>;
  file: File | null;
  onFileChange: (f: File | null) => void;
  dragActive: boolean;
  setDragActive: (v: boolean) => void;
  inputRef: RefObject<HTMLInputElement>;
  maxLabel: string;
  isPro: boolean;
  onCancel: () => void;
  onSubmit: (v: FormValues) => void;
}

export function FormStep({
  form,
  file,
  onFileChange,
  dragActive,
  setDragActive,
  inputRef,
  maxLabel,
  isPro,
  onCancel,
  onSubmit,
}: FormStepProps) {
  function onDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragActive(false);
    onFileChange(e.dataTransfer.files?.[0] ?? null);
  }

  return (
    <>
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
                const showCounter =
                  digits.length > 0 && !isValidBRPhone(field.value ?? "");
                return (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-xs text-muted-foreground">
                      WhatsApp{" "}
                      <span className="text-muted-foreground/60">(opcional)</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        inputMode="tel"
                        autoComplete="tel"
                        maxLength={16}
                        placeholder="(11) 99999-9999"
                        className="bg-background"
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
                <FormLabel className="text-xs text-muted-foreground">Valor</FormLabel>
                <FormControl>
                  <Input
                    inputMode="numeric"
                    placeholder="R$ 0,00"
                    className="bg-background"
                    value={field.value}
                    onChange={(e) => field.onChange(formatBRLInput(e.target.value))}
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
            isPro={isPro}
          />

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
                  dragActive && "border-primary/60 bg-accent/40",
                )}
              >
                <UploadCloud className="h-5 w-5 text-muted-foreground" />
                <div className="space-y-0.5">
                  <p className="text-xs font-medium text-foreground">
                    Arraste um arquivo ou clique para selecionar
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Até {maxLabel} · qualquer formato
                  </p>
                </div>
                <input
                  ref={inputRef}
                  id="vault-file"
                  type="file"
                  className="sr-only"
                  onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
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
                  onClick={() => onFileChange(null)}
                  className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  aria-label="Remover arquivo"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            <p className="text-[11px] text-muted-foreground">
              💡 Dica: Precisa enviar vários arquivos do projeto? Compacte tudo em um único arquivo .ZIP e envie aqui.
            </p>
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
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!form.formState.isValid}>
              Criar cofre
            </Button>
          </DialogFooter>
        </form>
      </Form>
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
