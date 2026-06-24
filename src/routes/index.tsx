import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { STATUSES, formatPriceBRL, daysSince } from "@/lib/crm";
import { WaButton } from "@/components/wa-button";
import { useAuth } from "@/hooks/useAuth";
import {
  Plus, ArrowRight, AlertTriangle, Clock,
  TrendingUp, Users, Activity,
} from "lucide-react";
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Dashboard Comercial — DriverLeads" }] }),
  component: Dashboard,
});

// ---------------------------------------------------------------------------
// Types & helpers
// ---------------------------------------------------------------------------

type Period = "hoje" | "semana" | "mes";

function getPeriodStart(p: Period): Date {
  const d = new Date();
  if (p === "hoje") { d.setHours(0, 0, 0, 0); return d; }
  if (p === "semana") {
    const dow = d.getDay();
    d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
    d.setHours(0, 0, 0, 0);
    return d;
  }
  d.setDate(1); d.setHours(0, 0, 0, 0); return d;
}

const PERIOD_LABEL: Record<Period, string> = {
  hoje: "hoje", semana: "semana", mes: "mês",
};

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function fetchDashboard() {
  const [customers, appts] = await Promise.all([
    supabase
      .from("customers")
      .select("id,name,phone,whatsapp,status,last_contact_at,next_return_at,interest_brand,interest_model,price_max,responsavel_id,created_at,updated_at,sold_at,sale_value")
      .order("created_at", { ascending: false }),
    supabase
      .from("appointments")
      .select("id,title,scheduled_at,type,done,customer_id")
      .eq("done", false)
      .order("scheduled_at", { ascending: true })
      .limit(10),
  ]);
  if (customers.error) throw customers.error;
  if (appts.error) throw appts.error;
  return { customers: customers.data ?? [], appts: appts.data ?? [] };
}

// Only fetched for gerente / admin
async function fetchTeamData() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const [profiles, activity] = await Promise.all([
    supabase.from("user_profiles").select("id,nome,perfil").eq("ativo", true),
    supabase
      .from("interactions")
      .select("id,user_id,type")
      .gte("created_at", todayStart.toISOString()),
  ]);
  return { profiles: profiles.data ?? [], activity: activity.data ?? [] };
}

// ---------------------------------------------------------------------------
// Small components
// ---------------------------------------------------------------------------

function Kpi({
  label, value, hint, tone,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "primary" | "danger" | "success" | "warning";
}) {
  const clsMap = {
    primary: "text-primary",
    danger:  "text-destructive",
    success: "text-emerald-600 dark:text-emerald-400",
    warning: "text-amber-500 dark:text-amber-400",
  };
  const cls = tone ? clsMap[tone] : "text-foreground";

  return (
    <div className="bg-card p-4 md:p-5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-2xl font-bold", cls)}>{value}</p>
      {hint && <p className="mt-0.5 text-[10px] italic text-muted-foreground">{hint}</p>}
    </div>
  );
}

