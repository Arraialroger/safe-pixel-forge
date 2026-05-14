import { useState } from "react";
import {
  Lock,
  Link2,
  Check,
  Trash2,
  Loader2,
  MessageCircle,
  Mail,
  History as HistoryIcon,
  ShieldCheck,
} from "lucide-react";
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
import { useVaultActions } from "@/hooks/useVaultActions";

export interface VaultRowProps {
  vault: Vault;
  signatureIp?: string | null;
}

function StatusBadge({ vault }: { vault: Vault }) {
  const isPaid = vault.status === "paid";
  const expired = isExpired(vault);
  const expiringSoon = isExpiringSoon(vault) && !isPaid;
  const urgency = expiringLabel(vault);

  return (
    <span
      className={cn(
        "inline-flex w-fit shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
        expired
          ? "bg-destructive/15 text-destructive"
          : isPaid
            ? "bg-success/15 text-success"
            : expiringSoon
              ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
              : "bg-primary/15 text-primary",
      )}
    >
      {expired
        ? "Expirado"
        : expiringSoon
          ? urgency ?? "Expirando"
          : statusLabel(vault.status)}
    </span>
  );
}

function SignatureBadge({ ip }: { ip?: string | null }) {
  return (
    <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">
      <ShieldCheck className="h-3 w-3" strokeWidth={2.5} />
      Entrega assinada
      {ip && <span className="font-mono text-[10px] opacity-80">· {ip}</span>}
    </span>
  );
}

function formatShortDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

export function VaultRow({ vault, signatureIp }: VaultRowProps) {
  const expired = isExpired(vault);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { copied, copyLink, openWhatsApp, resend, remove } = useVaultActions(vault);

  const actions = (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setHistoryOpen(true)}
        className="h-8 gap-1.5 px-2 text-muted-foreground hover:text-foreground"
        aria-label="Ver histórico"
      >
        <HistoryIcon className="h-3.5 w-3.5" />
        <span className="text-xs">Histórico</span>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => resend.mutate()}
        disabled={resend.isPending || expired}
        className="h-8 gap-1.5 px-2 text-muted-foreground hover:text-foreground"
        aria-label="Reenviar e-mail"
      >
        {resend.isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Mail className="h-3.5 w-3.5" />
        )}
        <span className="text-xs">Reenviar</span>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={openWhatsApp}
        disabled={expired}
        className="h-8 gap-1.5 px-2 text-success hover:text-success"
        aria-label="Compartilhar via WhatsApp"
      >
        <MessageCircle className="h-3.5 w-3.5" strokeWidth={2.25} />
        <span className="text-xs">WhatsApp</span>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={copyLink}
        disabled={expired}
        className="h-8 gap-1.5 px-2 text-muted-foreground hover:text-foreground"
        aria-label="Copiar link de pagamento"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-success" />
        ) : (
          <Link2 className="h-3.5 w-3.5" />
        )}
        <span className="text-xs">{copied ? "Copiado" : "Copiar link"}</span>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setConfirmOpen(true)}
        className="h-8 gap-1.5 px-2 text-destructive/80 hover:bg-destructive/10 hover:text-destructive"
        aria-label="Excluir cofre"
      >
        <Trash2 className="h-3.5 w-3.5" />
        <span className="text-xs">Excluir</span>
      </Button>
    </>
  );

  return (
    <>
      {/* Desktop row */}
      <div className="hidden items-center gap-3 border-b border-border px-4 py-3 transition-colors hover:bg-accent/30 md:grid md:grid-cols-[110px_minmax(0,1fr)_120px_90px_90px_180px_auto]">
        <StatusBadge vault={vault} />

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Lock className="h-3.5 w-3.5 shrink-0 text-vault" strokeWidth={2.25} />
            <p className="truncate text-sm font-semibold text-foreground">
              {vault.title}
            </p>
          </div>
          <p className="truncate pl-5 text-xs text-muted-foreground">
            {vault.client_name}
          </p>
        </div>

        <p className="text-sm font-semibold tabular-nums text-foreground">
          {formatBRL(Number(vault.price))}
        </p>

        <p className="text-xs tabular-nums text-muted-foreground">
          {formatShortDate(vault.created_at)}
        </p>
        <p
          className={cn(
            "text-xs tabular-nums",
            expired ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {formatExpiryDate(vault.expires_at) ?? "—"}
        </p>

        <div className="min-w-0">
          {signatureIp !== undefined ? (
            <SignatureBadge ip={signatureIp} />
          ) : (
            <span className="text-xs text-muted-foreground/60">—</span>
          )}
        </div>

        <div className="flex items-center justify-end gap-1">{actions}</div>
      </div>

      {/* Mobile card */}
      <div className="rounded-xl border border-border bg-card p-4 shadow-soft md:hidden">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Lock className="h-3.5 w-3.5 shrink-0 text-vault" strokeWidth={2.25} />
              <p className="truncate text-sm font-semibold text-foreground">
                {vault.title}
              </p>
            </div>
            <p className="mt-0.5 truncate pl-5 text-xs text-muted-foreground">
              {vault.client_name}
            </p>
          </div>
          <StatusBadge vault={vault} />
        </div>

        <div className="mb-3 grid grid-cols-2 gap-2 text-xs">
          <div>
            <p className="text-muted-foreground">Valor</p>
            <p className="font-semibold tabular-nums text-foreground">
              {formatBRL(Number(vault.price))}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Expira</p>
            <p
              className={cn(
                "tabular-nums",
                expired ? "text-destructive" : "text-foreground",
              )}
            >
              {formatExpiryDate(vault.expires_at) ?? "—"}
            </p>
          </div>
        </div>

        {signatureIp !== undefined && (
          <div className="mb-3">
            <SignatureBadge ip={signatureIp} />
          </div>
        )}

        <div className="grid grid-cols-2 gap-1.5">{actions}</div>
      </div>

      <AlertDialog
        open={confirmOpen}
        onOpenChange={(o) => !remove.isPending && setConfirmOpen(o)}
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
            <AlertDialogCancel disabled={remove.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                remove.mutate(undefined, { onSuccess: () => setConfirmOpen(false) });
              }}
              disabled={remove.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {remove.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
            <DialogDescription className="truncate">{vault.title}</DialogDescription>
          </DialogHeader>
          <div className="mt-2 max-h-[60vh] overflow-y-auto pr-1">
            <VaultTimeline vaultId={vault.id} vaultTitle={vault.title} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
