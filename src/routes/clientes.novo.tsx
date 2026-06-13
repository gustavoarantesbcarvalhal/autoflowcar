import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SOURCES, STATUSES } from "@/lib/crm";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/clientes/novo")({
  head: () => ({ meta: [{ title: "Novo Cliente — AutoFlow" }] }),
  component: NovoCliente,
});

function NovoCliente() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "", phone: "", whatsapp: "", city: "", email: "",
    interest_brand: "", interest_model: "", interest_year: "",
    price_min: "", price_max: "", notes: "",
    source: "outros", status: "novo_lead",
  });

  const m = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Nome é obrigatório");
      const payload: Record<string, unknown> = { ...form };
      payload.price_min = form.price_min ? Number(form.price_min) : null;
      payload.price_max = form.price_max ? Number(form.price_max) : null;
      for (const k of Object.keys(payload)) if (payload[k] === "") payload[k] = null;
      payload.name = form.name;
      const { data, error } = await supabase.from("customers").insert(payload as never).select("id").single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (id) => { toast.success("Cliente cadastrado"); navigate({ to: "/clientes/$id", params: { id } }); },
    onError: (e: Error) => toast.error(e.message),
  });

  function setF<K extends keyof typeof form>(k: K, v: string) { setForm((f) => ({ ...f, [k]: v })); }

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

        <Section title="Interesse">
          <Input label="Marca" value={form.interest_brand} onChange={(v) => setF("interest_brand", v)} />
          <Input label="Modelo" value={form.interest_model} onChange={(v) => setF("interest_model", v)} />
          <Input label="Ano" value={form.interest_year} onChange={(v) => setF("interest_year", v)} />
          <Input label="Preço mín. (R$)" value={form.price_min} onChange={(v) => setF("price_min", v)} type="number" />
          <Input label="Preço máx. (R$)" value={form.price_max} onChange={(v) => setF("price_max", v)} type="number" />
        </Section>

        <Section title="Origem e Status">
          <Select label="Origem do lead" value={form.source} onChange={(v) => setF("source", v)} options={SOURCES.map((s) => ({ value: s.id, label: s.label }))} />
          <Select label="Status" value={form.status} onChange={(v) => setF("status", v)} options={STATUSES.map((s) => ({ value: s.id, label: s.label }))} />
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

function Input({ label, value, onChange, type = "text", required, className }: { label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean; className?: string }) {
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

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
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
