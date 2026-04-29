import { useState } from "react";
import { Navigate, Outlet, useNavigate } from "react-router-dom";
import { Loader2, AlertTriangle, Menu } from "lucide-react";
import { AppSidebar, SidebarBody } from "@/components/AppSidebar";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useAuthReady } from "@/hooks/useAuthReady";
import { useSubscription } from "@/hooks/useSubscription";
import { useOwnerBranding } from "@/hooks/useBranding";

export default function AuthenticatedLayout() {
  const { user, isReady } = useAuthReady();
  const { isOverdue } = useSubscription();
  const { logoUrl, displayName } = useOwnerBranding();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex min-h-screen w-full bg-background">
      <AppSidebar />
      <main className="flex-1 overflow-auto">
        {/* Mobile top bar */}
        <header className="flex h-14 items-center justify-between gap-3 border-b border-border bg-card px-4 md:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Abrir menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 border-r border-border bg-card p-0">
              <SidebarBody onNavigate={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>
          <Logo
            size="sm"
            customLogoUrl={logoUrl}
            customLogoAlt={displayName ?? undefined}
          />
          <span className="w-9" aria-hidden /> {/* spacer p/ centralizar logo */}
        </header>

        {isOverdue && (
          <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-3 md:px-8">
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-2 text-sm text-amber-600 dark:text-amber-400">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Sua assinatura está com pagamento em atraso. Regularize para continuar criando cofres.
                </span>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => navigate("/configuracoes")}
                className="w-full sm:w-auto"
              >
                Regularizar
              </Button>
            </div>
          </div>
        )}
        <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
