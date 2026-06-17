import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { STATUSES, FOLLOW_UP_TYPES, formatPriceBRL, whatsappLink, sourceLabel, statusLabel } from "@/lib/crm";
import { ArrowLeft, MessageCircle, Phone, Mail, MapPin, Trash2, CheckCircle2, User } from "lucide-react";
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

function ClienteDetalhe() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({ queryKey: ["customer", id], queryFn: () => fetchCustomer(id) });

  const [note, setNote] = useState("");
  const [type, setType] = useState("nota");

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
            {c.phone && <span className="inline-flex items-center gap-1"><Phone className="size-3.5" />{c.phone as string}</span>}
            {c.email && <span className="inline-flex items-center gap-1"><Mail className="size-3.5" />{c.email as string}</span>}
            {c.city  && <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" />{c.city as string}</span>}
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold uppercase">
              {sourceLabel(c.source as string)}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <a
            href={whatsappLink((c.whatsapp ?? c.phone) as string, `Olá ${c.name}!`)}
            target="_blank" rel="noreferrer"
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-whatsapp px-3 text-sm font-bold text-white hover:opacity-90"
          >
            <MessageCircle className="size-4" /> WhatsApp
          </a>
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
                          {it.type.replace(/_/g, " ")}
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
            {c.notes && (
              <p className="mt-3 whitespace-pre-wrap rounded-md bg-muted p-2 text-xs">
                {c.notes as string}
              </p>
            )}
          </div>

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
