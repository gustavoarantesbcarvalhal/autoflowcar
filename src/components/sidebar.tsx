import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import type { ElementType } from "react";
import {
  LayoutDashboard, Users, MessageCircle, Car, Calendar,
  Download, UserCog, Settings, ChevronLeft, ChevronRight,
  LogOut, User, Sun, Moon, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useFollowUpBadge } from "@/hooks/useFollowUpBadge";
import { useTheme } from "./theme-provider";

type NavItem = { to: string; label: string; icon: ElementType };

const BASE_NAV: NavItem[] = [
  { to: "/",          label: "Dashboard", icon: LayoutDashboard },
  { to: "/clientes",  label: "Clientes",  icon: Users           },
  { to: "/followup",  label: "Follow-up", icon: MessageCircle   },
  { to: "/estoque",   label: "Estoque",   icon: Car             },
  { to: "/agenda",    label: "Agenda",    icon: Calendar        },
];

const EXTRA_NAV: NavItem[] = [
  { to: "/exportar",      label: "Exportar",      icon: Download },
  { to: "/usuarios",      label: "Usuários",       icon: UserCog  },
  { to: "/configuracoes", label: "Configurações",  icon: Settings },
];

const PERFIL_LABEL: Record<string, string> = {
  admin_loja: "Admin", gerente: "Gerente", vendedor: "Vendedor", super_admin: "Super Admin",
};

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { nome, perfil, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const followUpBadge = useFollowUpBadge();
  const [loggingOut, setLoggingOut] = useState(false);

  const podeVerExportar    = perfil !== "vendedor" && perfil !== null;
  const podeVerUsuarios    = perfil === "admin_loja" || perfil === "gerente";
  const podeVerConfigacoes = perfil === "admin_loja";

  const navItems: NavItem[] = [
    ...BASE_NAV,
    ...EXTRA_NAV.filter((item) => {
      if (item.to === "/exportar")      return podeVerExportar;
      if (item.to === "/usuarios")      return podeVerUsuarios;
      if (item.to === "/configuracoes") return podeVerConfigacoes;
      return true;
    }),
  ];

  async function handleLogout() {
    setLoggingOut(true);
    try { await signOut(); } finally { setLoggingOut(false); }
  }

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col flex-shrink-0 h-screen sticky top-0 overflow-hidden border-r border-border bg-background transition-[width] duration-200 ease-in-out",
        collapsed ? "w-[52px]" : "w-[220px]",
      )}
    >
      {/* Logo row */}
      <div className="flex h-14 flex-shrink-0 items-center justify-between border-b border-border px-3">
        <Link
          to="/"
          className={cn("flex items-center gap-2.5 overflow-hidden", collapsed && "pointer-events-none")}
        >
          <div className="flex h-7 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary shadow-sm">
            <span className="text-[11px] font-black tracking-tight text-primary-foreground">DL</span>
          </div>
          {!collapsed && (
            <span className="whitespace-nowrap text-[15px] font-extrabold tracking-tight">DriverLeads</span>
          )}
        </Link>
        <button
          onClick={onToggle}
          className="grid size-7 flex-shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
        >
          {collapsed ? <ChevronRight className="size-3.5" /> : <ChevronLeft className="size-3.5" />}
        </button>
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3">
        {navItems.map((item) => {
          const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
          const badge  = item.to === "/followup" ? followUpBadge : undefined;
          const Icon   = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to as never}
              title={collapsed ? item.label : undefined}
              className={cn(
                "relative mb-0.5 flex items-center rounded-lg text-sm font-medium transition-colors",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
                collapsed
                  ? "mx-auto w-8 justify-center p-2"
                  : "mx-2 px-2.5 py-2",
              )}
            >
              <Icon className="size-4 flex-shrink-0" />
              {!collapsed && <span className="ml-3 truncate">{item.label}</span>}
              {badge !== undefined && badge > 0 && (
                <span
                  className={cn(
                    "flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-0.5 text-[9px] font-bold text-white",
                    collapsed ? "absolute -right-0.5 -top-0.5" : "ml-auto",
                  )}
                >
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="flex-shrink-0 space-y-1 border-t border-border p-2">
        {/* Theme toggle */}
        <button
          onClick={toggle}
          title={theme === "dark" ? "Modo claro" : "Modo escuro"}
          aria-label="Alternar tema"
          className={cn(
            "flex h-9 items-center rounded-lg text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
            collapsed ? "mx-auto w-8 justify-center" : "w-full gap-3 px-2.5",
          )}
        >
          {theme === "dark"
            ? <Sun  className="size-4 flex-shrink-0" />
            : <Moon className="size-4 flex-shrink-0" />}
          {!collapsed && <span>{theme === "dark" ? "Modo claro" : "Modo escuro"}</span>}
        </button>

        {/* User + logout */}
        {nome && (
          <div
            className={cn(
              "flex items-center rounded-lg py-1.5",
              collapsed ? "justify-center px-0" : "gap-2 px-2",
            )}
          >
            <div className="grid size-7 flex-shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
              <User className="size-3.5" />
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold leading-none">{nome}</p>
                {perfil && (
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {PERFIL_LABEL[perfil] ?? perfil}
                  </p>
                )}
              </div>
            )}
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              title="Sair"
              className="ml-auto grid size-7 flex-shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-60"
            >
              {loggingOut
                ? <Loader2 className="size-3.5 animate-spin" />
                : <LogOut  className="size-3.5" />}
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
