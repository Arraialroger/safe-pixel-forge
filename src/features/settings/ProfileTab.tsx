import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ImagePlus, Loader2, Trash2, Lock } from "lucide-react";
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
import { supabase } from "@/integrations/supabase/client";

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

const ALLOWED_LOGO_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
const MAX_LOGO_BYTES = 2 * 1024 * 1024;

function withCacheBust(url: string | null | undefined, version: number | string): string | null {
  if (!url) return null;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}v=${version}`;
}

export function ProfileTab({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
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
      toast({ title: "Erro ao remover logo", variant: "destructive" });
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
            <div className="flex items-start gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-background">
                {currentLogo ? (
                  <img src={currentLogo} alt="Logo" className="h-full w-full object-contain" />
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