function PeriodFilter({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  const opts: { id: Period; label: string }[] = [
    { id: "hoje",   label: "Hoje" },
    { id: "semana", label: "Semana" },
    { id: "mes",    label: "Mês" },
  ];
  return (
    <div className="flex overflow-hidden rounded-md border border-border">
      {opts.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={cn(
            "px-3 py-1.5 text-xs font-bold transition-colors",
            value === o.id
              ? "bg-primary text-primary-foreground"
              : "bg-card text-muted-foreground hover:bg-muted",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

function Dashboard() {
  const { perfil } = useAuth();
  const isVendedor = perfil === "vendedor";
  const isGerente  = perfil === "gerente" || perfil === "admin_loja" || perfil === "super_admin";

  const [period, setPeriod] = useState<Period>("semana");

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: fetchDashboard,
  });

  const { data: teamData } = useQuery({
    queryKey: ["dashboard-team"],
    queryFn: fetchTeamData,
    enabled: isGerente,
    staleTime: 60_000,
  });

  const allCustomers = data?.customers ?? [];
  const appts        = data?.appts ?? [];

  // ── period-aware thresholds ──────────────────────────────────────────────
  const periodStart = useMemo(() => getPeriodStart(period), [period]);

  // ── KPIs ─────────────────────────────────────────────────────────────────
  const activeLeads = useMemo(
    () => allCustomers.filter((c) => !["venda_realizada", "perdido"].includes(c.status)),
    [allCustomers],
  );

  const newLeadsPeriod = useMemo(
    () => allCustomers.filter((c) => new Date(c.created_at) >= periodStart).length,
    [allCustomers, periodStart],
  );

  const salesPeriod = useMemo(
    () =>
      allCustomers.filter(
        (c) => c.status === "venda_realizada" && c.sold_at != null && new Date(c.sold_at) >= periodStart,
      ).length,
    [allCustomers, periodStart],
  );

  const faturamentoPeriod = useMemo(() => {
    if (!isGerente) return 0;
    return allCustomers
      .filter((c) => c.status === "venda_realizada" && c.sold_at != null && new Date(c.sold_at) >= periodStart)
      .reduce((sum, c) => sum + (c.sale_value ?? 0), 0);
  }, [isGerente, allCustomers, periodStart]);

  const ticketMedio = useMemo(() => {
    if (!isGerente) return 0;
    const comValor = allCustomers.filter(
      (c) => c.status === "venda_realizada" && (c.sale_value ?? 0) > 0,
    );
    if (comValor.length === 0) return 0;
    const total = comValor.reduce((sum, c) => sum + (c.sale_value ?? 0), 0);
    return total / comValor.length;
  }, [isGerente, allCustomers]);

  const negotiating = useMemo(
    () =>
      activeLeads.filter((c) =>
        ["em_atendimento", "em_negociacao", "visita"].includes(c.status),
      ).length,
    [activeLeads],
  );

  const now = Date.now();

  const overdueFu = useMemo(
    () =>
      activeLeads.filter(
        (c) => c.next_return_at && new Date(c.next_return_at).getTime() < now,
      ).length,
    [activeLeads],
  );

  const staleLeads = useMemo(
    () =>
      activeLeads.filter((c) => {
        const d = daysSince(c.last_contact_at);
        return d !== null && d >= 7;
      }),
    [activeLeads],
  );

  // conversion rate snapshot
  const totalEver  = allCustomers.length;
  const totalSales = allCustomers.filter((c) => c.status === "venda_realizada").length;
  const convRate   = totalEver > 0 ? Math.round((totalSales / totalEver) * 100) : 0;

  // pipeline counts (all leads, including closed — for funnel)
  const pipelineByStatus = useMemo(
    () =>
      STATUSES.map((s) => ({
        ...s,
        count: allCustomers.filter((c) => c.status === s.id).length,
      })),
    [allCustomers],
  );
  const activePipelineTotal = activeLeads.length;

  // ── Vendor ranking (gerente only) ─────────────────────────────────────────
  const vendorRanking = useMemo(() => {
    if (!isGerente || !teamData?.profiles.length) return [];
    return teamData.profiles
      .filter((p) => p.perfil !== "super_admin")
      .map((p) => {
        const mine = allCustomers.filter((c) => c.responsavel_id === p.id);
        const leads    = mine.filter((c) => !["venda_realizada", "perdido"].includes(c.status)).length;
        const vendas   = mine.filter((c) => c.status === "venda_realizada").length;
        const atrasados = mine.filter(
          (c) =>
            c.next_return_at &&
            new Date(c.next_return_at).getTime() < now &&
            !["venda_realizada", "perdido"].includes(c.status),
        ).length;
        const faturamento = mine
          .filter((c) => c.status === "venda_realizada")
          .reduce((sum, c) => sum + (c.sale_value ?? 0), 0);
        return { id: p.id, nome: p.nome ?? "", leads, vendas, atrasados, faturamento };
      })
      .filter((v) => v.leads > 0 || v.vendas > 0)
      .sort((a, b) => b.faturamento - a.faturamento || b.vendas - a.vendas || b.leads - a.leads);
  }, [isGerente, teamData, allCustomers]);

  // ── Team activity today ───────────────────────────────────────────────────
  const teamActivity = useMemo(() => {
    if (!isGerente || !teamData) return [];
    const actMap = new Map<string, number>();
    for (const i of teamData.activity) {
      if (i.user_id) actMap.set(i.user_id, (actMap.get(i.user_id) ?? 0) + 1);
    }
    return (teamData.profiles ?? [])
      .filter((p) => p.perfil !== "super_admin")
      .map((p) => ({ nome: p.nome ?? "", count: actMap.get(p.id) ?? 0 }))
      .sort((a, b) => b.count - a.count);
  }, [isGerente, teamData]);

  const wappsHoje = useMemo(() => {
    if (!isGerente || !teamData) return 0;
    return teamData.activity.filter((i) => i.type === "whatsapp").length;
  }, [isGerente, teamData]);

  const upcoming = appts.slice(0, 5);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-[1600px] p-4 md:p-6">

      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {isVendedor ? "Meu Dashboard" : "Dashboard Comercial"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isVendedor ? "Seus leads e compromissos" : "Visão geral do pipeline"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PeriodFilter value={period} onChange={setPeriod} />
          <Link
            to="/clientes/novo"
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="size-4" /> Novo Lead
          </Link>
        </div>
      </div>

      {/* KPI ribbon — 6 cards, period-aware */}
      <div className="mb-8 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border shadow-sm sm:grid-cols-3 lg:grid-cols-6">
        <Kpi
          label={isVendedor ? "Meus Leads Ativos" : "Leads Ativos"}
          value={isLoading ? "…" : activeLeads.length}
        />
        <Kpi
          label={`Novos — ${PERIOD_LABEL[period]}`}
          value={isLoading ? "…" : newLeadsPeriod}
          tone="primary"
        />
        <Kpi
          label={isVendedor ? "Em Negociação" : "Negociando"}
          value={isLoading ? "…" : negotiating}
        />
        <Kpi
          label={`Vendas — ${PERIOD_LABEL[period]}`}
          value={isLoading ? "…" : salesPeriod}
          tone="success"
          hint={!isVendedor ? `${convRate}% conversão total` : undefined}
        />
        <Kpi
          label="Follow-ups Atrasados"
          value={isLoading ? "…" : overdueFu}
          tone={overdueFu > 0 ? "danger" : undefined}
        />
        <Kpi
          label="Sem Contato 7d+"
          value={isLoading ? "…" : staleLeads.length}
          tone={staleLeads.length > 0 ? "warning" : undefined}
        />
      </div>

      {/* Financial KPIs — gerente / admin only */}
      {isGerente && (
        <div className="mb-8 grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-border bg-border shadow-sm">
          <Kpi
            label={`Faturamento — ${PERIOD_LABEL[period]}`}
            value={isLoading ? "…" : faturamentoPeriod > 0 ? formatPriceBRL(faturamentoPeriod) : "R$ 0"}
            tone="success"
          />
          <Kpi
            label="Ticket Médio (com valor)"
            value={isLoading ? "…" : ticketMedio > 0 ? formatPriceBRL(ticketMedio) : "—"}
            hint="Média das vendas com valor informado"
          />
          <Kpi
            label="WhatsApps hoje"
            value={isLoading ? "…" : wappsHoje}
            hint="Enviados pela equipe hoje"
          />
        </div>
      )}

      {/* Main 2-column layout */}
      <div className="flex flex-col gap-6 lg:flex-row">

        {/* Left — leads sem contato */}
        <section className="flex-1">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest">
              <AlertTriangle className="size-4 text-amber-500" />
              {isVendedor ? "Meus leads sem contato" : "Sem contato há 7d+"}
            </h2>
            <Link
              to="/followup"
              className="inline-flex items-center gap-1 text-xs font-bold uppercase text-primary hover:underline"
            >
              Follow-up <ArrowRight className="size-3" />
            </Link>
          </div>
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            {staleLeads.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                <TrendingUp className="mx-auto mb-2 size-6" />
                Nenhum lead parado. Continue assim.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {staleLeads.slice(0, 6).map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 p-3 hover:bg-muted/50">
                    <Link to="/clientes/$id" params={{ id: c.id }} className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{c.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {c.interest_brand} {c.interest_model} · {formatPriceBRL(c.price_max)} · {daysSince(c.last_contact_at)}d sem contato
                      </p>
                    </Link>
                    <WaButton
                      customerId={c.id}
                      nome={c.name}
                      numero={c.whatsapp ?? c.phone}
                      marca={c.interest_brand}
                      modelo={c.interest_model}
                      status={c.status}
                      size="sm"
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Right sidebar */}
        <aside className="w-full space-y-4 lg:w-80">

          {/* Próximos agendamentos */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest">
                <Clock className="size-4 text-primary" /> Próximos
              </h2>
              <Link to="/agenda" className="text-xs font-bold uppercase text-primary hover:underline">
                Agenda
              </Link>
            </div>
            <div className="space-y-2 rounded-xl border border-border bg-card p-4">
              {upcoming.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum compromisso agendado.</p>
              ) : (
                upcoming.map((a) => {
                  const dt = new Date(a.scheduled_at);
                  const overdue = dt.getTime() < Date.now();
                  return (
                    <div key={a.id} className={cn("border-l-2 py-1 pl-3", overdue ? "border-destructive" : "border-border")}>
                      <p className={cn("font-mono text-[10px]", overdue ? "font-bold text-destructive" : "text-muted-foreground")}>
                        {dt.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </p>
                      <p className="text-sm font-medium">{a.title || a.type}</p>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Funil do pipeline */}
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-widest">Funil do Pipeline</p>
              {!isVendedor && totalEver > 0 && (
                <span className="rounded-full bg-emerald-600/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                  {convRate}% conversão
                </span>
              )}
            </div>
            <div className="space-y-2">
              {pipelineByStatus.map((s) => {
                const pct =
                  activePipelineTotal > 0 && !["venda_realizada", "perdido"].includes(s.id)
                    ? Math.round((s.count / activePipelineTotal) * 100)
                    : 0;
                return (
                  <div key={s.id}>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-xs">
                        <span className={cn("size-2 rounded-full", s.accent)} />
                        {s.label}
                      </span>
                      <span className="font-mono text-xs font-bold">{s.count}</span>
                    </div>
                    {pct > 0 && (
                      <div className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn("h-full rounded-full", s.accent)}
                          style={{ width: `${Math.max(pct, 3)}%` }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

        </aside>
      </div>

      {/* ── Gerente / Admin only ─────────────────────────────────────────── */}
      {isGerente && (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">

          {/* Ranking de vendedores */}
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-widest">
              <Users className="size-4 text-primary" /> Ranking de Vendedores
            </h2>
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              {vendorRanking.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">
                  Nenhum lead atribuído a vendedores ainda.
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Vendedor</th>
                      <th className="px-2 py-2 text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Leads</th>
                      <th className="px-2 py-2 text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Vendas</th>
                      <th className="px-2 py-2 text-right text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Faturamento</th>
                      <th className="px-4 py-2 text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Atrasados</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {vendorRanking.map((v, i) => (
                      <tr key={v.id} className="hover:bg-muted/40">
                        <td className="px-4 py-2.5">
                          <span className="mr-2 font-mono text-[10px] text-muted-foreground">#{i + 1}</span>
                          {v.nome}
                        </td>
                        <td className="px-2 py-2.5 text-center font-mono font-bold">{v.leads}</td>
                        <td className="px-2 py-2.5 text-center">
                          <span className={cn("font-mono font-bold", v.vendas > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>
                            {v.vendas}
                          </span>
                        </td>
                        <td className="px-2 py-2.5 text-right">
                          <span className={cn("font-mono text-xs font-bold", v.faturamento > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>
                            {v.faturamento > 0 ? formatPriceBRL(v.faturamento) : "—"}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {v.atrasados > 0 ? (
                            <span className="rounded-full bg-destructive/10 px-2 py-0.5 font-mono text-xs font-bold text-destructive">
                              {v.atrasados}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>

          {/* Atividade de hoje */}
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-widest">
              <Activity className="size-4 text-primary" /> Atividade Hoje
            </h2>
            <div className="rounded-xl border border-border bg-card p-4">
              {teamActivity.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum registro de atividade ainda hoje.</p>
              ) : (
                <div className="space-y-3">
                  {teamActivity.map((t) => {
                    const maxCount = Math.max(...teamActivity.map((x) => x.count), 1);
                    const pct = Math.round((t.count / maxCount) * 100);
                    return (
                      <div key={t.nome}>
                        <div className="mb-1 flex items-center justify-between text-sm">
                          <span className="font-medium">{t.nome}</span>
                          <span className={cn("font-mono text-xs font-bold", t.count === 0 && "text-muted-foreground")}>
                            {t.count} {t.count === 1 ? "contato" : "contatos"}
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

        </div>
      )}
    </div>
  );
}
