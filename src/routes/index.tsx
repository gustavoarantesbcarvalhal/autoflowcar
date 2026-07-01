import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { STATUSES, formatPriceBRL, daysSince } from "@/lib/crm";
import { WaButton } from "@/components/wa-button";
import { useAuth } from "@/hooks/useAuth";
import { useNotifications, type AppNotification } from "@/hooks/useNotifications";
import {
  Plus, ArrowRight, AlertTriangle, Clock,
  TrendingUp, Users, Activity, Bell,
} from "lucide-react";
import { useState, useMemo, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Dashboard Comercial — DriverLeads" }] }),
  component: Dashboard,
});

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

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

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
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">{label}</p>
      <p className={cn("mt-2 text-3xl font-black tabular-nums tracking-tight", cls)}>{value}</p>
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
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
    <div className="flex overflow-hidden rounded-[10px] border border-border bg-card">
      {opts.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={cn(
            "px-3.5 py-1.5 text-xs font-semibold transition-colors",
            value === o.id
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const PLATFORM_LABEL: Record<string, { label: string; cls: string }> = {
  meta_lead_ads:    { label: "Meta Ads",  cls: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  meta_ctwa:        { label: "WhatsApp",  cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  whatsapp_organic: { label: "WhatsApp",  cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  generic:          { label: "Site",      cls: "bg-muted text-muted-foreground" },
};

function LeadsFeedItem({ n }: { n: AppNotification }) {
  const navigate   = useNavigate();
  const customerId = n.metadata?.customer_id as string | undefined;
  const platform   = n.metadata?.platform as string | undefined;
  const tag        = platform ? (PLATFORM_LABEL[platform] ?? PLATFORM_LABEL.generic) : PLATFORM_LABEL.generic;

  return (
    <li
      onClick={() => customerId && navigate({ to: `/clientes/${customerId}` as never })}
      className={cn(
        "flex cursor-pointer items-start gap-2.5 px-4 py-2.5 transition-colors hover:bg-muted/60",
        !n.read && "bg-primary/5",
      )}
    >
      <div className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", !n.read ? "bg-primary" : "bg-transparent")} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-xs font-semibold">{n.title}</p>
          <span className={cn("shrink-0 rounded-full px-1.5 py-px text-[9px] font-bold", tag.cls)}>
            {tag.label}
          </span>
        </div>
        {n.body && <p className="truncate text-[11px] text-muted-foreground">{n.body}</p>}
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          {new Date(n.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
    </li>
  );
}

function Dashboard() {
  const { perfil, nome } = useAuth();
  const navigate   = useNavigate();
  const isVendedor = perfil === "vendedor";
  const isGerente  = perfil === "gerente" || perfil === "admin_loja" || perfil === "super_admin";

  const [period, setPeriod] = useState<Period>("semana");
  const { notifications, loading: notifLoading, unreadCount, markAllRead } = useNotifications();

  // Toast for live Realtime inserts — skip initial load
  const initialLoadDoneRef = useRef(false);
  const prevNotifCountRef  = useRef(0);
  useEffect(() => {
    if (!initialLoadDoneRef.current) {
      if (!notifLoading) {
        initialLoadDoneRef.current = true;
        prevNotifCountRef.current  = notifications.length;
      }
      return;
    }
    if (notifications.length > prevNotifCountRef.current) {
      const newOnes = notifications.slice(0, notifications.length - prevNotifCountRef.current);
      for (const n of newOnes) {
        const customerId = n.metadata?.customer_id as string | undefined;
        toast.success(n.title, {
          description: n.body ?? undefined,
          action: customerId
            ? { label: "Ver", onClick: () => navigate({ to: `/clientes/${customerId}` as never }) }
            : undefined,
          duration: 8000,
        });
      }
      prevNotifCountRef.current = notifications.length;
    }
  }, [notifications, notifLoading]);

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

  const periodStart = useMemo(() => getPeriodStart(period), [period]);

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

  const totalEver  = allCustomers.length;
  const totalSales = allCustomers.filter((c) => c.status === "venda_realizada").length;
  const convRate   = totalEver > 0 ? Math.round((totalSales / totalEver) * 100) : 0;

  const pipelineByStatus = useMemo(
    () =>
      STATUSES.map((s) => ({
        ...s,
        count: allCustomers.filter((c) => c.status === s.id).length,
      })),
    [allCustomers],
  );
  const activePipelineTotal = activeLeads.length;

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

  const upcoming = appts.slice(0, 5);
  const nomeDisplay = nome?.split(" ")[0] ?? "";

  return (
    <div className="mx-auto max-w-[1600px] p-4 md:p-8">

      {/* Header */}
      <PageHeader
        title={nomeDisplay ? `${getGreeting()}, ${nomeDisplay}` : isVendedor ? "Meu Dashboard" : "Dashboard Comercial"}
        subtitle={isVendedor ? "Seus leads e compromissos" : "Visão geral do pipeline"}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <PeriodFilter value={period} onChange={setPeriod} />
            <Link
              to="/clientes/novo"
              className="inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
            >
              <Plus className="size-4" /> Novo Lead
            </Link>
          </div>
        }
      />

      {/* 4 KPIs principais */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
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
          label={`Vendas — ${PERIOD_LABEL[period]}`}
          value={isLoading ? "…" : salesPeriod}
          tone="success"
          hint={!isVendedor && totalEver > 0 ? `${convRate}% conversão total` : undefined}
        />
        <Kpi
          label="Ações Urgentes"
          value={isLoading ? "…" : overdueFu}
          tone={overdueFu > 0 ? "danger" : undefined}
          hint="Follow-ups vencidos"
        />
      </div>

      {/* KPIs financeiros — gerente / admin */}
      {isGerente && (
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Kpi
            label={`Faturamento — ${PERIOD_LABEL[period]}`}
            value={isLoading ? "…" : faturamentoPeriod > 0 ? formatPriceBRL(faturamentoPeriod) : "R$ 0"}
            tone="success"
          />
          <Kpi
            label="Ticket Médio"
            value={isLoading ? "…" : ticketMedio > 0 ? formatPriceBRL(ticketMedio) : "—"}
            hint="Média das vendas com valor informado"
          />
          <Kpi
            label="Taxa de Conversão"
            value={isLoading ? "…" : `${convRate}%`}
            hint={`${totalSales} de ${totalEver} leads convertidos`}
          />
        </div>
      )}

      {/* Layout 2 colunas */}
      <div className="flex flex-col gap-6 lg:flex-row">

        {/* Leads sem contato */}
        <section className="flex-1">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <AlertTriangle className="size-4 text-amber-500" />
              {isVendedor ? "Meus leads sem contato" : "Sem contato há 7d+"}
            </h2>
            <Link
              to="/followup"
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              Follow-up <ArrowRight className="size-3" />
            </Link>
          </div>
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            {staleLeads.length === 0 ? (
              <EmptyState
                icon={TrendingUp}
                title="Nenhum lead parado"
                subtitle="Todos os seus leads estão em dia. Continue assim!"
                tone="success"
                className="border-none py-10"
              />
            ) : (
              <ul className="divide-y divide-border">
                {staleLeads.slice(0, 6).map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 p-3.5 hover:bg-muted/40">
                    <Link to="/clientes/$id" params={{ id: c.id }} className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{c.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {c.interest_brand} {c.interest_model}
                        {c.price_max ? ` · ${formatPriceBRL(c.price_max)}` : ""}
                        {" · "}
                        <span className="font-medium text-destructive">{daysSince(c.last_contact_at)}d sem contato</span>
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

        {/* Aside direito */}
        <aside className="w-full space-y-4 lg:w-80">

          {/* Próximos compromissos */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Clock className="size-4 text-primary" /> Próximos
              </h2>
              <Link to="/agenda" className="text-xs font-semibold text-primary hover:underline">
                Agenda <ArrowRight className="inline size-3" />
              </Link>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4">
              {upcoming.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum compromisso agendado.</p>
              ) : (
                <div className="space-y-2.5">
                  {upcoming.map((a) => {
                    const dt      = new Date(a.scheduled_at);
                    const overdue = dt.getTime() < Date.now();
                    return (
                      <div key={a.id} className={cn("flex items-start gap-3 rounded-lg border-l-2 py-1.5 pl-3", overdue ? "border-destructive" : "border-primary/50")}>
                        <div className="min-w-0 flex-1">
                          <p className={cn("font-mono text-[11px]", overdue ? "font-bold text-destructive" : "text-muted-foreground")}>
                            {dt.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                          </p>
                          <p className="text-sm font-medium leading-tight">{a.title || a.type}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Feed de leads recebidos */}
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Bell className="size-4 text-primary" />
                Últimos Leads
                {unreadCount > 0 && (
                  <span className="rounded-full bg-destructive px-1.5 py-px text-[9px] font-bold text-white">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </h2>
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllRead()}
                  className="text-[11px] text-primary hover:underline"
                >
                  Marcar lidos
                </button>
              )}
            </div>
            {notifications.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-muted-foreground">
                Nenhum lead recebido ainda.
              </p>
            ) : (
              <ul className="max-h-64 divide-y divide-border overflow-y-auto">
                {notifications.slice(0, 8).map((n) => (
                  <LeadsFeedItem key={n.id} n={n} />
                ))}
              </ul>
            )}
            {notifications.length > 0 && (
              <div className="border-t border-border px-4 py-2">
                <Link
                  to="/clientes"
                  className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                >
                  Ver todos os leads <ArrowRight className="size-3" />
                </Link>
              </div>
            )}
          </div>

          {/* Funil */}
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold">Funil do Pipeline</p>
              {!isVendedor && totalEver > 0 && (
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                  {convRate}% conversão
                </span>
              )}
            </div>
            <div className="space-y-2.5">
              {pipelineByStatus.map((s) => {
                const pct =
                  activePipelineTotal > 0 && !["venda_realizada", "perdido"].includes(s.id)
                    ? Math.round((s.count / activePipelineTotal) * 100)
                    : 0;
                return (
                  <div key={s.id}>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className={cn("size-2 rounded-full flex-shrink-0", s.accent)} />
                        {s.label}
                      </span>
                      <span className="font-mono text-xs font-bold tabular-nums">{s.count}</span>
                    </div>
                    {pct > 0 && (
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn("h-full rounded-full transition-all duration-500", s.accent)}
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

      {/* Gerente / Admin */}
      {isGerente && (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">

          <section>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Users className="size-4 text-primary" /> Ranking de Vendedores
            </h2>
            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              {vendorRanking.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">
                  Nenhum lead atribuído a vendedores ainda.
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Vendedor</th>
                      <th className="px-2 py-2.5 text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Leads</th>
                      <th className="px-2 py-2.5 text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Vendas</th>
                      <th className="px-2 py-2.5 text-right text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Faturamento</th>
                      <th className="px-4 py-2.5 text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Atrasos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {vendorRanking.map((v, i) => (
                      <tr key={v.id} className="hover:bg-muted/40">
                        <td className="px-4 py-2.5">
                          <span className="mr-2 font-mono text-xs text-muted-foreground">#{i + 1}</span>
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

          <section>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Activity className="size-4 text-primary" /> Atividade Hoje
            </h2>
            <div className="rounded-2xl border border-border bg-card p-4">
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
