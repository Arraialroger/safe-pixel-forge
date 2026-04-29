import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

export default function ResetPassword() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Captura do hash de recovery: o Supabase coloca um type=recovery no fragment
  // e o onAuthStateChange (em useAuth) cria a sessão automaticamente.
  const [hadRecoveryHash] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.location.hash.includes("type=recovery") || window.location.hash.includes("access_token");
  });

  useEffect(() => {
    // Após sucesso o Supabase já populou a sessão; manter o hash limpo na URL.
    if (window.location.hash) {
      const url = window.location.pathname + window.location.search;
      window.history.replaceState(null, "", url);
    }
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      toast({ title: "Senha muito curta", description: "Use ao menos 6 caracteres.", variant: "destructive" });
      return;
    }
    if (password !== confirm) {
      toast({ title: "As senhas não coincidem", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        toast({
          title: "Não foi possível atualizar a senha",
          description: error.message,
          variant: "destructive",
        });
        return;
      }
      toast({ title: "Senha atualizada", description: "Você já está logado." });
      navigate("/dashboard");
    } finally {
      setSubmitting(false);
    }
  }

  const showInvalid = !authLoading && !user && !hadRecoveryHash;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <Logo size="lg" />
          <p className="text-sm text-muted-foreground">Defina uma nova senha</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-soft-lg">
          {showInvalid ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/15">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-foreground">Link inválido ou expirado</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Solicite um novo link de recuperação para continuar.
                </p>
              </div>
              <Button asChild className="w-full">
                <Link to="/forgot-password">Pedir novo link</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-medium text-muted-foreground">
                  Nova senha
                </Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-background"
                  disabled={submitting}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm" className="text-xs font-medium text-muted-foreground">
                  Confirmar nova senha
                </Label>
                <Input
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="bg-background"
                  disabled={submitting}
                />
              </div>
              <Button type="submit" className="w-full" disabled={submitting || authLoading}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar nova senha
              </Button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
