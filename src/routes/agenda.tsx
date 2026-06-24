import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { APPOINTMENT_TYPES } from "@/lib/crm";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, CheckCircle2, Trash2 } from "lucide-react";

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

function AgendaPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["agenda"], queryFn: fetchAll });
  const [f, setF] = useState({ customer_id: "", type: "retorno", scheduled_at: "", title: "" });

  const create = useMutation({
    mutationFn: async () => {
      if (!f.scheduled_at) throw new Error("Data obrigatória");
      const { error } = await supabase.from("appointments").insert({
        customer_id: f.customer_id || null,
        type: f.type as never,
        scheduled_at: new Date(f.scheduled_at).toISOString(),
        title: f.title || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { setF({ customer_id: "", type: "retorno", scheduled_at: "", title: "" }); qc.invalidateQueries({ queryKey: ["agenda"] }); toast.success("Agendado"); },
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
  const today = items.filter((a) => { const t = new Date(a.scheduled_at).getTime(); return t >= todayStart && t < todayEnd; });
  const week = items.filter((a) => { const t = new Date(a.scheduled_at).getTime(); return t >= todayEnd && t < weekEnd; });
  const later = items.filter((a) => new Date(a.scheduled_at).getTime() >= weekEnd);
  const overdue = items.filter((a) => !a.done && new Date(a.scheduled_at).getTime() < todayStart);

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-6">
      <h1 className="text-2xl font-bold tracking-tight">Agenda</h1>
      <p className="mb-5 text-sm text-muted-foreground">Retornos, visitas e test drives</p>

      <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }}
        className="mb-6 grid grid-cols-1 gap-2 rounded-xl border border-border bg-card p-4 md:grid-cols-5">
        <select value={f.customer_id} onChange={(e) => setF({ ...f, customer_id: e.target.value })}
          className="h-9 rounded-md border border-border bg-background px-2 text-sm">
          <option value="">— Cliente (opcional) —</option>
          {data?.customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}
          className="h-9 rounded-md border border-border bg-background px-2 text-sm">
          {APPOINTMENT_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
        <input type="datetime-local" value={f.scheduled_at} onChange={(e) => setF({ ...f, scheduled_at: e.target.value })}
          className="h-9 rounded-md border border-border bg-background px-2 text-sm" />
        <input placeholder="Título / Anotação" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })}
          className="h-9 rounded-md border border-border bg-background px-2 text-sm" />
        <button className="inline-flex h-9 items-center justify-center gap-1 rounded-md bg-primary text-sm font-bold text-primary-foreground hover:bg-primary/90">
          <Plus className="size-4" /> Agendar
        </button>
      </form>

      {isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> : (
        <div className="space-y-6">
          <Section title="Atrasados" tone="danger" items={overdue} customers={data?.customers ?? []} onToggle={(id, done) => toggle.mutate({ id, done })} onRemove={(id) => remove.mutate(id)} />
          <Section title="Hoje" tone="primary" items={today} customers={data?.customers ?? []} onToggle={(id, done) => toggle.mutate({ id, done })} onRemove={(id) => remove.mutate(id)} />
          <Section title="Esta semana" items={week} customers={data?.customers ?? []} onToggle={(id, done) => toggle.mutate({ id, done })} onRemove={(id) => remove.mutate(id)} />
          <Section title="Mais tarde" items={later} customers={data?.customers ?? []} onToggle={(id, done) => toggle.mutate({ id, done })} onRemove={(id) => remove.mutate(id)} />
        </div>
      )}
    </div>
  );
}

function Section({ title, tone, items, customers, onToggle, onRemove }: {
  title: string; tone?: "danger" | "primary"; items: { id: string; type: string; scheduled_at: string; title: string | null; done: boolean; customer_id: string | null }[];
  customers: { id: string; name: string }[]; onToggle: (id: string, done: boolean) => void; onRemove: (id: string) => void;
}) {
  if (items.length === 0) return null;
  const cmap = new Map(customers.map((c) => [c.id, c.name]));
  const titleCls = tone === "danger" ? "text-destructive" : tone === "primary" ? "text-primary" : "";
  return (
    <section>
      <h2 className={`mb-2 text-xs font-bold uppercase tracking-widest ${titleCls}`}>{title} · {items.length}</h2>
      <ul className="overflow-hidden rounded-xl border border-border bg-card divide-y divide-border">
        {items.map((a) => (
          <li key={a.id} className={`flex items-center gap-3 p-3 ${a.done ? "opacity-50" : ""}`}>
            <button onClick={() => onToggle(a.id, !a.done)} className={`grid size-7 place-items-center rounded-full border ${a.done ? "bg-success border-success text-white" : "border-border hover:border-primary"}`}>
              {a.done && <CheckCircle2 className="size-4" />}
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold">
                {a.title || APPOINTMENT_TYPES.find((t) => t.id === a.type)?.label}
                {a.customer_id && <Link to="/clientes/$id" params={{ id: a.customer_id }} className="ml-2 text-xs font-medium text-primary hover:underline">{cmap.get(a.customer_id)}</Link>}
              </p>
              <p className="font-mono text-[11px] text-muted-foreground">
                {new Date(a.scheduled_at).toLocaleString("pt-BR")} · {APPOINTMENT_TYPES.find((t) => t.id === a.type)?.label}
              </p>
            </div>
            <button onClick={() => onRemove(a.id)} className="p-1 text-muted-foreground hover:text-destructive">
              <Trash2 className="size-4" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
