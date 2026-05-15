import { Lock, Upload, Send, DownloadCloud } from "lucide-react";
import { NewVaultDialog } from "@/components/NewVaultDialog";

const steps = [
  {
    icon: Upload,
    title: "Crie o cofre",
    description: "Faça upload do arquivo final, defina o valor e quem é o cliente.",
  },
  {
    icon: Send,
    title: "Cliente paga via Pix",
    description: "Enviamos o link por e-mail e WhatsApp. Acompanhe o status em tempo real.",
  },
  {
    icon: DownloadCloud,
    title: "Arquivo libera automático",
    description: "O cliente baixa só após pagar. Você recebe sem dor de cabeça.",
  },
];

export function VaultsEmptyState() {
  return (
    <section className="rounded-2xl border border-dashed border-border bg-card/40 px-6 py-12 shadow-soft">
      <div className="mx-auto max-w-2xl text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-border bg-background">
          <Lock className="h-6 w-6 text-vault" strokeWidth={2.25} />
        </div>
        <h2 className="text-lg font-semibold text-foreground">
          Como você ganha dinheiro com o PixelSafe
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Em 3 passos simples, do upload ao pagamento confirmado.
        </p>
      </div>

      <ol className="mx-auto mt-8 grid max-w-3xl gap-4 sm:grid-cols-3">
        {steps.map((step, i) => {
          const Icon = step.icon;
          return (
            <li
              key={step.title}
              className="relative rounded-xl border border-border bg-background p-5 text-left"
            >
              <span className="absolute -top-2.5 left-5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
                {i + 1}
              </span>
              <Icon className="mb-3 h-5 w-5 text-vault" strokeWidth={2.25} />
              <h3 className="text-sm font-semibold text-foreground">{step.title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {step.description}
              </p>
            </li>
          );
        })}
      </ol>

      <div className="mt-8 flex justify-center">
        <NewVaultDialog />
      </div>
    </section>
  );
}
