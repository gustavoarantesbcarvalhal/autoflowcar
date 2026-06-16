import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { Eye, EyeOff, Loader2, AlertCircle, CheckCircle } from "lucide-react";
import { z } from "zod";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

type View = "login" | "forgot" | "reset_sent";

function LoginPage() {
  const { user, loading, tenantStatus, signIn, resetPassword, signOut } =
    useAuth();

  const [view, setView] = useState<View>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // O redirect pós-login é centralizado em AppShell (__root.tsx).
  // LoginPage só precisa lidar com o que é específico do formulário.

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = z
      .object({ email: z.string().email(), password: z.string().min(1) })
      .safeParse({ email, password });

    if (!parsed.success) {
      setError("Preencha e-mail e senha corretamente.");
      return;
    }

    setSubmitting(true);
    try {
      await signIn(email, password);
      // Redirect happens via useEffect after auth state updates
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao fazer login";
      if (msg.includes("Invalid login credentials")) {
        setError("E-mail ou senha incorretos.");
      } else {
        setError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!z.string().email().safeParse(email).success) {
      setError("Digite um e-mail válido.");
      return;
    }
    setSubmitting(true);
    try {
      await resetPassword(email);
      setView("reset_sent");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao enviar e-mail");
    } finally {
      setSubmitting(false);
    }
  }

  // Show blocking error after login attempt if tenant is blocked
  const isBlocked = user && !loading && tenantStatus === "bloqueado";

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-2">
          <div className="grid size-10 place-items-center rounded-lg bg-primary">
            <div className="size-4 rotate-45 bg-primary-foreground" />
          </div>
          <span className="text-2xl font-bold tracking-tight">AUTOFLOW</span>
          <p className="text-sm text-muted-foreground">CRM para Lojas de Veículos</p>
        </div>

        {/* Blocked state */}
        {isBlocked && (
          <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
              <div>
                <p className="text-sm font-semibold text-destructive">Loja bloqueada</p>
                <p className="mt-0.5 text-xs text-destructive/80">
                  Entre em contato com o suporte AutoFlow para desbloquear sua conta.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => signOut()}
              className="mt-3 w-full rounded-md border border-destructive/40 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
            >
              Sair da conta
            </button>
          </div>
        )}

        {/* Reset sent */}
        {view === "reset_sent" && (
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex flex-col items-center gap-3 text-center">
              <CheckCircle className="size-10 text-green-500" />
              <h2 className="text-lg font-semibold">E-mail enviado!</h2>
              <p className="text-sm text-muted-foreground">
                Verifique sua caixa de entrada em <strong>{email}</strong> para
                redefinir sua senha.
              </p>
              <button
                onClick={() => setView("login")}
                className="mt-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                Voltar ao login
              </button>
            </div>
          </div>
        )}

        {/* Login form */}
        {view === "login" && !isBlocked && (
          <form
            onSubmit={handleLogin}
            className="rounded-xl border border-border bg-card p-6 shadow-sm"
          >
            <h2 className="mb-5 text-lg font-semibold">Entrar na sua conta</h2>

            {error && (
              <div className="mb-4 flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                <AlertCircle className="size-4 shrink-0" />
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">E-mail</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
                  autoComplete="email"
                  className={cn(
                    "h-10 w-full rounded-md border border-border bg-surface px-3 text-sm",
                    "outline-none transition-colors focus:border-primary/60 focus:ring-2 focus:ring-primary/20",
                  )}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">Senha</label>
                <div className="relative">
                  <input
                    type={showPass ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                    className={cn(
                      "h-10 w-full rounded-md border border-border bg-surface pl-3 pr-10 text-sm",
                      "outline-none transition-colors focus:border-primary/60 focus:ring-2 focus:ring-primary/20",
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPass ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => { setView("forgot"); setError(null); }}
              className="mt-2 block text-xs text-muted-foreground underline-offset-4 hover:underline"
            >
              Esqueci minha senha
            </button>

            <button
              type="submit"
              disabled={submitting}
              className={cn(
                "mt-5 flex h-10 w-full items-center justify-center gap-2 rounded-md",
                "bg-primary text-sm font-semibold text-primary-foreground",
                "transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60",
              )}
            >
              {submitting && <Loader2 className="size-4 animate-spin" />}
              {submitting ? "Entrando…" : "Entrar"}
            </button>
          </form>
        )}

        {/* Forgot password form */}
        {view === "forgot" && (
          <form
            onSubmit={handleForgot}
            className="rounded-xl border border-border bg-card p-6 shadow-sm"
          >
            <h2 className="mb-1 text-lg font-semibold">Recuperar senha</h2>
            <p className="mb-5 text-sm text-muted-foreground">
              Enviaremos um link para redefinir sua senha.
            </p>

            {error && (
              <div className="mb-4 flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                <AlertCircle className="size-4 shrink-0" />
                {error}
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-sm font-medium">E-mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                autoComplete="email"
                className={cn(
                  "h-10 w-full rounded-md border border-border bg-surface px-3 text-sm",
                  "outline-none transition-colors focus:border-primary/60 focus:ring-2 focus:ring-primary/20",
                )}
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className={cn(
                "mt-5 flex h-10 w-full items-center justify-center gap-2 rounded-md",
                "bg-primary text-sm font-semibold text-primary-foreground",
                "transition-colors hover:bg-primary/90 disabled:opacity-60",
              )}
            >
              {submitting && <Loader2 className="size-4 animate-spin" />}
              Enviar link de recuperação
            </button>

            <button
              type="button"
              onClick={() => { setView("login"); setError(null); }}
              className="mt-3 block w-full text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              Voltar ao login
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
