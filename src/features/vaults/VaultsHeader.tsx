import { NewVaultDialog } from "@/components/NewVaultDialog";

export function VaultsHeader() {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Seus cofres
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gestão completa das suas entregas e cobranças.
        </p>
      </div>
      <div className="w-full sm:w-auto">
        <NewVaultDialog />
      </div>
    </header>
  );
}
