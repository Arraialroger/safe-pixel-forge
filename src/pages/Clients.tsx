import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users, MessageCircle, Link2, ChevronDown, Wallet, Clock, TrendingUp, Search } from "lucide-react";
import { Link } from "react-router-dom";

import { supabase } from "@/integrations/supabase/client";
import { useAuthReady } from "@/hooks/useAuthReady";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { toast } from "sonner";
import { formatBRPhone, onlyDigits } from "@/lib/phone";
import { isExpired, formatBRL, statusLabel } from "@/data/mockVaults";
import type { Vault } from "@/data/mockVaults";
import { cn } from "@/lib/utils";

type SortKey = "recent" | "revenue" | "conversion";

interface ClientRow {
  email: string;
  clientName: string;
  clientWhatsapp: string | null;
  vaults: Vault[];
  totalReceived: number;
  totalPending: number;
  paidCount: number;
  totalCount: number;
  conversionRate: number;
  lastCreatedAt: string;
}

async function copyCheckoutLink(slug: string) {
  const url = `${window.location.origin}/pay/${slug}`;
  try {
    await navigator.clipboard.writeText(url);
    toast.success("Link de cobrança copiado!", {
      description: "Cole no WhatsApp ou e-mail do cliente.",
    });
  } catch {
    toast.error("Não foi possível copiar", { description: url });
  }
}

export default function Clients() {
  const { user, isReady } = useAuthReady();
  const [openItem, setOpenItem] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("recent");

  const { data: vaults, isLoading, isError } = useQuery({
    queryKey: ["vaults", user?.id],
    enabled: isReady && !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vaults")
        .select("*")
        .eq("owner_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Vault[];
    },
  });

  const clients = useMemo<ClientRow[]>(() => {
    const map = new Map<string, ClientRow>();
    for (const v of vaults ?? []) {
      const key = (v.client_email ?? "").trim().toLowerCase();
      if (!key) continue;
      const price = Number(v.price) || 0;
      const isPaid = v.status === "paid";
      const isOverdue = !isPaid && isExpired(v);
      const existing = map.get(key);
      if (existing) {
        existing.vaults.push(v);
        existing.totalCount += 1;
        if (isPaid) {
          existing.paidCount += 1;
          existing.totalReceived += price;
        } else {
          existing.totalPending += price;
        }
        if (v.created_at > existing.lastCreatedAt) existing.lastCreatedAt = v.created_at;
        if (!existing.clientName && v.client_name) existing.clientName = v.client_name;
        if (!existing.clientWhatsapp && v.client_whatsapp) existing.clientWhatsapp = v.client_whatsapp;
      } else {
        map.set(key, {
          email: v.client_email ?? "",
          clientName: v.client_name,
          clientWhatsapp: v.client_whatsapp ?? null,
          vaults: [v],
          totalReceived: isPaid ? price : 0,
          totalPending: isPaid ? 0 : price,
          paidCount: isPaid ? 1 : 0,
          totalCount: 1,
          conversionRate: 0,
          lastCreatedAt: v.created_at,
        });
      }
      // touch isOverdue para o linter (já usado para futura segmentação visual abaixo)
      void isOverdue;
    }
    const arr = Array.from(map.values());
    for (const c of arr) {
      c.conversionRate = c.totalCount > 0 ? c.paidCount / c.totalCount : 0;
    }
    return arr.sort((a, b) => b.totalReceived - a.totalReceived || b.totalCount - a.totalCount);
  }, [vaults]);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Clientes
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Mini-CRM dos seus jobs: receita, inadimplência e conversão por cliente.
        </p>
      </header>

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      )}

      {isError && (
        <p className="text-sm text-destructive">
          Não foi possível carregar seus clientes. Tente novamente.
        </p>
      )}

      {!isLoading && !isError && clients.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-card/40 px-6 py-12 text-center shadow-soft">
          <Users className="h-8 w-8 text-muted-foreground" />
          <p className="max-w-sm text-sm text-muted-foreground">
            Sua base de clientes aparecerá aqui assim que você criar os seus primeiros cofres.
          </p>
          <Button asChild variant="secondary" size="sm">
            <Link to="/dashboard">Ir para Dashboard</Link>
          </Button>
        </div>
      )}

      {!isLoading && clients.length > 0 && (
        <Accordion
          type="single"
          collapsible
          value={openItem}
          onValueChange={setOpenItem}
          className="space-y-3"
        >
          {clients.map((c) => {
            const digits = c.clientWhatsapp ? onlyDigits(c.clientWhatsapp) : "";
            const conversionPct = Math.round(c.conversionRate * 100);
            return (
              <AccordionItem
                key={c.email}
                value={c.email}
                className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft"
              >
                <AccordionTrigger className="px-4 py-3 hover:no-underline [&[data-state=open]>svg]:rotate-180">
                  <div className="flex w-full flex-col gap-3 text-left sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {c.clientName || "—"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{c.email}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-medium tabular-nums text-success">
                        <Wallet className="h-3 w-3" />
                        {formatBRL(c.totalReceived)}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium tabular-nums text-amber-600 dark:text-amber-400">
                        <Clock className="h-3 w-3" />
                        {formatBRL(c.totalPending)}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-medium tabular-nums text-primary">
                        <TrendingUp className="h-3 w-3" />
                        {conversionPct}%
                      </span>
                    </div>
                  </div>
                  <ChevronDown className="ml-3 h-4 w-4 shrink-0 text-muted-foreground transition-transform" />
                </AccordionTrigger>
                <AccordionContent className="border-t border-border bg-background/40 px-4 pb-4 pt-3">
                  <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    {digits ? (
                      <a
                        href={`https://wa.me/55${digits}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-success hover:underline"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        {formatBRPhone(c.clientWhatsapp ?? "")}
                      </a>
                    ) : (
                      <span>Sem WhatsApp</span>
                    )}
                    <span>·</span>
                    <span>
                      {c.paidCount}/{c.totalCount} jobs pagos
                    </span>
                  </div>

                  <ul className="space-y-2">
                    {c.vaults.map((v) => {
                      const isPaid = v.status === "paid";
                      const overdue = !isPaid && isExpired(v);
                      const showResend = !isPaid;
                      return (
                        <li
                          key={v.id}
                          className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-foreground">
                              {v.title}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              <span
                                className={cn(
                                  "font-medium",
                                  isPaid
                                    ? "text-success"
                                    : overdue
                                      ? "text-destructive"
                                      : "text-amber-600 dark:text-amber-400",
                                )}
                              >
                                {overdue ? "Expirado" : statusLabel(v.status)}
                              </span>
                              {" · "}
                              <span className="tabular-nums">{formatBRL(Number(v.price))}</span>
                            </p>
                          </div>
                          {showResend && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => copyCheckoutLink(v.public_slug)}
                              className="shrink-0"
                            >
                              <Link2 className="mr-1.5 h-3.5 w-3.5" />
                              Reenviar cobrança
                            </Button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}
    </div>
  );
}
