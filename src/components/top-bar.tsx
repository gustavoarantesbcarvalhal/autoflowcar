import { Link, useRouterState } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { NotificationBell } from "./notification-bell";

const PATH_TITLES: Record<string, string> = {
  "/":              "Dashboard",
  "/clientes":      "Pipeline",
  "/clientes/novo": "Novo Lead",
  "/followup":      "Follow-up",
  "/estoque":       "Estoque",
  "/agenda":        "Agenda",
  "/exportar":      "Exportar",
  "/usuarios":      "Usuários",
  "/configuracoes": "Configurações",
};

function resolveTitle(pathname: string): string {
  if (PATH_TITLES[pathname]) return PATH_TITLES[pathname];
  if (pathname.startsWith("/clientes/")) return "Lead";
  if (pathname.startsWith("/estoque/"))  return "Detalhes do Veículo";
  return "DriverLeads";
}

export function TopBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <header className="hidden md:flex h-14 flex-shrink-0 items-center justify-between border-b border-border bg-background px-6">
      <h1 className="text-[15px] font-semibold tracking-tight">{resolveTitle(pathname)}</h1>
      <div className="flex items-center gap-2">
        <NotificationBell />
        <Link
          to="/clientes/novo"
          className="flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          <Plus className="size-4" /> Novo Lead
        </Link>
      </div>
    </header>
  );
}
