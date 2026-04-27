import { FormEvent, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";
import { Vault, VaultStatus } from "@/data/mockVaults";

interface NewVaultDialogProps {
  onCreate: (vault: Vault) => void;
}

export function NewVaultDialog({ onCreate }: NewVaultDialogProps) {
  const [open, setOpen] = useState(false);
  const [project, setProject] = useState("");
  const [client, setClient] = useState("");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<VaultStatus>("pendente");

  function reset() {
    setProject("");
    setClient("");
    setAmount("");
    setStatus("pendente");
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!project.trim() || !client.trim() || !amount) return;
    const numericAmount = Number(amount.replace(",", "."));
    if (Number.isNaN(numericAmount) || numericAmount <= 0) return;

    onCreate({
      id: `v-${Date.now()}`,
      project: project.trim(),
      client: client.trim(),
      amount: numericAmount,
      status,
    });
    reset();
    setOpen(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-1.5 h-4 w-4" />
          Novo Cofre
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-card sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo cofre</DialogTitle>
          <DialogDescription>
            Crie um cofre para guardar a entrega e o pagamento de um projeto.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="project" className="text-xs text-muted-foreground">
              Nome do projeto
            </Label>
            <Input
              id="project"
              placeholder="Ex.: Logo Café Raíz"
              value={project}
              onChange={(e) => setProject(e.target.value)}
              className="bg-background"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="client" className="text-xs text-muted-foreground">
              Nome do cliente
            </Label>
            <Input
              id="client"
              placeholder="Ex.: Marina Souza"
              value={client}
              onChange={(e) => setClient(e.target.value)}
              className="bg-background"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="amount" className="text-xs text-muted-foreground">
                Valor (R$)
              </Label>
              <Input
                id="amount"
                inputMode="decimal"
                placeholder="850,00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="bg-background"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as VaultStatus)}>
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="pago">Pago</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit">Criar cofre</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
