import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { ThemeProvider } from "@/components/theme-provider";
import { TopNav } from "@/components/top-nav";
import { MobileNav } from "@/components/mobile-nav";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/contexts/AuthContext";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, ShieldOff } from "lucide-react";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Página não encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          A página que você procura não existe ou foi movida.
        </p>
        <a
          href="/"
          className="mt-6 inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Voltar ao Dashboard
        </a>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight">Algo deu errado</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <div className="mt-6 flex justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "AutoFlow — CRM para Lojas de Veículos" },
      {
        name: "description",
        content:
          "CRM rápido para vendedores: pipeline kanban, follow-up automático, estoque e agenda em um só lugar.",
      },
      { property: "og:title", content: "AutoFlow — CRM para Lojas de Veículos" },
      { name: "twitter:title", content: "AutoFlow — CRM para Lojas de Veículos" },
      {
        property: "og:description",
        content:
          "CRM rápido para vendedores: pipeline kanban, follow-up automático, estoque e agenda em um só lugar.",
      },
      {
        name: "twitter:description",
        content:
          "CRM rápido para vendedores: pipeline kanban, follow-up automático, estoque e agenda em um só lugar.",
      },
      {
        property: "og:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/ce6126aa-8000-4c45-80cd-3f70142debca/id-preview-8a56d427--50b29a49-453b-4acf-abb7-80d5df590b21.lovable.app-1781374373230.png",
      },
      {
        name: "twitter:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/ce6126aa-8000-4c45-80cd-3f70142debca/id-preview-8a56d427--50b29a49-453b-4acf-abb7-80d5df590b21.lovable.app-1781374373230.png",
      },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <AppShell />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

function BlockedScreen() {
  const { signOut } = useAuth();

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="max-w-sm text-center">
        <div className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-red-100 dark:bg-red-900/30">
          <ShieldOff className="size-6 text-red-600 dark:text-red-400" />
        </div>
        <h1 className="text-xl font-semibold">Acesso bloqueado</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sua conta está bloqueada ou inativa. Entre em contato com o suporte AutoFlow.
        </p>
        <button
          onClick={() => signOut()}
          className="mt-6 text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Sair da conta
        </button>
      </div>
    </div>
  );
}

function AppShell() {
  const { user, loading, isSuperAdmin, temAcesso } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();

  const isLoginPage = pathname === "/login";
  const isAdminPage = pathname.startsWith("/admin");

  useEffect(() => {
    if (loading) return;

    console.log(`[SHELL] guard: user=${!!user} isLoginPage=${isLoginPage} temAcesso=${temAcesso} isSuperAdmin=${isSuperAdmin}`);

    if (!user && !isLoginPage) {
      console.log(`[SHELL] → /login (sem usuário)`);
      navigate({ to: "/login", replace: true });
      return;
    }

    if (user && isLoginPage && temAcesso) {
      const dest = isSuperAdmin ? "/admin" : "/";
      console.log(`[SHELL] → ${dest} (usuário autenticado saindo do login)`);
      navigate({ to: dest, replace: true });
    }
  }, [loading, user, isLoginPage, isSuperAdmin, temAcesso, navigate]);

  // Login page: renderiza imediatamente sem esperar o loading.
  // O redirect para o dashboard acontece via useEffect quando loading=false.
  // Isso elimina o spinner de 500ms-1s causado pelo refresh de token do Supabase.
  if (isLoginPage) {
    return (
      <>
        <Outlet />
        <Toaster richColors position="top-right" />
      </>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  // Admin area — own header is rendered by admin.tsx
  if (isAdminPage) {
    return (
      <>
        <Outlet />
        <Toaster richColors position="top-right" />
      </>
    );
  }

  // Tenant blocked: user authenticated but no access
  if (user && !temAcesso) {
    return <BlockedScreen />;
  }

  // Main app with nav
  return (
    <div className="min-h-screen bg-surface text-foreground">
      <TopNav />
      <main className="pb-20 md:pb-0">
        <Outlet />
      </main>
      <MobileNav />
      <Toaster richColors position="top-right" />
    </div>
  );
}
