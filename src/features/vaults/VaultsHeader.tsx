import { HelpCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { NewVaultDialog } from "@/features/vaults/new/NewVaultDialog";

export function VaultsHeader() {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
          Seus cofres
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            title="Central de ajuda"
          >
            <Link to="/configuracoes?tab=ajuda" aria-label="Central de ajuda">
              <HelpCircle className="h-4 w-4" />
            </Link>
          </Button>
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
