import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { FOLLOW_UP_TYPES, APPOINTMENT_TYPES, followUpTypeLabel, daysSince, statusLabel } from "@/lib/crm";
import { WaButton } from "@/components/wa-button";
import {
  CheckCircle2, Clock, RotateCcw,
  ChevronDown, ChevronUp, AlertCircle, CalendarClock, Inbox, User,
  Star, AlertTriangle, Calendar, Filter,
} from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/followup")({
  head: () => ({ meta: [{ title: "Follow-up — DriverLeads" }] }),
  component: FollowupPage,
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FollowUpLead = {
  id: string;
  name: string;
  phone: string | null;
  whatsapp: string | null;
  status: string;
  next_return_at: string | null;
  next_action_type: string | null;
  next_action_notes: string | null;
  last_contact_at: string | null;
  interest_brand: string | null;
  interest_model: string | null;
  responsavel_id: string | null;
  responsavel_nome: string | null;
  is_priority: boolean;
  status_changed_at: string | null;
  created_at: string;
  interaction_count: number;
};

type TodayAppt = {
  id: string;
  type: string;
  scheduled_at: string;
  title: string | null;
  done: boolean;
  customer_id: string | null;
  customer_name: string | null;
};

type HistoricoItem = {
  id: string;
  type: string;
  content: string | null;
  created_at: string;
  user_id: string | null;
  user_nome: string | null;
};

type Panel =
  | { kind: "none" }
  | { kind: "concluir"; leadId: string }
  | { kind: "reagendar"; leadId: string }
  | { kind: "historico"; leadId: string };

type ConcluirArgs  = { leadId: string; tipo: string; nota: string };
type ReagendarArgs = { leadId: string; novaData: string; tipo: string; nota: string };

type SharedProps = {
  panel: Panel;
  setPanel: (p: Panel) => void;
  onConcluir: (args: ConcluirArgs) => void;
  onReagendar: (args: ReagendarArgs) => void;
  isPending: boolean;
  isGerente: boolean;
};

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function fetchFollowUps(): Promise<FollowUpLead[]> {
  const { data, error } = await supabase
    .from("customers")
    .select("id,name,phone,whatsapp,status,next_return_at,next_action_type,next_action_notes,last_contact_at,interest_brand,interest_model,responsavel_id,is_priority,status_changed_at,created_at")
    .not("status", "in", "(venda_realizada,perdido)")
    .order("is_priority", { ascending: false })
    .order("next_return_at", { ascending: true, nullsFirst: false });
  if (error) throw error;

  const rows = data ?? [];
  if (rows.length === 0) return [];

  // Enrich: responsável names
  const responsavelIds = [
    ...new Set(rows.map((c) => c.responsavel_id).filter((id): id is string => id !== null)),
  ];
  const profileMap = new Map<string, string>();
  if (responsavelIds.length > 0) {
    const { data: profiles } = await supabase
      .from("user_profiles")
      .select("id,nome")
      .in("id", responsavelIds);
    for (const p of profiles ?? []) profileMap.set(p.id, p.nome);
  }

  // Enrich: interaction counts
  const customerIds = rows.map((c) => c.id);
  const countMap = new Map<string, number>();
  if (customerIds.length > 0) {
    const { data: ints } = await supabase
      .from("interactions")
      .select("customer_id")
      .in("customer_id", customerIds);
    for (const i of ints ?? []) {
      countMap.set(i.customer_id, (countMap.get(i.customer_id) ?? 0) + 1);
    }
  }

  return rows.map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    whatsapp: c.whatsapp,
    status: c.status,
    next_return_at: c.next_return_at,
    next_action_type: c.next_action_type,
    next_action_notes: c.next_action_notes,
    last_contact_at: c.last_contact_at,
    interest_brand: c.interest_brand,
    interest_model: c.interest_model,
    responsavel_id: c.responsavel_id,
    responsavel_nome: c.responsavel_id ? (profileMap.get(c.responsavel_id) ?? null) : null,
    is_priority: c.is_priority,
    status_changed_at: c.status_changed_at,
    created_at: c.created_at,
    interaction_count: countMap.get(c.id) ?? 0,
  }));
}

