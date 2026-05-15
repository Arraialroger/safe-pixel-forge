import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

type Mode = "signin" | "signup";

function translateAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login")) return "Email ou senha incorretos.";
  if (m.includes("already registered") || m.includes("user already"))
    return "Este email já está cadastrado. Tente entrar.";
  if (m.includes("password") && m.includes("6"))
    return "A senha deve ter ao menos 6 caracteres.";
  if (m.includes("email")) return "Email inválido.";
  return message;
}

export default function Login() {
  const navigate = useNavigate();
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (!email.trim()) next.email = "Informe seu email.";
    if (!password.trim()) next.password = "Informe sua senha.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSubmitting(true);
    try {
      if (mode === "signin") {
        const { error } = await signIn(email.trim(), password);
        if (error) {
          toast({ title: "Não foi possível entrar", description: translateAuthError(error.message), variant: "destructive" });
          return;
        }
        navigate("/app");
      } else {
        const { data, error } = await signUp(email.trim(), password);
        if (error) {
          toast({ title: "Não foi possível criar a conta", description: translateAuthError(error.message), variant: "destructive" });
          return;
        }
        if (data.session) {
          toast({ title: "Conta criada", description: "Bem-vindo ao PixelSafe." });
          navigate("/app");
        } else {
          toast({ title: "Confirme seu email", description: "Enviamos um link de confirmação para o seu email." });
        }
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <Logo size="lg" />
          <p className="text-sm text-muted-foreground">
            {mode === "signin" ? "Entre na sua conta" : "Crie sua conta"}
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="rounded-2xl border border-border bg-card p-6 shadow-soft-lg"
        >
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-medium text-muted-foreground">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="voce@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-background"
                aria-invalid={!!errors.email}
                disabled={submitting}
              />
              {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-medium text-muted-foreground">
                Senha
              </Label>
              <Input
                id="password"
                type="password"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-background"
                aria-invalid={!!errors.password}
                disabled={submitting}
              />
              {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
            </div>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "signin" ? "Entrar" : "Criar conta"}
            </Button>

            {mode === "signin" && (
              <div className="text-center">
                <Link
                  to="/forgot-password"
                  className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  Esqueci minha senha
                </Link>
              </div>
            )}

            <div className="pt-1 text-center">
              <button
                type="button"
                onClick={() => {
                  setMode((m) => (m === "signin" ? "signup" : "signin"));
                  setErrors({});
                }}
                className="text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                {mode === "signin"
                  ? "Não tem conta? Cadastre-se"
                  : "Já tem conta? Entrar"}
              </button>
            </div>
          </div>
        </form>

        <div className="mt-4">
          <Button asChild variant="outline" className="w-full">
            <Link to="/install">
              <Smartphone className="mr-2 h-4 w-4" />
              Instalar no celular
            </Link>
          </Button>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Protegendo entregas freelancer com cofres digitais.
        </p>
      </div>
    </main>
  );
}
