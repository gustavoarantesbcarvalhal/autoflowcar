import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { VEHICLE_STATUSES, formatPriceBRL } from "@/lib/crm";
import { Plus, Trash2, X, ImageIcon, Upload } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/estoque")({
  head: () => ({ meta: [{ title: "Estoque de Veículos — AutoFlow" }] }),
  component: EstoquePage,
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FUEL_OPTIONS = ["Flex", "Gasolina", "Diesel", "Elétrico", "Híbrido"];
const TRANSMISSION_OPTIONS = ["Manual", "Automático", "Automatizado", "CVT"];

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
    // Brazilian decimal format: "20.000,00" → remove thousand-dots → replace comma → round cents
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
        className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm outline-none focus:border-primary/60"
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
        className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm outline-none focus:border-primary/60"
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
// EstoquePage
// ---------------------------------------------------------------------------

function EstoquePage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["vehicles"], queryFn: fetchVehicles });
  const [showNew, setShowNew] = useState(false);
  const [photoVehicle, setPhotoVehicle] = useState<Vehicle | null>(null);
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

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Estoque de Veículos</h1>
          <p className="text-sm text-muted-foreground">
            {filtered.length} de {(data ?? []).length} veículos
          </p>
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
        <NewVehicleForm
          onDone={() => { setShowNew(false); qc.invalidateQueries({ queryKey: ["vehicles"] }); }}
        />
      )}

      {/* Filtros */}
      <div className="mb-3 flex flex-wrap gap-2">
        <input
          value={filter.q}
          onChange={(e) => setFilter({ ...filter, q: e.target.value })}
          placeholder="Buscar marca, modelo, versão ou ano…"
          className="h-9 min-w-48 flex-1 rounded-md border border-border bg-card px-3 text-sm outline-none focus:border-primary/60"
        />
        <select
          value={filter.range}
          onChange={(e) => setFilter({ ...filter, range: Number(e.target.value) })}
          className="h-9 rounded-md border border-border bg-card px-2 text-sm"
        >
          {PRICE_RANGES.map((r, i) => <option key={i} value={i}>{r.label}</option>)}
        </select>
        <select
          value={filter.status}
          onChange={(e) => setFilter({ ...filter, status: e.target.value })}
          className="h-9 rounded-md border border-border bg-card px-2 text-sm"
        >
          <option value="">Todos os status</option>
          {VEHICLE_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <select
          value={filter.month}
          onChange={(e) => setFilter({ ...filter, month: Number(e.target.value) })}
          className="h-9 rounded-md border border-border bg-card px-2 text-sm"
        >
          <option value={-1}>Todos os meses</option>
          {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
        </select>
        <select
          value={filter.year}
          onChange={(e) => setFilter({ ...filter, year: Number(e.target.value) })}
          className="h-9 rounded-md border border-border bg-card px-2 text-sm"
          disabled={filter.month < 0}
        >
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {filter.month >= 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs">
          <span className="font-bold uppercase tracking-wider text-muted-foreground">
            {MONTHS[filter.month]} / {filter.year}
          </span>
          <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 font-bold text-emerald-600 dark:text-emerald-400">
            Disponíveis: {monthCounts.disponivel}
          </span>
          <span className="rounded-md bg-amber-500/15 px-2 py-0.5 font-bold text-amber-600 dark:text-amber-400">
            Reservados: {monthCounts.reservado}
          </span>
          <span className="rounded-md bg-primary/15 px-2 py-0.5 font-bold text-primary">
            Vendidos: {monthCounts.vendido}
          </span>
          <button
            onClick={() => setFilter({ ...filter, month: -1 })}
            className="ml-auto rounded-md border border-border px-2 py-0.5 hover:bg-muted"
          >
            Limpar mês
          </button>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/30 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="w-14 p-3"></th>
                <th className="p-3">Veículo</th>
                <th className="p-3">Ano</th>
                <th className="p-3 text-right">KM</th>
                <th className="p-3 text-right">Valor</th>
                <th className="p-3 text-right">FIPE</th>
                <th className="p-3">Status</th>
                <th className="p-3"></th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((v) => (
                <tr key={v.id} className="hover:bg-muted/30">
                  <td className="p-3">
                    {v.photo_main_url ? (
                      <img
                        src={v.photo_main_url}
                        alt=""
                        className="size-10 rounded object-cover"
                      />
                    ) : (
                      <div className="flex size-10 items-center justify-center rounded bg-muted">
                        <ImageIcon className="size-4 text-muted-foreground/50" />
                      </div>
                    )}
                  </td>
                  <td className="p-3">
                    <p className="font-bold">{v.brand} {v.model}</p>
                    {(v.version || v.fuel || v.color) && (
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {[v.version, v.fuel, v.color].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </td>
                  <td className="p-3 font-mono text-sm">{v.year ?? "—"}</td>
                  <td className="p-3 text-right font-mono text-sm">
                    {v.mileage ? v.mileage.toLocaleString("pt-BR") : "—"}
                  </td>
                  <td className="p-3 text-right font-mono font-bold">
                    {formatPriceBRL(v.price_listed ?? v.price)}
                  </td>
                  <td className="p-3 text-right font-mono text-muted-foreground">
                    {v.price_fipe ? formatPriceBRL(v.price_fipe) : "—"}
                  </td>
                  <td className="p-3">
                    <select
                      value={v.status}
                      onChange={(e) => updateStatus.mutate({ id: v.id, status: e.target.value })}
                      className="h-7 rounded border border-border bg-background px-1 text-xs"
                    >
                      {VEHICLE_STATUSES.map((s) => (
                        <option key={s.id} value={s.id}>{s.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="p-3">
                    <button
                      onClick={() => setPhotoVehicle(v)}
                      title="Gerenciar fotos"
                      className="inline-flex items-center gap-1 rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <ImageIcon className="size-4" />
                    </button>
                  </td>
                  <td className="p-3">
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
                <tr>
                  <td colSpan={9} className="p-8 text-center text-muted-foreground">
                    Nenhum veículo encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {photoVehicle && (
        <PhotoModal
          vehicle={photoVehicle}
          onClose={() => setPhotoVehicle(null)}
          onMainChanged={(url) => onPhotoMainChanged(photoVehicle.id, url)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PhotoModal
// ---------------------------------------------------------------------------

function PhotoModal({
  vehicle,
  onClose,
  onMainChanged,
}: {
  vehicle: Vehicle;
  onClose: () => void;
  onMainChanged: (url: string | null) => void;
}) {
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);

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
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-10">
      <div className="w-full max-w-xl rounded-xl border border-border bg-background shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="font-bold">
            Fotos — {vehicle.brand} {vehicle.model}
            {vehicle.version ? ` ${vehicle.version}` : ""}
          </h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-muted">
            <X className="size-5" />
          </button>
        </div>
        <div className="p-4">
          <label
            className={cn(
              "inline-flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border px-4 py-2 text-sm hover:bg-muted",
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
            <p className="mt-4 rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Nenhuma foto cadastrada ainda
            </p>
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {photos.map((photo) => (
                <div key={photo.id} className="relative overflow-hidden rounded-lg border border-border">
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
                      onClick={() => { if (confirm("Excluir foto?")) deletePhoto(photo); }}
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

  const inp = "h-9 w-full rounded-md border border-border bg-background px-2 text-sm outline-none focus:border-primary/60";
  const lbl = "mb-1 block text-xs font-medium text-muted-foreground";

  return (
    <div className="mb-4 rounded-xl border border-border bg-card p-4">
      <h3 className="mb-3 text-sm font-bold">Novo veículo</h3>
      <form onSubmit={(e) => { e.preventDefault(); m.mutate(); }} className="space-y-3">

        {/* Linha 1: Marca, Modelo, Versão */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div>
            <label className={lbl}>Marca *</label>
            <input placeholder="Ex: Toyota" value={f.brand}
              onChange={(e) => setF({ ...f, brand: e.target.value })} className={inp} />
          </div>
          <div className="sm:col-span-2">
            <label className={lbl}>Modelo *</label>
            <input placeholder="Ex: Corolla" value={f.model}
              onChange={(e) => setF({ ...f, model: e.target.value })} className={inp} />
          </div>
          <div>
            <label className={lbl}>Versão</label>
            <input placeholder="Ex: XEi" value={f.version}
              onChange={(e) => setF({ ...f, version: e.target.value })} className={inp} />
          </div>
        </div>

        {/* Linha 2: Ano, Cor, KM, Status */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div>
            <label className={lbl}>Ano</label>
            <input
              type="text" inputMode="numeric" maxLength={4} placeholder="2022"
              value={f.year}
              onChange={(e) => setF({ ...f, year: e.target.value.replace(/\D/g, "").slice(0, 4) })}
              className={inp}
            />
          </div>
          <div>
            <label className={lbl}>Cor</label>
            <input placeholder="Prata" value={f.color}
              onChange={(e) => setF({ ...f, color: e.target.value })} className={inp} />
          </div>
          <div>
            <label className={lbl}>KM</label>
            <KmInput
              placeholder="45000"
              value={f.mileage}
              onChange={(v) => setF({ ...f, mileage: v })}
            />
          </div>
          <div>
            <label className={lbl}>Status</label>
            <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}
              className={cn(inp, "cursor-pointer")}>
              {VEHICLE_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
        </div>

        {/* Linha 3: Combustível, Câmbio */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={lbl}>Combustível</label>
            <select value={f.fuel} onChange={(e) => setF({ ...f, fuel: e.target.value })}
              className={cn(inp, "cursor-pointer")}>
              <option value="">— Selecionar —</option>
              {FUEL_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>Câmbio</label>
            <select value={f.transmission} onChange={(e) => setF({ ...f, transmission: e.target.value })}
              className={cn(inp, "cursor-pointer")}>
              <option value="">— Selecionar —</option>
              {TRANSMISSION_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        </div>

        {/* Linha 4: Valores */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div>
            <label className={lbl}>Valor anunciado</label>
            <CurrencyInput placeholder="Ex: 59900" value={f.price_listed}
              onChange={(v) => setF({ ...f, price_listed: v })} />
          </div>
          <div>
            <label className={lbl}>Tabela FIPE</label>
            <CurrencyInput placeholder="Ex: 58200" value={f.price_fipe}
              onChange={(v) => setF({ ...f, price_fipe: v })} />
          </div>
        </div>

        {/* Linha 5: Oferta e Descrição */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div>
            <label className={lbl}>Oferta / Bônus</label>
            <textarea
              value={f.deal_offer}
              onChange={(e) => setF({ ...f, deal_offer: e.target.value })}
              rows={3}
              placeholder={"Transferência grátis\nTanque cheio\nIPVA pago"}
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-primary/60"
            />
          </div>
          <div>
            <label className={lbl}>Descrição do veículo</label>
            <textarea
              value={f.description}
              onChange={(e) => setF({ ...f, description: e.target.value })}
              rows={3}
              placeholder={"Motor 1.4\nAr condicionado\nMultimídia"}
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-primary/60"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onDone}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted">
            Cancelar
          </button>
          <button
            type="submit" disabled={m.isPending}
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
