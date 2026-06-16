import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Moon,
  Sun,
  Search,
  Plus,
  MessageCircle,
  LogOut,
  ChevronDown,
  User,
  Loader2,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useTheme } from "./theme-provider";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

function NavLink({ to, label, pathname }: { to: string; label: string; pathname: string }) {
  const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
  return (
    <Link
      to={to as never}
      className={cn(
        "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {label}
    </Link>
  );
}

export function TopNav() {
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const { nome, perfil, signOut } = useAuth();
  const [q, setQ] = useState("");
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

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

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    navigate({ to: "/clientes", search: { q: q.trim() } as never });
  }

  async function handleLogout() {
    setLoggingOut(true);
    console.log(`[LOGOUT] signOut iniciado t=${performance.now().toFixed(0)}ms`);
    try {
      await signOut();
      console.log(`[LOGOUT] signOut resolvido t=${performance.now().toFixed(0)}ms`);
    } finally {
      setLoggingOut(false);
    }
  }

  const perfilLabel: Record<string, string> = {
    admin_loja: "Admin",
    gerente: "Gerente",
    vendedor: "Vendedor",
    super_admin: "Super Admin",
  };

  return (
    <nav className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur-md">
      <div className="flex items-center gap-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="grid size-7 place-items-center rounded bg-primary">
            <div className="size-3 rotate-45 bg-primary-foreground" />
          </div>
          <span className="text-lg font-bold tracking-tight">AUTOFLOW</span>
        </Link>
        <div className="hidden items-center gap-1 md:flex">
          <NavLink to="/" label="Dashboard" pathname={pathname} />
          <NavLink to="/clientes" label="Clientes" pathname={pathname} />
          <NavLink to="/followup" label="Follow-up" pathname={pathname} />
          <NavLink to="/estoque" label="Estoque" pathname={pathname} />
          <NavLink to="/agenda" label="Agenda" pathname={pathname} />
          {podeVerExportar && <NavLink to="/exportar" label="Exportar" pathname={pathname} />}
          {podeVerUsuarios && <NavLink to="/usuarios" label="Usuários" pathname={pathname} />}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <form onSubmit={submitSearch} className="relative hidden sm:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            type="text"
            placeholder="Buscar cliente, telefone ou veículo…"
            className="h-9 w-72 rounded-md border border-border bg-surface pl-9 pr-3 text-sm outline-none transition-colors focus:border-primary/60"
          />
        </form>
        <Link
          to="/clientes/novo"
          className="hidden h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 sm:inline-flex"
        >
          <Plus className="size-4" /> Novo Lead
        </Link>
        <button
          onClick={toggle}
          className="grid size-9 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Alternar tema"
        >
          {theme === "dark" ? (
            <Sun className="size-4" />
          ) : (
            <Moon className="size-4" />
          )}
        </button>
        <a
          href="https://wa.me/"
          target="_blank"
          rel="noreferrer"
          className="grid size-9 place-items-center rounded-md text-whatsapp transition-colors hover:bg-muted"
          aria-label="WhatsApp"
        >
          <MessageCircle className="size-4" />
        </a>

        {/* User menu */}
        {nome && (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setUserMenuOpen((v) => !v)}
              className={cn(
                "flex h-9 items-center gap-1.5 rounded-md px-2 text-sm text-muted-foreground transition-colors",
                "hover:bg-muted hover:text-foreground",
                userMenuOpen && "bg-muted text-foreground",
              )}
            >
              <div className="grid size-6 place-items-center rounded-full bg-primary/20 text-primary">
                <User className="size-3.5" />
              </div>
              <span className="hidden max-w-[120px] truncate md:block">{nome}</span>
              <ChevronDown className="size-3.5" />
            </button>

            {userMenuOpen && (
              <div className="absolute right-0 top-full mt-1 w-56 rounded-lg border border-border bg-card shadow-lg">
                <div className="border-b border-border px-4 py-3">
                  <p className="font-medium leading-none">{nome}</p>
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
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-60"
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
