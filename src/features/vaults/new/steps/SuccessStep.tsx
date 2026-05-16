import { CheckCircle2, MessageCircle, Copy, History, X, Sparkles } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import type { Vault } from "@/data/mockVaults";

interface SuccessStepProps {
  vault: Vault;
  vaultNumber: number | null;
  onClose: () => void;
}

export function SuccessStep({ vault, vaultNumber, onClose }: SuccessStepProps) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const link = `${window.location.origin}/pay/${vault.public_slug}`;

  function openWhatsApp() {
    const text = `Olá! Preparei o arquivo do seu projeto "${vault.title}". Acesse o link seguro para realizar o pagamento e liberar o download: ${link}`;
    const digits = vault.client_whatsapp?.replace(/\D/g, "") ?? "";
    const url = digits
      ? `https://wa.me/55${digits}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Não foi possível copiar. Copie manualmente: " + link);
    }
  }

  return (
    <>
      <DialogHeader>
        <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15">
          <CheckCircle2 className="h-7 w-7 text-emerald-500" strokeWidth={2.25} />
        </div>
        <DialogTitle className="text-center">Cofre criado com sucesso</DialogTitle>
        <DialogDescription className="text-center">
          Compartilhe o link com {vault.client_name} para receber o pagamento.
        </DialogDescription>
        {vaultNumber !== null && (
          <div className="mx-auto mt-2 inline-flex items-center gap-1.5 rounded-full border border-vault/30 bg-vault/10 px-3 py-1 text-[11px] font-semibold text-vault">
            <Sparkles className="h-3 w-3" />
            Cofre #{vaultNumber} criado
          </div>
        )}
      </DialogHeader>

      <div className="space-y-3 py-2">
        <div className="rounded-lg border border-border bg-background/60 p-3">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Link do cofre
          </p>
          <p className="mt-1 truncate text-xs font-medium text-foreground">{link}</p>
        </div>

        <Button
          type="button"
          onClick={openWhatsApp}
          className="w-full bg-emerald-500 text-white hover:bg-emerald-600"
        >
          <MessageCircle className="mr-2 h-4 w-4" />
          {vault.client_whatsapp ? "Enviar pelo WhatsApp" : "Abrir WhatsApp"}
        </Button>

        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" onClick={copyLink}>
            <Copy className="mr-1.5 h-3.5 w-3.5" />
            {copied ? "Copiado!" : "Copiar link"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(`/conquista/${vault.id}`)}
          >
            <History className="mr-1.5 h-3.5 w-3.5" />
            Ver conquista
          </Button>
        </div>
      </div>

      <DialogFooter className="pt-2 sm:justify-center">
        <Button type="button" variant="ghost" onClick={onClose}>
          <X className="mr-1.5 h-3.5 w-3.5" />
          Fechar
        </Button>
      </DialogFooter>
    </>
  );
}
