import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { VEHICLE_STATUSES, formatPriceBRL } from "@/lib/crm";
import { Plus, Trash2, X, ImageIcon, Upload, Pencil, Car, Search, Filter, SlidersHorizontal } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PageHeader } from "@/components/page-header";
import { inputCls, labelCls, FormField, FormSection } from "@/components/form-field";

export const Route = createFileRoute("/estoque")({
  head: () => ({ meta: [{ title: "Estoque de Veículos — DriverLeads" }] }),
  component: EstoquePage,
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FUEL_OPTIONS = ["Flex", "Gasolina", "Diesel", "Elétrico", "Híbrido"];
const TRANSMISSION_OPTIONS = ["Manual", "Automático", "Automatizado", "CVT"];

const PRICE_RANGES = [
  { label: "Todos os preços", min: 0, max: Infinity },
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

const STATUS_STYLE: Record<string, string> = {
  disponivel: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  reservado:  "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  vendido:    "bg-primary/15 text-primary",
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Vehicle = {
  id: string; brand: string; model: string;
  version: string | null; year: number | null;
  color: string | null; mileage: number | null;
  fuel: string | null; transmission: string | null;
  price_listed: number | null; price_fipe: number | null;
  price: number | null; price_min_neg: number | null;
  deal_offer: string | null; description: string | null;
  photo_main_url: string | null;
  status: "disponivel" | "reservado" | "vendido";
  tenant_id: string | null;
  created_at: string; updated_at: string;
};

type VehiclePhoto = {
  id: string; vehicle_id: string;
  url: string; path: string;
  ordem: number; is_main: boolean; created_at: string;
};

// ---------------------------------------------------------------------------
// Numeric input helpers
// ---------------------------------------------------------------------------

function parseRawCurrency(raw: string): string {
  const s = raw.replace(/R\$\s?/g, "").trim();
  if (s.includes(",")) {
    const normalized = s.replace(/\./g, "").replace(",", ".");
    const n = parseFloat(normalized);
    return isNaN(n) ? "" : String(Math.round(n));
  }
  return s.replace(/\D/g, "");
}

function CurrencyInput({
  placeholder, value, onChange,
}: {
  placeholder: string; value: string; onChange: (digits: string) => void;
}) {
  const [focused, setFocused] = useState(false);
  const num = value !== "" ? Number(value) : null;
  const displayValue = focused
    ? value
    : num != null ? new Intl.NumberFormat("pt-BR").format(num) : "";
  const preview = num != null ? formatPriceBRL(num) : null;
  return (
    <div>
      <input
        type="text" inputMode="numeric" placeholder={placeholder}
        value={displayValue}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => onChange(parseRawCurrency(e.target.value))}
        className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary/60"
      />
      {preview && <p className="mt-0.5 text-[10px] font-medium text-primary">{preview}</p>}
    </div>
  );
}

function KmInput({
  placeholder, value, onChange,
}: {
  placeholder: string; value: string; onChange: (digits: string) => void;
}) {
  const [focused, setFocused] = useState(false);
  const num = value !== "" ? Number(value) : null;
  const displayValue = focused
    ? value
    : num != null ? new Intl.NumberFormat("pt-BR").format(num) : "";
  const preview = num != null
    ? `${new Intl.NumberFormat("pt-BR").format(num)} km`
    : null;
  return (
    <div>
      <input
        type="text" inputMode="numeric" placeholder={placeholder}
        value={displayValue}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
        className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary/60"
      />
      {preview && <p className="mt-0.5 text-[10px] font-medium text-muted-foreground">{preview}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

async function fetchVehicles(): Promise<Vehicle[]> {
  const { data, error } = await supabase
    .from("vehicles")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Vehicle[];
}

// ---------------------------------------------------------------------------
// VehicleCard
// ---------------------------------------------------------------------------

function VehicleCard({
  v,
  onEdit,
  onPhotos,
  onDelete,
  onStatusChange,
}: {
  v: Vehicle;
  onEdit: () => void;
  onPhotos: () => void;
  onDelete: () => void;
  onStatusChange: (status: string) => void;
}) {
  const statusLabel = VEHICLE_STATUSES.find((s) => s.id === v.status)?.label ?? v.status;
  const price = v.price_listed ?? v.price;

  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md">
      {/* Photo */}
      <div className="relative aspect-video w-full overflow-hidden bg-muted">
        {v.photo_main_url ? (
          <img
            src={v.photo_main_url}
            alt={`${v.brand} ${v.model}`}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1.5">
            <Car className="size-8 text-muted-foreground/30" />
            <span className="text-[10px] text-muted-foreground/50">Sem foto</span>
          </div>
        )}
        {/* Status badge overlay */}
        <div className="absolute right-2 top-2">
          <span className={cn("rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide", STATUS_STYLE[v.status] ?? "bg-muted text-foreground")}>
            {statusLabel}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-3.5">
        <p className="text-sm font-extrabold leading-tight">{v.brand} {v.model}</p>
        {v.version && (
          <p className="mt-0.5 text-xs font-medium text-muted-foreground">{v.version}</p>
        )}

        {/* Specs chips */}
        <div className="mt-2 flex flex-wrap gap-1">
          {v.year && (
            <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] font-bold">{v.year}</span>
          )}
          {v.mileage != null && (
            <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px]">
              {v.mileage.toLocaleString("pt-BR")} km
            </span>
          )}
          {v.fuel && (
            <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px]">{v.fuel}</span>
          )}
          {v.color && (
            <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px]">{v.color}</span>
          )}
        </div>

        {/* Price */}
        <div className="mt-3 flex items-end justify-between">
          <div>
            <p className="font-mono text-base font-extrabold tabular-nums">
              {formatPriceBRL(price)}
            </p>
            {v.price_fipe && (
              <p className="font-mono text-[10px] text-muted-foreground">
                FIPE {formatPriceBRL(v.price_fipe)}
              </p>
            )}
          </div>
          {/* Quick status change */}
          <select
            value={v.status}
            onChange={(e) => onStatusChange(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            className="h-7 rounded-lg border border-border bg-background px-1.5 text-[10px] font-bold outline-none focus:border-primary/60"
          >
            {VEHICLE_STATUSES.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </div>

        {/* Actions */}
        <div className="mt-3 flex items-center gap-1 border-t border-border pt-3">
          <button
            onClick={onEdit}
            title="Editar"
            className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Pencil className="size-3.5" /> Editar
          </button>
          <button
            onClick={onPhotos}
            title="Fotos"
            className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ImageIcon className="size-3.5" /> Fotos
          </button>
          <button
            onClick={onDelete}
            title="Excluir"
            className="h-8 w-8 rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="mx-auto size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// EstoquePage
// ---------------------------------------------------------------------------

function EstoquePage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["vehicles"], queryFn: fetchVehicles });
  const [showNew, setShowNew] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [photoVehicle, setPhotoVehicle] = useState<Vehicle | null>(null);
  const [editVehicle, setEditVehicle] = useState<Vehicle | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const now = new Date();
  const [filter, setFilter] = useState({
    q: "", range: 0, status: "", month: -1, year: now.getFullYear(),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vehicles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vehicles"] });
      toast.success("Veículo removido");
    },
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
      const p = Number(v.price_listed ?? v.price ?? 0);
      if (p < r.min || p > r.max) return false;
      if (filter.q) {
        const t = filter.q.toLowerCase();
        if (![v.brand, v.model, v.version, String(v.year ?? "")].some((x) => x?.toLowerCase().includes(t)))
          return false;
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

  function onPhotoMainChanged(vehicleId: string, mainUrl: string | null) {
    qc.setQueryData<Vehicle[]>(["vehicles"], (old) =>
      old?.map((v) => v.id === vehicleId ? { ...v, photo_main_url: mainUrl } : v) ?? []
    );
  }

  const hasActiveFilters = filter.status !== "" || filter.range !== 0 || filter.month >= 0;

  const selectCls = "h-9 rounded-lg border border-border bg-card px-2 text-sm outline-none focus:border-primary/60";

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-6">

      <PageHeader
        title="Estoque de Veículos"
        subtitle={`${filtered.length} de ${(data ?? []).length} veículos`}
        action={
          <button
            onClick={() => setShowNew((s) => !s)}
            className="inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
          >
            {showNew ? <X className="size-4" /> : <Plus className="size-4" />}
            {showNew ? "Cancelar" : "Adicionar Veículo"}
          </button>
        }
      />

      {showNew && (
        <NewVehicleForm
          onDone={() => { setShowNew(false); qc.invalidateQueries({ queryKey: ["vehicles"] }); }}
        />
      )}

      {/* Filter bar */}
      <div className="mb-4 space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={filter.q}
              onChange={(e) => setFilter({ ...filter, q: e.target.value })}
              placeholder="Buscar marca, modelo, versão ou ano…"
              className="h-9 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-sm outline-none focus:border-primary/60"
            />
          </div>
          <button
            onClick={() => setShowFilters((s) => !s)}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors",
              showFilters || hasActiveFilters
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <SlidersHorizontal className="size-4" />
            Filtros
            {hasActiveFilters && (
              <span className="ml-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                {[filter.status !== "", filter.range !== 0, filter.month >= 0].filter(Boolean).length}
              </span>
            )}
          </button>
        </div>

        {showFilters && (
          <div className="flex flex-wrap gap-2 rounded-xl border border-border bg-card/60 p-3">
            <select
              value={filter.status}
              onChange={(e) => setFilter({ ...filter, status: e.target.value })}
              className={selectCls}
            >
              <option value="">Todos os status</option>
              {VEHICLE_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            <select
              value={filter.range}
              onChange={(e) => setFilter({ ...filter, range: Number(e.target.value) })}
              className={selectCls}
            >
              {PRICE_RANGES.map((r, i) => <option key={i} value={i}>{r.label}</option>)}
            </select>
            <select
              value={filter.month}
              onChange={(e) => setFilter({ ...filter, month: Number(e.target.value) })}
              className={selectCls}
            >
              <option value={-1}>Todos os meses</option>
              {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
            <select
              value={filter.year}
              onChange={(e) => setFilter({ ...filter, year: Number(e.target.value) })}
              disabled={filter.month < 0}
              className={cn(selectCls, filter.month < 0 && "opacity-40")}
            >
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            {hasActiveFilters && (
              <button
                onClick={() => setFilter({ q: filter.q, range: 0, status: "", month: -1, year: now.getFullYear() })}
                className="h-9 rounded-lg border border-border px-3 text-xs font-medium text-muted-foreground hover:bg-muted"
              >
                Limpar filtros
              </button>
            )}
          </div>
        )}

        {filter.month >= 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs">
            <Filter className="size-3.5 text-muted-foreground" />
            <span className="font-bold uppercase tracking-wider text-muted-foreground">
              {MONTHS[filter.month]} / {filter.year}
            </span>
            <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 font-bold text-emerald-700 dark:text-emerald-400">
              Disponíveis: {monthCounts.disponivel}
            </span>
            <span className="rounded-md bg-amber-500/15 px-2 py-0.5 font-bold text-amber-700 dark:text-amber-400">
              Reservados: {monthCounts.reservado}
            </span>
            <span className="rounded-md bg-primary/15 px-2 py-0.5 font-bold text-primary">
              Vendidos: {monthCounts.vendido}
            </span>
          </div>
        )}
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-72 animate-pulse rounded-2xl border border-border bg-card" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-20 text-center">
          <Car className="mx-auto mb-3 size-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Nenhum veículo encontrado.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {filtered.map((v) => (
            <VehicleCard
              key={v.id}
              v={v}
              onEdit={() => setEditVehicle(v)}
              onPhotos={() => setPhotoVehicle(v)}
              onDelete={() => setDeleteTarget(v.id)}
              onStatusChange={(status) => updateStatus.mutate({ id: v.id, status })}
            />
          ))}
        </div>
      )}

      {photoVehicle && (
        <PhotoModal
          vehicle={photoVehicle}
          onClose={() => setPhotoVehicle(null)}
          onMainChanged={(url) => onPhotoMainChanged(photoVehicle.id, url)}
        />
      )}

      {editVehicle && (
        <EditVehicleModal
          vehicle={editVehicle}
          onClose={() => setEditVehicle(null)}
          onSaved={(updated) => {
            qc.setQueryData<Vehicle[]>(["vehicles"], (old) =>
              old?.map((v) => v.id === updated.id ? updated : v) ?? []
            );
            setEditVehicle(null);
          }}
        />
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}
        title="Excluir veículo?"
        description="Esta ação não pode ser desfeita. O veículo será removido permanentemente."
        confirmLabel="Excluir"
        variant="danger"
        isPending={remove.isPending}
        onConfirm={() => { if (deleteTarget) remove.mutate(deleteTarget); setDeleteTarget(null); }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// EditVehicleModal
// ---------------------------------------------------------------------------

type VehicleEditForm = {
  brand: string; model: string; version: string;
  year: string; color: string; mileage: string;
  fuel: string; transmission: string;
  price_listed: string; price_fipe: string;
  deal_offer: string; description: string;
  status: string;
};

function vehicleToForm(v: Vehicle): VehicleEditForm {
  return {
    brand:        v.brand,
    model:        v.model,
    version:      v.version ?? "",
    year:         v.year != null ? String(v.year) : "",
    color:        v.color ?? "",
    mileage:      v.mileage != null ? String(v.mileage) : "",
    fuel:         v.fuel ?? "",
    transmission: v.transmission ?? "",
    price_listed: v.price_listed != null ? String(Math.round(Number(v.price_listed))) : "",
    price_fipe:   v.price_fipe   != null ? String(Math.round(Number(v.price_fipe)))   : "",
    deal_offer:   v.deal_offer ?? "",
    description:  v.description ?? "",
    status:       v.status,
  };
}

function EditVehicleModal({
  vehicle, onClose, onSaved,
}: {
  vehicle: Vehicle;
  onClose: () => void;
  onSaved: (updated: Vehicle) => void;
}) {
  const [f, setF] = useState<VehicleEditForm>(() => vehicleToForm(vehicle));

  const save = useMutation({
    mutationFn: async () => {
      if (!f.brand.trim() || !f.model.trim()) throw new Error("Marca e modelo são obrigatórios");
      const patch = {
        brand:        f.brand.trim(),
        model:        f.model.trim(),
        version:      f.version || null,
        year:         f.year ? Number(f.year) : null,
        color:        f.color || null,
        mileage:      f.mileage ? Number(f.mileage) : null,
        fuel:         f.fuel || null,
        transmission: f.transmission || null,
        price_listed: f.price_listed ? Number(f.price_listed) : null,
        price_fipe:   f.price_fipe   ? Number(f.price_fipe)   : null,
        deal_offer:   f.deal_offer || null,
        description:  f.description || null,
        status:       f.status as Vehicle["status"],
      };
      const { data, error } = await supabase
        .from("vehicles")
        .update(patch as never)
        .eq("id", vehicle.id)
        .select("*")
        .single();
      if (error) throw error;
      return data as Vehicle;
    },
    onSuccess: (updated) => {
      toast.success("Veículo atualizado");
      onSaved(updated);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-5 py-4">
          <h2 className="text-base font-bold">
            Editar — {vehicle.brand} {vehicle.model}{vehicle.version ? ` ${vehicle.version}` : ""}
          </h2>
          <button onClick={onClose} className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted">
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-6 p-5">
          <section>
            <p className={cn(labelCls, "mb-3")}>Informações Básicas</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <label className={labelCls}>Marca *</label>
                <input value={f.brand} onChange={(e) => setF({ ...f, brand: e.target.value })} className={inputCls} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Modelo *</label>
                <input value={f.model} onChange={(e) => setF({ ...f, model: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Versão</label>
                <input value={f.version} onChange={(e) => setF({ ...f, version: e.target.value })} placeholder="XEi" className={inputCls} />
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <label className={labelCls}>Ano</label>
                <input
                  type="text" inputMode="numeric" maxLength={4} placeholder="2022"
                  value={f.year}
                  onChange={(e) => setF({ ...f, year: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Cor</label>
                <input value={f.color} onChange={(e) => setF({ ...f, color: e.target.value })} placeholder="Prata" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>KM</label>
                <KmInput placeholder="45000" value={f.mileage} onChange={(v) => setF({ ...f, mileage: v })} />
              </div>
              <div>
                <label className={labelCls}>Status</label>
                <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} className={cn(inputCls, "cursor-pointer")}>
                  {VEHICLE_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Combustível</label>
                <select value={f.fuel} onChange={(e) => setF({ ...f, fuel: e.target.value })} className={cn(inputCls, "cursor-pointer")}>
                  <option value="">— Selecionar —</option>
                  {FUEL_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Câmbio</label>
                <select value={f.transmission} onChange={(e) => setF({ ...f, transmission: e.target.value })} className={cn(inputCls, "cursor-pointer")}>
                  <option value="">— Selecionar —</option>
                  {TRANSMISSION_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            </div>
          </section>

          <section>
            <p className={cn(labelCls, "mb-3")}>Informações Comerciais</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Valor anunciado</label>
                <CurrencyInput placeholder="Ex: 59900" value={f.price_listed} onChange={(v) => setF({ ...f, price_listed: v })} />
              </div>
              <div>
                <label className={labelCls}>Tabela FIPE</label>
                <CurrencyInput placeholder="Ex: 58200" value={f.price_fipe} onChange={(v) => setF({ ...f, price_fipe: v })} />
              </div>
            </div>
          </section>

          <section>
            <p className={cn(labelCls, "mb-3")}>Oferta / Descrição</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Oferta / Bônus</label>
                <textarea
                  value={f.deal_offer}
                  onChange={(e) => setF({ ...f, deal_offer: e.target.value })}
                  rows={4}
                  placeholder={"Transferência grátis\nTanque cheio\nIPVA pago"}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/60"
                />
              </div>
              <div>
                <label className={labelCls}>Descrição do veículo</label>
                <textarea
                  value={f.description}
                  onChange={(e) => setF({ ...f, description: e.target.value })}
                  rows={4}
                  placeholder={"Motor 1.4\nAr condicionado\nMultimídia"}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/60"
                />
              </div>
            </div>
          </section>
        </div>

        <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-border bg-card px-5 py-4">
          <button onClick={onClose} className="h-9 rounded-lg border border-border px-4 text-sm font-medium hover:bg-muted">
            Cancelar
          </button>
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="h-9 rounded-lg bg-primary px-5 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {save.isPending ? "Salvando…" : "Salvar alterações"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PhotoModal
// ---------------------------------------------------------------------------

function PhotoModal({
  vehicle, onClose, onMainChanged,
}: {
  vehicle: Vehicle;
  onClose: () => void;
  onMainChanged: (url: string | null) => void;
}) {
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [photoToDelete, setPhotoToDelete] = useState<VehiclePhoto | null>(null);

  const { data: photos = [] } = useQuery({
    queryKey: ["vehicle-photos", vehicle.id],
    queryFn: async (): Promise<VehiclePhoto[]> => {
      const { data, error } = await supabase
        .from("vehicle_photos")
        .select("*")
        .eq("vehicle_id", vehicle.id)
        .order("ordem");
      if (error) throw error;
      return (data ?? []) as VehiclePhoto[];
    },
  });

  async function uploadFiles(files: FileList) {
    if (!vehicle.tenant_id) { toast.error("Tenant não identificado"); return; }
    setUploading(true);
    try {
      const isFirst = photos.length === 0;
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const ext = file.name.split(".").pop() ?? "jpg";
        const path = `${vehicle.tenant_id}/${vehicle.id}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("vehicle-photos")
          .upload(path, file, { upsert: false });
        if (upErr) throw upErr;
        const { data: { publicUrl } } = supabase.storage.from("vehicle-photos").getPublicUrl(path);
        const makeMain = isFirst && i === 0;
        await supabase.from("vehicle_photos").insert({
          vehicle_id: vehicle.id,
          url: publicUrl,
          path,
          ordem: photos.length + i,
          is_main: makeMain,
        });
        if (makeMain) {
          await supabase.from("vehicles").update({ photo_main_url: publicUrl }).eq("id", vehicle.id);
          onMainChanged(publicUrl);
        }
      }
      await qc.invalidateQueries({ queryKey: ["vehicle-photos", vehicle.id] });
      toast.success(files.length === 1 ? "Foto adicionada" : `${files.length} fotos adicionadas`);
    } catch (e: unknown) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function setMain(photo: VehiclePhoto) {
    await supabase.from("vehicle_photos").update({ is_main: false }).eq("vehicle_id", vehicle.id);
    await supabase.from("vehicle_photos").update({ is_main: true }).eq("id", photo.id);
    await supabase.from("vehicles").update({ photo_main_url: photo.url }).eq("id", vehicle.id);
    qc.invalidateQueries({ queryKey: ["vehicle-photos", vehicle.id] });
    onMainChanged(photo.url);
  }

  async function deletePhoto(photo: VehiclePhoto) {
    await supabase.storage.from("vehicle-photos").remove([photo.path]);
    await supabase.from("vehicle_photos").delete().eq("id", photo.id);
    const remaining = photos.filter((p) => p.id !== photo.id);
    const next = remaining[0] ?? null;
    await supabase.from("vehicles").update({ photo_main_url: next?.url ?? null }).eq("id", vehicle.id);
    if (next && photo.is_main) {
      await supabase.from("vehicle_photos").update({ is_main: true }).eq("id", next.id);
    }
    qc.invalidateQueries({ queryKey: ["vehicle-photos", vehicle.id] });
    onMainChanged(next?.url ?? null);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-10 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-bold">
            Fotos — {vehicle.brand} {vehicle.model}{vehicle.version ? ` ${vehicle.version}` : ""}
          </h2>
          <button onClick={onClose} className="grid size-8 place-items-center rounded-lg hover:bg-muted">
            <X className="size-4" />
          </button>
        </div>
        <div className="p-5">
          <label
            className={cn(
              "inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border px-4 py-2.5 text-sm font-medium hover:bg-muted",
              uploading && "pointer-events-none opacity-60",
            )}
          >
            <Upload className="size-4" />
            {uploading ? "Enviando…" : "Adicionar fotos"}
            <input
              type="file" accept="image/*" multiple disabled={uploading}
              className="sr-only"
              onChange={(e) => e.target.files && uploadFiles(e.target.files)}
            />
          </label>

          {photos.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Nenhuma foto cadastrada ainda
            </p>
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {photos.map((photo) => (
                <div key={photo.id} className="relative overflow-hidden rounded-xl border border-border">
                  <img src={photo.url} alt="" className="aspect-square w-full object-cover" />
                  <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between bg-black/60 px-2 py-1.5">
                    {photo.is_main ? (
                      <span className="text-[10px] font-bold text-amber-400">★ Principal</span>
                    ) : (
                      <button
                        onClick={() => setMain(photo)}
                        className="text-[10px] text-white/60 hover:text-amber-400"
                      >
                        Definir principal
                      </button>
                    )}
                    <button
                      onClick={() => setPhotoToDelete(photo)}
                      className="rounded p-0.5 text-white/50 hover:text-red-400"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={photoToDelete !== null}
        onOpenChange={(o) => { if (!o) setPhotoToDelete(null); }}
        title="Excluir foto?"
        description="Esta foto será removida permanentemente."
        confirmLabel="Excluir"
        variant="danger"
        onConfirm={() => { if (photoToDelete) { deletePhoto(photoToDelete); setPhotoToDelete(null); } }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// NewVehicleForm
// ---------------------------------------------------------------------------

type VehicleForm = {
  brand: string; model: string; version: string;
  year: string; color: string; mileage: string;
  fuel: string; transmission: string;
  price_listed: string; price_fipe: string;
  deal_offer: string; description: string;
  status: string;
};

const emptyForm: VehicleForm = {
  brand: "", model: "", version: "",
  year: "", color: "", mileage: "",
  fuel: "", transmission: "",
  price_listed: "", price_fipe: "",
  deal_offer: "", description: "",
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
        version:      f.version      || null,
        year:         f.year         ? Number(f.year)    : null,
        color:        f.color        || null,
        mileage:      f.mileage      ? Number(f.mileage) : null,
        fuel:         f.fuel         || null,
        transmission: f.transmission || null,
        price_listed: f.price_listed ? Number(f.price_listed) : null,
        price_fipe:   f.price_fipe   ? Number(f.price_fipe)   : null,
        deal_offer:   f.deal_offer   || null,
        description:  f.description  || null,
        status:       f.status as "disponivel" | "reservado" | "vendido",
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Veículo adicionado"); onDone(); },
    onError:   (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mb-5 rounded-2xl border border-border bg-card p-5">
      <h3 className="mb-4 text-sm font-bold">Novo veículo</h3>
      <form onSubmit={(e) => { e.preventDefault(); m.mutate(); }} className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <label className={labelCls}>Marca *</label>
            <input placeholder="Toyota" value={f.brand} onChange={(e) => setF({ ...f, brand: e.target.value })} className={inputCls} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Modelo *</label>
            <input placeholder="Corolla" value={f.model} onChange={(e) => setF({ ...f, model: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Versão</label>
            <input placeholder="XEi" value={f.version} onChange={(e) => setF({ ...f, version: e.target.value })} className={inputCls} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <label className={labelCls}>Ano</label>
            <input
              type="text" inputMode="numeric" maxLength={4} placeholder="2022"
              value={f.year}
              onChange={(e) => setF({ ...f, year: e.target.value.replace(/\D/g, "").slice(0, 4) })}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Cor</label>
            <input placeholder="Prata" value={f.color} onChange={(e) => setF({ ...f, color: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>KM</label>
            <KmInput placeholder="45000" value={f.mileage} onChange={(v) => setF({ ...f, mileage: v })} />
          </div>
          <div>
            <label className={labelCls}>Status</label>
            <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} className={cn(inputCls, "cursor-pointer")}>
              {VEHICLE_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Combustível</label>
            <select value={f.fuel} onChange={(e) => setF({ ...f, fuel: e.target.value })} className={cn(inputCls, "cursor-pointer")}>
              <option value="">— Selecionar —</option>
              {FUEL_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Câmbio</label>
            <select value={f.transmission} onChange={(e) => setF({ ...f, transmission: e.target.value })} className={cn(inputCls, "cursor-pointer")}>
              <option value="">— Selecionar —</option>
              {TRANSMISSION_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Valor anunciado</label>
            <CurrencyInput placeholder="59900" value={f.price_listed} onChange={(v) => setF({ ...f, price_listed: v })} />
          </div>
          <div>
            <label className={labelCls}>Tabela FIPE</label>
            <CurrencyInput placeholder="58200" value={f.price_fipe} onChange={(v) => setF({ ...f, price_fipe: v })} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Oferta / Bônus</label>
            <textarea
              value={f.deal_offer}
              onChange={(e) => setF({ ...f, deal_offer: e.target.value })}
              rows={3}
              placeholder={"Transferência grátis\nTanque cheio\nIPVA pago"}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/60"
            />
          </div>
          <div>
            <label className={labelCls}>Descrição do veículo</label>
            <textarea
              value={f.description}
              onChange={(e) => setF({ ...f, description: e.target.value })}
              rows={3}
              placeholder={"Motor 1.4\nAr condicionado\nMultimídia"}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/60"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onDone}
            className="h-9 rounded-lg border border-border px-4 text-sm font-medium hover:bg-muted">
            Cancelar
          </button>
          <button
            type="submit" disabled={m.isPending}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-5 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {m.isPending ? "Adicionando…" : "Adicionar"}
          </button>
        </div>
      </form>
    </div>
  );
}
