import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export default function Settings() {
  const [emailNotif, setEmailNotif] = useState(true);
  const [weeklyDigest, setWeeklyDigest] = useState(false);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Configurações
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ajuste sua conta, notificações e plano.
        </p>
      </header>

      <div className="space-y-4">
        {/* Perfil */}
        <section className="rounded-lg border border-border bg-card p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-sm font-medium text-foreground">
                UD
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">Usuário Demo</h2>
                <p className="text-xs text-muted-foreground">demo@pixelsafe.app</p>
              </div>
            </div>
            <Button variant="secondary" size="sm">
              Editar
            </Button>
          </div>
        </section>

        {/* Notificações */}
        <section className="rounded-lg border border-border bg-card p-6">
          <h2 className="mb-4 text-sm font-semibold text-foreground">Notificações</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="email-notif" className="text-sm text-foreground">
                  Email de novos pagamentos
                </Label>
                <p className="text-xs text-muted-foreground">
                  Receba um email quando um cofre for pago.
                </p>
              </div>
              <Switch
                id="email-notif"
                checked={emailNotif}
                onCheckedChange={setEmailNotif}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="weekly-digest" className="text-sm text-foreground">
                  Resumo semanal
                </Label>
                <p className="text-xs text-muted-foreground">
                  Receba um resumo dos seus cofres toda segunda-feira.
                </p>
              </div>
              <Switch
                id="weekly-digest"
                checked={weeklyDigest}
                onCheckedChange={setWeeklyDigest}
              />
            </div>
          </div>
        </section>

        {/* Plano */}
        <section className="rounded-lg border border-border bg-card p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <h2 className="text-sm font-semibold text-foreground">Plano</h2>
                <span className="rounded-full bg-vault/15 px-2 py-0.5 text-[11px] font-medium text-vault">
                  Pro
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Renova em 12/05/2026 · R$ 39,00/mês
              </p>
            </div>
            <Button variant="secondary" size="sm">
              Gerenciar plano
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
