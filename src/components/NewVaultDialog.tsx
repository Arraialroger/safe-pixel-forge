import { FormEvent, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";
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
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { VaultStatus } from "@/data/mockVaults";

export function NewVaultDialog() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [clientName, setClientName] = useState("");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<VaultStatus>("pending");

  function reset() {
    setTitle("");
    setClientName("");
    setAmount("");
    setStatus("pending");
  }

  const mutation = useMutation({
    mutationFn: async (payload: {
      title: string;
      client_name: string;
      price: number;
      status: VaultStatus;
    }) => {
      if (!user) throw new Error("Sessão expirada. Faça login novamente.");
      const { data, error } = await supabase
        .from("vaults")
        .insert({ ...payload, owner_id: user.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vaults"] });
      toast({ title: "Cofre criado", description: "Seu cofre foi salvo com sucesso." });
      reset();
      setOpen(false);
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao criar cofre", description: err.message, variant: "destructive" });
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !clientName.trim() || !amount) return;
    const numericAmount = Number(amount.replace(",", "."));
    if (Number.isNaN(numericAmount) || numericAmount <= 0) return;

    mutation.mutate({
      title: title.trim(),
      client_name: clientName.trim(),
      price: numericAmount,
      status,
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (mutation.isPending) return;
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
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-background"
              disabled={mutation.isPending}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="client" className="text-xs text-muted-foreground">
              Nome do cliente
            </Label>
            <Input
              id="client"
              placeholder="Ex.: Marina Souza"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="bg-background"
              disabled={mutation.isPending}
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
                disabled={mutation.isPending}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as VaultStatus)}
                disabled={mutation.isPending}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="paid">Pago</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={mutation.isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar cofre
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
