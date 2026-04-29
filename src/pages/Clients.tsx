import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users, MessageCircle } from "lucide-react";
import { Link } from "react-router-dom";

import { supabase } from "@/integrations/supabase/client";
import { useAuthReady } from "@/hooks/useAuthReady";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatBRPhone, onlyDigits } from "@/lib/phone";
import type { Vault } from "@/data/mockVaults";

interface ClientRow {
  email: string;
  clientName: string;
  clientWhatsapp: string | null;
  totalProjects: number;
  lastCreatedAt: string;
}

export default function Clients() {
  const { user, isReady } = useAuthReady();

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
      const existing = map.get(key);
      if (existing) {
        existing.totalProjects += 1;
        if (v.created_at > existing.lastCreatedAt) {
          existing.lastCreatedAt = v.created_at;
        }
        if (!existing.clientName && v.client_name) existing.clientName = v.client_name;
        if (!existing.clientWhatsapp && v.client_whatsapp) {
          existing.clientWhatsapp = v.client_whatsapp;
        }
      } else {
        map.set(key, {
          email: v.client_email ?? "",
          clientName: v.client_name,
          clientWhatsapp: v.client_whatsapp ?? null,
          totalProjects: 1,
          lastCreatedAt: v.created_at,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.totalProjects - a.totalProjects);
  }, [vaults]);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Clientes
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sua base de contatos, gerada automaticamente a partir dos cofres.
        </p>
      </header>

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-md" />
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
            Sua base de clientes aparecerá aqui assim que você criar os seus
            primeiros cofres.
          </p>
          <Button asChild variant="secondary" size="sm">
            <Link to="/dashboard">Ir para Dashboard</Link>
          </Button>
        </div>
      )}

      {!isLoading && clients.length > 0 && (
        <>
          {/* Mobile: lista em cards */}
          <section className="space-y-3 md:hidden">
            {clients.map((c) => {
              const digits = c.clientWhatsapp ? onlyDigits(c.clientWhatsapp) : "";
              return (
                <article
                  key={c.email}
                  className="rounded-2xl border border-border bg-card p-4 shadow-soft"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {c.clientName || "—"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{c.email}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-medium tabular-nums text-primary">
                      {c.totalProjects} {c.totalProjects === 1 ? "projeto" : "projetos"}
                    </span>
                  </div>
                  {digits ? (
                    <a
                      href={`https://wa.me/55${digits}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex items-center gap-1.5 text-xs text-success hover:underline"
                      aria-label={`Abrir WhatsApp de ${c.clientName}`}
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      {formatBRPhone(c.clientWhatsapp ?? "")}
                    </a>
                  ) : (
                    <p className="mt-3 text-xs text-muted-foreground">Sem WhatsApp</p>
                  )}
                </article>
              );
            })}
          </section>

          {/* Desktop: tabela */}
          <section className="hidden rounded-2xl border border-border bg-card shadow-soft md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>WhatsApp</TableHead>
                  <TableHead className="text-right">Projetos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((c) => {
                  const digits = c.clientWhatsapp ? onlyDigits(c.clientWhatsapp) : "";
                  return (
                    <TableRow key={c.email}>
                      <TableCell className="font-medium text-foreground">
                        {c.clientName || "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{c.email}</TableCell>
                      <TableCell>
                        {digits ? (
                          <div className="flex items-center gap-2">
                            <span className="text-foreground">
                              {formatBRPhone(c.clientWhatsapp ?? "")}
                            </span>
                            <a
                              href={`https://wa.me/55${digits}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                              aria-label={`Abrir WhatsApp de ${c.clientName}`}
                            >
                              <MessageCircle className="h-4 w-4" />
                            </a>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-foreground">
                        {c.totalProjects}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </section>
        </>
      )}
    </div>
  );
}
