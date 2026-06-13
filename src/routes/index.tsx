import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { STATUSES, formatPriceBRL, whatsappLink, daysSince } from "@/lib/crm";
import { Plus, MessageCircle, ArrowRight, AlertTriangle, Clock, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Dashboard Comercial — AutoFlow" }] }),
  component: Dashboard,
});

async function fetchDashboard() {
  const [customers, appts] = await Promise.all([
    supabase.from("customers").select("id,name,phone,whatsapp,status,last_contact_at,next_return_at,interest_brand,interest_model,price_max").order("created_at", { ascending: false }),
    supabase.from("appointments").select("id,title,scheduled_at,type,done,customer_id").eq("done", false).order("scheduled_at", { ascending: true }).limit(10),
  ]);
  if (customers.error) throw customers.error;
  if (appts.error) throw appts.error;
  return { customers: customers.data ?? [], appts: appts.data ?? [] };
}

function Kpi({ label, value, hint, tone }: { label: string; value: string | number; hint?: string; tone?: "primary" | "danger" | "success" | "muted" }) {
  const toneCls = tone === "primary" ? "text-primary" : tone === "danger" ? "text-destructive" : tone === "success" ? "text-success" : "text-foreground";
  return (
    <div className="bg-card p-5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${toneCls}`}>{value}</p>
      {hint && <p className="mt-1 text-[10px] font-medium italic text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Dashboard() {
  const { data, isLoading } = useQuery({ queryKey: ["dashboard"], queryFn: fetchDashboard });

  const customers = data?.customers ?? [];
  const newLeads = customers.filter((c) => c.status === "novo_lead").length;
  const negotiating = customers.filter((c) => ["em_negociacao", "interessado", "proposta_enviada", "test_drive"].includes(c.status)).length;
  const sales = customers.filter((c) => c.status === "venda_realizada").length;
  const stale = customers.filter((c) => {
    const d = daysSince(c.last_contact_at);
    return d !== null && d >= 7 && c.status !== "venda_realizada" && c.status !== "perdido";
  });
  const followups = customers.filter((c) => {
    if (!c.next_return_at) return false;
    return new Date(c.next_return_at).getTime() <= Date.now() && c.status !== "venda_realizada" && c.status !== "perdido";
  }).length;

  const appts = data?.appts ?? [];
  const upcoming = appts.slice(0, 5);

  return (
    <div className="mx-auto max-w-[1600px] p-4 md:p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard Comercial</h1>
          <p className="text-sm text-muted-foreground">Visão rápida do dia de vendas</p>
        </div>
        <div className="flex gap-2">
          <Link to="/clientes/novo" className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
            <Plus className="size-4" /> Cadastro rápido
          </Link>
          <a href="https://wa.me/" target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-md bg-whatsapp px-3 text-sm font-semibold text-white hover:opacity-90">
            <MessageCircle className="size-4" /> WhatsApp
          </a>
        </div>
      </div>

      {/* KPI Ribbon */}
      <div className="mb-8 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border shadow-sm md:grid-cols-3 lg:grid-cols-6">
        <Kpi label="Leads Novos" value={isLoading ? "…" : newLeads} hint="Não contactados" />
        <Kpi label="Em Negociação" value={isLoading ? "…" : negotiating} />
        <Kpi label="Follow-ups" value={isLoading ? "…" : followups} tone="primary" hint="Pendentes hoje" />
        <Kpi label="Vendas" value={isLoading ? "…" : sales} tone="success" hint="Concluídas" />
        <Kpi label="Sem Contato 7d+" value={isLoading ? "…" : stale.length} tone="danger" />
        <Kpi label="Próximos Retornos" value={isLoading ? "…" : upcoming.length} />
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Stale list */}
        <section className="flex-1">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest"><AlertTriangle className="size-4 text-destructive" />Clientes sem contato há 7d+</h2>
            <Link to="/followup" className="inline-flex items-center gap-1 text-xs font-bold uppercase text-primary hover:underline">
              Ver Follow-up <ArrowRight className="size-3" />
            </Link>
          </div>
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            {stale.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                <TrendingUp className="mx-auto mb-2 size-6" />
                Nenhum cliente parado. Continue assim.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {stale.slice(0, 6).map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 p-3 hover:bg-muted/50">
                    <Link to="/clientes/$id" params={{ id: c.id }} className="flex-1 min-w-0">
                      <p className="truncate text-sm font-semibold">{c.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {c.interest_brand} {c.interest_model} · {formatPriceBRL(c.price_max)} · Sem contato há {daysSince(c.last_contact_at)} dias
                      </p>
                    </Link>
                    <a
                      href={whatsappLink(c.whatsapp ?? c.phone, `Olá ${c.name}, tudo bem?`)}
                      target="_blank" rel="noreferrer"
                      className="inline-flex h-8 items-center gap-1 rounded-md bg-whatsapp px-2 text-xs font-bold text-white hover:opacity-90"
                    >
                      <MessageCircle className="size-3.5" /> Zap
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Upcoming */}
        <aside className="w-full lg:w-80">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest"><Clock className="size-4 text-primary" />Próximos Retornos</h2>
            <Link to="/agenda" className="text-xs font-bold uppercase text-primary hover:underline">Agenda</Link>
          </div>
          <div className="space-y-3 rounded-xl border border-border bg-card p-4">
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum compromisso agendado.</p>
            ) : upcoming.map((a) => {
              const dt = new Date(a.scheduled_at);
              const overdue = dt.getTime() < Date.now();
              return (
                <div key={a.id} className={`border-l-2 pl-3 py-1 ${overdue ? "border-destructive" : "border-border"}`}>
                  <p className={`text-[10px] font-mono ${overdue ? "text-destructive font-bold" : "text-muted-foreground"}`}>
                    {dt.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </p>
                  <p className="text-sm font-medium">{a.title || a.type}</p>
                </div>
              );
            })}
          </div>

          <div className="mt-4 rounded-xl border border-primary/30 bg-accent p-4">
            <p className="text-xs font-bold uppercase text-accent-foreground">Pipeline</p>
            <div className="mt-3 space-y-2">
              {STATUSES.slice(0, 6).map((s) => {
                const count = customers.filter((c) => c.status === s.id).length;
                return (
                  <div key={s.id} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2"><span className={`size-2 rounded-full ${s.accent}`} />{s.label}</span>
                    <span className="font-mono font-bold">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
