import { useState } from "react";
import { VaultCard } from "@/components/VaultCard";
import { NewVaultDialog } from "@/components/NewVaultDialog";
import { Vault, initialVaults } from "@/data/mockVaults";

export default function Dashboard() {
  const [vaults, setVaults] = useState<Vault[]>(initialVaults);

  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Cofres
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gerencie as entregas e pagamentos dos seus projetos.
          </p>
        </div>
        <NewVaultDialog onCreate={(v) => setVaults((prev) => [v, ...prev])} />
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {vaults.map((vault) => (
          <VaultCard key={vault.id} vault={vault} />
        ))}
      </section>
    </div>
  );
}
