import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Moon,
  Sun,
  Plus,
  LogOut,
  ChevronDown,
  User,
  Loader2,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useTheme } from "./theme-provider";
import { useAuth } from "@/hooks/useAuth";
import { useFollowUpBadge } from "@/hooks/useFollowUpBadge";
import { cn } from "@/lib/utils";

function NavLink({
  to,
  label,
  pathname,
  badge,
}: {
  to: string;
  label: string;
  pathname: string;
  badge?: number;
}) {
  const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
  return (
    <Link
      to={to as never}
      className={cn(
        "relative rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "bg-primary/10 text-primary font-semibold"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {label}
      {badge !== undefined && badge > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-0.5 text-[9px] font-bold text-white">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </Link>
  );
}

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-7 w-9 items-center justify-center rounded-lg bg-primary shadow-sm">
        <span className="text-[11px] font-black tracking-tight text-primary-foreground">DL</span>
      </div>
      <span className="text-[15px] font-extrabold tracking-tight">DriverLeads</span>
    </div>
  );
}

export function TopNav() {
  const { theme, toggle } = useTheme();
  const { nome, perfil, signOut } = useAuth();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const followUpBadge = useFollowUpBadge();

  const podeVerExportar = perfil !== "vendedor" && perfil !== null;
  const podeVerUsuarios = perfil === "admin_loja" || perfil === "gerente";

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await signOut();
    } finally {
      setLoggingOut(false);
    }
  }

  const perfilLabel: Record<string, string> = {
    admin_loja:  "Admin",
    gerente:     "Gerente",
    vendedor:    "Vendedor",
    super_admin: "Super Admin",
  };

  return (
    <nav className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur-md">
      <div className="flex items-center gap-6">
        <Link to="/">
          <Logo />
        </Link>
        <div className="hidden items-center gap-0.5 md:flex">
          <NavLink to="/"          label="Dashboard" pathname={pathname} />
          <NavLink to="/clientes"  label="Clientes"  pathname={pathname} />
          <NavLink to="/followup"  label="Follow-up" pathname={pathname} badge={followUpBadge} />
          <NavLink to="/estoque"   label="Estoque"   pathname={pathname} />
          <NavLink to="/agenda"    label="Agenda"    pathname={pathname} />
          {podeVerExportar && <NavLink to="/exportar" label="Exportar"  pathname={pathname} />}
          {podeVerUsuarios && <NavLink to="/usuarios" label="Usuários"  pathname={pathname} />}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Link
          to="/clientes/novo"
          className="hidden h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 sm:inline-flex"
        >
          <Plus className="size-4" /> Novo Lead
        </Link>
        <button
          onClick={toggle}
          className="grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Alternar tema"
        >
          {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </button>
        {nome && (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setUserMenuOpen((v) => !v)}
              className={cn(
                "flex h-9 items-center gap-1.5 rounded-lg px-2 text-sm text-muted-foreground transition-colors",
                "hover:bg-muted hover:text-foreground",
                userMenuOpen && "bg-muted text-foreground",
              )}
            >
              <div className="grid size-6 place-items-center rounded-full bg-primary/15 text-primary">
                <User className="size-3.5" />
              </div>
              <span className="hidden max-w-[120px] truncate md:block">{nome}</span>
              <ChevronDown className="size-3.5" />
            </button>

            {userMenuOpen && (
              <div className="absolute right-0 top-full mt-1 w-56 rounded-xl border border-border bg-card shadow-xl">
                <div className="border-b border-border px-4 py-3">
                  <p className="font-semibold leading-none">{nome}</p>
                  {perfil && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {perfilLabel[perfil] ?? perfil}
                    </p>
                  )}
                </div>
                <div className="p-1">
                  <button
                    onClick={handleLogout}
                    disabled={loggingOut}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-60"
                  >
                    {loggingOut ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <LogOut className="size-4" />
                    )}
                    {loggingOut ? "Saindo…" : "Sair"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
