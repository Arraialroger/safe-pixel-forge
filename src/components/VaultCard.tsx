import { Lock } from "lucide-react";
import { Vault, formatBRL } from "@/data/mockVaults";
import { cn } from "@/lib/utils";

interface VaultCardProps {
  vault: Vault;
}

export function VaultCard({ vault }: VaultCardProps) {
  const isPaid = vault.status === "pago";

  return (
    <article className="group rounded-lg border border-border bg-card p-5 transition-all duration-200 hover:border-muted-foreground/30 hover:bg-accent/30">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background">
            <Lock className="h-4 w-4 text-vault" strokeWidth={2.25} />
          </span>
          <h3 className="text-sm font-semibold leading-tight text-foreground">
            {vault.project}
          </h3>
        </div>

        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[11px] font-medium capitalize",
            isPaid
              ? "bg-success/15 text-success"
              : "bg-primary/15 text-primary",
          )}
        >
          {vault.status}
        </span>
      </header>

      <p className="mb-3 text-xs text-muted-foreground">
        Cliente · <span className="text-foreground/80">{vault.client}</span>
      </p>

      <p className="text-xl font-semibold tracking-tight text-foreground">
        {formatBRL(vault.amount)}
      </p>
    </article>
  );
}
