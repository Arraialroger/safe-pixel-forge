import { Link } from "react-router-dom";
import { Lock } from "lucide-react";
import { Vault, formatBRL, statusLabel, isExpired } from "@/data/mockVaults";
import { isExpiringSoon, expiringLabel } from "@/utils/vault";
import { cn } from "@/lib/utils";

interface VaultRecentItemProps {
  vault: Vault;
}

export function VaultRecentItem({ vault }: VaultRecentItemProps) {
  const isPaid = vault.status === "paid";
  const expired = isExpired(vault);
  const expiringSoon = isExpiringSoon(vault) && !isPaid;
  const urgency = expiringLabel(vault);

  return (
    <Link
      to="/cofres"
      className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-accent/40"
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-background">
        <Lock className="h-3.5 w-3.5 text-vault" strokeWidth={2.25} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{vault.title}</p>
        <p className="truncate text-xs text-muted-foreground">{vault.client_name}</p>
      </div>
      <p className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
        {formatBRL(Number(vault.price))}
      </p>
      <span
        className={cn(
          "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
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
    </Link>
  );
}
