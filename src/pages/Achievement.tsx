import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Copy, Loader2, Share2, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { formatBRL } from "@/data/mockVaults";
import { toast } from "@/hooks/use-toast";

interface AchievementData {
  id: string;
  title: string;
  price: number;
  paid_at: string | null;
}

export default function Achievement() {
  const { id } = useParams<{ id: string }>();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["achievement", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_achievement_data", {
        p_vault_id: id!,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return (row ?? null) as AchievementData | null;
    },
  });

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-background via-background to-vault/10 px-4 py-10">
      <div className="mb-8">
        <Logo size="md" />
      </div>

      <div className="w-full max-w-md">
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!isLoading && (isError || !data) && (
          <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-soft-lg">
            <h1 className="text-base font-semibold text-foreground">
              Conquista não encontrada
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Este link é inválido ou o pagamento ainda não foi confirmado.
            </p>
          </div>
        )}

        {data && <AchievementCard data={data} />}
      </div>

      {data && (
        <div className="mt-10 max-w-md text-center">
          <a
            href="/?ref=achievement"
            className="inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Comece a receber pelos seus projetos com segurança no PixelSafe →
          </a>
        </div>
      )}
    </main>
  );
}

function AchievementCard({ data }: { data: AchievementData }) {
  const shareUrl = typeof window !== "undefined" ? window.location.href : "";
  const priceStr = formatBRL(Number(data.price));

  const waText = encodeURIComponent(
    `🎉 Mais um projeto entregue e pago via PixelSafe!\n\n` +
      `📦 ${data.title}\n💰 ${priceStr}\n\n` +
      `Veja: ${shareUrl}`,
  );
  const waHref = `https://wa.me/?text=${waText}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast({ title: "Link copiado!", description: "Compartilhe sua conquista." });
    } catch {
      toast({
        title: "Não foi possível copiar",
        description: "Tente copiar manualmente da barra de endereços.",
        variant: "destructive",
      });
    }
  }

  return (
    <article className="rounded-2xl border border-success/30 bg-card/80 p-8 text-center shadow-soft-lg backdrop-blur">
      <div className="mb-5 flex flex-col items-center">
        <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full border border-success/40 bg-success/10">
          <Trophy className="h-8 w-8 text-success" strokeWidth={2.25} />
        </div>
        <p className="text-[11px] font-medium uppercase tracking-widest text-success">
          Projeto entregue e pago
        </p>
      </div>

      <h1 className="text-xl font-semibold text-foreground">{data.title}</h1>

      <div className="mt-6 rounded-xl border border-success/30 bg-success/10 p-6">
        <p className="text-[11px] uppercase tracking-wide text-success/80">
          Valor recebido
        </p>
        <p className="mt-1 text-4xl font-bold tracking-tight text-success">
          {priceStr}
        </p>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Button asChild className="w-full">
          <a href={waHref} target="_blank" rel="noopener noreferrer">
            <Share2 className="mr-2 h-4 w-4" />
            WhatsApp
          </a>
        </Button>
        <Button variant="outline" className="w-full" onClick={copyLink}>
          <Copy className="mr-2 h-4 w-4" />
          Copiar link
        </Button>
      </div>
    </article>
  );
}
