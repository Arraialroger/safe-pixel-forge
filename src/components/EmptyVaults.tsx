import { Lock } from "lucide-react";
import { NewVaultDialog } from "@/components/NewVaultDialog";

export function EmptyVaults() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/40 px-6 py-16 text-center shadow-soft">
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-border bg-background">
        <Lock className="h-6 w-6 text-vault" strokeWidth={2.25} />
      </div>
      <h2 className="text-base font-semibold text-foreground">
        Nenhum cofre ainda
      </h2>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
        Crie seu primeiro cofre para guardar a entrega e o pagamento de um projeto. Seu cliente recebe um link e libera o arquivo após pagar.
      </p>
      <div className="mt-6">
        <NewVaultDialog />
      </div>
    </div>
  );
}
