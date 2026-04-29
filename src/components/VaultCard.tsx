import { useState } from "react";
import { Lock, Link2, Check, MoreHorizontal, Trash2, Loader2, MessageCircle, Mail } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Vault, formatBRL, statusLabel } from "@/data/mockVaults";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface VaultCardProps {
  vault: Vault;
}

export function VaultCard({ vault }: VaultCardProps) {
  const isPaid = vault.status === "paid";
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function handleCopy() {
    const url = `${window.location.origin}/pay/${vault.public_slug}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast({
        title: "Link copiado!",
        description: "Envie para o seu cliente.",
      });
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({
        title: "Não foi possível copiar o link",
        description: "Copie manualmente: " + url,
        variant: "destructive",
      });
    }
  }

  function handleWhatsApp() {
    const link = `${window.location.origin}/pay/${vault.public_slug}`;
    const text = isPaid
      ? `Pagamento confirmado! Seu arquivo já está disponível para download. Acesse pelo link: ${link}`
      : `Olá! Preparei o arquivo do seu projeto. Acesse o link seguro para realizar o pagamento e liberar o download: ${link}`;
    const encoded = encodeURIComponent(text);
    const digits = vault.client_whatsapp?.replace(/\D/g, "") ?? "";
    const url = digits
      ? `https://wa.me/55${digits}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  const resendMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("resend-vault-email", {
        body: { vault_id: vault.id },
      });
      if (error) {
        // Tenta extrair a mensagem do corpo retornado pela edge function.
        const ctx = (error as { context?: Response }).context;
        if (ctx && typeof ctx.json === "function") {
          try {
            const body = await ctx.json();
            if (body?.error) throw new Error(body.error);
          } catch (_) {
            // fallthrough
          }
        }
        throw new Error(error.message || "Falha ao reenviar e-mail");
      }
      return data as { success: boolean; kind: "pending" | "paid" };
    },
    onSuccess: (data) => {
      toast({
        title: "E-mail enviado",
        description:
          data?.kind === "paid"
            ? "O cliente recebeu o link de download."
            : "O cliente recebeu o link de pagamento.",
      });
    },
    onError: (err: Error) => {
      toast({
        title: "Erro ao reenviar e-mail",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (vault.file_path) {
        const { error: storageErr } = await supabase.storage
          .from("vault-files")
          .remove([vault.file_path]);
        if (storageErr) {
          // best-effort: continue with row delete even if storage fails
          console.warn("Falha ao remover arquivo do storage:", storageErr);
        }
      }
      const { error } = await supabase.from("vaults").delete().eq("id", vault.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vaults"] });
      toast({
        title: "Cofre excluído",
        description: "O cofre foi removido com sucesso.",
      });
      setConfirmOpen(false);
    },
    onError: (err: Error) => {
      toast({
        title: "Erro ao excluir cofre",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  return (
    <article className="group rounded-lg border border-border bg-card p-5 transition-all duration-200 hover:border-muted-foreground/30 hover:bg-accent/30">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-background">
            <Lock className="h-4 w-4 text-vault" strokeWidth={2.25} />
          </span>
          <h3 className="truncate text-sm font-semibold leading-tight text-foreground">
            {vault.title}
          </h3>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[11px] font-medium",
              isPaid ? "bg-success/15 text-success" : "bg-primary/15 text-primary",
            )}
          >
            {statusLabel(vault.status)}
          </span>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                aria-label="Ações do cofre"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  if (!resendMutation.isPending) resendMutation.mutate();
                }}
                disabled={resendMutation.isPending}
              >
                {resendMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Mail className="mr-2 h-4 w-4" />
                )}
                Reenviar e-mail
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  setConfirmOpen(true);
                }}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Excluir cofre
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <p className="mb-3 text-xs text-muted-foreground">
        Cliente · <span className="text-foreground/80">{vault.client_name}</span>
      </p>

      <p className="mb-4 text-xl font-semibold tracking-tight text-foreground">
        {formatBRL(Number(vault.price))}
      </p>

      <div className="grid grid-cols-[1fr_auto] gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopy}
          className="w-full"
        >
          {copied ? (
            <Check className="mr-1.5 h-3.5 w-3.5 text-success" />
          ) : (
            <Link2 className="mr-1.5 h-3.5 w-3.5" />
          )}
          {copied ? "Link copiado" : "Copiar link"}
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={handleWhatsApp}
          aria-label="Compartilhar via WhatsApp"
          title="Compartilhar via WhatsApp"
          className="px-2.5 text-success hover:text-success"
        >
          <MessageCircle className="h-3.5 w-3.5" strokeWidth={2.25} />
        </Button>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={(o) => !deleteMutation.isPending && setConfirmOpen(o)}>
        <AlertDialogContent className="bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir este cofre?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O arquivo vinculado também será removido do storage.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                deleteMutation.mutate();
              }}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </article>
  );
}
