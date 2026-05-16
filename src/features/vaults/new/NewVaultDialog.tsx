import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Crown, MessageCircle, Plus } from "lucide-react";
import * as tus from "tus-js-client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { toast as legacyToast } from "@/hooks/use-toast";
import { toast as sonnerToast } from "sonner";
import { parseBRLToNumber } from "@/lib/currency";
import { normalizeBRPhone } from "@/lib/phone";
import { cn } from "@/lib/utils";
import type { Vault } from "@/data/mockVaults";
import {
  ACTIVE_STATUSES,
  FREE_ACTIVE_LIMIT,
  MAX_FREE_FILE,
  MAX_PRO_FILE,
  schema,
  type FormValues,
} from "./schema";
import { FormStep } from "./steps/FormStep";
import { UploadStep } from "./steps/UploadStep";
import { SuccessStep } from "./steps/SuccessStep";

type Step = "form" | "uploading" | "success";

export function NewVaultDialog() {
  const { user } = useAuth();
  const { isActive: subscriptionActive } = useSubscription();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("form");
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [createdVault, setCreatedVault] = useState<Vault | null>(null);
  const [vaultNumber, setVaultNumber] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const maxBytes = subscriptionActive ? MAX_PRO_FILE : MAX_FREE_FILE;
  const maxLabel = subscriptionActive ? "2GB" : "500MB";

  const activeCountQuery = useQuery({
    queryKey: ["vaults-active-count", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("vaults")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", user!.id)
        .in("status", ACTIVE_STATUSES as unknown as string[]);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const activeCount = activeCountQuery.data ?? 0;
  const showScarcity = !subscriptionActive && activeCount >= 3;

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
    setUploadProgress(0);
    setStep("form");
    setCreatedVault(null);
    setVaultNumber(null);
  }

  function handleNewClick() {
    if (activeCount >= FREE_ACTIVE_LIMIT && !subscriptionActive) {
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
    if (f.size > maxBytes) {
      legacyToast({
        title: "Arquivo acima do limite",
        description: subscriptionActive
          ? "O limite por arquivo no Plano Pro é de 2GB."
          : "O Plano PayGo permite até 500MB por arquivo. Faça upgrade para o Pro e envie até 2GB.",
        variant: "destructive",
      });
      return;
    }
    setFile(f);
  }

  async function uploadFileResumable(f: File, objectPath: string) {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) throw new Error("Sessão expirada. Faça login novamente.");
    const projectUrl = import.meta.env.VITE_SUPABASE_URL as string;

    await new Promise<void>((resolve, reject) => {
      const upload = new tus.Upload(f, {
        endpoint: `${projectUrl}/storage/v1/upload/resumable`,
        retryDelays: [0, 3000, 5000, 10000, 20000],
        headers: {
          authorization: `Bearer ${token}`,
          "x-upsert": "false",
        },
        uploadDataDuringCreation: true,
        removeFingerprintOnSuccess: true,
        metadata: {
          bucketName: "vault-files",
          objectName: objectPath,
          contentType: f.type || "application/octet-stream",
          cacheControl: "3600",
        },
        chunkSize: 6 * 1024 * 1024,
        onError: (err) => reject(err),
        onProgress: (sent, total) => {
          const pct = total > 0 ? Math.round((sent / total) * 100) : 0;
          setUploadProgress(pct);
        },
        onSuccess: () => {
          setUploadProgress(100);
          resolve();
        },
      });

      upload.findPreviousUploads().then((prev) => {
        if (prev.length) upload.resumeFromPreviousUpload(prev[0]);
        upload.start();
      });
    });
  }

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      if (!user) throw new Error("Sessão expirada. Faça login novamente.");

      const { count: currentActive, error: countErr } = await supabase
        .from("vaults")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", user.id)
        .in("status", ACTIVE_STATUSES as unknown as string[]);
      if (countErr) throw countErr;
      if ((currentActive ?? 0) >= FREE_ACTIVE_LIMIT && !subscriptionActive) {
        throw new Error(
          "Limite de 5 cofres ativos do plano PayGo atingido. Faça upgrade para o Plano Pro.",
        );
      }

      if (file && file.size > maxBytes) {
        throw new Error(
          subscriptionActive
            ? "Arquivo acima de 2GB."
            : "Arquivo acima de 500MB. Faça upgrade para o Plano Pro.",
        );
      }

      const price = parseBRLToNumber(values.price_masked);
      const whatsapp = values.client_whatsapp
        ? normalizeBRPhone(values.client_whatsapp)
        : "";
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
          status: "draft",
        })
        .select()
        .single();
      if (insertErr) throw insertErr;

      setStep("uploading");

      let filePath: string | null = null;
      if (file) {
        const safeName = file.name.replace(/[^\w.\-]+/g, "_");
        const path = `${user.id}/${vault.id}/${safeName}`;
        try {
          setUploadProgress(0);
          await uploadFileResumable(file, path);
          filePath = path;
        } catch (upErr) {
          await supabase.from("vaults").delete().eq("id", vault.id);
          throw upErr instanceof Error
            ? upErr
            : new Error("Falha no upload do arquivo.");
        }
      }

      const { error: updErr } = await supabase
        .from("vaults")
        .update({
          status: "pending",
          file_path: filePath,
          file_name: file ? file.name : null,
        })
        .eq("id", vault.id);
      if (updErr) {
        if (filePath) {
          await supabase.storage.from("vault-files").remove([filePath]);
        }
        await supabase.from("vaults").delete().eq("id", vault.id);
        throw updErr;
      }

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

      // Total de cofres do usuário (para o badge "Cofre #N").
      const { count: totalCount } = await supabase
        .from("vaults")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", user.id);

      const finalVault: Vault = {
        ...(vault as unknown as Vault),
        status: "pending",
        file_path: filePath,
        file_name: file ? file.name : null,
        client_whatsapp: whatsapp || null,
      };

      return { vault: finalVault, emailError, totalCount: totalCount ?? null };
    },
    onSuccess: ({ vault, emailError, totalCount }) => {
      queryClient.invalidateQueries({ queryKey: ["vaults"] });
      queryClient.invalidateQueries({
        queryKey: ["vaults-active-count", user?.id],
      });
      setCreatedVault(vault);
      setVaultNumber(totalCount);
      setStep("success");
      if (emailError) {
        legacyToast({
          title: "Cofre criado",
          description:
            "Não foi possível enviar o e-mail agora. Você pode reenviar manualmente.",
        });
      }
    },
    onError: (err: Error) => {
      setStep("form");
      legacyToast({
        title: "Erro ao criar cofre",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  function handleClose() {
    // Toast persistente com CTA WhatsApp quando o usuário fecha o success.
    if (step === "success" && createdVault) {
      const v = createdVault;
      const link = `${window.location.origin}/pay/${v.public_slug}`;
      sonnerToast("Cofre pronto para receber 💸", {
        description: `Compartilhe o link com ${v.client_name} para acelerar o pagamento.`,
        duration: Infinity,
        action: {
          label: "WhatsApp",
          onClick: () => {
            const text = `Olá! Preparei o arquivo do seu projeto "${v.title}". Acesse o link seguro para realizar o pagamento e liberar o download: ${link}`;
            const digits = v.client_whatsapp?.replace(/\D/g, "") ?? "";
            const url = digits
              ? `https://wa.me/55${digits}?text=${encodeURIComponent(text)}`
              : `https://wa.me/?text=${encodeURIComponent(text)}`;
            window.open(url, "_blank", "noopener,noreferrer");
          },
        },
      });
    }
    setOpen(false);
    resetAll();
  }

  return (
    <>
      <Button onClick={handleNewClick} className="relative w-full sm:w-auto">
        <Plus className="mr-1.5 h-4 w-4" />
        Novo Cofre
        {showScarcity && (
          <span
            className={cn(
              "ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
              activeCount >= FREE_ACTIVE_LIMIT
                ? "bg-destructive/20 text-destructive-foreground"
                : "bg-amber-500/20 text-amber-700 dark:text-amber-300",
            )}
            aria-label={`${activeCount} de ${FREE_ACTIVE_LIMIT} cofres ativos do plano PayGo`}
          >
            {activeCount}/{FREE_ACTIVE_LIMIT}
          </span>
        )}
      </Button>

      <AlertDialog open={paywallOpen} onOpenChange={setPaywallOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15 text-amber-500">
              <Crown className="h-6 w-6" strokeWidth={2.25} />
            </div>
            <AlertDialogTitle className="text-center">
              Limite do Plano PayGo atingido
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              Você atingiu o limite de 5 entregas ativas simultâneas do plano gratuito.
              Faça o upgrade para o PixelSafe Pro e crie cofres ilimitados, além de zerar a taxa de transação.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-center">
            <Button variant="ghost" onClick={() => setPaywallOpen(false)}>
              Agora não
            </Button>
            <AlertDialogAction
              onClick={() => {
                setPaywallOpen(false);
                navigate("/configuracoes");
              }}
            >
              <Crown className="mr-1.5 h-4 w-4" />
              Conhecer Plano Pro
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (mutation.isPending) return; // bloqueia fechar durante upload
          if (!o) {
            handleClose();
            return;
          }
          setOpen(o);
        }}
      >
        <DialogContent
          className="max-h-[90vh] overflow-y-auto bg-card sm:max-w-md"
          onInteractOutside={(e) => {
            if (mutation.isPending) e.preventDefault();
          }}
          onEscapeKeyDown={(e) => {
            if (mutation.isPending) e.preventDefault();
          }}
        >
          {step === "form" && (
            <FormStep
              form={form}
              file={file}
              onFileChange={handleFile}
              dragActive={dragActive}
              setDragActive={setDragActive}
              inputRef={inputRef}
              maxLabel={maxLabel}
              isPro={subscriptionActive}
              onCancel={handleClose}
              onSubmit={(values) => mutation.mutate(values)}
            />
          )}

          {step === "uploading" && (
            <UploadStep
              progress={uploadProgress}
              fileName={file?.name ?? null}
              hasFile={!!file}
            />
          )}

          {step === "success" && createdVault && (
            <SuccessStep
              vault={createdVault}
              vaultNumber={vaultNumber}
              onClose={handleClose}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

// Ícone re-exportado para tree-shaking não reclamar em testes futuros.
export { MessageCircle };
