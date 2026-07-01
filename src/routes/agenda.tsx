import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { APPOINTMENT_TYPES } from "@/lib/crm";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, CheckCircle2, Trash2, X, ChevronLeft, ChevronRight, LayoutList, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { inputCls } from "@/components/form-field";

export const Route = createFileRoute("/agenda")({
  head: () => ({ meta: [{ title: "Agenda — DriverLeads" }] }),
  component: AgendaPage,
});

// ── Types ─────────────────────────────────────────────────────────────────────

type AgendaItem = {
  id: string;
  type: string;
  scheduled_at: string;
  title: string | null;
  done: boolean;
  customer_id: string | null;
};

type NewForm = {
  customer_id: string;
  type: string;
  scheduled_at: string;
  title: string;
};

const EMPTY_FORM: NewForm = { customer_id: "", type: "retorno", scheduled_at: "", title: "" };

// ── Fetch ─────────────────────────────────────────────────────────────────────

async function fetchAll() {
  const [a, c] = await Promise.all([
    supabase.from("appointments").select("*").order("scheduled_at", { ascending: true }),
    supabase.from("customers").select("id,name").order("name"),
  ]);
  if (a.error) throw a.error;
  if (c.error) throw c.error;
  return { appointments: a.data ?? [], customers: c.data ?? [] };
}

// ── Calendar helpers ──────────────────────────────────────────────────────────

