import { Navigate, Outlet, useNavigate } from "react-router-dom";
import { Loader2, AlertTriangle } from "lucide-react";
import { AppSidebar } from "@/components/AppSidebar";
import { Button } from "@/components/ui/button";
import { useAuthReady } from "@/hooks/useAuthReady";
import { useSubscription } from "@/hooks/useSubscription";

export default function AuthenticatedLayout() {
  const { user, isReady } = useAuthReady();
  const { isOverdue } = useSubscription();
  const navigate = useNavigate();

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
        {isOverdue && (
          <div className="border-b border-amber-500/30 bg-amber-500/10 px-8 py-3">
            <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>
                  Sua assinatura está com pagamento em atraso. Regularize para continuar criando cofres.
                </span>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => navigate("/configuracoes")}
              >
                Regularizar
              </Button>
            </div>
          </div>
        )}
        <div className="mx-auto w-full max-w-6xl px-8 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
