import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/hooks/useAuth";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (!email.trim()) next.email = "Informe seu email.";
    if (!password.trim()) next.password = "Informe sua senha.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    login();
    navigate("/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <Logo size="lg" />
          <p className="text-sm text-muted-foreground">Entre na sua conta</p>
        </div>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="rounded-lg border border-border bg-card p-6 shadow-none"
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
              />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-medium text-muted-foreground">
                Senha
              </Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-background"
                aria-invalid={!!errors.password}
              />
              {errors.password && (
                <p className="text-xs text-destructive">{errors.password}</p>
              )}
            </div>

            <Button type="submit" className="w-full">
              Entrar
            </Button>

            <div className="pt-1 text-center">
              <a
                href="#"
                onClick={(e) => e.preventDefault()}
                className="text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                Esqueci minha senha
              </a>
            </div>
          </div>
        </form>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Protegendo entregas freelancer com cofres digitais.
        </p>
      </div>
    </main>
  );
}
