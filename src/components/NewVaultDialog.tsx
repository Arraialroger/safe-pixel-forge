import { useState, useRef, DragEvent } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, UploadCloud, FileText, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { VaultStatus } from "@/data/mockVaults";
import { formatBRLInput, parseBRLToNumber } from "@/lib/currency";
import { cn } from "@/lib/utils";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

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
    .max(20, "Máximo de 20 caracteres.")
    .optional()
    .or(z.literal("")),
  price_masked: z
    .string()
    .min(1, "Informe o valor.")
    .refine((v) => parseBRLToNumber(v) > 0, "Valor deve ser maior que zero.")
    .refine(
      (v) => parseBRLToNumber(v) <= 9_999_999,
      "Valor muito alto."
    ),
  status: z.enum(["pending", "paid"]),
});

type FormValues = z.infer<typeof schema>;

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function NewVaultDialog() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: {
      title: "",
      client_name: "",
      client_email: "",
      client_whatsapp: "",
      price_masked: "",
      status: "pending",
    },
  });

  function resetAll() {
    form.reset();
    setFile(null);
    setDragActive(false);
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
      const price = parseBRLToNumber(values.price_masked);

      // 1. Insert vault
      const whatsapp = values.client_whatsapp?.trim();
      const { data: vault, error: insertErr } = await supabase
        .from("vaults")
        .insert({
          title: values.title.trim(),
          client_name: values.client_name.trim(),
          client_email: values.client_email.trim(),
          client_whatsapp: whatsapp ? whatsapp : null,
          price,
          status: values.status,
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

      return vault;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vaults"] });
      toast({
        title: "Cofre criado",
        description: "Seu cofre foi salvo com sucesso.",
      });
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
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (mutation.isPending) return;
        setOpen(o);
        if (!o) resetAll();
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-1.5 h-4 w-4" />
          Novo Cofre
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-card sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo cofre</DialogTitle>
          <DialogDescription>
            Crie um cofre para guardar a entrega e o pagamento de um projeto.
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
                    Nome do projeto
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ex.: Logo Café Raíz"
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
                      placeholder="Ex.: Marina Souza"
                      className="bg-background"
                      disabled={mutation.isPending}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
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
                name="status"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-xs text-muted-foreground">
                      Status
                    </FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(v) => field.onChange(v as VaultStatus)}
                      disabled={mutation.isPending}
                    >
                      <FormControl>
                        <SelectTrigger className="bg-background">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="pending">Pendente</SelectItem>
                        <SelectItem value="paid">Pago</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />
            </div>

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
  );
}
