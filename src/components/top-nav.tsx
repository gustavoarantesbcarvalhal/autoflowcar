import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Moon, Sun, Search, Plus, MessageCircle } from "lucide-react";
import { useState } from "react";
import { useTheme } from "./theme-provider";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Dashboard" },
  { to: "/clientes", label: "Clientes" },
  { to: "/followup", label: "Follow-up" },
  { to: "/estoque", label: "Estoque" },
  { to: "/agenda", label: "Agenda" },
  { to: "/exportar", label: "Exportar" },
] as const;

export function TopNav() {
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    navigate({ to: "/clientes", search: { q: q.trim() } as never });
  }

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
          {NAV.map((n) => {
            const active = n.to === "/" ? pathname === "/" : pathname.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {n.label}
              </Link>
            );
          })}
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
          className="grid size-9 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label="Alternar tema"
        >
          {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </button>
        <a
          href="https://wa.me/"
          target="_blank"
          rel="noreferrer"
          className="grid size-9 place-items-center rounded-md text-whatsapp hover:bg-muted transition-colors"
          aria-label="WhatsApp"
        >
          <MessageCircle className="size-4" />
        </a>
      </div>
    </nav>
  );
}
