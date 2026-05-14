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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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

export const VAULT_GRID_COLS =
  "grid-cols-[96px_minmax(0,1fr)_110px_92px_56px_180px]";

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

function formatShortDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

interface IconActionProps {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon: React.ReactNode;
  className?: string;
  destructive?: boolean;
}

function IconAction({
  label,
  onClick,
  disabled,
  loading,
  icon,
  className,
  destructive,
}: IconActionProps) {
  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClick}
          disabled={disabled || loading}
          aria-label={label}
          className={cn(
            "h-8 w-8 text-muted-foreground hover:text-foreground",
            destructive &&
              "text-destructive/80 hover:bg-destructive/10 hover:text-destructive",
            className,
          )}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}

export function VaultRow({ vault, signatureIp }: VaultRowProps) {
  const expired = isExpired(vault);
  const isSigned = signatureIp !== undefined;
  const [historyOpen, setHistoryOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { copied, copyLink, openWhatsApp, resend, remove } = useVaultActions(vault);

  const desktopActions = (
    <>
      <IconAction
        label="Ver histórico"
        icon={<HistoryIcon className="h-4 w-4" />}
        onClick={() => setHistoryOpen(true)}
      />
      <IconAction
        label="Reenviar e-mail"
        icon={<Mail className="h-4 w-4" />}
        onClick={() => resend.mutate()}
        loading={resend.isPending}
        disabled={expired}
      />
      <IconAction
        label="Compartilhar no WhatsApp"
        icon={<MessageCircle className="h-4 w-4" strokeWidth={2.25} />}
        onClick={openWhatsApp}
        disabled={expired}
        className="text-success hover:text-success"
      />
      <IconAction
        label={copied ? "Link copiado" : "Copiar link de pagamento"}
        icon={
          copied ? (
            <Check className="h-4 w-4 text-success" />
          ) : (
            <Link2 className="h-4 w-4" />
          )
        }
        onClick={copyLink}
        disabled={expired}
      />
      <IconAction
        label="Excluir cofre"
        icon={<Trash2 className="h-4 w-4" />}
        onClick={() => setConfirmOpen(true)}
        destructive
      />
    </>
  );

  const mobileActions = (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setHistoryOpen(true)}
        className="h-9 justify-start gap-2 text-muted-foreground hover:text-foreground"
      >
        <HistoryIcon className="h-4 w-4" />
        <span className="text-xs">Histórico</span>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => resend.mutate()}
        disabled={resend.isPending || expired}
        className="h-9 justify-start gap-2 text-muted-foreground hover:text-foreground"
      >
        {resend.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Mail className="h-4 w-4" />
        )}
        <span className="text-xs">Reenviar</span>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={openWhatsApp}
        disabled={expired}
        className="h-9 justify-start gap-2 text-success hover:text-success"
      >
        <MessageCircle className="h-4 w-4" strokeWidth={2.25} />
        <span className="text-xs">WhatsApp</span>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={copyLink}
        disabled={expired}
        className="h-9 justify-start gap-2 text-muted-foreground hover:text-foreground"
      >
        {copied ? (
          <Check className="h-4 w-4 text-success" />
        ) : (
          <Link2 className="h-4 w-4" />
        )}
        <span className="text-xs">{copied ? "Copiado" : "Copiar link"}</span>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setConfirmOpen(true)}
        className="col-span-2 h-9 justify-start gap-2 text-destructive/80 hover:bg-destructive/10 hover:text-destructive"
      >
        <Trash2 className="h-4 w-4" />
        <span className="text-xs">Excluir</span>
      </Button>
    </>
  );

  return (
    <>
      {/* Desktop row */}
      <div
        className={cn(
          "hidden items-center gap-3 border-b border-border px-4 py-3 transition-colors hover:bg-accent/30 md:grid",
          VAULT_GRID_COLS,
        )}
      >
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

        <p className="text-right text-sm font-semibold tabular-nums text-foreground">
          {formatBRL(Number(vault.price))}
        </p>

        <p
          className={cn(
            "text-right text-xs tabular-nums",
            expired ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {formatExpiryDate(vault.expires_at) ?? "—"}
        </p>

        <div className="flex justify-center">
          {isSigned ? (
            <Tooltip delayDuration={200}>
              <TooltipTrigger asChild>
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-success/15 text-success">
                  <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2.5} />
                </span>
              </TooltipTrigger>
              <TooltipContent side="top">
                Entrega assinada
                {signatureIp ? ` · ${signatureIp}` : ""}
              </TooltipContent>
            </Tooltip>
          ) : (
            <span className="text-xs text-muted-foreground/50">—</span>
          )}
        </div>

        <div className="flex items-center justify-end gap-0.5">
          {desktopActions}
        </div>
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

        {isSigned && (
          <div className="mb-3">
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">
              <ShieldCheck className="h-3 w-3" strokeWidth={2.5} />
              Entrega assinada
              {signatureIp && (
                <span className="font-mono text-[10px] opacity-80">· {signatureIp}</span>
              )}
            </span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-1.5">{mobileActions}</div>
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
