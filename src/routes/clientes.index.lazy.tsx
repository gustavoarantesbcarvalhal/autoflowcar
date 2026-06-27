import { createLazyFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { STATUSES, type StatusId, formatPriceBRL, daysSince } from "@/lib/crm";
import { WaButton } from "@/components/wa-button";
import { useAuth } from "@/hooks/useAuth";
import {
  DndContext, useDraggable, useDroppable,
  type DragEndEvent, PointerSensor, useSensor, useSensors,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  Plus, Search, X, Star, AlertTriangle, Clock, TrendingUp,
  CheckCircle2, ExternalLink, ArrowRight, Activity,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createLazyFileRoute("/clientes/")({
  component: ClientesPage,
});

// ── Types ─────────────────────────────────────────────────────────────────────

type Customer = {
  id: string;
  name: string;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  status: StatusId;
  source: string | null;
  source_platform: string | null;
  interest_brand: string | null;
  interest_model: string | null;
  price_min: number | null;
  price_max: number | null;
  last_contact_at: string | null;
  next_return_at: string | null;
  is_priority: boolean;
  responsavel_id: string | null;
  created_at: string;
  sale_value: number | null;
  sold_at: string | null;
};

type FilterId =
  | "todos" | "meus" | "prioridade" | "sem_contato"
  | "visita_hoje" | "negociacao" | "atrasados";

type SalesPeriod = "hoje" | "semana" | "mes";

// ── Constants ─────────────────────────────────────────────────────────────────

const PIPELINE_STATUSES = STATUSES.filter(
  (s) => s.id !== "venda_realizada" && s.id !== "perdido"
);

const STATUS_BADGE: Record<StatusId, string> = {
  novo_lead:        "bg-blue-400/10 text-blue-600 dark:text-blue-400",
  primeiro_contato: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  em_atendimento:   "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  em_negociacao:    "bg-primary/10 text-primary",
  visita:           "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  venda_realizada:  "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  perdido:          "bg-slate-400/10 text-slate-500 dark:text-slate-400",
};

// Next-status shortcuts for slide-over actions
const NEXT_STATUSES: Partial<Record<StatusId, StatusId[]>> = {
  novo_lead:        ["primeiro_contato", "em_atendimento"],
  primeiro_contato: ["em_atendimento",   "em_negociacao"],
  em_atendimento:   ["em_negociacao",    "visita"],
  em_negociacao:    ["visita", "venda_realizada", "perdido"],
  visita:           ["venda_realizada",  "em_negociacao", "perdido"],
  perdido:          ["novo_lead"],
};

// ── Fetch ─────────────────────────────────────────────────────────────────────

async function fetchCustomers(): Promise<Customer[]> {
  const { data, error } = await supabase
    .from("customers")
    .select("id,name,phone,whatsapp,email,status,source,source_platform,interest_brand,interest_model,price_min,price_max,last_contact_at,next_return_at,is_priority,responsavel_id,created_at,sale_value,sold_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Customer[];
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function startOf(unit: "day" | "week" | "month", d = new Date()): Date {
  const r = new Date(d);
  if (unit === "week") {
    const dow = r.getDay();
    r.setDate(r.getDate() - (dow === 0 ? 6 : dow - 1));
  } else if (unit === "month") {
    r.setDate(1);
  }
  r.setHours(0, 0, 0, 0);
  return r;
}

// ── Interaction icons ─────────────────────────────────────────────────────────

function iIcon(type: string): string {
  const m: Record<string, string> = {
    whatsapp: "💬", ligacao: "📞", email: "✉️",
    visita: "🏢", test_drive: "🚗", proposta: "📄",
    nota: "📝", retorno: "🔁", perda: "❌", edicao: "✏️",
  };
  return m[type] ?? "·";
}

// ── KPI Strip ─────────────────────────────────────────────────────────────────

function KpiStrip({
  customers,
  onVendas,
  onPerdidos,
}: {
  customers: Customer[];
  onVendas: () => void;
  onPerdidos: () => void;
}) {
  const todayStart  = startOf("day");
  const active      = customers.filter((c) => !["venda_realizada", "perdido"].includes(c.status));
  const novosHoje   = customers.filter((c) => new Date(c.created_at) >= todayStart);
  const nego        = customers.filter((c) => c.status === "em_negociacao");
  const visitas     = customers.filter((c) => c.status === "visita");
  const vendas      = customers.filter((c) => c.status === "venda_realizada");
  const perdidos    = customers.filter((c) => c.status === "perdido");
  const vendasHoje  = vendas.filter((c) => c.sold_at && new Date(c.sold_at) >= todayStart);
  const totalVendas = vendas.reduce((s, c) => s + (c.sale_value ?? 0), 0);

  const items = [
    {
      label: "Ativos",
      value: active.length,
      sub: `${novosHoje.length} novo${novosHoje.length !== 1 ? "s" : ""} hoje`,
      cls: "text-foreground",
      dot: "bg-primary",
      onClick: undefined as (() => void) | undefined,
    },
    {
      label: "Novos hoje",
      value: novosHoje.length,
      sub: "entrados hoje",
      cls: "text-primary",
      dot: "bg-blue-400",
      onClick: undefined,
    },
    {
      label: "Negociação",
      value: nego.length,
      sub: `de ${active.length} ativos`,
      cls: "text-amber-600 dark:text-amber-400",
      dot: "bg-amber-500",
      onClick: undefined,
    },
    {
      label: "Visitas",
      value: visitas.length,
      sub: "agendadas",
      cls: "text-violet-600 dark:text-violet-400",
      dot: "bg-violet-500",
      onClick: undefined,
    },
    {
      label: "Vendas",
      value: vendas.length,
      sub: `${vendasHoje.length} hoje${totalVendas > 0 ? ` · ${formatPriceBRL(totalVendas)}` : ""}`,
      cls: "text-emerald-600 dark:text-emerald-400",
      dot: "bg-emerald-500",
      onClick: onVendas,
    },
    {
      label: "Perdidos",
      value: perdidos.length,
      sub: "não convertidos",
      cls: "text-muted-foreground",
      dot: "bg-slate-400",
      onClick: onPerdidos,
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-2 px-4 pt-3 pb-2 md:grid-cols-6">
      {items.map((k) => (
        <button
          key={k.label}
          onClick={k.onClick}
          disabled={!k.onClick}
          className={cn(
            "group flex flex-col gap-0.5 rounded-xl border border-border bg-card px-3 py-2.5 text-left transition-colors",
            k.onClick
              ? "cursor-pointer hover:border-primary/30 hover:bg-muted/40"
              : "cursor-default",
          )}
        >
          <div className="flex items-center gap-1.5">
            <span className={cn("size-1.5 rounded-full", k.dot)} />
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {k.label}
            </span>
            {k.onClick && (
              <ArrowRight className="ml-auto size-3 text-primary opacity-0 transition-opacity group-hover:opacity-100" />
            )}
          </div>
          <p className={cn("text-xl font-black tabular-nums leading-tight", k.cls)}>
            {k.value}
          </p>
          <p className="truncate text-[10px] text-muted-foreground">{k.sub}</p>
        </button>
      ))}
    </div>
  );
}

// ── Filter Chips ──────────────────────────────────────────────────────────────

const FILTERS: Array<{ id: FilterId; label: string }> = [
  { id: "todos",       label: "Todos" },
  { id: "meus",        label: "Meus Leads" },
  { id: "prioridade",  label: "Prioridade" },
  { id: "sem_contato", label: "Sem Contato" },
  { id: "visita_hoje", label: "Visita Hoje" },
  { id: "negociacao",  label: "Negociação" },
  { id: "atrasados",   label: "Atrasados" },
];

function FilterChips({
  value,
  counts,
  onChange,
}: {
  value: FilterId;
  counts: Partial<Record<FilterId, number>>;
  onChange: (v: FilterId) => void;
}) {
  return (
    <div className="flex gap-1.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {FILTERS.map((f) => {
        const count = counts[f.id];
        return (
          <button
            key={f.id}
            onClick={() => onChange(f.id)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors",
              value === f.id
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            {f.label}
            {count !== undefined && count > 0 && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-px text-[9px] font-bold",
                  value === f.id
                    ? "bg-white/20"
                    : "bg-primary/10 text-primary",
                )}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Compact Lead Card ─────────────────────────────────────────────────────────

function LeadCard({
  c,
  accent,
  isSelected,
  onSelect,
}: {
  c: Customer;
  accent: string;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: c.id });

  const idle    = daysSince(c.last_contact_at);
  const stale   = idle !== null && idle >= 7;
  const overdue = c.next_return_at && new Date(c.next_return_at).getTime() < Date.now();
  const vehicle = [c.interest_brand, c.interest_model].filter(Boolean).join(" ");
  const price   = c.price_max ?? c.price_min;

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.4 : 1 }}
      {...attributes}
      {...listeners}
      onClick={() => !isDragging && onSelect()}
      className={cn(
        "group relative cursor-grab select-none rounded-xl border bg-card p-3 shadow-sm transition-all active:cursor-grabbing",
        isSelected
          ? "border-primary/50 ring-1 ring-primary/20 shadow-primary/10 shadow-md"
          : "border-border hover:border-primary/30 hover:shadow-md",
      )}
    >
      {/* Accent bar */}
      <div className={cn("absolute left-0 inset-y-2.5 w-[3px] rounded-r-full", accent)} />

      {/* Name row */}
      <div className="flex items-start gap-1 pl-2.5">
        <p className="flex-1 truncate text-[13px] font-bold leading-snug">{c.name}</p>
        {c.is_priority && (
          <Star className="mt-0.5 size-3 shrink-0 fill-amber-400 text-amber-400" />
        )}
      </div>

      {/* Vehicle */}
      <p className="mt-0.5 truncate pl-2.5 text-[11px] text-muted-foreground">
        {vehicle || <span className="italic opacity-50">Sem veículo</span>}
      </p>

      {/* Bottom row */}
      <div className="mt-2 flex items-center gap-2 pl-2.5">
        <span className="font-mono text-[11px] font-bold">
          {price ? formatPriceBRL(price) : <span className="text-muted-foreground/40">—</span>}
        </span>

        {stale && (
          <span className="flex items-center gap-0.5 text-[10px] font-bold text-destructive">
            <AlertTriangle className="size-2.5" />
            {idle}d
          </span>
        )}
        {!stale && overdue && (
          <span className="flex items-center gap-0.5 text-[10px] font-semibold text-amber-500">
            <Clock className="size-2.5" />
            Atrasado
          </span>
        )}

        <div className="ml-auto" onClick={(e) => e.stopPropagation()}>
          <WaButton
            customerId={c.id}
            nome={c.name}
            numero={c.whatsapp ?? c.phone}
            marca={c.interest_brand}
            modelo={c.interest_model}
            status={c.status}
            size="sm"
          />
        </div>
      </div>
    </div>
  );
}

// ── Kanban Column ─────────────────────────────────────────────────────────────

function KanbanColumn({
  status, title, accent, items, selectedId, onSelect,
}: {
  status: StatusId;
  title: string;
  accent: string;
  items: Customer[];
  selectedId: string | null;
  onSelect: (c: Customer) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-[240px] shrink-0 flex-col rounded-2xl transition-all duration-150",
        isOver && "bg-primary/5 scale-[1.01]",
      )}
    >
      <div className="mb-2 flex items-center gap-2 px-0.5">
        <span className={cn("size-2 rounded-full", accent)} />
        <h3 className="flex-1 truncate text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          {title}
        </h3>
        <span className={cn(
          "rounded-full px-1.5 py-0.5 font-mono text-[10px] font-bold",
          items.length > 0 ? "bg-muted text-muted-foreground" : "text-muted-foreground/30",
        )}>
          {items.length}
        </span>
      </div>

      <div className="flex min-h-[60px] flex-col gap-1.5">
        {items.map((c) => (
          <LeadCard
            key={c.id}
            c={c}
            accent={accent}
            isSelected={selectedId === c.id}
            onSelect={() => onSelect(c)}
          />
        ))}
        {items.length === 0 && (
          <div
            className={cn(
              "grid place-items-center rounded-xl border border-dashed border-border/50 py-6 text-[10px] uppercase tracking-widest text-muted-foreground/30 transition-colors",
              isOver && "border-primary/30 bg-primary/5 text-primary/40",
            )}
          >
            Soltar aqui
          </div>
        )}
      </div>
    </div>
  );
}

// ── Lead Slide-Over ───────────────────────────────────────────────────────────

function LeadSlideOver({
  customer,
  onClose,
  onMoveStatus,
}: {
  customer: Customer;
  onClose: () => void;
  onMoveStatus: (id: string, status: StatusId) => void;
}) {
  const navigate = useNavigate();

  const { data: interactions = [] } = useQuery({
    queryKey: ["customer-preview-interactions", customer.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("interactions")
        .select("id,type,content,created_at")
        .eq("customer_id", customer.id)
        .order("created_at", { ascending: false })
        .limit(5);
      return (data ?? []) as Array<{
        id: string; type: string; content: string | null; created_at: string;
      }>;
    },
    staleTime: 30_000,
  });

  const idle    = daysSince(customer.last_contact_at);
  const stale   = idle !== null && idle >= 7;
  const vehicle = [customer.interest_brand, customer.interest_model].filter(Boolean).join(" ");
  const price   = customer.price_max ?? customer.price_min;
  const statusInfo = STATUSES.find((s) => s.id === customer.status);
  const nextSts = NEXT_STATUSES[customer.status] ?? [];

  return (
    <div className="flex w-[340px] shrink-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xl">

      {/* Header */}
      <div className="flex items-start justify-between gap-2 border-b border-border p-4">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate text-sm font-bold">{customer.name}</h3>
            {customer.is_priority && (
              <Star className="size-3 shrink-0 fill-amber-400 text-amber-400" />
            )}
          </div>
          {statusInfo && (
            <span className={cn(
              "mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold",
              STATUS_BADGE[customer.status],
            )}>
              <span className={cn("size-1.5 rounded-full", statusInfo.accent)} />
              {statusInfo.label}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted"
        >
          <X className="size-3.5" />
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">

        {/* Contact data */}
        <div className="space-y-1.5 p-4 pb-2">
          {(customer.whatsapp || customer.phone) && (
            <p className="flex items-center gap-2 text-xs">
              <span className="text-base leading-none">📞</span>
              <span className="font-medium">{customer.whatsapp ?? customer.phone}</span>
            </p>
          )}
          {customer.email && (
            <p className="flex items-center gap-2 text-xs">
              <span className="text-base leading-none">✉️</span>
              <span className="truncate text-muted-foreground">{customer.email}</span>
            </p>
          )}
          {vehicle && (
            <p className="flex items-center gap-2 text-xs">
              <span className="text-base leading-none">🚗</span>
              <span className="font-medium">{vehicle}</span>
            </p>
          )}
          {price != null && (
            <p className="flex items-center gap-2 text-xs">
              <span className="text-base leading-none">💰</span>
              <span className="font-mono font-bold text-primary">
                {formatPriceBRL(price)}
              </span>
            </p>
          )}
          {customer.last_contact_at && (
            <p className={cn(
              "flex items-center gap-1.5 text-[11px]",
              stale ? "font-semibold text-destructive" : "text-muted-foreground",
            )}>
              {stale
                ? <AlertTriangle className="size-3 shrink-0" />
                : <Clock className="size-3 shrink-0" />
              }
              {stale
                ? `Sem contato há ${idle} dias`
                : `Último contato: ${new Date(customer.last_contact_at).toLocaleDateString("pt-BR")}`
              }
            </p>
          )}
        </div>

        {/* Primary actions */}
        <div className="flex gap-2 px-4 pb-3" onClick={(e) => e.stopPropagation()}>
          <div className="flex-1">
            <WaButton
              customerId={customer.id}
              nome={customer.name}
              numero={customer.whatsapp ?? customer.phone}
              marca={customer.interest_brand}
              modelo={customer.interest_model}
              status={customer.status}
              size="md"
            />
          </div>
          <button
            onClick={() => navigate({ to: "/clientes/$id", params: { id: customer.id } })}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-xs font-semibold hover:bg-muted"
          >
            <ExternalLink className="size-3.5" />
            Abrir
          </button>
        </div>

        {/* Move status */}
        {nextSts.length > 0 && (
          <div className="border-t border-border px-4 py-3">
            <p className="mb-2 text-[9px] font-black uppercase tracking-widest text-muted-foreground">
              Mover para
            </p>
            <div className="flex flex-wrap gap-1.5">
              {nextSts.map((s) => {
                const info = STATUSES.find((x) => x.id === s);
                return (
                  <button
                    key={s}
                    onClick={() => onMoveStatus(customer.id, s)}
                    className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-[11px] font-semibold transition-colors hover:bg-muted"
                  >
                    <span className={cn("size-1.5 rounded-full", info?.accent)} />
                    {info?.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Recent history */}
        {interactions.length > 0 && (
          <div className="border-t border-border px-4 py-3">
            <p className="mb-2 text-[9px] font-black uppercase tracking-widest text-muted-foreground">
              Histórico recente
            </p>
            <ul className="space-y-2">
              {interactions.map((i) => (
                <li key={i.id} className="flex items-start gap-2">
                  <span className="mt-px text-sm leading-none">{iIcon(i.type)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] text-muted-foreground">
                      {i.content || i.type}
                    </p>
                    <p className="text-[10px] text-muted-foreground/50">
                      {new Date(i.created_at).toLocaleString("pt-BR", {
                        day: "2-digit", month: "2-digit",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-border p-3">
        <button
          onClick={() => navigate({ to: "/clientes/$id", params: { id: customer.id } })}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/5"
        >
          Ver página completa <ArrowRight className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

// ── Vendas Drawer ─────────────────────────────────────────────────────────────

function VendasDrawer({
  customers,
  onClose,
}: {
  customers: Customer[];
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<SalesPeriod>("mes");

  const cutoff = startOf(
    period === "hoje" ? "day" : period === "semana" ? "week" : "month"
  );

  const vendas = customers
    .filter((c) => c.status === "venda_realizada")
    .filter((c) => !c.sold_at || new Date(c.sold_at) >= cutoff);

  const total = vendas.reduce((s, c) => s + (c.sale_value ?? 0), 0);

  const periodLabels: Record<SalesPeriod, string> = {
    hoje: "Hoje", semana: "Esta semana", mes: "Este mês",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="flex h-full w-full max-w-md flex-col overflow-hidden border-l border-border bg-card shadow-2xl">
        <div className="flex items-start justify-between gap-2 border-b border-border p-5">
          <div>
            <h2 className="text-base font-bold">Vendas Realizadas</h2>
            <p className={cn(
              "mt-0.5 text-sm font-semibold",
              total > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
            )}>
              {vendas.length} venda{vendas.length !== 1 ? "s" : ""}
              {total > 0 && ` · ${formatPriceBRL(total)}`}
            </p>
          </div>
          <button onClick={onClose} className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted">
            <X className="size-4" />
          </button>
        </div>

        <div className="flex gap-1 border-b border-border px-4 py-2">
          {(["hoje", "semana", "mes"] as SalesPeriod[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                "rounded-lg px-3 py-1 text-xs font-semibold transition-colors",
                period === p
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              {periodLabels[p]}
            </button>
          ))}
        </div>

        <div className="flex-1 divide-y divide-border overflow-y-auto">
          {vendas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <CheckCircle2 className="mb-3 size-9 text-muted-foreground/20" />
              <p className="text-sm font-medium text-muted-foreground">
                Nenhuma venda em {periodLabels[period].toLowerCase()}
              </p>
            </div>
          ) : (
            vendas.map((c) => (
              <button
                key={c.id}
                onClick={() => { navigate({ to: "/clientes/$id", params: { id: c.id } }); onClose(); }}
                className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-muted/50"
              >
                <CheckCircle2 className="size-5 shrink-0 text-emerald-500" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{c.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[c.interest_brand, c.interest_model].filter(Boolean).join(" ") || "—"}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-mono text-sm font-bold text-emerald-600 dark:text-emerald-400">
                    {c.sale_value ? formatPriceBRL(c.sale_value) : "—"}
                  </p>
                  {c.sold_at && (
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(c.sold_at).toLocaleDateString("pt-BR")}
                    </p>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ── Perdidos Drawer ───────────────────────────────────────────────────────────

function PerdidosDrawer({
  customers,
  onClose,
}: {
  customers: Customer[];
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const perdidos = customers.filter((c) => c.status === "perdido");

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="flex h-full w-full max-w-md flex-col overflow-hidden border-l border-border bg-card shadow-2xl">
        <div className="flex items-start justify-between gap-2 border-b border-border p-5">
          <div>
            <h2 className="text-base font-bold">Leads Perdidos</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {perdidos.length} lead{perdidos.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button onClick={onClose} className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted">
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 divide-y divide-border overflow-y-auto">
          {perdidos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <TrendingUp className="mb-3 size-9 text-emerald-500/30" />
              <p className="text-sm font-medium text-muted-foreground">Nenhum lead perdido 🎉</p>
            </div>
          ) : (
            perdidos.map((c) => (
              <button
                key={c.id}
                onClick={() => { navigate({ to: "/clientes/$id", params: { id: c.id } }); onClose(); }}
                className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-muted/50"
              >
                <X className="size-4 shrink-0 text-muted-foreground/40" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{c.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[c.interest_brand, c.interest_model].filter(Boolean).join(" ") || "—"}
                  </p>
                </div>
                <p className="shrink-0 font-mono text-[10px] text-muted-foreground">
                  {new Date(c.created_at).toLocaleDateString("pt-BR")}
                </p>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

function ClientesPage() {
  const { q: initialQ } = Route.useSearch() as { q?: string };
  const { user } = useAuth();

  const [q, setQ]                     = useState(initialQ ?? "");
  const [filter, setFilter]           = useState<FilterId>("todos");
  const [selected, setSelected]       = useState<Customer | null>(null);
  const [showVendas, setShowVendas]   = useState(false);
  const [showPerdidos, setShowPerd]   = useState(false);

  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({
    queryKey: ["customers"],
    queryFn: fetchCustomers,
  });

  const mutateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: StatusId }) => {
      const { error } = await supabase.from("customers").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: ["customers"] });
      const prev = qc.getQueryData<Customer[]>(["customers"]);
      qc.setQueryData<Customer[]>(
        ["customers"],
        (old) => old?.map((c) => (c.id === id ? { ...c, status } : c)) ?? []
      );
      setSelected((s) => (s?.id === id ? { ...s, status } : s));
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["customers"], ctx.prev);
      toast.error("Erro ao mover lead.");
    },
    onSuccess: () => toast.success("Status atualizado"),
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  function onDragEnd(e: DragEndEvent) {
    const id = String(e.active.id);
    const newStatus = e.over?.id as StatusId | undefined;
    if (!newStatus) return;
    const cur = data.find((c) => c.id === id);
    if (cur && cur.status !== newStatus) mutateStatus.mutate({ id, status: newStatus });
  }

  // Derived filter counts (calculated over all active leads, ignoring current filter)
  const activeLeads = data.filter((c) => !["venda_realizada", "perdido"].includes(c.status));
  const todayStart  = startOf("day");
  const tomorrowStart = new Date(todayStart.getTime() + 86_400_000);

  const filterCounts = useMemo((): Partial<Record<FilterId, number>> => {
    const l = activeLeads;
    return {
      meus:        l.filter((c) => c.responsavel_id === user?.id).length,
      prioridade:  l.filter((c) => c.is_priority).length,
      sem_contato: l.filter((c) => { const d = daysSince(c.last_contact_at); return d !== null && d >= 7; }).length,
      visita_hoje: l.filter((c) =>
        c.status === "visita" && c.next_return_at &&
        new Date(c.next_return_at) >= todayStart &&
        new Date(c.next_return_at) < tomorrowStart
      ).length,
      negociacao:  l.filter((c) => c.status === "em_negociacao").length,
      atrasados:   l.filter((c) => c.next_return_at && new Date(c.next_return_at) < new Date()).length,
    };
  }, [activeLeads, user?.id]);

  // Filtered + searched data for Kanban
  const visible = useMemo(() => {
    let list = activeLeads;

    if (q.trim()) {
      const t = q.toLowerCase();
      list = list.filter((c) =>
        [c.name, c.phone, c.whatsapp, c.email, c.interest_brand, c.interest_model]
          .some((v) => v?.toLowerCase().includes(t))
      );
    }

    switch (filter) {
      case "meus":
        list = list.filter((c) => c.responsavel_id === user?.id); break;
      case "prioridade":
        list = list.filter((c) => c.is_priority); break;
      case "sem_contato":
        list = list.filter((c) => { const d = daysSince(c.last_contact_at); return d !== null && d >= 7; }); break;
      case "visita_hoje":
        list = list.filter((c) =>
          c.status === "visita" && c.next_return_at &&
          new Date(c.next_return_at) >= todayStart &&
          new Date(c.next_return_at) < tomorrowStart
        ); break;
      case "negociacao":
        list = list.filter((c) => c.status === "em_negociacao"); break;
      case "atrasados":
        list = list.filter((c) => c.next_return_at && new Date(c.next_return_at) < new Date()); break;
    }

    return list;
  }, [data, q, filter, user?.id]);

  const grouped = useMemo(() => {
    const g: Record<string, Customer[]> = {};
    for (const s of PIPELINE_STATUSES) g[s.id] = [];
    for (const c of visible) if (g[c.status] !== undefined) g[c.status].push(c);
    return g;
  }, [visible]);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col overflow-hidden">

      {/* KPI strip */}
      {isLoading ? (
        <div className="grid grid-cols-3 gap-2 px-4 pt-3 pb-2 md:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-[72px] animate-pulse rounded-xl border border-border bg-card" />
          ))}
        </div>
      ) : (
        <KpiStrip
          customers={data}
          onVendas={() => setShowVendas(true)}
          onPerdidos={() => setShowPerd(true)}
        />
      )}

      {/* Controls */}
      <div className="flex flex-col gap-1.5 px-4 pb-2">
        <div className="flex items-center gap-2">
          <div className="relative max-w-xs flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Nome, telefone, veículo…"
              className="h-8 w-full rounded-lg border border-border bg-card pl-8 pr-3 text-sm outline-none focus:border-primary/60 transition-colors"
            />
            {q && (
              <button
                onClick={() => setQ("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          {visible.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {visible.length} lead{visible.length !== 1 ? "s" : ""}
            </span>
          )}

          <Link
            to="/clientes/novo"
            className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
          >
            <Plus className="size-3.5" /> Novo Lead
          </Link>
        </div>
        <FilterChips value={filter} counts={filterCounts} onChange={setFilter} />
      </div>

      {/* Kanban + Slide-over */}
      <div className="flex flex-1 gap-3 overflow-hidden px-4 pb-4">
        {isLoading ? (
          <div className="flex flex-1 gap-3 overflow-x-auto">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-64 w-[240px] shrink-0 animate-pulse rounded-2xl border border-border bg-card"
              />
            ))}
          </div>
        ) : (
          <DndContext sensors={sensors} onDragEnd={onDragEnd}>
            <div className="flex flex-1 gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {PIPELINE_STATUSES.map((s) => (
                <KanbanColumn
                  key={s.id}
                  status={s.id}
                  title={s.label}
                  accent={s.accent}
                  items={grouped[s.id] ?? []}
                  selectedId={selected?.id ?? null}
                  onSelect={(c) => setSelected((prev) => prev?.id === c.id ? null : c)}
                />
              ))}
              {/* Hidden droppables so drag to venda_realizada/perdido still works */}
              <HiddenDropzone id="venda_realizada" />
              <HiddenDropzone id="perdido" />
            </div>
          </DndContext>
        )}

        {/* Slide-over panel */}
        {selected && (
          <LeadSlideOver
            customer={selected}
            onClose={() => setSelected(null)}
            onMoveStatus={(id, status) => {
              mutateStatus.mutate({ id, status });
              if (status === "venda_realizada" || status === "perdido") {
                setSelected(null);
              }
            }}
          />
        )}
      </div>

      {/* Drawers */}
      {showVendas   && <VendasDrawer   customers={data} onClose={() => setShowVendas(false)} />}
      {showPerdidos && <PerdidosDrawer customers={data} onClose={() => setShowPerd(false)}   />}
    </div>
  );
}

// Hidden droppable zones for venda_realizada + perdido (DnD still works)
function HiddenDropzone({ id }: { id: string }) {
  const { setNodeRef } = useDroppable({ id });
  return <div ref={setNodeRef} aria-hidden className="sr-only" />;
}
