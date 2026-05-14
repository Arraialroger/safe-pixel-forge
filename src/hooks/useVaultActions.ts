import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { Vault } from "@/data/mockVaults";

export function useVaultActions(vault: Vault) {
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);

  const link = `${window.location.origin}/pay/${vault.public_slug}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast({ title: "Link copiado!", description: "Envie para o seu cliente." });
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({
        title: "Não foi possível copiar o link",
        description: "Copie manualmente: " + link,
        variant: "destructive",
      });
    }
  }

  function openWhatsApp() {
    const isPaid = vault.status === "paid";
    const text = isPaid
      ? `Pagamento confirmado! Seu arquivo já está disponível para download. Acesse pelo link: ${link}`
      : `Olá! Preparei o arquivo do seu projeto. Acesse o link seguro para realizar o pagamento e liberar o download: ${link}`;
    const encoded = encodeURIComponent(text);
    const digits = vault.client_whatsapp?.replace(/\D/g, "") ?? "";
    const url = digits
      ? `https://wa.me/55${digits}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  const resend = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("resend-vault-email", {
        body: { vault_id: vault.id },
      });
      if (error) {
        const ctx = (error as { context?: Response }).context;
        if (ctx && typeof ctx.json === "function") {
          try {
            const body = await ctx.json();
            if (body?.error) throw new Error(body.error);
          } catch (_) {
            // fallthrough
          }
        }
        throw new Error(error.message || "Falha ao reenviar e-mail");
      }
      return data as { success: boolean; kind: "pending" | "paid" };
    },
    onSuccess: (data) => {
      toast({
        title: "E-mail enviado",
        description:
          data?.kind === "paid"
            ? "O cliente recebeu o link de download."
            : "O cliente recebeu o link de pagamento.",
      });
    },
    onError: (err: Error) => {
      toast({
        title: "Erro ao reenviar e-mail",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const remove = useMutation({
    mutationFn: async () => {
      if (vault.file_path) {
        const { error: storageErr } = await supabase.storage
          .from("vault-files")
          .remove([vault.file_path]);
        if (storageErr) console.warn("Falha ao remover arquivo do storage:", storageErr);
      }
      const { error } = await supabase.from("vaults").delete().eq("id", vault.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vaults"] });
      toast({ title: "Cofre excluído", description: "O cofre foi removido com sucesso." });
    },
    onError: (err: Error) => {
      toast({
        title: "Erro ao excluir cofre",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  return { link, copied, copyLink, openWhatsApp, resend, remove };
}
