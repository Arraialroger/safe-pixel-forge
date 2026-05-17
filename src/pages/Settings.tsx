import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthReady } from "@/hooks/useAuthReady";
import { ProfileTab } from "@/features/settings/ProfileTab";
import { PlanTab } from "@/features/settings/PlanTab";
import { MercadoPagoTab } from "@/features/settings/MercadoPagoTab";
import { HelpTab } from "@/features/settings/HelpTab";

const VALID_TABS = ["perfil", "plano", "mercado-pago", "ajuda"] as const;
type TabValue = (typeof VALID_TABS)[number];

function parseTab(value: string | null): TabValue {
  return (VALID_TABS as readonly string[]).includes(value ?? "")
    ? (value as TabValue)
    : "perfil";
}

export default function Settings() {
  const { user, isReady } = useAuthReady();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<TabValue>(() => parseTab(searchParams.get("tab")));

  // Sincroniza com mudanças externas no querystring (ex: clique em link).
  useEffect(() => {
    const next = parseTab(searchParams.get("tab"));
    if (next !== tab) setTab(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  function handleTabChange(value: string) {
    const next = parseTab(value);
    setTab(next);
    const params = new URLSearchParams(searchParams);
    if (next === "perfil") params.delete("tab");
    else params.set("tab", next);
    setSearchParams(params, { replace: true });
  }

  if (!isReady || !user?.id) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Configurações
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ajuste seu perfil, marca, integrações e tire suas dúvidas.
        </p>
      </header>

      <Tabs value={tab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 sm:inline-flex sm:w-auto">
          <TabsTrigger value="perfil">Perfil</TabsTrigger>
          <TabsTrigger value="plano">Plano</TabsTrigger>
          <TabsTrigger value="mercado-pago">Mercado Pago</TabsTrigger>
          <TabsTrigger value="ajuda">Ajuda</TabsTrigger>
        </TabsList>

        <TabsContent value="perfil" className="mt-0">
          <ProfileTab userId={user.id} />
        </TabsContent>
        <TabsContent value="plano" className="mt-0">
          <PlanTab />
        </TabsContent>
        <TabsContent value="mercado-pago" className="mt-0">
          <MercadoPagoTab userId={user.id} />
        </TabsContent>
        <TabsContent value="ajuda" className="mt-0">
          <HelpTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