async function fetchTodayAppts(): Promise<TodayAppt[]> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart.getTime() + 86_400_000);

  const { data } = await supabase
    .from("appointments")
    .select("id,type,scheduled_at,title,done,customer_id")
    .gte("scheduled_at", todayStart.toISOString())
    .lt("scheduled_at", todayEnd.toISOString())
    .order("scheduled_at", { ascending: true });

  if (!data || data.length === 0) return [];

  const cids = [...new Set(data.map((a) => a.customer_id).filter(Boolean) as string[])];
  const nameMap = new Map<string, string>();
  if (cids.length > 0) {
    const { data: customers } = await supabase
      .from("customers")
      .select("id,name")
      .in("id", cids);
    for (const c of customers ?? []) nameMap.set(c.id, c.name);
  }

  return data.map((a) => ({
    ...a,
    customer_name: a.customer_id ? (nameMap.get(a.customer_id) ?? null) : null,
  }));
}

async function fetchHistorico(customerId: string): Promise<HistoricoItem[]> {
  const { data: ints, error } = await supabase
    .from("interactions")
    .select("id,type,content,created_at,user_id")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  const interactions = ints ?? [];
  if (interactions.length === 0) return [];

  const userIds = [
    ...new Set(interactions.map((i) => i.user_id).filter(Boolean) as string[]),
  ];
  const profileMap = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("user_profiles")
      .select("id,nome")
      .in("id", userIds);
    for (const p of profiles ?? []) profileMap.set(p.id, p.nome as string);
  }

  return interactions.map((i) => ({
    ...i,
    user_nome: i.user_id ? (profileMap.get(i.user_id) ?? null) : null,
  }));
}

// ---------------------------------------------------------------------------
// Lead grouping
// ---------------------------------------------------------------------------

const STUCK_DAYS = 14;

