import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { statusLabel } from "@/lib/crm";
import { NotificationBell } from "./notification-bell";

// ── Path titles ───────────────────────────────────────────────────────────────

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
  if (pathname.startsWith("/estoque/"))  return "Veículo";
  return "DriverLeads";
}

// ── Status pill ───────────────────────────────────────────────────────────────

const STATUS_DOT: Record<string, string> = {
  novo:             "bg-blue-500",
  em_negociacao:    "bg-amber-500",
  proposta_enviada: "bg-violet-500",
  venda_realizada:  "bg-emerald-500",
  perdido:          "bg-red-500",
  aguardando:       "bg-slate-400",
};

function StatusPill({ status }: { status: string | null }) {
  if (!status) return null;
  return (
    <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-semibold">
      <span className={cn("size-1.5 rounded-full", STATUS_DOT[status] ?? "bg-muted-foreground")} />
      {statusLabel(status)}
    </span>
  );
}

// ── Initials helper ───────────────────────────────────────────────────────────

function initials(name: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ── Global search ─────────────────────────────────────────────────────────────

type SearchResult = {
  id: string;
  name: string | null;
  phone: string | null;
  whatsapp: string | null;
  status: string | null;
};

function GlobalSearch() {
  const navigate  = useNavigate();
  const wrapRef   = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  const [query,    setQuery]    = useState("");
  const [debounced, setDebounced] = useState("");
  const [open,     setOpen]     = useState(false);
  const [cursor,   setCursor]   = useState(-1);

  // Debounce 280ms
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 280);
    return () => clearTimeout(t);
  }, [query]);

  const { data: results = [], isFetching } = useQuery<SearchResult[]>({
    queryKey: ["global-search", debounced],
    queryFn: async () => {
      const { data } = await supabase
        .from("customers")
        .select("id,name,phone,whatsapp,status")
        .or(
          `name.ilike.%${debounced}%,phone.ilike.%${debounced}%,whatsapp.ilike.%${debounced}%,email.ilike.%${debounced}%`,
        )
        .limit(7);
      return (data ?? []) as SearchResult[];
    },
    enabled: debounced.length >= 2,
    staleTime: 10_000,
  });

  // Global shortcut Ctrl+K / ⌘K
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Click outside → close
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  function clearSearch() {
    setQuery("");
    setDebounced("");
    setOpen(false);
    setCursor(-1);
  }

  function selectResult(id: string) {
    clearSearch();
    navigate({ to: "/clientes/$id", params: { id } });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") { clearSearch(); inputRef.current?.blur(); return; }
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(c + 1, results.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setCursor((c) => Math.max(c - 1, -1)); }
    if (e.key === "Enter" && cursor >= 0) selectResult(results[cursor].id);
  }

  const showDropdown = open && debounced.length >= 2;

  return (
    <div ref={wrapRef} className="relative w-full max-w-[320px]">
      {/* Input */}
      <div
        className={cn(
          "flex h-9 items-center gap-2 rounded-[10px] border px-3 transition-colors",
          open
            ? "border-primary/50 bg-background shadow-sm"
            : "border-border bg-muted/40 hover:border-border/80",
        )}
      >
        <Search className="size-3.5 shrink-0 text-muted-foreground" />

        <input
          ref={inputRef}
          value={query}
          placeholder="Buscar leads…"
          onChange={(e) => { setQuery(e.target.value); setOpen(true); setCursor(-1); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
        />

        {query ? (
          <button
            tabIndex={-1}
            onClick={clearSearch}
            className="grid size-4 place-items-center rounded text-muted-foreground hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        ) : (
          <kbd className="hidden shrink-0 items-center gap-0.5 rounded border border-border bg-muted px-1 py-px font-mono text-[9px] text-muted-foreground sm:flex">
            <span>⌘</span>K
          </kbd>
        )}
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-full min-w-[300px] overflow-hidden rounded-xl border border-border bg-popover shadow-xl">
          {isFetching ? (
            /* Skeleton rows */
            <div className="divide-y divide-border">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                  <div className="size-7 rounded-full bg-muted animate-pulse" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-24 rounded-full bg-muted animate-pulse" />
                    <div className="h-2.5 w-16 rounded-full bg-muted animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : results.length === 0 ? (
            <p className="px-4 py-5 text-center text-sm text-muted-foreground">
              Nenhum resultado para{" "}
              <span className="font-semibold">"{debounced}"</span>
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {results.map((r, i) => (
                <li key={r.id}>
                  <button
                    onMouseEnter={() => setCursor(i)}
                    onClick={() => selectResult(r.id)}
                    className={cn(
                      "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors",
                      i === cursor ? "bg-muted" : "hover:bg-muted/60",
                    )}
                  >
                    {/* Avatar */}
                    <div className="grid size-7 shrink-0 place-items-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                      {initials(r.name)}
                    </div>

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{r.name ?? "—"}</p>
                      {(r.phone || r.whatsapp) && (
                        <p className="text-[11px] text-muted-foreground">
                          {r.phone ?? r.whatsapp}
                        </p>
                      )}
                    </div>

                    <StatusPill status={r.status} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Footer hint */}
          {results.length > 0 && (
            <div className="flex items-center justify-between border-t border-border bg-muted/30 px-3 py-1.5">
              <p className="text-[10px] text-muted-foreground">
                {results.length} resultado{results.length !== 1 ? "s" : ""}
              </p>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <span><kbd className="rounded border border-border bg-muted px-1 font-mono">↑↓</kbd> navegar</span>
                <span><kbd className="rounded border border-border bg-muted px-1 font-mono">↵</kbd> abrir</span>
                <span><kbd className="rounded border border-border bg-muted px-1 font-mono">esc</kbd> fechar</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── TopBar ────────────────────────────────────────────────────────────────────

export function TopBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <header className="hidden md:flex h-14 shrink-0 items-center gap-4 border-b border-border bg-background px-5">
      {/* Page title */}
      <h1 className="shrink-0 text-[15px] font-semibold tracking-tight text-foreground">
        {resolveTitle(pathname)}
      </h1>

      {/* Search — fills remaining space up to max-width */}
      <div className="flex flex-1 justify-start pl-2">
        <GlobalSearch />
      </div>

      {/* Right actions */}
      <div className="flex shrink-0 items-center gap-2">
        <NotificationBell />
        <Link
          to="/clientes/novo"
          className="flex h-9 items-center gap-1.5 rounded-[10px] bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          <Plus className="size-4" /> Novo Lead
        </Link>
      </div>
    </header>
  );
}
