import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import type { ElementType } from "react";
import {
  LayoutDashboard, Users, MessageCircle, Car, Calendar,
  Download, UserCog, Settings, ChevronLeft, ChevronRight,
  LogOut, Sun, Moon, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useFollowUpBadge } from "@/hooks/useFollowUpBadge";
import { useTheme } from "./theme-provider";

// ── Types ─────────────────────────────────────────────────────────────────────

type NavItem = { to: string; label: string; icon: ElementType };

// ── Nav definitions ───────────────────────────────────────────────────────────

const PRIMARY_NAV: NavItem[] = [
  { to: "/",         label: "Dashboard", icon: LayoutDashboard },
  { to: "/clientes", label: "Pipeline",  icon: Users           },
  { to: "/followup", label: "Follow-up", icon: MessageCircle   },
  { to: "/estoque",  label: "Estoque",   icon: Car             },
  { to: "/agenda",   label: "Agenda",    icon: Calendar        },
];

const SECONDARY_NAV: NavItem[] = [
  { to: "/exportar",      label: "Exportar",      icon: Download },
  { to: "/usuarios",      label: "Usuários",       icon: UserCog  },
  { to: "/configuracoes", label: "Configurações",  icon: Settings },
];

const PERFIL_LABEL: Record<string, string> = {
  admin_loja:  "Admin",
  gerente:     "Gerente",
  vendedor:    "Vendedor",
  super_admin: "Super Admin",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(nome: string | null): string {
  if (!nome) return "?";
  const parts = nome.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ── Nav link ──────────────────────────────────────────────────────────────────

function NavLink({
  item,
  active,
  badge,
  collapsed,
}: {
  item: NavItem;
  active: boolean;
  badge?: number;
  collapsed: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to as never}
      title={collapsed ? item.label : undefined}
      className={cn(
        "relative mb-0.5 flex items-center rounded-lg text-sm transition-colors",
        active
          ? "bg-primary/10 font-semibold text-primary"
          : "font-medium text-muted-foreground hover:bg-muted hover:text-foreground",
        collapsed
          ? "mx-auto h-10 w-10 justify-center"
          : "h-9 px-2.5 gap-3",
      )}
    >
      {/* Left accent bar when expanded + active */}
      {active && !collapsed && (
        <span className="absolute inset-y-2 left-0 w-0.5 rounded-r-full bg-primary" />
      )}

      <Icon className="size-4 flex-shrink-0" />

      {!collapsed && <span className="truncate">{item.label}</span>}

      {/* Badge */}
      {badge !== undefined && badge > 0 && (
        <span
          className={cn(
            "flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-white",
            collapsed ? "absolute -right-1 -top-1" : "ml-auto",
          )}
        >
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </Link>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

export function Sidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const pathname      = useRouterState({ select: (s) => s.location.pathname });
  const { nome, perfil, signOut } = useAuth();
  const { theme, toggle: toggleTheme } = useTheme();
  const followUpBadge = useFollowUpBadge();
  const [loggingOut, setLoggingOut] = useState(false);

  const podeVerExportar = perfil !== "vendedor" && perfil !== null;
  const podeVerUsuarios = perfil === "admin_loja" || perfil === "gerente";
  const podeVerConfigs  = perfil === "admin_loja";

  const secondaryItems = SECONDARY_NAV.filter((item) => {
    if (item.to === "/exportar")      return podeVerExportar;
    if (item.to === "/usuarios")      return podeVerUsuarios;
    if (item.to === "/configuracoes") return podeVerConfigs;
    return true;
  });

  const hasSecondary = secondaryItems.length > 0;

  async function handleLogout() {
    setLoggingOut(true);
    try { await signOut(); } finally { setLoggingOut(false); }
  }

  const initials = getInitials(nome);

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col flex-shrink-0 h-screen sticky top-0 overflow-hidden border-r border-border bg-background transition-[width] duration-200 ease-in-out",
        collapsed ? "w-[60px]" : "w-[228px]",
      )}
    >
      {/* ── Logo row ─────────────────────────────────────────────────────── */}
      <div className="flex h-14 flex-shrink-0 items-center justify-between border-b border-border px-3">
        <Link
          to="/"
          className={cn(
            "flex items-center gap-2.5 overflow-hidden",
            collapsed && "pointer-events-none",
          )}
        >
          {/* Logo mark */}
          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-primary shadow-sm shadow-primary/30">
            <span className="text-[11px] font-black tracking-tight text-white">DL</span>
          </div>

          {!collapsed && (
            <span className="whitespace-nowrap text-[15px] font-extrabold tracking-tight">
              Driver<span className="text-primary">Leads</span>
            </span>
          )}
        </Link>

        {/* Collapse toggle */}
        <button
          onClick={onToggle}
          className="grid size-7 flex-shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
        >
          {collapsed
            ? <ChevronRight className="size-3.5" />
            : <ChevronLeft  className="size-3.5" />
          }
        </button>
      </div>

      {/* ── Navigation ───────────────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-2">

        {/* Primary group */}
        <div className={cn(!collapsed && "px-2")}>
          {PRIMARY_NAV.map((item) => {
            const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            const badge  = item.to === "/followup" ? followUpBadge : undefined;
            return (
              <NavLink
                key={item.to}
                item={item}
                active={active}
                badge={badge}
                collapsed={collapsed}
              />
            );
          })}
        </div>

        {/* Group separator */}
        {hasSecondary && (
          <div
            className={cn(
              "my-2 border-t border-border",
              collapsed ? "mx-3.5" : "mx-4",
            )}
          />
        )}

        {/* Secondary group */}
        {hasSecondary && (
          <div className={cn(!collapsed && "px-2")}>
            {secondaryItems.map((item) => {
              const active = pathname.startsWith(item.to);
              return (
                <NavLink
                  key={item.to}
                  item={item}
                  active={active}
                  collapsed={collapsed}
                />
              );
            })}
          </div>
        )}
      </nav>

      {/* ── Bottom section ───────────────────────────────────────────────── */}
      <div className="flex-shrink-0 border-t border-border p-2 space-y-0.5">

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          title={theme === "dark" ? "Modo claro" : "Modo escuro"}
          aria-label="Alternar tema"
          className={cn(
            "flex items-center rounded-lg text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
            collapsed ? "mx-auto h-10 w-10 justify-center" : "h-9 w-full gap-3 px-2.5",
          )}
        >
          {theme === "dark"
            ? <Sun  className="size-4 flex-shrink-0" />
            : <Moon className="size-4 flex-shrink-0" />
          }
          {!collapsed && (
            <span>{theme === "dark" ? "Modo claro" : "Modo escuro"}</span>
          )}
        </button>

        {/* User row */}
        {nome && (
          <div
            className={cn(
              "flex items-center rounded-lg",
              collapsed
                ? "flex-col justify-center gap-1 py-1"
                : "gap-2.5 px-2 py-1.5",
            )}
          >
            {/* Avatar with initials */}
            <div
              title={collapsed ? (nome ?? "") : undefined}
              className={cn(
                "grid flex-shrink-0 place-items-center rounded-full bg-primary/15 font-bold text-primary",
                collapsed ? "size-8 text-xs" : "size-7 text-[11px]",
              )}
            >
              {initials}
            </div>

            {/* Name + role (expanded only) */}
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold leading-tight">{nome}</p>
                {perfil && (
                  <p className="text-[10px] text-muted-foreground">
                    {PERFIL_LABEL[perfil] ?? perfil}
                  </p>
                )}
              </div>
            )}

            {/* Logout */}
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              title="Sair"
              aria-label="Sair"
              className={cn(
                "grid place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-60",
                collapsed ? "size-8" : "ml-auto size-7 flex-shrink-0",
              )}
            >
              {loggingOut
                ? <Loader2 className="size-3.5 animate-spin" />
                : <LogOut  className="size-3.5" />
              }
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
