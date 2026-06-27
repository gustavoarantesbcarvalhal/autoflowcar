import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { APPOINTMENT_TYPES } from "@/lib/crm";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, CheckCircle2, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/agenda")({
  head: () => ({ meta: [{ title: "Agenda — DriverLeads" }] }),
  component: AgendaPage,
});

async function fetchAll() {
  const [a, c] = await Promise.all([
    supabase.from("appointments").select("*").order("scheduled_at", { ascending: true }),
    supabase.from("customers").select("id,name").order("name"),
  ]);
  if (a.error) throw a.error;
  if (c.error) throw c.error;
  return { appointments: a.data ?? [], customers: c.data ?? [] };
}

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

const EMPTY_FORM: NewForm = {
  customer_id: "",
  type: "retorno",
  scheduled_at: "",
  title: "",
};

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
    try {
      await onCreate(f);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const inputCls = "h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-primary/60";

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
            <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
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
              <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
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
              <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
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
            <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
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
              className="h-10 rounded-lg border border-border px-4 text-sm font-medium hover:bg-muted disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-60"
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

function AgendaPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["agenda"], queryFn: fetchAll });
  const [showModal, setShowModal] = useState(false);

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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agenda"] });
      toast.success("Agendado");
    },
    onError: (e: Error) => toast.error(e.message),
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

  const items = data?.appointments ?? [];
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const todayEnd = todayStart + 86400000;
  const weekEnd = todayStart + 7 * 86400000;
  const today   = items.filter((a) => { const t = new Date(a.scheduled_at).getTime(); return t >= todayStart && t < todayEnd; });
  const week    = items.filter((a) => { const t = new Date(a.scheduled_at).getTime(); return t >= todayEnd && t < weekEnd; });
  const later   = items.filter((a) => new Date(a.scheduled_at).getTime() >= weekEnd);
  const overdue = items.filter((a) => !a.done && new Date(a.scheduled_at).getTime() < todayStart);

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-8">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Agenda</h1>
          <p className="text-sm text-muted-foreground">Retornos, visitas e test drives</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
        >
          <Plus className="size-4" /> Agendar
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : (
        <div className="space-y-6">
          <AgendaSection title="Atrasados" tone="danger"  items={overdue} customers={data?.customers ?? []} onToggle={(id, done) => toggle.mutate({ id, done })} onRemove={(id) => remove.mutate(id)} />
          <AgendaSection title="Hoje"      tone="primary" items={today}   customers={data?.customers ?? []} onToggle={(id, done) => toggle.mutate({ id, done })} onRemove={(id) => remove.mutate(id)} />
          <AgendaSection title="Esta semana"              items={week}    customers={data?.customers ?? []} onToggle={(id, done) => toggle.mutate({ id, done })} onRemove={(id) => remove.mutate(id)} />
          <AgendaSection title="Mais tarde"               items={later}   customers={data?.customers ?? []} onToggle={(id, done) => toggle.mutate({ id, done })} onRemove={(id) => remove.mutate(id)} />
          {overdue.length === 0 && today.length === 0 && week.length === 0 && later.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
              Nenhum compromisso agendado.
            </div>
          )}
        </div>
      )}

      {showModal && (
        <AgendaModal
          customers={data?.customers ?? []}
          onCreate={(f) => create.mutateAsync(f)}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}

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
  const cmap = new Map(customers.map((c) => [c.id, c.name]));
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
            <li key={a.id} className={cn("flex items-center gap-3 p-3.5 transition-colors hover:bg-muted/30", a.done && "opacity-50")}>
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
