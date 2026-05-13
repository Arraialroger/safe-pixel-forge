import { useState } from "react";
import {
  Link2,
  Check,
  MoreHorizontal,
  Trash2,
  Loader2,
  MessageCircle,
  Mail,
  CalendarClock,
  History as HistoryIcon,
  ShieldCheck,
  User,
  Clock,
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Vault,
  formatBRL,
  statusLabel,
  isExpired,
  formatExpiryDate,
} from "@/data/mockVaults";
import { isExpiringSoon, expiringLabel } from "@/utils/vault";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { VaultTimeline } from "@/components/VaultTimeline";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface VaultCardProps {
  vault: Vault;
}

export function VaultCard({ vault }: VaultCardProps) {
  const isPaid = vault.status === "paid";
  const expired = isExpired(vault);
  const expiringSoon = isExpiringSoon(vault) && !isPaid;
  const urgencyLabel = expiringLabel(vault);
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

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
      const { data, error } = await supabase.functions.invoke(
        "resend-vault-email",
        {
          body: { vault_id: vault.id },
        }
      );
      if (error) {
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
          console.warn("Falha ao remover arquivo do storage:", storageErr);
        }
      }
      const { error } = await supabase
        .from("vaults")
        .delete()
        .eq("id", vault.id);
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

  const statusText = expired
    ? "Expirado"
    : expiringSoon
      ? urgencyLabel ?? "Expirando"
      : statusLabel(vault.status);

  return (
    <Card className="group overflow-hidden rounded-2xl border border-border bg-card shadow-soft transition-all duration-200 hover:border-muted-foreground/30 hover:bg-accent/30 hover:shadow-soft-lg">
      {/* Header: Badge + Menu */}
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-5 pb-0">
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
            expired
              ? "bg-destructive/15 text-destructive"
              : isPaid
                ? "bg-success/15 text-success"
                : expiringSoon
                  ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                  : "bg-primary/15 text-primary"
          )}
        >
          {statusText}
        </span>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              aria-label="Ações do cofre"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                if (!resendMutation.isPending && !expired)
                  resendMutation.mutate();
              }}
              disabled={resendMutation.isPending || expired}
            >
              {resendMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Mail className="mr-2 h-4 w-4" />
              )}
              Reenviar e-mail
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                setHistoryOpen(true);
              }}
            >
              <HistoryIcon className="mr-2 h-4 w-4" />
              Ver histórico
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
      </CardHeader>

      {/* Título e Cliente */}
      <CardContent className="space-y-1 p-5 pt-3">
        <h3 className="text-lg font-semibold leading-snug text-foreground line-clamp-2">
          {vault.title}
        </h3>
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <User className="h-3.5 w-3.5" strokeWidth={2} />
          <span className="truncate">{vault.client_name}</span>
        </p>

        {/* Bloco Financeiro */}
        <div className="mt-4 space-y-1.5">
          <p className="text-2xl font-bold tracking-tight text-foreground">
            {formatBRL(Number(vault.price))}
          </p>

          {vault.downloaded_at && (
            <p className="inline-flex items-center gap-1.5 rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">
              <ShieldCheck className="h-3 w-3" strokeWidth={2.5} />
              Entrega assinada
            </p>
          )}

          {vault.expires_at && (
            <p
              className={cn(
                "flex items-center gap-1.5 text-xs",
                expired
                  ? "text-destructive"
                  : expiringSoon
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-muted-foreground"
              )}
            >
              <CalendarClock className="h-3.5 w-3.5" />
              {expired ? "Expirou em " : "Expira em "}
              {formatExpiryDate(vault.expires_at)}
            </p>
          )}

          {!vault.expires_at && vault.created_at && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              Criado em {formatExpiryDate(vault.created_at)}
            </p>
          )}
        </div>
      </CardContent>

      {/* Rodapé de Ações */}
      <CardFooter className="grid grid-cols-[1fr_auto] gap-2 border-t border-border/60 px-5 py-4">
        <Button
          variant="secondary"
          size="sm"
          onClick={handleCopy}
          disabled={expired}
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
          size="sm"
          onClick={handleWhatsApp}
          disabled={expired}
          aria-label="Compartilhar via WhatsApp"
          title="Compartilhar via WhatsApp"
          className="bg-emerald-500 text-white hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-500 px-3"
        >
          <MessageCircle className="h-4 w-4" strokeWidth={2.25} />
        </Button>
      </CardFooter>

      {/* Dialogs */}
      <AlertDialog
        open={confirmOpen}
        onOpenChange={(o) => !deleteMutation.isPending && setConfirmOpen(o)}
      >
        <AlertDialogContent className="bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir este cofre?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O arquivo vinculado também será
              removido do storage.
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

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="bg-card sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HistoryIcon className="h-4 w-4 text-muted-foreground" />
              Histórico do cofre
            </DialogTitle>
            <DialogDescription className="truncate">
              {vault.title}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2 max-h-[60vh] overflow-y-auto pr-1">
            <VaultTimeline vaultId={vault.id} vaultTitle={vault.title} />
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
