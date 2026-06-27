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

function Logo() {
  return (
    <div className="mb-8 flex flex-col items-center gap-3">
      <div className="flex h-14 w-16 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/40">
        <span className="text-xl font-black tracking-tight text-primary-foreground">DL</span>
      </div>
      <span className="text-2xl font-extrabold tracking-tight text-white">DriverLeads</span>
      <p className="text-sm text-white/50">CRM para Lojas de Veículos</p>
    </div>
  );
}

function LoginPage() {
  const { user, loading, tenantStatus, signIn, resetPassword, signOut } = useAuth();

  const [view, setView] = useState<View>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const isBlocked = user && !loading && tenantStatus === "bloqueado";

  const inputCls = cn(
    "h-11 w-full rounded-xl border border-border bg-muted/50 px-3 text-sm",
    "outline-none transition-colors focus:border-primary/60 focus:ring-2 focus:ring-primary/20",
  );

  return (
    <div className="login-bg flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <Logo />

        {/* Blocked state */}
        {isBlocked && (
          <div className="mb-4 rounded-2xl border border-destructive/40 bg-destructive/10 p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
              <div>
                <p className="text-sm font-semibold text-destructive">Loja bloqueada</p>
                <p className="mt-0.5 text-xs text-destructive/80">
                  Entre em contato com o suporte DriverLeads para desbloquear sua conta.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => signOut()}
              className="mt-3 w-full rounded-xl border border-destructive/40 py-2 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
            >
              Sair da conta
            </button>
          </div>
        )}

        {/* Reset sent */}
        {view === "reset_sent" && (
          <div className="rounded-2xl bg-card p-7 shadow-2xl">
            <div className="flex flex-col items-center gap-3 text-center">
              <CheckCircle className="size-10 text-success" />
              <h2 className="text-lg font-semibold">E-mail enviado!</h2>
              <p className="text-sm text-muted-foreground">
                Verifique sua caixa de entrada em <strong>{email}</strong> para redefinir sua senha.
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
            className="rounded-2xl bg-card p-7 shadow-2xl"
          >
            <h2 className="mb-6 text-lg font-bold">Entrar na sua conta</h2>

            {error && (
              <div className="mb-5 flex items-center gap-2 rounded-xl bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                <AlertCircle className="size-4 shrink-0" />
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase tracking-wide">E-mail</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
                  autoComplete="email"
                  className={inputCls}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase tracking-wide">Senha</label>
                <div className="relative">
                  <input
                    type={showPass ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                    className={cn(inputCls, "pr-11")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className={cn(
                "mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl",
                "bg-primary text-sm font-bold text-primary-foreground shadow-sm shadow-primary/30",
                "transition-all hover:bg-primary/90 hover:shadow-primary/40 disabled:cursor-not-allowed disabled:opacity-60",
              )}
            >
              {submitting && <Loader2 className="size-4 animate-spin" />}
              {submitting ? "Entrando…" : "Entrar"}
            </button>

            <button
              type="button"
              onClick={() => {
                setView("forgot");
                setError(null);
              }}
              className="mt-4 block w-full text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              Esqueci minha senha
            </button>
          </form>
        )}

        {/* Forgot password form */}
        {view === "forgot" && (
          <form
            onSubmit={handleForgot}
            className="rounded-2xl bg-card p-7 shadow-2xl"
          >
            <h2 className="mb-1 text-lg font-bold">Recuperar senha</h2>
            <p className="mb-6 text-sm text-muted-foreground">
              Enviaremos um link para redefinir sua senha.
            </p>

            {error && (
              <div className="mb-4 flex items-center gap-2 rounded-xl bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                <AlertCircle className="size-4 shrink-0" />
                {error}
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase tracking-wide">E-mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                autoComplete="email"
                className={inputCls}
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className={cn(
                "mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl",
                "bg-primary text-sm font-bold text-primary-foreground shadow-sm shadow-primary/30",
                "transition-all hover:bg-primary/90 disabled:opacity-60",
              )}
            >
              {submitting && <Loader2 className="size-4 animate-spin" />}
              Enviar link de recuperação
            </button>

            <button
              type="button"
              onClick={() => {
                setView("login");
                setError(null);
              }}
              className="mt-4 block w-full text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              Voltar ao login
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
