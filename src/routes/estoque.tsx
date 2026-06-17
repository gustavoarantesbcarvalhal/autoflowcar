import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { VEHICLE_STATUSES, formatPriceBRL } from "@/lib/crm";
import { Plus, Trash2, X } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/estoque")({
  head: () => ({ meta: [{ title: "Estoque de Veículos — AutoFlow" }] }),
  component: EstoquePage,
});

// ---------------------------------------------------------------------------
// Currency input helper
// Armazena apenas dígitos (inteiro); exibe preview formatado abaixo do campo.
// Evita o bug de type="number" que interpreta "59.900" como 59,9.
// ---------------------------------------------------------------------------

function parseCurrencyDigits(raw: string): string {
  return raw.replace(/\D/g, "");
}

function CurrencyInput({
  placeholder,
  value,
  onChange,
}: {
  placeholder: string;
  value: string;
  onChange: (digits: string) => void;
}) {
  const preview = value ? formatPriceBRL(Number(value)) : null;
  return (
    <div>
      <input
        type="text"
        inputMode="numeric"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(parseCurrencyDigits(e.target.value))}
        className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm outline-none focus:border-primary/60"
      />
      {preview && (
        <p className="mt-0.5 text-[10px] font-medium text-primary">{preview}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

async function fetchVehicles() {
  const { data, error } = await supabase
    .from("vehicles")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// ---------------------------------------------------------------------------
// EstoquePage
// ---------------------------------------------------------------------------

function EstoquePage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["vehicles"], queryFn: fetchVehicles });
  const [showNew, setShowNew] = useState(false);
  const now = new Date();
  const [filter, setFilter] = useState({ q: "", range: 0, status: "", month: -1, year: now.getFullYear() });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vehicles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["vehicles"] }); toast.success("Veículo removido"); },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("vehicles")
        .update({ status: status as "disponivel" | "reservado" | "vendido" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vehicles"] }),
  });

  const years = useMemo(() => {
    const ys = new Set<number>([now.getFullYear()]);
    (data ?? []).forEach((v) => {
      if (v.created_at) ys.add(new Date(v.created_at).getFullYear());
    });
    return Array.from(ys).sort((a, b) => b - a);
  }, [data, now]);

  const filtered = useMemo(() => {
    const r = PRICE_RANGES[filter.range];
    return (data ?? []).filter((v) => {
      if (filter.status && v.status !== filter.status) return false;
      // Usa price_listed como referência de valor para filtros; fallback para price
      const p = Number(v.price_listed ?? v.price ?? 0);
      if (p < r.min || p > r.max) return false;
      if (filter.q) {
        const t = filter.q.toLowerCase();
        if (![v.brand, v.model, String(v.year)].some((x) => x?.toLowerCase?.().includes(t))) return false;
      }
      if (filter.month >= 0) {
        const ref = v.status === "disponivel" ? v.created_at : v.updated_at;
        if (!ref) return false;
        const d = new Date(ref);
        if (d.getMonth() !== filter.month || d.getFullYear() !== filter.year) return false;
      }
      return true;
    });
  }, [data, filter]);

  const monthCounts = useMemo(() => {
    const base = { disponivel: 0, reservado: 0, vendido: 0 };
    filtered.forEach((v) => { if (v.status in base) base[v.status as keyof typeof base]++; });
    return base;
  }, [filtered]);

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Estoque de Veículos</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} de {(data ?? []).length} veículos</p>
        </div>
        <button
          onClick={() => setShowNew((s) => !s)}
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-bold text-primary-foreground hover:bg-primary/90"
        >
          {showNew ? <X className="size-4" /> : <Plus className="size-4" />}
          {showNew ? "Cancelar" : "Adicionar Veículo"}
        </button>
      </div>

      {showNew && (
        <NewVehicleForm onDone={() => { setShowNew(false); qc.invalidateQueries({ queryKey: ["vehicles"] }); }} />
      )}

      {/* Filters */}
      <div className="mb-3 flex flex-wrap gap-2">
        <input
          value={filter.q}
          onChange={(e) => setFilter({ ...filter, q: e.target.value })}
          placeholder="Buscar marca, modelo ou ano…"
          className="h-9 min-w-48 flex-1 rounded-md border border-border bg-card px-3 text-sm outline-none focus:border-primary/60"
        />
        <select value={filter.range} onChange={(e) => setFilter({ ...filter, range: Number(e.target.value) })}
          className="h-9 rounded-md border border-border bg-card px-2 text-sm">
          {PRICE_RANGES.map((r, i) => <option key={i} value={i}>{r.label}</option>)}
        </select>
        <select value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })}
          className="h-9 rounded-md border border-border bg-card px-2 text-sm">
          <option value="">Todos os status</option>
          {VEHICLE_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <select value={filter.month} onChange={(e) => setFilter({ ...filter, month: Number(e.target.value) })}
          className="h-9 rounded-md border border-border bg-card px-2 text-sm">
          <option value={-1}>Todos os meses</option>
          {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
        </select>
        <select value={filter.year} onChange={(e) => setFilter({ ...filter, year: Number(e.target.value) })}
          className="h-9 rounded-md border border-border bg-card px-2 text-sm" disabled={filter.month < 0}>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {filter.month >= 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs">
          <span className="font-bold uppercase tracking-wider text-muted-foreground">{MONTHS[filter.month]} / {filter.year}</span>
          <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 font-bold text-emerald-600 dark:text-emerald-400">Disponíveis: {monthCounts.disponivel}</span>
          <span className="rounded-md bg-amber-500/15 px-2 py-0.5 font-bold text-amber-600 dark:text-amber-400">Reservados: {monthCounts.reservado}</span>
          <span className="rounded-md bg-primary/15 px-2 py-0.5 font-bold text-primary">Vendidos: {monthCounts.vendido}</span>
          <button onClick={() => setFilter({ ...filter, month: -1 })} className="ml-auto rounded-md border border-border px-2 py-0.5 hover:bg-muted">Limpar mês</button>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/30 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="p-3">Veículo</th>
                <th className="p-3">Ano</th>
                <th className="p-3">Cor</th>
                <th className="p-3 text-right">KM</th>
                <th className="p-3 text-right">Valor anunciado</th>
                <th className="p-3 text-right">Mín. neg.</th>
                <th className="p-3">Status</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((v) => (
                <tr key={v.id} className="hover:bg-muted/30">
                  <td className="p-3 font-bold">{v.brand} {v.model}</td>
                  <td className="p-3 font-mono">{v.year ?? "—"}</td>
                  <td className="p-3">{v.color ?? "—"}</td>
                  <td className="p-3 text-right font-mono">{v.mileage ? v.mileage.toLocaleString("pt-BR") : "—"}</td>
                  <td className="p-3 text-right font-mono font-bold">
                    {formatPriceBRL(v.price_listed ?? v.price)}
                  </td>
                  <td className="p-3 text-right font-mono text-muted-foreground">
                    {v.price_min_neg ? formatPriceBRL(v.price_min_neg) : "—"}
                  </td>
                  <td className="p-3">
                    <select
                      value={v.status}
                      onChange={(e) => updateStatus.mutate({ id: v.id, status: e.target.value })}
                      className="h-7 rounded border border-border bg-background px-1 text-xs"
                    >
                      {VEHICLE_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </select>
                  </td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => { if (confirm("Excluir este veículo?")) remove.mutate(v.id); }}
                      className="rounded p-1 text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">Nenhum veículo encontrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// NewVehicleForm
// ---------------------------------------------------------------------------

type VehicleForm = {
  brand: string;
  model: string;
  year: string;
  color: string;
  mileage: string;
  price_listed: string;
  price_min_neg: string;
  price_fipe: string;
  status: string;
};

const emptyForm: VehicleForm = {
  brand: "", model: "", year: "", color: "", mileage: "",
  price_listed: "", price_min_neg: "", price_fipe: "",
  status: "disponivel",
};

function NewVehicleForm({ onDone }: { onDone: () => void }) {
  const [f, setF] = useState<VehicleForm>(emptyForm);

  const m = useMutation({
    mutationFn: async () => {
      if (!f.brand || !f.model) throw new Error("Marca e modelo são obrigatórios");
      const { error } = await supabase.from("vehicles").insert({
        brand:        f.brand,
        model:        f.model,
        color:        f.color  || null,
        year:         f.year   ? Number(f.year)   : null,
        mileage:      f.mileage ? Number(f.mileage) : null,
        price_listed: f.price_listed  ? Number(f.price_listed)  : null,
        price_min_neg: f.price_min_neg ? Number(f.price_min_neg) : null,
        price_fipe:   f.price_fipe   ? Number(f.price_fipe)   : null,
        status:       f.status as "disponivel" | "reservado" | "vendido",
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Veículo adicionado"); onDone(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const inp = "h-9 w-full rounded-md border border-border bg-background px-2 text-sm outline-none focus:border-primary/60";

  return (
    <div className="mb-4 rounded-xl border border-border bg-card p-4">
      <h3 className="mb-3 text-sm font-bold">Novo veículo</h3>
      <form onSubmit={(e) => { e.preventDefault(); m.mutate(); }} className="space-y-3">
        {/* Identificação */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Marca *</label>
            <input placeholder="Ex: Toyota" value={f.brand} onChange={(e) => setF({ ...f, brand: e.target.value })} className={inp} />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Modelo *</label>
            <input placeholder="Ex: Corolla XEi" value={f.model} onChange={(e) => setF({ ...f, model: e.target.value })} className={inp} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Ano</label>
            <input type="number" placeholder="2022" value={f.year} onChange={(e) => setF({ ...f, year: e.target.value })} className={inp} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Cor</label>
            <input placeholder="Prata" value={f.color} onChange={(e) => setF({ ...f, color: e.target.value })} className={inp} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">KM</label>
            <input
              type="text" inputMode="numeric" placeholder="45000"
              value={f.mileage}
              onChange={(e) => setF({ ...f, mileage: parseCurrencyDigits(e.target.value) })}
              className={inp}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Status</label>
            <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} className={cn(inp, "cursor-pointer")}>
              {VEHICLE_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
        </div>

        {/* Valores */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Valor anunciado</label>
            <CurrencyInput placeholder="Ex: 59900" value={f.price_listed} onChange={(v) => setF({ ...f, price_listed: v })} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Mín. de negociação</label>
            <CurrencyInput placeholder="Ex: 56000" value={f.price_min_neg} onChange={(v) => setF({ ...f, price_min_neg: v })} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Tabela FIPE</label>
            <CurrencyInput placeholder="Ex: 58200" value={f.price_fipe} onChange={(v) => setF({ ...f, price_fipe: v })} />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onDone}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={m.isPending}
            className={cn(
              "inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground",
              "hover:bg-primary/90 disabled:opacity-60",
            )}
          >
            {m.isPending ? "Adicionando…" : "Adicionar"}
          </button>
        </div>
      </form>
    </div>
  );
}