function groupLeads(leads: FollowUpLead[], filterVendedorId?: string) {
  const filtered = filterVendedorId
    ? leads.filter((l) => l.responsavel_id === filterVendedorId)
    : leads;

  const now        = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const todayEnd   = todayStart + 86_400_000;
  const weekEnd    = todayStart + 8 * 86_400_000;
  const stuck14    = todayStart - STUCK_DAYS * 86_400_000;

  const vencidos:  FollowUpLead[] = [];
  const hoje:      FollowUpLead[] = [];
  const proximos7: FollowUpLead[] = [];
  const semData:   FollowUpLead[] = [];
  const parados:   FollowUpLead[] = [];

  for (const lead of filtered) {
    if (lead.next_return_at) {
      const t = new Date(lead.next_return_at).getTime();
      if      (t < todayStart) vencidos.push(lead);
      else if (t < todayEnd)   hoje.push(lead);
      else if (t < weekEnd)    proximos7.push(lead);
      // next_return_at > 7 dias: ainda não urgente
    } else {
      const refDate = lead.status_changed_at ?? lead.created_at;
      const refTime = new Date(refDate).getTime();
      if (refTime < stuck14) {
        parados.push(lead);
      } else {
        const d = daysSince(lead.last_contact_at);
        if (d === null || d >= 7) semData.push(lead);
      }
    }
  }

  return { vencidos, hoje, proximos7, semData, parados };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function FollowupPage() {
  const { perfil } = useAuth();
  const isGerente = perfil === "gerente" || perfil === "admin_loja" || perfil === "super_admin";
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({ queryKey: ["followup"], queryFn: fetchFollowUps });

  const { data: todayAppts = [] } = useQuery({
    queryKey: ["agenda-today"],
    queryFn: fetchTodayAppts,
    staleTime: 60_000,
  });

  const [panel, setPanel] = useState<Panel>({ kind: "none" });
  const [filterVendedor, setFilterVendedor] = useState("");

  const vendedorOptions = useMemo(() => {
    if (!isGerente) return [];
    const seen = new Map<string, string>();
    for (const l of data ?? []) {
      if (l.responsavel_id && l.responsavel_nome) {
        seen.set(l.responsavel_id, l.responsavel_nome);
      }
    }
    return [...seen.entries()]
      .map(([id, nome]) => ({ id, nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [isGerente, data]);

  const groups = useMemo(
    () => groupLeads(data ?? [], filterVendedor || undefined),
    [data, filterVendedor],
  );

  const { vencidos, hoje, proximos7, semData, parados } = groups;
  const urgentes  = vencidos.length + hoje.length;
  const totalFU   = urgentes + proximos7.length + semData.length + parados.length;

  const concluir = useMutation({
    mutationFn: async ({ leadId, tipo, nota }: ConcluirArgs) => {
      const { error: ie } = await supabase.from("interactions").insert({
        customer_id: leadId,
        type: tipo as never,
        content: nota || null,
      });
      if (ie) throw ie;
      const { error: ce } = await supabase
        .from("customers")
        .update({
          last_contact_at:   new Date().toISOString(),
          next_return_at:    null,
          next_action_type:  null,
          next_action_notes: null,
        })
        .eq("id", leadId);
      if (ce) throw ce;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["followup"] });
      qc.invalidateQueries({ queryKey: ["followup-badge"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setPanel({ kind: "none" });
      toast.success("Contato registrado e follow-up concluído");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reagendar = useMutation({
    mutationFn: async ({ leadId, novaData, tipo, nota }: ReagendarArgs) => {
      const { error } = await supabase
        .from("customers")
        .update({
          next_return_at:    new Date(novaData).toISOString(),
          next_action_type:  tipo,
          next_action_notes: nota || null,
        })
        .eq("id", leadId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["followup"] });
      setPanel({ kind: "none" });
      toast.success("Follow-up reagendado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const shared: SharedProps = {
    panel,
    setPanel,
    onConcluir:  (args) => concluir.mutate(args),
    onReagendar: (args) => reagendar.mutate(args),
    isPending: concluir.isPending || reagendar.isPending,
    isGerente,
  };

  return (
    <div className="mx-auto max-w-4xl p-4 md:p-6">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Central de Follow-up</h1>
          <p className="text-sm text-muted-foreground">
            {isLoading
              ? "Carregando…"
              : `${urgentes} ${urgentes === 1 ? "ação urgente" : "ações urgentes"} · ${parados.length} parados · ${proximos7.length} nos próximos 7 dias`}
          </p>
        </div>
        {isGerente && vendedorOptions.length > 0 && (
          <div className="flex items-center gap-2">
            <Filter className="size-3.5 text-muted-foreground" />
            <select
              value={filterVendedor}
              onChange={(e) => setFilterVendedor(e.target.value)}
              className="h-8 rounded-md border border-border bg-background px-2 text-sm"
            >
              <option value="">Toda a equipe</option>
              {vendedorOptions.map((v) => (
                <option key={v.id} value={v.id}>{v.nome}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl border border-border bg-card" />
          ))}
        </div>
      ) : totalFU === 0 && todayAppts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center">
          <CheckCircle2 className="mx-auto mb-3 size-10 text-emerald-500" />
          <p className="text-sm font-medium">Nenhum lead para acompanhar</p>
          <p className="mt-1 text-xs text-muted-foreground">Todos os leads ativos estão em dia.</p>
        </div>
      ) : (
        <div className="space-y-8">

          {/* Mini-agenda do dia */}
          {todayAppts.length > 0 && (
            <section>
              <div className="mb-3 flex items-center gap-2">
                <Calendar className="size-4 text-primary" />
                <h2 className="text-xs font-bold uppercase tracking-widest text-primary">
                  Agenda de hoje
                </h2>
                <span className="rounded-full bg-muted px-1.5 py-0.5 font-mono text-[10px] font-bold">
                  {todayAppts.length}
                </span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {todayAppts.map((a) => {
                  const dt = new Date(a.scheduled_at);
                  const isOverdue = !a.done && dt.getTime() < Date.now();
                  return (
                    <div
                      key={a.id}
                      className={cn(
                        "flex items-center gap-3 rounded-lg border bg-card px-3 py-2",
                        a.done
                          ? "border-border opacity-50"
                          : isOverdue
                            ? "border-destructive/50"
                            : "border-border",
                      )}
                    >
                      <div className={cn(
                        "h-8 w-1 shrink-0 rounded-full",
                        a.done ? "bg-muted" : isOverdue ? "bg-destructive" : "bg-primary",
                      )} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">
                          {a.title || APPOINTMENT_TYPES.find((t) => t.id === a.type)?.label || a.type}
                        </p>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                          <span className="font-mono">
                            {dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                          {a.customer_name && (
                            <>
                              <span>·</span>
                              {a.customer_id ? (
                                <Link
                                  to="/clientes/$id"
                                  params={{ id: a.customer_id }}
                                  className="text-primary hover:underline"
                                >
                                  {a.customer_name}
                                </Link>
                              ) : (
                                <span>{a.customer_name}</span>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                      {a.done && (
                        <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          <Section
            title="Vencidos" tone="danger" icon={AlertCircle}
            leads={vencidos} emptyText="Nenhum follow-up atrasado."
            {...shared}
          />
          <Section
            title="Hoje" tone="warning" icon={Clock}
            leads={hoje} emptyText="Nenhuma ação agendada para hoje."
            {...shared}
          />
          <Section
            title="Próximos 7 dias" tone="info" icon={CalendarClock}
            leads={proximos7} emptyText="Agenda limpa para a semana."
            {...shared}
          />
          <Section
            title="Parados em etapa" tone="stuck" icon={AlertTriangle}
            leads={parados}
            emptyText="Nenhum lead parado em etapa."
            subtitle={`sem movimentação há ${STUCK_DAYS}+ dias`}
            {...shared}
          />
          <Section
            title="Sem data programada" tone="muted" icon={Inbox}
            leads={semData}
            emptyText="Todos os leads ativos têm próxima ação programada."
            subtitle="sem contato há 7+ dias ou nunca contatados"
            {...shared}
          />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section
// ---------------------------------------------------------------------------

const TONE_CLS = {
  danger:  "text-destructive",
  warning: "text-amber-500 dark:text-amber-400",
  info:    "text-primary",
  stuck:   "text-orange-500 dark:text-orange-400",
  muted:   "text-muted-foreground",
} as const;

function Section({
  title, tone, icon: Icon, leads, emptyText, subtitle,
  panel, setPanel, onConcluir, onReagendar, isPending, isGerente,
}: {
  title: string;
  tone: keyof typeof TONE_CLS;
  icon: React.ElementType;
  leads: FollowUpLead[];
  emptyText: string;
  subtitle?: string;
} & SharedProps) {
  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Icon className={cn("size-4", TONE_CLS[tone])} />
        <h2 className={cn("text-xs font-bold uppercase tracking-widest", TONE_CLS[tone])}>
          {title}
        </h2>
        <span className="rounded-full bg-muted px-1.5 py-0.5 font-mono text-[10px] font-bold">
          {leads.length}
        </span>
        {subtitle && (
          <span className="text-[10px] text-muted-foreground">— {subtitle}</span>
        )}
      </div>

      {leads.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border py-5 text-center text-sm text-muted-foreground">
          {emptyText}
        </p>
      ) : (
        <div className="space-y-2">
          {leads.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              panel={panel}
              setPanel={setPanel}
              onConcluir={onConcluir}
              onReagendar={onReagendar}
              isPending={isPending}
              isGerente={isGerente}
            />
          ))}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// LeadCard
// ---------------------------------------------------------------------------

function LeadCard({
  lead, panel, setPanel, onConcluir, onReagendar, isPending, isGerente,
}: { lead: FollowUpLead } & SharedProps) {
  const qc = useQueryClient();

  const myKind =
    panel.kind !== "none" && (panel as { leadId: string }).leadId === lead.id
      ? panel.kind
      : null;

  function togglePanel(kind: Exclude<Panel["kind"], "none">) {
    setPanel(myKind === kind ? { kind: "none" } : ({ kind, leadId: lead.id } as Panel));
  }

  const togglePriority = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("customers")
        .update({ is_priority: !lead.is_priority })
        .eq("id", lead.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["followup"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const idle = daysSince(lead.last_contact_at);
  const nextDate   = lead.next_return_at ? new Date(lead.next_return_at) : null;
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const isOverdue  = nextDate && nextDate < todayStart;

  const stuckDays = lead.status_changed_at
    ? daysSince(lead.status_changed_at)
    : daysSince(lead.created_at);

  return (
    <div className={cn(
      "overflow-hidden rounded-xl border bg-card",
      lead.is_priority
        ? "border-amber-400/60 dark:border-amber-500/40"
        : "border-border",
    )}>
      <div className="flex flex-wrap items-start gap-3 p-4">
        <div className="min-w-0 flex-1">

          {/* Name row */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => togglePriority.mutate()}
              disabled={togglePriority.isPending}
              title={lead.is_priority ? "Remover prioridade" : "Marcar como prioritário"}
              className="shrink-0 transition-transform hover:scale-110 disabled:opacity-50"
            >
              <Star className={cn(
                "size-3.5",
                lead.is_priority
                  ? "fill-amber-400 text-amber-400"
                  : "text-muted-foreground/40 hover:text-amber-400",
              )} />
            </button>
            <Link
              to="/clientes/$id"
              params={{ id: lead.id }}
              className="text-sm font-bold hover:text-primary"
            >
              {lead.name}
            </Link>
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold uppercase">
              {statusLabel(lead.status)}
            </span>
            {lead.interaction_count > 0 && (
              <span className="rounded-full bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-primary">
                {lead.interaction_count} contato{lead.interaction_count !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          {/* Vehicle + contact info */}
          <p className="mt-0.5 text-xs text-muted-foreground">
            {[lead.interest_brand, lead.interest_model].filter(Boolean).join(" ") || "Interesse não definido"}
            {idle !== null ? (
              <>
                {" · "}
                <span className={idle >= 7 ? "font-medium text-destructive" : ""}>
                  {idle}d sem contato
                </span>
              </>
            ) : (
              <span className="font-medium text-destructive"> · nunca contatado</span>
            )}
          </p>

          {/* Responsável (gerente only) */}
          {isGerente && lead.responsavel_nome && (
            <p className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              <User className="size-2.5" /> {lead.responsavel_nome}
            </p>
          )}

          {/* Next action */}
          {(lead.next_action_type || nextDate) && (
            <div className="mt-1 flex items-center gap-1.5">
              <CalendarClock className={cn("size-3", isOverdue ? "text-destructive" : "text-muted-foreground")} />
              <span className={cn("text-xs", isOverdue ? "font-medium text-destructive" : "text-muted-foreground")}>
                {lead.next_action_type ? followUpTypeLabel(lead.next_action_type) : "Retorno"}
                {nextDate && (
                  <>
                    {" em "}
                    {nextDate.toLocaleDateString("pt-BR", {
                      day: "2-digit", month: "2-digit",
                      hour: "2-digit", minute: "2-digit",
                    })}
                  </>
                )}
              </span>
              {lead.next_action_notes && (
                <span className="truncate text-[10px] text-muted-foreground">
                  · {lead.next_action_notes}
                </span>
              )}
            </div>
          )}

          {/* Parado em etapa warning */}
          {!lead.next_return_at && stuckDays !== null && stuckDays >= STUCK_DAYS && (
            <p className="mt-1 text-[10px] font-medium text-orange-500 dark:text-orange-400">
              Parado em {statusLabel(lead.status)} há {stuckDays}d
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex shrink-0 flex-wrap gap-1.5">
          <WaButton
            customerId={lead.id}
            nome={lead.name}
            numero={lead.whatsapp ?? lead.phone}
            marca={lead.interest_brand}
            modelo={lead.interest_model}
            status={lead.status}
            size="sm"
          />
          <button
            onClick={() => togglePanel("concluir")}
            className={cn(
              "inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-bold transition-colors",
              myKind === "concluir"
                ? "bg-emerald-600/10 text-emerald-600 dark:text-emerald-400"
                : "border border-border hover:bg-muted",
            )}
          >
            <CheckCircle2 className="size-3" /> Concluir
          </button>
          <button
            onClick={() => togglePanel("reagendar")}
            className={cn(
              "inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-bold transition-colors",
              myKind === "reagendar"
                ? "bg-primary/10 text-primary"
                : "border border-border hover:bg-muted",
            )}
          >
            <RotateCcw className="size-3" /> Reagendar
          </button>
          <button
            onClick={() => togglePanel("historico")}
            className={cn(
              "inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-bold transition-colors",
              myKind === "historico"
                ? "bg-accent text-accent-foreground"
                : "border border-border hover:bg-muted",
            )}
          >
            {myKind === "historico" ? (
              <ChevronUp className="size-3" />
            ) : (
              <ChevronDown className="size-3" />
            )}
            Histórico
          </button>
        </div>
      </div>

      {myKind === "concluir" && (
        <ConcluirPanel
          leadId={lead.id}
          isPending={isPending}
          onConcluir={onConcluir}
          onCancel={() => setPanel({ kind: "none" })}
        />
      )}
      {myKind === "reagendar" && (
        <ReagendarPanel
          lead={lead}
          isPending={isPending}
          onReagendar={onReagendar}
          onCancel={() => setPanel({ kind: "none" })}
        />
      )}
      {myKind === "historico" && <HistoricoPanel customerId={lead.id} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ConcluirPanel
// ---------------------------------------------------------------------------

function ConcluirPanel({
  leadId, isPending, onConcluir, onCancel,
}: {
  leadId: string;
  isPending: boolean;
  onConcluir: (args: ConcluirArgs) => void;
  onCancel: () => void;
}) {
  const [tipo, setTipo] = useState("ligacao");
  const [nota, setNota] = useState("");

  return (
    <div className="border-t border-border bg-muted/40 px-4 py-3">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
        Registrar contato realizado
      </p>
      <div className="flex flex-wrap gap-2">
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
          className="h-8 rounded-md border border-border bg-background px-2 text-xs"
        >
          {FOLLOW_UP_TYPES.map((t) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
        <input
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          placeholder="Observação (opcional)"
          className="h-8 min-w-40 flex-1 rounded-md border border-border bg-background px-2 text-xs outline-none focus:border-primary/60"
        />
        <button
          onClick={() => onConcluir({ leadId, tipo, nota })}
          disabled={isPending}
          className="inline-flex h-8 items-center gap-1 rounded-md bg-emerald-600 px-3 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          <CheckCircle2 className="size-3" /> Confirmar
        </button>
        <button
          onClick={onCancel}
          className="inline-flex h-8 items-center rounded-md border border-border px-3 text-xs text-muted-foreground hover:bg-muted"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ReagendarPanel
// ---------------------------------------------------------------------------

function ReagendarPanel({
  lead, isPending, onReagendar, onCancel,
}: {
  lead: FollowUpLead;
  isPending: boolean;
  onReagendar: (args: ReagendarArgs) => void;
  onCancel: () => void;
}) {
  const defaultDate = lead.next_return_at
    ? new Date(lead.next_return_at).toISOString().slice(0, 16)
    : new Date(Date.now() + 86_400_000).toISOString().slice(0, 16);

  const [novaData, setNovaData] = useState(defaultDate);
  const [tipo, setTipo]         = useState(lead.next_action_type ?? "ligacao");
  const [nota, setNota]         = useState(lead.next_action_notes ?? "");

  return (
    <div className="border-t border-border bg-muted/40 px-4 py-3">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-primary">
        Reagendar próxima ação
      </p>
      <div className="flex flex-wrap gap-2">
        <input
          type="datetime-local"
          value={novaData}
          onChange={(e) => setNovaData(e.target.value)}
          className="h-8 rounded-md border border-border bg-background px-2 text-xs"
        />
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
          className="h-8 rounded-md border border-border bg-background px-2 text-xs"
        >
          {FOLLOW_UP_TYPES.map((t) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
        <input
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          placeholder="Observação (opcional)"
          className="h-8 min-w-40 flex-1 rounded-md border border-border bg-background px-2 text-xs outline-none focus:border-primary/60"
        />
        <button
          onClick={() => { if (novaData) onReagendar({ leadId: lead.id, novaData, tipo, nota }); }}
          disabled={!novaData || isPending}
          className="inline-flex h-8 items-center gap-1 rounded-md bg-primary px-3 text-xs font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          Salvar
        </button>
        <button
          onClick={onCancel}
          className="inline-flex h-8 items-center rounded-md border border-border px-3 text-xs text-muted-foreground hover:bg-muted"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// HistoricoPanel — fetches interactions on demand
// ---------------------------------------------------------------------------

function HistoricoPanel({ customerId }: { customerId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["historico", customerId],
    queryFn: () => fetchHistorico(customerId),
    staleTime: 30_000,
  });

  return (
    <div className="border-t border-border bg-muted/40 px-4 py-3">
      <p className="mb-3 text-[10px] font-bold uppercase tracking-widest">
        Histórico de contatos
      </p>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-md border border-border bg-card" />
          ))}
        </div>
      ) : !data || data.length === 0 ? (
        <p className="text-xs text-muted-foreground">Sem interações registradas.</p>
      ) : (
        <ol className="relative space-y-3 border-l-2 border-border pl-4">
          {data.map((it) => (
            <li key={it.id} className="relative">
              <span className="absolute -left-[17px] top-1 size-2.5 rounded-full bg-primary ring-2 ring-background" />
              <div className="flex flex-wrap items-baseline justify-between gap-x-2">
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
                    {new Date(it.created_at).toLocaleString("pt-BR", {
                      day: "2-digit", month: "2-digit",
                      hour: "2-digit", minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
              {it.content && (
                <p className="mt-0.5 text-xs text-foreground/80">{it.content}</p>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
