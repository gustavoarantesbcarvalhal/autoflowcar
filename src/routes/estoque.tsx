import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { VEHICLE_STATUSES, formatPriceBRL } from "@/lib/crm";
import { Plus, Trash2 } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/estoque")({
  head: () => ({ meta: [{ title: "Estoque de Veículos — AutoFlow" }] }),
  component: EstoquePage,
});

const PRICE_RANGES = [
  { label: "Todos", min: 0, max: Infinity },
  { label: "Até R$ 40k", min: 0, max: 40000 },
  { label: "Até R$ 60k", min: 0, max: 60000 },
  { label: "Até R$ 80k", min: 0, max: 80000 },
  { label: "R$ 80k–120k", min: 80000, max: 120000 },
  { label: "Acima R$ 120k", min: 120000, max: Infinity },
];

const MONTHS = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];

async function fetchVehicles() {
  const { data, error } = await supabase.from("vehicles").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

function EstoquePage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["vehicles"], queryFn: fetchVehicles });
  const [showNew, setShowNew] = useState(false);
  const [filter, setFilter] = useState({ q: "", range: 0, status: "" });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vehicles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["vehicles"] }); toast.success("Veículo removido"); },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("vehicles").update({ status: status as never }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vehicles"] }),
  });

  const filtered = useMemo(() => {
    const r = PRICE_RANGES[filter.range];
    return (data ?? []).filter((v) => {
      if (filter.status && v.status !== filter.status) return false;
      const p = Number(v.price ?? 0);
      if (p < r.min || p > r.max) return false;
      if (filter.q) {
        const t = filter.q.toLowerCase();
        if (![v.brand, v.model, String(v.year)].some((x) => x?.toLowerCase?.().includes(t))) return false;
      }
      return true;
    });
  }, [data, filter]);

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Estoque de Veículos</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} de {(data ?? []).length} veículos</p>
        </div>
        <button onClick={() => setShowNew((s) => !s)}
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-bold text-primary-foreground hover:bg-primary/90">
          <Plus className="size-4" /> Adicionar Veículo
        </button>
      </div>

      {showNew && <NewVehicleForm onDone={() => { setShowNew(false); qc.invalidateQueries({ queryKey: ["vehicles"] }); }} />}

      <div className="mb-4 flex flex-wrap gap-2">
        <input value={filter.q} onChange={(e) => setFilter({ ...filter, q: e.target.value })}
          placeholder="Buscar marca, modelo ou ano…"
          className="h-9 flex-1 min-w-48 rounded-md border border-border bg-card px-3 text-sm outline-none focus:border-primary/60" />
        <select value={filter.range} onChange={(e) => setFilter({ ...filter, range: Number(e.target.value) })}
          className="h-9 rounded-md border border-border bg-card px-2 text-sm">
          {PRICE_RANGES.map((r, i) => <option key={i} value={i}>{r.label}</option>)}
        </select>
        <select value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })}
          className="h-9 rounded-md border border-border bg-card px-2 text-sm">
          <option value="">Todos os status</option>
          {VEHICLE_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </div>

      {isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/30 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="p-3">Veículo</th><th className="p-3">Ano</th><th className="p-3">Cor</th>
                <th className="p-3 text-right">KM</th><th className="p-3 text-right">Valor</th>
                <th className="p-3">Status</th><th className="p-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((v) => (
                <tr key={v.id} className="hover:bg-muted/30">
                  <td className="p-3 font-bold">{v.brand} {v.model}</td>
                  <td className="p-3 font-mono">{v.year ?? "—"}</td>
                  <td className="p-3">{v.color ?? "—"}</td>
                  <td className="p-3 text-right font-mono">{v.mileage ? v.mileage.toLocaleString("pt-BR") : "—"}</td>
                  <td className="p-3 text-right font-mono font-bold">{formatPriceBRL(v.price)}</td>
                  <td className="p-3">
                    <select value={v.status} onChange={(e) => updateStatus.mutate({ id: v.id, status: e.target.value })}
                      className="h-7 rounded border border-border bg-background px-1 text-xs">
                      {VEHICLE_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </select>
                  </td>
                  <td className="p-3 text-right">
                    <button onClick={() => { if (confirm("Excluir?")) remove.mutate(v.id); }} className="text-destructive hover:bg-destructive/10 p-1 rounded">
                      <Trash2 className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Nenhum veículo encontrado.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function NewVehicleForm({ onDone }: { onDone: () => void }) {
  const [f, setF] = useState({ brand: "", model: "", year: "", color: "", mileage: "", price: "", status: "disponivel" });
  const m = useMutation({
    mutationFn: async () => {
      if (!f.brand || !f.model) throw new Error("Marca e modelo são obrigatórios");
      const { error } = await supabase.from("vehicles").insert({
        brand: f.brand, model: f.model, color: f.color || null,
        year: f.year ? Number(f.year) : null,
        mileage: f.mileage ? Number(f.mileage) : null,
        price: f.price ? Number(f.price) : null,
        status: f.status as never,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Veículo adicionado"); onDone(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); m.mutate(); }}
      className="mb-4 grid grid-cols-2 gap-2 rounded-xl border border-border bg-card p-4 md:grid-cols-7">
      <input placeholder="Marca *" value={f.brand} onChange={(e) => setF({ ...f, brand: e.target.value })} className="h-9 rounded-md border border-border bg-background px-2 text-sm" />
      <input placeholder="Modelo *" value={f.model} onChange={(e) => setF({ ...f, model: e.target.value })} className="h-9 rounded-md border border-border bg-background px-2 text-sm" />
      <input placeholder="Ano" type="number" value={f.year} onChange={(e) => setF({ ...f, year: e.target.value })} className="h-9 rounded-md border border-border bg-background px-2 text-sm" />
      <input placeholder="Cor" value={f.color} onChange={(e) => setF({ ...f, color: e.target.value })} className="h-9 rounded-md border border-border bg-background px-2 text-sm" />
      <input placeholder="KM" type="number" value={f.mileage} onChange={(e) => setF({ ...f, mileage: e.target.value })} className="h-9 rounded-md border border-border bg-background px-2 text-sm" />
      <input placeholder="Valor R$" type="number" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} className="h-9 rounded-md border border-border bg-background px-2 text-sm" />
      <button className="h-9 rounded-md bg-primary text-sm font-bold text-primary-foreground hover:bg-primary/90">Adicionar</button>
    </form>
  );
}
