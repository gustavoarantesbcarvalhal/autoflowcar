import { createLazyFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { STATUSES, type StatusId, sourceLabel, formatPriceBRL, daysSince } from "@/lib/crm";
import { WaButton } from "@/components/wa-button";
import { DndContext, useDraggable, useDroppable, type DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export const Route = createLazyFileRoute("/clientes/")({
  component: ClientesPage,
});

type Customer = {
  id: string; name: string; phone: string | null; whatsapp: string | null;
  status: StatusId; source: string | null;
  interest_brand: string | null; interest_model: string | null;
  price_min: number | null; price_max: number | null;
  last_contact_at: string | null; next_return_at: string | null;
};

async function fetchCustomers(): Promise<Customer[]> {
  const { data, error } = await supabase
    .from("customers")
    .select("id,name,phone,whatsapp,status,source,interest_brand,interest_model,price_min,price_max,last_contact_at,next_return_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Customer[];
}

function ClientesPage() {
  const { q: initialQ } = Route.useSearch() as { q: string };
  const [q, setQ] = useState(initialQ);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["customers"], queryFn: fetchCustomers });

  const mutateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: StatusId }) => {
      const { error } = await supabase.from("customers").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: ["customers"] });
      const prev = qc.getQueryData<Customer[]>(["customers"]);
      qc.setQueryData<Customer[]>(["customers"], (old) => old?.map((c) => c.id === id ? { ...c, status } : c) ?? []);
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(["customers"], ctx.prev); toast.error("Erro ao mover."); },
    onSuccess: () => toast.success("Status atualizado"),
  });

  const filtered = useMemo(() => {
    const list = data ?? [];
    if (!q.trim()) return list;
    const t = q.toLowerCase();
    return list.filter((c) =>
      [c.name, c.phone, c.whatsapp, c.interest_brand, c.interest_model]
        .some((v) => v?.toLowerCase().includes(t))
    );
  }, [data, q]);

  const grouped = useMemo(() => {
    const g: Record<string, Customer[]> = {};
    for (const s of STATUSES) g[s.id] = [];
    for (const c of filtered) (g[c.status] ??= []).push(c);
    return g;
  }, [filtered]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function onDragEnd(e: DragEndEvent) {
    const id = String(e.active.id);
    const newStatus = e.over?.id as StatusId | undefined;
    if (!newStatus) return;
    const cur = data?.find((c) => c.id === id);
    if (cur && cur.status !== newStatus) mutateStatus.mutate({ id, status: newStatus });
  }

  return (
    <div className="mx-auto max-w-[1800px] p-4 md:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pipeline de Clientes</h1>
          <p className="text-sm text-muted-foreground">Arraste os cards para mover entre etapas</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar cliente ou veículo…"
              className="h-9 w-64 rounded-md border border-border bg-card pl-9 pr-3 text-sm outline-none focus:border-primary/60"
            />
          </div>
          <Link to="/clientes/novo" className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
            <Plus className="size-4" /> Novo Lead
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-lg border border-border bg-card" />
          ))}
        </div>
      ) : (
        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-4">
            {STATUSES.map((s) => (
              <Column key={s.id} status={s.id} title={s.label} accent={s.accent} items={grouped[s.id] ?? []} />
            ))}
          </div>
        </DndContext>
      )}
    </div>
  );
}

function Column({ status, title, accent, items }: { status: StatusId; title: string; accent: string; items: Customer[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div ref={setNodeRef} className={`flex w-72 shrink-0 flex-col rounded-lg transition-colors ${isOver ? "bg-accent/40" : ""}`}>
      <div className="mb-3 flex items-center justify-between px-1">
        <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest">
          <span className={`size-2 rounded-full ${accent}`} />
          {title}
          <span className="ml-1 font-mono text-muted-foreground">{items.length}</span>
        </h3>
      </div>
      <div className="flex flex-col gap-2 min-h-32">
        {items.map((c) => <Card key={c.id} c={c} accent={accent} />)}
        {items.length === 0 && (
          <div className="grid place-items-center rounded-lg border border-dashed border-border p-6 text-[10px] uppercase tracking-tight text-muted-foreground">
            Arraste aqui
          </div>
        )}
      </div>
    </div>
  );
}

function Card({ c, accent }: { c: Customer; accent: string }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: c.id });
  const navigate = useNavigate();
  const idle = daysSince(c.last_contact_at);
  const stale = idle !== null && idle >= 7;
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.5 : 1 }}
      {...attributes} {...listeners}
      onClick={() => !isDragging && navigate({ to: "/clientes/$id", params: { id: c.id } })}
      className="group animate-entry relative cursor-grab rounded-lg border border-border bg-card p-3 shadow-sm transition-all hover:border-primary/30 hover:shadow-md active:cursor-grabbing"
    >
      <div className={`absolute left-0 top-3 h-8 w-0.5 ${accent}`} />
      <div className="mb-1 flex items-start justify-between">
        <span className="font-mono text-[10px] text-muted-foreground">#{c.id.slice(0, 4)}</span>
        <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] font-bold uppercase">{sourceLabel(c.source)}</span>
      </div>
      <h4 className="text-sm font-bold">{c.name}</h4>
      <p className="text-xs text-muted-foreground">
        {c.interest_brand || "—"} {c.interest_model || ""}
      </p>
      {stale && (
        <div className="mt-2 flex items-center gap-1">
          <span className="size-1.5 animate-pulse rounded-full bg-destructive" />
          <span className="text-[10px] font-medium text-destructive">Sem contato há {idle}d</span>
        </div>
      )}
      <div className="mt-3 flex items-center justify-between">
        <span className="font-mono text-[11px] font-semibold">{formatPriceBRL(c.price_max ?? c.price_min)}</span>
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
  );
}
