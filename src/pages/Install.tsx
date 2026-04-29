import { useState } from "react";
import { Link } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { Share, Plus, MoreVertical, Smartphone, ArrowLeft, CheckCircle2, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/Logo";
import { toast } from "@/hooks/use-toast";

interface Step {
  text: string;
  icon: React.ComponentType<{ className?: string }>;
}

const iosSteps: Step[] = [
  { text: "Abra o PixelSafe no Safari", icon: Smartphone },
  { text: "Toque no ícone Compartilhar na barra inferior", icon: Share },
  { text: "Escolha 'Adicionar à Tela de Início'", icon: Plus },
  { text: "Toque em 'Adicionar' no canto superior direito", icon: CheckCircle2 },
];

const androidSteps: Step[] = [
  { text: "Abra o PixelSafe no Chrome", icon: Smartphone },
  { text: "Toque no menu ⋮ (canto superior direito)", icon: MoreVertical },
  { text: "Escolha 'Adicionar à tela inicial' ou 'Instalar app'", icon: Plus },
  { text: "Confirme a instalação", icon: CheckCircle2 },
];

function StepList({ title, steps }: { title: string; steps: Step[] }) {
  return (
    <article className="rounded-2xl border border-border bg-card p-6 shadow-soft">
      <h2 className="mb-4 text-base font-semibold text-foreground">{title}</h2>
      <ol className="space-y-3">
        {steps.map((step, i) => {
          const Icon = step.icon;
          return (
            <li key={i} className="flex items-start gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                {i + 1}
              </span>
              <div className="flex flex-1 items-center gap-2 pt-1">
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <p className="text-sm text-foreground">{step.text}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </article>
  );
}

export default function Install() {
  return (
    <main className="min-h-screen bg-background px-4 py-8 md:py-12">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Logo size="lg" />
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
            Instale o PixelSafe no seu celular
          </h1>
          <p className="max-w-md text-sm text-muted-foreground">
            Adicione o PixelSafe à tela inicial do seu celular para acessar seus cofres como um app nativo,
            com ícone próprio e abertura em tela cheia.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <StepList title="iPhone (Safari)" steps={iosSteps} />
          <StepList title="Android (Chrome)" steps={androidSteps} />
        </div>

        <div className="mt-8 rounded-2xl border border-primary/30 bg-primary/5 p-5 text-center shadow-soft">
          <p className="text-sm text-foreground">
            Pronto! O PixelSafe vai abrir como um app nativo, sem barra de navegador.
          </p>
        </div>

        <div className="mt-6 flex justify-center">
          <Button asChild variant="ghost">
            <Link to="/login">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar para o login
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