function getWeekStart(offset: number): Date {
  const now = new Date();
  const dow  = now.getDay(); // 0=Sun
  const diff = dow === 0 ? -6 : 1 - dow; // back to Monday
  const mon  = new Date(now);
  mon.setDate(now.getDate() + diff + offset * 7);
  mon.setHours(0, 0, 0, 0);
  return mon;
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const DAY_SHORT = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

// ── Week Calendar ─────────────────────────────────────────────────────────────

function WeekCalendar({
  items,
  customers,
  weekOffset,
  onOffsetChange,
  onToggle,
  onRemove,
}: {
  items: AgendaItem[];
  customers: { id: string; name: string }[];
  weekOffset: number;
  onOffsetChange: (n: number) => void;
  onToggle: (id: string, done: boolean) => void;
  onRemove: (id: string) => void;
}) {
  const weekStart = getWeekStart(weekOffset);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const cmap  = new Map(customers.map((c) => [c.id, c.name]));

  const itemsByDay = new Map<string, AgendaItem[]>();
  for (const item of items) {
    const key = dateKey(new Date(item.scheduled_at));
    const arr = itemsByDay.get(key) ?? [];
    arr.push(item);
    itemsByDay.set(key, arr);
  }

  // Week label e.g. "23 jun – 29 jun"
  const fmt = (d: Date) =>
    d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "");
  const weekLabel = `${fmt(days[0])} – ${fmt(days[6])}`;

  const isCurrentWeek = weekOffset === 0;

  return (
    <div className="space-y-3">
      {/* Week navigation */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => onOffsetChange(weekOffset - 1)}
          className="grid size-8 place-items-center rounded-[10px] border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
        </button>

        <span className="flex-1 text-center text-sm font-semibold tabular-nums">
          {weekLabel}
        </span>

        <button
          onClick={() => onOffsetChange(weekOffset + 1)}
          className="grid size-8 place-items-center rounded-[10px] border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ChevronRight className="size-4" />
        </button>

        {!isCurrentWeek && (
          <button
            onClick={() => onOffsetChange(0)}
            className="h-8 rounded-[10px] border border-border px-3 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            Hoje
          </button>
        )}
      </div>

      {/* Calendar grid */}
      <div className="overflow-x-auto rounded-2xl border border-border">
        <div className="grid min-w-[560px] grid-cols-7">
          {days.map((day, i) => {
            const key      = dateKey(day);
            const isToday  = day.getTime() === today.getTime();
            const isPast   = day < today;
            const dayItems = (itemsByDay.get(key) ?? []).sort(
              (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime(),
            );

            return (
              <div
                key={key}
                className={cn(
                  "flex flex-col border-r border-border last:border-r-0",
                  isToday && "bg-primary/[0.03] dark:bg-primary/[0.06]",
                )}
              >
                {/* Day header */}
                <div
                  className={cn(
                    "border-b border-border px-2 py-2 text-center",
                    isToday
                      ? "bg-primary text-primary-foreground"
                      : isPast
                        ? "bg-muted/40"
                        : "bg-muted/20",
                  )}
                >
                  <p className={cn(
                    "text-[9px] font-bold uppercase tracking-widest",
                    isToday ? "text-primary-foreground/80" : "text-muted-foreground",
                  )}>
                    {DAY_SHORT[i]}
                  </p>
                  <p className={cn(
                    "mt-0.5 text-xl font-black tabular-nums leading-none",
                    isToday ? "text-primary-foreground" : isPast ? "text-muted-foreground" : "text-foreground",
                  )}>
                    {day.getDate()}
                  </p>
                  {dayItems.length > 0 && (
                    <span className={cn(
                      "mt-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold",
                      isToday
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-muted text-muted-foreground",
                    )}>
                      {dayItems.length}
                    </span>
                  )}
                </div>

                {/* Appointments */}
                <div className="min-h-20 flex-1 space-y-1 p-1.5">
                  {dayItems.map((a) => {
                    const dt       = new Date(a.scheduled_at);
                    const overdue  = dt < now && !a.done;
                    const typeLabel = APPOINTMENT_TYPES.find((t) => t.id === a.type)?.label;

                    return (
                      <div
                        key={a.id}
                        className={cn(
                          "group relative rounded-lg px-2 py-1.5",
                          a.done
                            ? "opacity-50 bg-muted/40"
                            : overdue
                              ? "bg-destructive/10 ring-1 ring-destructive/20"
                              : isToday
                                ? "bg-primary/10"
                                : "bg-muted/60",
                        )}
                      >
                        <p className={cn(
                          "font-mono text-[9px] leading-none",
                          overdue ? "font-bold text-destructive" : "text-muted-foreground",
                        )}>
                          {dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                        <p className={cn(
                          "mt-0.5 truncate text-[10px] font-semibold leading-tight",
                          overdue ? "text-destructive" : "",
                        )}>
                          {a.title || typeLabel}
                        </p>
                        {a.customer_id && cmap.has(a.customer_id) && (
                          <Link
                            to="/clientes/$id"
                            params={{ id: a.customer_id }}
                            className="block truncate text-[9px] text-muted-foreground hover:text-primary"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {cmap.get(a.customer_id)}
                          </Link>
                        )}

                        {/* Hover actions */}
                        <div className="absolute right-1 top-1 hidden gap-0.5 group-hover:flex">
                          <button
                            onClick={() => onToggle(a.id, !a.done)}
                            title={a.done ? "Reabrir" : "Concluir"}
                            className={cn(
                              "grid size-5 place-items-center rounded",
                              a.done ? "text-muted-foreground hover:text-foreground" : "hover:text-emerald-600",
                            )}
                          >
                            <CheckCircle2 className="size-3" />
                          </button>
                          <button
                            onClick={() => onRemove(a.id)}
                            title="Remover"
                            className="grid size-5 place-items-center rounded hover:text-destructive"
                          >
                            <Trash2 className="size-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── AgendaModal ───────────────────────────────────────────────────────────────

function AgendaModal({
  customers,
  onCreate,
  onClose,
}: {
  customers: { id: string; name: string }[];
  onCreate: (f: NewForm) => Promise<void>;
  onClose: () => void;
}) {
  const [f, setF] = useState<NewForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.scheduled_at) { toast.error("Data obrigatória"); return; }
    setSaving(true);
    try { await onCreate(f); onClose(); }
    finally { setSaving(false); }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold">Novo Agendamento</h2>
          <button
            onClick={onClose}
            className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-5">
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              Cliente (opcional)
            </label>
            <select
              value={f.customer_id}
              onChange={(e) => setF({ ...f, customer_id: e.target.value })}
              className={inputCls}
            >
              <option value="">— Selecionar cliente —</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                Tipo
              </label>
              <select
                value={f.type}
                onChange={(e) => setF({ ...f, type: e.target.value })}
                className={inputCls}
              >
                {APPOINTMENT_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                Data e hora
              </label>
              <input
                type="datetime-local"
                value={f.scheduled_at}
                onChange={(e) => setF({ ...f, scheduled_at: e.target.value })}
                required
                className={inputCls}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              Anotação (opcional)
            </label>
            <input
              placeholder="Ex: Trazer documentos do veículo"
              value={f.title}
              onChange={(e) => setF({ ...f, title: e.target.value })}
              className={inputCls}
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="h-9 rounded-[10px] border border-border px-4 text-sm font-medium hover:bg-muted disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-60"
            >
              <Plus className="size-4" />
              {saving ? "Agendando…" : "Agendar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── AgendaPage ────────────────────────────────────────────────────────────────

type ViewMode = "list" | "week";

function AgendaPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["agenda"], queryFn: fetchAll });
  const [showModal,    setShowModal]    = useState(false);
  const [removeTarget, setRemove]       = useState<string | null>(null);
  const [view,         setView]         = useState<ViewMode>("list");
  const [weekOffset,   setWeekOffset]   = useState(0);

  const create = useMutation({
    mutationFn: async (f: NewForm) => {
      const { error } = await supabase.from("appointments").insert({
        customer_id: f.customer_id || null,
        type: f.type as never,
        scheduled_at: new Date(f.scheduled_at).toISOString(),
        title: f.title || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["agenda"] }); toast.success("Agendado"); },
    onError:   (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) => {
      const { error } = await supabase.from("appointments").update({ done }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agenda"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("appointments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agenda"] }),
  });

  const items     = data?.appointments ?? [];
  const customers = data?.customers    ?? [];

  // List-view grouping
  const now       = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const todayEnd   = todayStart + 86400000;
  const weekEnd    = todayStart + 7 * 86400000;

  const today   = items.filter((a) => { const t = new Date(a.scheduled_at).getTime(); return t >= todayStart && t < todayEnd; });
  const week    = items.filter((a) => { const t = new Date(a.scheduled_at).getTime(); return t >= todayEnd && t < weekEnd; });
  const later   = items.filter((a) => new Date(a.scheduled_at).getTime() >= weekEnd);
  const overdue = items.filter((a) => !a.done && new Date(a.scheduled_at).getTime() < todayStart);
  const isEmpty = items.length === 0;

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-8">
      <PageHeader
        title="Agenda"
        subtitle="Retornos, visitas e test drives"
        action={
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex overflow-hidden rounded-[10px] border border-border bg-card">
              <button
                onClick={() => setView("list")}
                title="Visão de lista"
                className={cn(
                  "flex h-9 items-center gap-1.5 px-3 text-xs font-semibold transition-colors",
                  view === "list"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <LayoutList className="size-3.5" />
                Lista
              </button>
              <button
                onClick={() => setView("week")}
                title="Visão semanal"
                className={cn(
                  "flex h-9 items-center gap-1.5 px-3 text-xs font-semibold transition-colors",
                  view === "week"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <CalendarDays className="size-3.5" />
                Semana
              </button>
            </div>

            <button
              onClick={() => setShowModal(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
            >
              <Plus className="size-4" /> Agendar
            </button>
          </div>
        }
      />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : isEmpty ? (
        <EmptyState
          icon={CheckCircle2}
          title="Nenhum compromisso agendado"
          subtitle='Clique em "Agendar" para adicionar um compromisso.'
          tone="success"
        />
      ) : view === "week" ? (
        <WeekCalendar
          items={items}
          customers={customers}
          weekOffset={weekOffset}
          onOffsetChange={setWeekOffset}
          onToggle={(id, done) => toggle.mutate({ id, done })}
          onRemove={setRemove}
        />
      ) : (
        <div className="space-y-6">
          <AgendaSection title="Atrasados" tone="danger"  items={overdue} customers={customers} onToggle={(id, done) => toggle.mutate({ id, done })} onRemove={setRemove} />
          <AgendaSection title="Hoje"      tone="primary" items={today}   customers={customers} onToggle={(id, done) => toggle.mutate({ id, done })} onRemove={setRemove} />
          <AgendaSection title="Esta semana"              items={week}    customers={customers} onToggle={(id, done) => toggle.mutate({ id, done })} onRemove={setRemove} />
          <AgendaSection title="Mais tarde"               items={later}   customers={customers} onToggle={(id, done) => toggle.mutate({ id, done })} onRemove={setRemove} />
        </div>
      )}

      {showModal && (
        <AgendaModal
          customers={customers}
          onCreate={(f) => create.mutateAsync(f)}
          onClose={() => setShowModal(false)}
        />
      )}

      <ConfirmDialog
        open={removeTarget !== null}
        onOpenChange={(o) => { if (!o) setRemove(null); }}
        title="Remover agendamento?"
        description="Esta ação não pode ser desfeita."
        confirmLabel="Remover"
        variant="danger"
        isPending={remove.isPending}
        onConfirm={() => { if (removeTarget) remove.mutate(removeTarget); setRemove(null); }}
      />
    </div>
  );
}

// ── AgendaSection (list view) ─────────────────────────────────────────────────

function AgendaSection({
  title, tone, items, customers, onToggle, onRemove,
}: {
  title: string;
  tone?: "danger" | "primary";
  items: AgendaItem[];
  customers: { id: string; name: string }[];
  onToggle: (id: string, done: boolean) => void;
  onRemove: (id: string) => void;
}) {
  if (items.length === 0) return null;
  const cmap    = new Map(customers.map((c) => [c.id, c.name]));
  const titleCls = tone === "danger" ? "text-destructive" : tone === "primary" ? "text-primary" : "";

  return (
    <section>
      <h2 className={cn("mb-2.5 text-sm font-semibold", titleCls)}>
        {title}
        <span className="ml-2 font-mono text-xs font-bold text-muted-foreground">· {items.length}</span>
      </h2>
      <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
        {items.map((a) => {
          const typeLabel = APPOINTMENT_TYPES.find((t) => t.id === a.type)?.label;
          return (
            <li
              key={a.id}
              className={cn(
                "flex items-center gap-3 p-3.5 transition-colors hover:bg-muted/30",
                a.done && "opacity-50",
              )}
            >
              <button
                onClick={() => onToggle(a.id, !a.done)}
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-full border transition-colors",
                  a.done
                    ? "border-success bg-success text-success-foreground"
                    : "border-border hover:border-primary",
                )}
              >
                {a.done && <CheckCircle2 className="size-4" />}
              </button>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">
                  {a.title || typeLabel}
                  {a.customer_id && (
                    <Link
                      to="/clientes/$id"
                      params={{ id: a.customer_id }}
                      className="ml-2 text-xs font-medium text-primary hover:underline"
                    >
                      {cmap.get(a.customer_id)}
                    </Link>
                  )}
                </p>
                <p className="font-mono text-xs text-muted-foreground">
                  {new Date(a.scheduled_at).toLocaleString("pt-BR")}
                  {a.title && typeLabel ? ` · ${typeLabel}` : ""}
                </p>
              </div>
              <button
                onClick={() => onRemove(a.id)}
                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
