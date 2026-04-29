import { Wallet, Clock, PackageCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { Vault } from "@/data/mockVaults";

function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

interface StatsCardsProps {
  vaults: Vault[];
}

export function StatsCards({ vaults }: StatsCardsProps) {
  let totalReceived = 0;
  let totalPending = 0;
  let deliveredCount = 0;
  for (const v of vaults) {
    const price = Number(v.price) || 0;
    if (v.status === "paid") {
      totalReceived += price;
      deliveredCount += 1;
    } else if (v.status === "pending") {
      totalPending += price;
    }
  }

  const items = [
    {
      label: "Total recebido",
      value: formatBRL(totalReceived),
      icon: Wallet,
      tint: "text-emerald-500",
    },
    {
      label: "Aguardando pagamento",
      value: formatBRL(totalPending),
      icon: Clock,
      tint: "text-amber-500",
    },
    {
      label: "Projetos entregues",
      value: String(deliveredCount),
      icon: PackageCheck,
      tint: "text-vault",
    },
  ];

  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Card key={item.label} className="rounded-2xl p-5 shadow-soft">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="text-2xl font-semibold tracking-tight text-foreground">
                  {item.value}
                </p>
              </div>
              <Icon className={`h-5 w-5 ${item.tint}`} />
            </div>
          </Card>
        );
      })}
    </section>
  );
}
