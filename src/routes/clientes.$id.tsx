import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { STATUSES, SOURCES, FOLLOW_UP_TYPES, formatPriceBRL, sourceLabel, statusLabel } from "@/lib/crm";
import { WaButton } from "@/components/wa-button";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, Phone, Mail, MapPin, Trash2, CheckCircle2, User, MessageCircle, ImageIcon, X, Pencil } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/clientes/$id")({
  head: () => ({ meta: [{ title: "Cliente — AutoFlow" }] }),
  component: ClienteDetalhe,
});

type RichInteraction = {
  id: string;
  type: string;
  content: string | null;
  created_at: string;
  user_id: string | null;
  user_nome: string | null;
};

async function fetchCustomer(id: string) {
  const [c, i, a] = await Promise.all([
    supabase.from("customers").select("*").eq("id", id).single(),
    supabase
      .from("interactions")
      .select("id,type,content,created_at,user_id")
      .eq("customer_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("appointments")
      .select("*")
      .eq("customer_id", id)
      .order("scheduled_at", { ascending: true }),
  ]);
  if (c.error) throw c.error;

  const interactions = i.data ?? [];
  const userIds = [
    ...new Set(interactions.map((it) => it.user_id).filter(Boolean) as string[]),
  ];
  const profileMap = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("user_profiles")
      .select("id,nome")
      .in("id", userIds);
    for (const p of profiles ?? []) profileMap.set(p.id, p.nome as string);
  }

  const richInteractions: RichInteraction[] = interactions.map((it) => ({
    ...it,
    user_nome: it.user_id ? (profileMap.get(it.user_id) ?? null) : null,
  }));

  return { customer: c.data, interactions: richInteractions, appointments: a.data ?? [] };
}

type StockVehicle = {
  id: string; brand: string; model: string;
  version: string | null; year: number | null;
  price_listed: number | null; photo_main_url: string | null;
};

type TeamMember = { id: string; nome: string; perfil: string };

// ---------------------------------------------------------------------------
// EditLeadModal
// ---------------------------------------------------------------------------

type EditForm = {
  name: string; phone: string; whatsapp: string; email: string;
  cpf: string; city: string; notes: string;
  interest_vehicle_id: string;
  interest_brand: string; interest_model: string; interest_year: string;
  price_min: string; price_max: string;
  source: string; responsavel_id: string;
};

function buildDiff(
  original: Record<string, unknown>,
  updated: Record<string, unknown>,
  labels: Record<string, string>,
): string {
  const lines: string[] = [];
  for (const key of Object.keys(labels)) {
    const oldVal = String(original[key] ?? "");
    const newVal = String(updated[key] ?? "");
    if (oldVal !== newVal) {
      lines.push(`${labels[key]}: "${oldVal || "—"}" → "${newVal || "—"}"`);
    }
  }
  return lines.length ? lines.join("\n") : "Sem alterações";
}

const FIELD_LABELS: Record<string, string> = {
  name: "Nome", phone: "Telefone", whatsapp: "WhatsApp",
  email: "E-mail", cpf: "CPF", city: "Cidade", notes: "Obs.",
  interest_brand: "Marca", interest_model: "Modelo", interest_year: "Ano",
  price_min: "Preço mín.", price_max: "Preço máx.",
  source: "Origem", responsavel_id: "Responsável",
};

