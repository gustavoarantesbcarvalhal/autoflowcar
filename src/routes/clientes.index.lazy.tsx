import { createLazyFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { STATUSES, type StatusId, formatPriceBRL, daysSince } from "@/lib/crm";
import { WaButton } from "@/components/wa-button";
import { DndContext, useDraggable, useDroppable, type DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Plus, Search, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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

const COLLAPSED_BY_DEFAULT: StatusId[] = ["venda_realizada", "perdido"];

function ClientesPage() {
  const { q: initialQ } = Route.useSearch() as { q: string };
  const [q, setQ] = useState(initialQ);
  const [collapsed, setCollapsed] = useState<Set<StatusId>>(
    () => new Set(COLLAPSED_BY_DEFAULT),
  );
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

  function toggleCollapse(statusId: StatusId) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(statusId)) next.delete(statusId);
      else next.add(statusId);
      return next;
    });
  }

  return (
    <div className="mx-auto max-w-[1800px] p-4 md:p-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Pipeline de Clientes</h1>
          <p className="text-sm text-muted-foreground">Arraste os cards para mover entre etapas</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar cliente ou veículo…"
              className="h-9 w-64 rounded-lg border border-border bg-card pl-9 pr-3 text-sm outline-none focus:border-primary/60"
            />
          </div>
          <Link to="/clientes/novo" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90">
            <Plus className="size-4" /> Novo Lead
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="flex gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-40 w-72 shrink-0 animate-pulse rounded-2xl border border-border bg-card" />
          ))}
        </div>
      ) : (
        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
          <div className="relative">
            <div className="flex gap-3 overflow-x-auto pb-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {STATUSES.map((s) => (
                <Column
                  key={s.id}
                  status={s.id}
                  title={s.label}
                  accent={s.accent}
                  items={grouped[s.id] ?? []}
                  isCollapsed={collapsed.has(s.id)}
                  onToggleCollapse={() => toggleCollapse(s.id)}
                />
              ))}
            </div>
            <div className="pointer-events-none absolute right-0 top-0 h-full w-14 bg-gradient-to-l from-surface to-transparent" />
          </div>
        </DndContext>
      )}
    </div>
  );
}

function Column({
  status, title, accent, items, isCollapsed, onToggleCollapse,
}: {
  status: StatusId;
  title: string;
  accent: string;
  items: Customer[];
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  if (isCollapsed) {
    return (
      <div
        ref={setNodeRef}
        className="flex w-14 shrink-0 cursor-pointer flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-4 transition-colors hover:border-primary/40 hover:bg-muted/30"
        onClick={onToggleCollapse}
        title={`Expandir ${title}`}
      >
        <span className={cn("size-2 rounded-full", accent)} />
        <span className="font-mono text-xs font-bold text-muted-foreground">{items.length}</span>
        <span
          className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
          style={{ writingMode: "vertical-lr", transform: "rotate(180deg)" }}
        >
          {title}
        </span>
        <ChevronRight className="size-3.5 text-muted-foreground" />
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-72 shrink-0 flex-col rounded-2xl transition-colors",
        isOver ? "bg-accent/30" : "",
      )}
    >
      <div className="mb-3 flex items-center justify-between px-1">
        <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest">
          <span className={cn("size-2 rounded-full", accent)} />
          {title}
          <span className="ml-1 font-mono text-muted-foreground">{items.length}</span>
        </h3>
        {COLLAPSED_BY_DEFAULT.includes(status as StatusId) && (
          <button
            onClick={onToggleCollapse}
            className="rounded p-0.5 text-muted-foreground hover:text-foreground"
            title="Recolher coluna"
          >
            <ChevronRight className="size-3.5 rotate-180" />
          </button>
        )}
      </div>
      <div className="flex min-h-32 flex-col gap-2">
        {items.map((c) => <Card key={c.id} c={c} accent={accent} />)}
        {items.length === 0 && (
          <div className="grid place-items-center rounded-2xl border border-dashed border-border p-6 text-[10px] uppercase tracking-tight text-muted-foreground">
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
      className="group animate-entry relative cursor-grab rounded-2xl border border-border bg-card p-3 shadow-sm transition-all hover:border-primary/30 hover:shadow-md active:cursor-grabbing"
    >
      <div className={cn("absolute left-0 top-3 h-8 w-0.5 rounded-full", accent)} />
      <h4 className="text-sm font-bold">{c.name}</h4>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {c.interest_brand || "—"} {c.interest_model || ""}
      </p>
      {stale && (
        <div className="mt-2 flex items-center gap-1.5">
          <span className="size-1.5 animate-pulse rounded-full bg-destructive" />
          <span className="text-xs font-semibold text-destructive">Sem contato há {idle}d</span>
        </div>
      )}
      <div className="mt-3 flex items-center justify-between">
        <span className="font-mono text-xs font-bold">{formatPriceBRL(c.price_max ?? c.price_min)}</span>
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
