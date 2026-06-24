import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SOURCES, STATUSES, formatPriceBRL } from "@/lib/crm";
import { toast } from "sonner";
import { ArrowLeft, ImageIcon, X } from "lucide-react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/clientes/novo")({
  head: () => ({ meta: [{ title: "Novo Cliente — DriverLeads" }] }),
  component: NovoCliente,
});

type StockVehicle = {
  id: string; brand: string; model: string;
  version: string | null; year: number | null;
  price_listed: number | null; photo_main_url: string | null;
};

async function fetchAvailableVehicles(): Promise<StockVehicle[]> {
  const { data, error } = await supabase
    .from("vehicles")
    .select("id,brand,model,version,year,price_listed,photo_main_url")
    .eq("status", "disponivel")
    .order("brand");
  if (error) throw error;
  return (data ?? []) as StockVehicle[];
}

function NovoCliente() {
  const navigate = useNavigate();
  const { data: vehicles } = useQuery({
    queryKey: ["vehicles-disponivel"],
    queryFn: fetchAvailableVehicles,
  });

  const [form, setForm] = useState({
    name: "", phone: "", whatsapp: "", city: "", email: "",
    interest_vehicle_id: "",
    interest_brand: "", interest_model: "", interest_year: "",
    price_min: "", price_max: "", notes: "",
    source: "outros", status: "primeiro_contato",
  });

  const selectedVehicle = vehicles?.find((v) => v.id === form.interest_vehicle_id) ?? null;

  function handleVehicleSelect(vehicleId: string) {
    if (!vehicleId) {
      setForm((f) => ({ ...f, interest_vehicle_id: "" }));
      return;
    }
    const v = vehicles?.find((v) => v.id === vehicleId);
    if (v) {
      setForm((f) => ({
        ...f,
        interest_vehicle_id: vehicleId,
        interest_brand: v.brand,
        interest_model: [v.model, v.version].filter(Boolean).join(" "),
        interest_year:  v.year ? String(v.year) : f.interest_year,
      }));
    }
  }

  const m = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Nome é obrigatório");
      const payload: Record<string, unknown> = { ...form };
      payload.price_min          = form.price_min  ? Number(form.price_min)  : null;
      payload.price_max          = form.price_max  ? Number(form.price_max)  : null;
      payload.interest_vehicle_id = form.interest_vehicle_id || null;
      for (const k of Object.keys(payload)) if (payload[k] === "") payload[k] = null;
      payload.name   = form.name;
      payload.status = form.status;
      payload.source = form.source;
      const { data, error } = await supabase.from("customers").insert(payload as never).select("id").single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (id) => {
      toast.success("Cliente cadastrado");
      navigate({ to: "/clientes/$id", params: { id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function setF<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  return (
    <div className="mx-auto max-w-3xl p-4 md:p-6">
      <Link to="/clientes" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Voltar para Pipeline
      </Link>
      <h1 className="text-2xl font-bold tracking-tight">Cadastro Rápido de Cliente</h1>
      <p className="mb-6 text-sm text-muted-foreground">Menos de 30 segundos. Apenas o nome é obrigatório.</p>

      <form
        onSubmit={(e) => { e.preventDefault(); m.mutate(); }}
        className="grid gap-4 rounded-xl border border-border bg-card p-6"
      >
        <Section title="Dados Pessoais">
          <Input label="Nome *" value={form.name} onChange={(v) => setF("name", v)} required />
          <Input label="Telefone" value={form.phone} onChange={(v) => setF("phone", v)} />
          <Input label="WhatsApp" value={form.whatsapp} onChange={(v) => setF("whatsapp", v)} />
          <Input label="Cidade" value={form.city} onChange={(v) => setF("city", v)} />
          <Input label="E-mail" value={form.email} onChange={(v) => setF("email", v)} className="md:col-span-2" />
        </Section>

        {/* Veículo de interesse */}
        <div>
          <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Veículo de Interesse
          </h2>

          {/* Dropdown do estoque */}
          <label className="block">
            <span className="text-xs font-bold uppercase text-muted-foreground">Selecionar do estoque</span>
            <select
              value={form.interest_vehicle_id}
              onChange={(e) => handleVehicleSelect(e.target.value)}
              className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary/60"
            >
              <option value="">— Não está no estoque / preencher manualmente —</option>
              {(vehicles ?? []).map((v) => (
                <option key={v.id} value={v.id}>
                  {v.brand} {v.model}{v.version ? ` ${v.version}` : ""} {v.year}
                  {v.price_listed ? ` — ${formatPriceBRL(v.price_listed)}` : ""}
                </option>
              ))}
            </select>
          </label>

          {/* Card do veículo selecionado */}
          {selectedVehicle && (
            <div className="mt-2 flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
              {selectedVehicle.photo_main_url ? (
                <img
                  src={selectedVehicle.photo_main_url}
                  alt=""
                  className="size-14 flex-shrink-0 rounded object-cover"
                />
              ) : (
                <div className="flex size-14 flex-shrink-0 items-center justify-center rounded bg-muted">
                  <ImageIcon className="size-5 text-muted-foreground" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-bold text-sm">
                  {selectedVehicle.brand} {selectedVehicle.model}
                  {selectedVehicle.version ? ` ${selectedVehicle.version}` : ""}
                </p>
                <p className="text-xs text-muted-foreground">{selectedVehicle.year ?? "—"}</p>
                {selectedVehicle.price_listed && (
                  <p className="text-xs font-semibold text-primary">
                    {formatPriceBRL(selectedVehicle.price_listed)}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, interest_vehicle_id: "" }))}
                className="flex-shrink-0 rounded p-1 hover:bg-muted"
                title="Desvincular"
              >
                <X className="size-4" />
              </button>
            </div>
          )}

          {/* Campos manuais (sempre visíveis, auto-preenchidos ao selecionar do estoque) */}
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <Input label="Marca" value={form.interest_brand} onChange={(v) => setF("interest_brand", v)} />
            <Input label="Modelo" value={form.interest_model} onChange={(v) => setF("interest_model", v)} />
            <Input label="Ano" value={form.interest_year} onChange={(v) => setF("interest_year", v)} />
            <div className="grid grid-cols-2 gap-2">
              <Input label="Preço mín. (R$)" value={form.price_min} onChange={(v) => setF("price_min", v)} type="number" />
              <Input label="Preço máx. (R$)" value={form.price_max} onChange={(v) => setF("price_max", v)} type="number" />
            </div>
          </div>
        </div>

        <Section title="Origem e Status">
          <Select label="Origem do lead" value={form.source} onChange={(v) => setF("source", v)}
            options={SOURCES.map((s) => ({ value: s.id, label: s.label }))} />
          <Select label="Status" value={form.status} onChange={(v) => setF("status", v)}
            options={STATUSES.map((s) => ({ value: s.id, label: s.label }))} />
        </Section>

        <div>
          <label className="text-xs font-bold uppercase text-muted-foreground">Observações</label>
          <textarea
            value={form.notes} onChange={(e) => setF("notes", e.target.value)} rows={3}
            className="mt-1 w-full rounded-md border border-border bg-background p-2 text-sm outline-none focus:border-primary/60"
          />
        </div>

        <button
          type="submit" disabled={m.isPending}
          className="h-11 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
        >
          {m.isPending ? "Salvando…" : "Cadastrar cliente"}
        </button>
      </form>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">{title}</h2>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">{children}</div>
    </div>
  );
}

function Input({
  label, value, onChange, type = "text", required, className,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; required?: boolean; className?: string;
}) {
  return (
    <label className={className}>
      <span className="text-xs font-bold uppercase text-muted-foreground">{label}</span>
      <input
        type={type} value={value} onChange={(e) => onChange(e.target.value)} required={required}
        className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary/60"
      />
    </label>
  );
}

function Select({
  label, value, onChange, options,
}: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label>
      <span className="text-xs font-bold uppercase text-muted-foreground">{label}</span>
      <select
        value={value} onChange={(e) => onChange(e.target.value)}
        className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary/60"
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}