function EditLeadModal({
  customer,
  stockVehicles,
  teamMembers,
  canEditResponsavel,
  onClose,
  onSaved,
}: {
  customer: Record<string, unknown>;
  stockVehicles: StockVehicle[];
  teamMembers: TeamMember[];
  canEditResponsavel: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [form, setForm] = useState<EditForm>({
    name:               String(customer.name ?? ""),
    phone:              String(customer.phone ?? ""),
    whatsapp:           String(customer.whatsapp ?? ""),
    email:              String(customer.email ?? ""),
    cpf:                String(customer.cpf ?? ""),
    city:               String(customer.city ?? ""),
    notes:              String(customer.notes ?? ""),
    interest_vehicle_id: String(customer.interest_vehicle_id ?? ""),
    interest_brand:     String(customer.interest_brand ?? ""),
    interest_model:     String(customer.interest_model ?? ""),
    interest_year:      String(customer.interest_year ?? ""),
    price_min:          customer.price_min != null ? String(customer.price_min) : "",
    price_max:          customer.price_max != null ? String(customer.price_max) : "",
    source:             String(customer.source ?? "outros"),
    responsavel_id:     String(customer.responsavel_id ?? ""),
  });
  const [saving, setSaving] = useState(false);

  const selectedVehicle = stockVehicles.find((v) => v.id === form.interest_vehicle_id) ?? null;

  function setF<K extends keyof EditForm>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function handleVehicleSelect(vehicleId: string) {
    if (!vehicleId) {
      setForm((f) => ({ ...f, interest_vehicle_id: "" }));
      return;
    }
    const v = stockVehicles.find((sv) => sv.id === vehicleId);
    if (v) {
      setForm((f) => ({
        ...f,
        interest_vehicle_id: vehicleId,
        interest_brand: v.brand,
        interest_model: [v.model, v.version].filter(Boolean).join(" "),
        interest_year: v.year ? String(v.year) : f.interest_year,
      }));
    }
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error("Nome é obrigatório"); return; }
    setSaving(true);
    try {
      const patch: Record<string, unknown> = {
        name:               form.name.trim(),
        phone:              form.phone || null,
        whatsapp:           form.whatsapp || null,
        email:              form.email || null,
        cpf:                form.cpf || null,
        city:               form.city || null,
        notes:              form.notes || null,
        interest_vehicle_id: form.interest_vehicle_id || null,
        interest_brand:     form.interest_brand || null,
        interest_model:     form.interest_model || null,
        interest_year:      form.interest_year || null,
        price_min:          form.price_min ? Number(form.price_min) : null,
        price_max:          form.price_max ? Number(form.price_max) : null,
        source:             form.source || null,
        responsavel_id:     form.responsavel_id || null,
      };

      const { error: updateErr } = await supabase
        .from("customers")
        .update(patch as never)
        .eq("id", customer.id as string);
      if (updateErr) throw updateErr;

      const originalForDiff: Record<string, unknown> = {
        name: customer.name, phone: customer.phone, whatsapp: customer.whatsapp,
        email: customer.email, cpf: customer.cpf, city: customer.city,
        notes: customer.notes, interest_brand: customer.interest_brand,
        interest_model: customer.interest_model, interest_year: customer.interest_year,
        price_min: customer.price_min, price_max: customer.price_max,
        source: customer.source, responsavel_id: customer.responsavel_id,
      };
      const updatedForDiff: Record<string, unknown> = {
        name: patch.name, phone: patch.phone, whatsapp: patch.whatsapp,
        email: patch.email, cpf: patch.cpf, city: patch.city,
        notes: patch.notes, interest_brand: patch.interest_brand,
        interest_model: patch.interest_model, interest_year: patch.interest_year,
        price_min: patch.price_min, price_max: patch.price_max,
        source: patch.source, responsavel_id: patch.responsavel_id,
      };
      const diff = buildDiff(originalForDiff, updatedForDiff, FIELD_LABELS);

      await supabase.from("interactions").insert({
        customer_id: customer.id as string,
        type: "edicao" as never,
        content: diff,
        user_id: user?.id ?? null,
      });

      toast.success("Cadastro atualizado");
      onSaved();
      onClose();
    } catch (e: unknown) {
      toast.error((e as Error).message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-card shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4 sticky top-0 bg-card z-10">
          <h2 className="text-base font-bold">Editar Cliente</h2>
          <button onClick={onClose} className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted">
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-5 p-5">

          {/* Dados Pessoais */}
          <section>
            <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Dados Pessoais</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <EField label="Nome *" value={form.name} onChange={(v) => setF("name", v)} className="sm:col-span-2" />
              <EField label="Telefone" value={form.phone} onChange={(v) => setF("phone", v)} />
              <EField label="WhatsApp" value={form.whatsapp} onChange={(v) => setF("whatsapp", v)} />
              <EField label="E-mail" value={form.email} onChange={(v) => setF("email", v)} />
              <EField label="CPF" value={form.cpf} onChange={(v) => setF("cpf", v)} />
              <EField label="Cidade" value={form.city} onChange={(v) => setF("city", v)} className="sm:col-span-2" />
              <div className="sm:col-span-2">
                <label className="block">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground">Observações</span>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setF("notes", e.target.value)}
                    rows={3}
                    className="mt-1 w-full rounded-md border border-border bg-background p-2 text-sm outline-none focus:border-primary/60"
                  />
                </label>
              </div>
            </div>
          </section>

          {/* Dados Comerciais */}
          <section>
            <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Dados Comerciais</p>

            {/* Vínculo com estoque */}
            <label className="mb-2 block">
              <span className="text-[10px] font-bold uppercase text-muted-foreground">Veículo do estoque</span>
              <select
                value={form.interest_vehicle_id}
                onChange={(e) => handleVehicleSelect(e.target.value)}
                className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm outline-none focus:border-primary/60"
              >
                <option value="">— Sem vínculo com estoque —</option>
                {stockVehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.brand} {v.model}{v.version ? ` ${v.version}` : ""} {v.year}
                  </option>
                ))}
              </select>
            </label>

            {selectedVehicle && (
              <div className="mb-3 flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-2">
                {selectedVehicle.photo_main_url ? (
                  <img src={selectedVehicle.photo_main_url} alt="" className="size-10 flex-shrink-0 rounded object-cover" />
                ) : (
                  <div className="flex size-10 flex-shrink-0 items-center justify-center rounded bg-muted">
                    <ImageIcon className="size-3.5 text-muted-foreground" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold">
                    {selectedVehicle.brand} {selectedVehicle.model}{selectedVehicle.version ? ` ${selectedVehicle.version}` : ""}
                  </p>
                  {selectedVehicle.price_listed && (
                    <p className="text-[10px] font-medium text-primary">{formatPriceBRL(selectedVehicle.price_listed)}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, interest_vehicle_id: "" }))}
                  className="flex-shrink-0 rounded p-0.5 text-muted-foreground hover:text-destructive"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <EField label="Marca" value={form.interest_brand} onChange={(v) => setF("interest_brand", v)} />
              <EField label="Modelo" value={form.interest_model} onChange={(v) => setF("interest_model", v)} />
              <EField label="Ano" value={form.interest_year} onChange={(v) => setF("interest_year", v)} />
              <div className="grid grid-cols-2 gap-2">
                <EField label="Preço mín. (R$)" value={form.price_min} onChange={(v) => setF("price_min", v)} type="number" />
                <EField label="Preço máx. (R$)" value={form.price_max} onChange={(v) => setF("price_max", v)} type="number" />
              </div>
              <div>
                <label className="block">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground">Origem</span>
                  <select
                    value={form.source}
                    onChange={(e) => setF("source", e.target.value)}
                    className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm outline-none focus:border-primary/60"
                  >
                    {SOURCES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </label>
              </div>
              {canEditResponsavel && teamMembers.length > 0 && (
                <div>
                  <label className="block">
                    <span className="text-[10px] font-bold uppercase text-muted-foreground">Responsável</span>
                    <select
                      value={form.responsavel_id}
                      onChange={(e) => setF("responsavel_id", e.target.value)}
                      className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm outline-none focus:border-primary/60"
                    >
                      <option value="">— Sem responsável —</option>
                      {teamMembers.map((m) => (
                        <option key={m.id} value={m.id}>{m.nome}</option>
                      ))}
                    </select>
                  </label>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-4 sticky bottom-0 bg-card">
          <button
            onClick={onClose}
            className="h-9 rounded-md border border-border px-4 text-sm font-medium hover:bg-muted"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="h-9 rounded-md bg-primary px-5 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {saving ? "Salvando…" : "Salvar alterações"}
          </button>
        </div>
      </div>
    </div>
  );
}

function EField({
  label, value, onChange, type = "text", className,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; className?: string;
}) {
  return (
    <label className={className}>
      <span className="text-[10px] font-bold uppercase text-muted-foreground">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary/60"
      />
    </label>
  );
}

// ---------------------------------------------------------------------------
// ClienteDetalhe
// ---------------------------------------------------------------------------

function ClienteDetalhe() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { perfil } = useAuth();
  const { data, isLoading } = useQuery({ queryKey: ["customer", id], queryFn: () => fetchCustomer(id) });

  const { data: stockVehicles = [] } = useQuery<StockVehicle[]>({
    queryKey: ["vehicles-disponivel"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select("id,brand,model,version,year,price_listed,photo_main_url")
        .neq("status", "vendido")
        .order("brand");
      if (error) return [];
      return (data ?? []) as StockVehicle[];
    },
  });

  const { data: teamMembers = [] } = useQuery<TeamMember[]>({
    queryKey: ["team-members"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("id,nome,perfil")
        .eq("ativo", true)
        .neq("perfil", "super_admin")
        .order("nome");
      if (error) return [];
      return (data ?? []) as TeamMember[];
    },
    enabled: perfil !== "vendedor",
  });

  const canEditResponsavel = perfil !== "vendedor";

  const [note, setNote] = useState("");
  const [type, setType] = useState("nota");
  const [showEdit, setShowEdit] = useState(false);

  const addInteraction = useMutation({
    mutationFn: async () => {
      if (!note.trim()) throw new Error("Escreva algo");
      const { error } = await supabase
        .from("interactions")
        .insert({ customer_id: id, type: type as never, content: note });
      if (error) throw error;
      await supabase
        .from("customers")
        .update({ last_contact_at: new Date().toISOString() })
        .eq("id", id);
    },
    onSuccess: () => {
      setNote("");
      qc.invalidateQueries({ queryKey: ["customer", id] });
      qc.invalidateQueries({ queryKey: ["followup"] });
      qc.invalidateQueries({ queryKey: ["followup-badge"] });
      toast.success("Registrado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateCustomer = useMutation({
    mutationFn: async (patch: Record<string, unknown>) => {
      const { error } = await supabase.from("customers").update(patch as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customer", id] });
      qc.invalidateQueries({ queryKey: ["followup"] });
      qc.invalidateQueries({ queryKey: ["followup-badge"] });
    },
  });

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("customers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Cliente removido"); navigate({ to: "/clientes" }); },
  });

  if (isLoading || !data) return <div className="p-8 text-sm text-muted-foreground">Carregando…</div>;
  const c = data.customer as Record<string, unknown>;

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6">
      <Link to="/clientes" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Pipeline
      </Link>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{c.name as string}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            {!!c.phone && <span className="inline-flex items-center gap-1"><Phone className="size-3.5" />{c.phone as string}</span>}
            {!!c.email && <span className="inline-flex items-center gap-1"><Mail className="size-3.5" />{c.email as string}</span>}
            {!!c.city  && <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" />{c.city as string}</span>}
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold uppercase">
              {sourceLabel(c.source as string)}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowEdit(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium hover:bg-muted"
          >
            <Pencil className="size-4" /> Editar
          </button>
          <WaButton
            customerId={id}
            nome={c.name as string}
            numero={(c.whatsapp ?? c.phone) as string | null}
            marca={c.interest_brand as string | null}
            modelo={c.interest_model as string | null}
            status={c.status as string}
          />
          <button
            onClick={() => { if (confirm("Excluir cliente?")) remove.mutate(); }}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Add interaction */}
          <section className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-widest">Registrar atendimento</h2>
            <div className="flex flex-col gap-2">
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
              >
                <option value="nota">Anotação</option>
                <option value="ligacao">Ligação</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="email">E-mail</option>
                <option value="visita">Visita</option>
                <option value="test_drive">Test Drive</option>
                <option value="retorno">Retorno</option>
                <option value="proposta">Proposta enviada</option>
                <option value="veiculo_apresentado">Veículo apresentado</option>
                <option value="perda">Motivo da perda</option>
              </select>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="O que aconteceu nesse contato?"
                className="w-full rounded-md border border-border bg-background p-2 text-sm outline-none focus:border-primary/60"
              />
              <button
                onClick={() => addInteraction.mutate()}
                disabled={addInteraction.isPending}
                className="self-end rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                Adicionar
              </button>
            </div>
          </section>

          {/* Timeline */}
          <section>
            <h2 className="mb-3 text-xs font-bold uppercase tracking-widest">Linha do tempo</h2>
            {data.interactions.length === 0 ? (
              <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                Nenhum registro ainda.
              </p>
            ) : (
              <ol className="relative space-y-4 border-l-2 border-border pl-5">
                {data.interactions.map((it) => (
                  <li key={it.id} className="relative">
                    <span className="absolute -left-[26px] top-1.5 size-3 rounded-full bg-primary ring-4 ring-background" />
                    <div className="rounded-lg border border-border bg-card p-3">
                      <div className="flex flex-wrap items-center justify-between gap-1">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
                          {it.type === "edicao" ? "Edição de cadastro" : it.type.replace(/_/g, " ")}
                        </span>
                        <div className="flex items-center gap-2">
                          {it.user_nome && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                              <User className="size-2.5" />
                              {it.user_nome}
                            </span>
                          )}
                          <span className="font-mono text-[10px] text-muted-foreground">
                            {new Date(it.created_at).toLocaleString("pt-BR")}
                          </span>
                        </div>
                      </div>
                      {it.content && (
                        <p className="mt-2 whitespace-pre-wrap text-sm">{it.content}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          {/* Contadores de contato */}
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="mb-3 text-xs font-bold uppercase tracking-widest">Histórico de contatos</h3>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-lg font-bold">{data.interactions.length}</p>
                <p className="text-[10px] text-muted-foreground">Total</p>
              </div>
              <div>
                <p className="text-lg font-bold text-whatsapp">
                  {data.interactions.filter((i) => i.type === "whatsapp").length}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  <MessageCircle className="mr-0.5 inline size-2.5" />WhatsApps
                </p>
              </div>
              <div>
                <p className="text-lg font-bold">
                  {data.interactions.filter((i) => i.type === "ligacao").length}
                </p>
                <p className="text-[10px] text-muted-foreground">Ligações</p>
              </div>
            </div>
          </div>

          {/* Status */}
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="mb-3 text-xs font-bold uppercase tracking-widest">Status do negócio</h3>
            <select
              value={c.status as string}
              onChange={(e) => updateCustomer.mutate({ status: e.target.value })}
              className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
            >
              {STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            <button
              onClick={() => {
                updateCustomer.mutate({ last_contact_at: new Date().toISOString() });
                toast.success("Contato registrado");
              }}
              className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs font-bold hover:bg-muted"
            >
              <CheckCircle2 className="size-3.5" /> Marcar contato realizado
            </button>
          </div>

          {/* Próxima ação */}
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="mb-3 text-xs font-bold uppercase tracking-widest">Próxima ação</h3>
            <select
              value={(c.next_action_type as string) ?? ""}
              onChange={(e) => updateCustomer.mutate({ next_action_type: e.target.value || null })}
              className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
            >
              <option value="">— Sem tipo definido —</option>
              {FOLLOW_UP_TYPES.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
            <label className="mt-3 block">
              <span className="text-[10px] font-bold uppercase text-muted-foreground">Data / hora</span>
              <input
                type="datetime-local"
                defaultValue={
                  c.next_return_at
                    ? new Date(c.next_return_at as string).toISOString().slice(0, 16)
                    : ""
                }
                onChange={(e) =>
                  updateCustomer.mutate({
                    next_return_at: e.target.value
                      ? new Date(e.target.value).toISOString()
                      : null,
                  })
                }
                className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
              />
            </label>
            <label className="mt-3 block">
              <span className="text-[10px] font-bold uppercase text-muted-foreground">Observação</span>
              <textarea
                rows={2}
                defaultValue={(c.next_action_notes as string) ?? ""}
                onBlur={(e) =>
                  updateCustomer.mutate({ next_action_notes: e.target.value || null })
                }
                placeholder="Detalhe da ação planejada"
                className="mt-1 w-full rounded-md border border-border bg-background p-2 text-sm outline-none focus:border-primary/60"
              />
            </label>
          </div>

          {/* Interesse */}
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="mb-3 text-xs font-bold uppercase tracking-widest">Interesse</h3>

            {/* Vínculo com estoque */}
            <div className="mb-3">
              <span className="text-[10px] font-bold uppercase text-muted-foreground">Veículo do estoque</span>
              <select
                value={(c.interest_vehicle_id as string) ?? ""}
                onChange={(e) => {
                  const vehicleId = e.target.value || null;
                  const v = stockVehicles.find((v) => v.id === vehicleId);
                  updateCustomer.mutate({
                    interest_vehicle_id: vehicleId,
                    ...(v && {
                      interest_brand: v.brand,
                      interest_model: [v.model, v.version].filter(Boolean).join(" "),
                      interest_year:  v.year ? String(v.year) : undefined,
                    }),
                  });
                }}
                className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
              >
                <option value="">— Sem vínculo com estoque —</option>
                {stockVehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.brand} {v.model}{v.version ? ` ${v.version}` : ""} {v.year}
                  </option>
                ))}
              </select>

              {/* Card do veículo vinculado */}
              {(() => {
                const linked = stockVehicles.find((v) => v.id === (c.interest_vehicle_id as string));
                if (!linked) return null;
                return (
                  <div className="mt-2 flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-2">
                    {linked.photo_main_url ? (
                      <img src={linked.photo_main_url} alt="" className="size-10 flex-shrink-0 rounded object-cover" />
                    ) : (
                      <div className="flex size-10 flex-shrink-0 items-center justify-center rounded bg-muted">
                        <ImageIcon className="size-3.5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold">
                        {linked.brand} {linked.model}{linked.version ? ` ${linked.version}` : ""}
                      </p>
                      {linked.price_listed && (
                        <p className="text-[10px] font-medium text-primary">{formatPriceBRL(linked.price_listed)}</p>
                      )}
                    </div>
                    <button
                      onClick={() => updateCustomer.mutate({ interest_vehicle_id: null })}
                      className="flex-shrink-0 rounded p-0.5 text-muted-foreground hover:text-destructive"
                      title="Desvincular"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                );
              })()}
            </div>

            <dl className="space-y-1 text-sm">
              <Row k="Marca"  v={c.interest_brand as string} />
              <Row k="Modelo" v={c.interest_model as string} />
              <Row k="Ano"    v={c.interest_year as string} />
              <Row k="Faixa"  v={
                c.price_min || c.price_max
                  ? `${formatPriceBRL(c.price_min as number)} – ${formatPriceBRL(c.price_max as number)}`
                  : "—"
              } />
              <Row k="Origem"      v={sourceLabel(c.source as string)} />
              <Row k="Status atual" v={statusLabel(c.status as string)} />
            </dl>
            {!!c.notes && (
              <p className="mt-3 whitespace-pre-wrap rounded-md bg-muted p-2 text-xs">
                {c.notes as string}
              </p>
            )}
          </div>

          {c.status === "venda_realizada" && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
              <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                Dados da Venda
              </h3>
              <label className="block">
                <span className="text-[10px] font-bold uppercase text-muted-foreground">Valor da venda (R$)</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  key={c.id as string}
                  defaultValue={(c.sale_value as number) ?? ""}
                  onBlur={(e) =>
                    updateCustomer.mutate({
                      sale_value: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  placeholder="Ex: 45000"
                  className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                />
              </label>
              {!!c.sold_at && (
                <p className="mt-2 text-[10px] text-muted-foreground">
                  Fechada em{" "}
                  {new Date(c.sold_at as string).toLocaleString("pt-BR", {
                    day: "2-digit", month: "2-digit", year: "numeric",
                    hour: "2-digit", minute: "2-digit",
                  })}
                </p>
              )}
            </div>
          )}

          {c.status === "perdido" && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
              <h3 className="mb-2 text-xs font-bold uppercase text-destructive">Motivo da perda</h3>
              <textarea
                defaultValue={(c.lost_reason as string) ?? ""}
                rows={3}
                onBlur={(e) => updateCustomer.mutate({ lost_reason: e.target.value })}
                placeholder="Por que perdeu a venda?"
                className="w-full rounded-md border border-border bg-background p-2 text-sm"
              />
            </div>
          )}
        </aside>
      </div>

      {showEdit && (
        <EditLeadModal
          customer={c}
          stockVehicles={stockVehicles}
          teamMembers={teamMembers}
          canEditResponsavel={canEditResponsavel}
          onClose={() => setShowEdit(false)}
          onSaved={() => qc.invalidateQueries({ queryKey: ["customer", id] })}
        />
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between border-b border-border/60 py-1 last:border-0">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="font-medium">{v || "—"}</dd>
    </div>
  );
}
