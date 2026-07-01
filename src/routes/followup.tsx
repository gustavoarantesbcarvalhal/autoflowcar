import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { FOLLOW_UP_TYPES, followUpTypeLabel, daysSince, statusLabel } from "@/lib/crm";
import { WaButton } from "@/components/wa-button";
import {
  CheckCircle2, Clock, RotateCcw,
  AlertCircle, CalendarClock, Inbox, User,
  Star, AlertTriangle, Filter, X,
} from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { SkeletonList } from "@/components/skeleton-presets";
import { inputCls, labelCls, selectCls, textareaCls } from "@/components/form-field";

export const Route = createFileRoute("/followup")({
  head: () => ({ meta: [{ title: "Follow-up — DriverLeads" }] }),
  component: FollowupPage,
});

// ── Types ─────────────────────────────────────────────────────────────────────

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

type Panel =
  | { kind: "none" }
  | { kind: "concluir";  leadId: string }
  | { kind: "reagendar"; leadId: string };

type ConcluirArgs  = { leadId: string; tipo: string; nota: string };
type ReagendarArgs = { leadId: string; novaData: string; tipo: string; nota: string };

// ── Data fetching ─────────────────────────────────────────────────────────────

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

// ── Group logic ───────────────────────────────────────────────────────────────

const STUCK_DAYS = 14;

function groupLeads(leads: FollowUpLead[], filterVendedorId?: string) {
  const filtered = filterVendedorId
    ? leads.filter((l) => l.responsavel_id === filterVendedorId)
    : leads;

  const now = new Date();
  const y = now.getFullYear(); const mo = now.getMonth(); const d = now.getDate();
  const todayStart = new Date(y, mo, d).getTime();
  const todayEnd   = new Date(y, mo, d + 1).getTime();
  const weekEnd    = new Date(y, mo, d + 8).getTime();
  const stuck14    = new Date(y, mo, d - STUCK_DAYS).getTime();

  const vencidos:  FollowUpLead[] = [];
  const hoje:      FollowUpLead[] = [];
  const proximos7: FollowUpLead[] = [];
  const futuro:    FollowUpLead[] = [];
  const semData:   FollowUpLead[] = [];
  const parados:   FollowUpLead[] = [];

  for (const lead of filtered) {
    if (lead.next_return_at) {
      const t = new Date(lead.next_return_at).getTime();
      if      (t < todayStart) vencidos.push(lead);
      else if (t < todayEnd)   hoje.push(lead);
      else if (t < weekEnd)    proximos7.push(lead);
      else                     futuro.push(lead);
    } else {
      const refDate = lead.status_changed_at ?? lead.created_at;
      const refTime = new Date(refDate).getTime();
      if (refTime < stuck14) {
        parados.push(lead);
      } else {
        const ds = daysSince(lead.last_contact_at);
        if (ds === null || ds >= 7) semData.push(lead);
      }
    }
  }

  return { vencidos, hoje, proximos7, futuro, semData, parados };
}

// ── Slide-over ────────────────────────────────────────────────────────────────

function SlideOver({
  open,
  onClose,
  title,
  subtitle,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/20 transition-opacity duration-200",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={cn(
          "fixed right-0 top-0 z-50 flex h-full w-full max-w-sm flex-col border-l border-border bg-background shadow-2xl transition-transform duration-200",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        {/* Header */}
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-5">
          <div>
            <p className="text-sm font-semibold">{title}</p>
            {subtitle && (
              <p className="text-[11px] text-muted-foreground">{subtitle}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {children}
        </div>
      </div>
    </>
  );
}

// ── Forms inside slide-over ───────────────────────────────────────────────────

function ConcluirForm({
  leadId,
  isPending,
  onConcluir,
  onCancel,
}: {
  leadId: string;
  isPending: boolean;
  onConcluir: (args: ConcluirArgs) => void;
  onCancel: () => void;
}) {
  const [tipo, setTipo] = useState("ligacao");
  const [nota, setNota] = useState("");

  return (
    <div className="space-y-4">
      <div>
        <label className={labelCls}>Tipo de contato</label>
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
          className={selectCls}
        >
          {FOLLOW_UP_TYPES.map((t) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelCls}>Observação <span className="font-normal normal-case text-muted-foreground">(opcional)</span></label>
        <textarea
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          placeholder="O que foi discutido?"
          rows={3}
          className={textareaCls}
        />
      </div>

      <div className="flex gap-2 pt-1">
        <button
          onClick={() => onConcluir({ leadId, tipo, nota })}
          disabled={isPending}
          className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-[10px] bg-emerald-600 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          <CheckCircle2 className="size-3.5" />
          {isPending ? "Salvando…" : "Confirmar contato"}
        </button>
        <button
          onClick={onCancel}
          className="h-9 rounded-[10px] border border-border px-4 text-sm text-muted-foreground hover:bg-muted"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

function ReagendarForm({
  lead,
  isPending,
  onReagendar,
  onCancel,
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
    <div className="space-y-4">
      <div>
        <label className={labelCls}>Nova data</label>
        <input
          type="datetime-local"
          value={novaData}
          onChange={(e) => setNovaData(e.target.value)}
          className={inputCls}
        />
      </div>

      <div>
        <label className={labelCls}>Tipo de ação</label>
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
          className={selectCls}
        >
          {FOLLOW_UP_TYPES.map((t) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelCls}>Observação <span className="font-normal normal-case text-muted-foreground">(opcional)</span></label>
        <textarea
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          placeholder="O que precisa ser feito?"
          rows={3}
          className={textareaCls}
        />
      </div>

      <div className="flex gap-2 pt-1">
        <button
          onClick={() => { if (novaData) onReagendar({ leadId: lead.id, novaData, tipo, nota }); }}
          disabled={!novaData || isPending}
          className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-[10px] bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {isPending ? "Salvando…" : "Confirmar reagendamento"}
        </button>
        <button
          onClick={onCancel}
          className="h-9 rounded-[10px] border border-border px-4 text-sm text-muted-foreground hover:bg-muted"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

function FollowupPage() {
  const { perfil } = useAuth();
  const isGerente  = perfil === "gerente" || perfil === "admin_loja" || perfil === "super_admin";
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({ queryKey: ["followup"], queryFn: fetchFollowUps });

  const [panel, setPanel]             = useState<Panel>({ kind: "none" });
  const [filterVendedor, setFilter]   = useState("");

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

  const { vencidos, hoje, proximos7, futuro, semData, parados } = groups;
  const urgentes = vencidos.length + hoje.length;
  const totalFU  = urgentes + proximos7.length + futuro.length + semData.length + parados.length;

  // Find the active lead for slide-over
  const activeLead = useMemo(() => {
    if (panel.kind === "none") return null;
    return (data ?? []).find((l) => l.id === (panel as { leadId: string }).leadId) ?? null;
  }, [panel, data]);

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

  const isPending = concluir.isPending || reagendar.isPending;

  return (
    <>
      <div className="mx-auto max-w-4xl p-4 md:p-8">
        <PageHeader
          title="Central de Follow-up"
          subtitle={
            isLoading
              ? "Carregando…"
              : `${urgentes} ${urgentes === 1 ? "ação urgente" : "ações urgentes"} · ${parados.length} parados · ${proximos7.length} nos próximos 7 dias`
          }
          action={
            isGerente && vendedorOptions.length > 0 ? (
              <div className="flex items-center gap-2">
                <Filter className="size-3.5 text-muted-foreground" />
                <select
                  value={filterVendedor}
                  onChange={(e) => setFilter(e.target.value)}
                  className="h-9 rounded-[10px] border border-border bg-background px-2 text-sm outline-none focus:border-primary/60"
                >
                  <option value="">Toda a equipe</option>
                  {vendedorOptions.map((v) => (
                    <option key={v.id} value={v.id}>{v.nome}</option>
                  ))}
                </select>
              </div>
            ) : undefined
          }
        />

        {isLoading ? (
          <SkeletonList count={4} />
        ) : totalFU === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="Nenhum lead para acompanhar"
            subtitle="Todos os leads ativos estão em dia."
            tone="success"
          />
        ) : (
          <div className="space-y-8">
            <Section title="Vencidos"                tone="danger"  icon={AlertCircle}   leads={vencidos}  panel={panel} setPanel={setPanel} isGerente={isGerente} />
            <Section title="Hoje"                    tone="warning" icon={Clock}         leads={hoje}      panel={panel} setPanel={setPanel} isGerente={isGerente} />
            <Section title="Próximos 7 dias"         tone="info"    icon={CalendarClock} leads={proximos7} panel={panel} setPanel={setPanel} isGerente={isGerente} />
            <Section title="Agendados (+ de 7 dias)" tone="future"  icon={CalendarClock} leads={futuro}    panel={panel} setPanel={setPanel} isGerente={isGerente} subtitle="retorno planejado além da próxima semana" />
            <Section title="Parados em etapa"        tone="stuck"   icon={AlertTriangle} leads={parados}   panel={panel} setPanel={setPanel} isGerente={isGerente} subtitle={`sem movimentação há ${STUCK_DAYS}+ dias`} />
            <Section title="Sem data programada"     tone="muted"   icon={Inbox}         leads={semData}   panel={panel} setPanel={setPanel} isGerente={isGerente} subtitle="sem contato há 7+ dias ou nunca contatados" />
          </div>
        )}
      </div>

      {/* Slide-over */}
      <SlideOver
        open={panel.kind !== "none"}
        onClose={() => setPanel({ kind: "none" })}
        title={panel.kind === "concluir" ? "Concluir Follow-up" : "Reagendar Follow-up"}
        subtitle={activeLead?.name ?? undefined}
      >
        {activeLead && panel.kind === "concluir" && (
          <>
            <LeadSlideOverSummary lead={activeLead} />
            <div className="mt-5">
              <p className="mb-4 text-xs font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                Registrar contato realizado
              </p>
              <ConcluirForm
                leadId={activeLead.id}
                isPending={isPending}
                onConcluir={(args) => concluir.mutate(args)}
                onCancel={() => setPanel({ kind: "none" })}
              />
            </div>
          </>
        )}
        {activeLead && panel.kind === "reagendar" && (
          <>
            <LeadSlideOverSummary lead={activeLead} />
            <div className="mt-5">
              <p className="mb-4 text-xs font-bold uppercase tracking-wide text-primary">
                Reagendar próxima ação
              </p>
              <ReagendarForm
                lead={activeLead}
                isPending={isPending}
                onReagendar={(args) => reagendar.mutate(args)}
                onCancel={() => setPanel({ kind: "none" })}
              />
            </div>
          </>
        )}
      </SlideOver>
    </>
  );
}

// Lead summary shown at the top of the slide-over
function LeadSlideOverSummary({ lead }: { lead: FollowUpLead }) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 px-4 py-3">
      <Link
        to="/clientes/$id"
        params={{ id: lead.id }}
        className="text-sm font-bold hover:text-primary"
      >
        {lead.name}
      </Link>
      <div className="mt-1 flex flex-wrap gap-1.5 text-xs text-muted-foreground">
        <span className="rounded-md bg-muted px-1.5 py-0.5 font-semibold text-foreground">
          {statusLabel(lead.status)}
        </span>
        {(lead.interest_brand || lead.interest_model) && (
          <span>{[lead.interest_brand, lead.interest_model].filter(Boolean).join(" ")}</span>
        )}
        {lead.responsavel_nome && (
          <span className="inline-flex items-center gap-1">
            <User className="size-3" /> {lead.responsavel_nome}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────

const TONE_CLS = {
  danger:  "text-destructive",
  warning: "text-amber-500 dark:text-amber-400",
  info:    "text-primary",
  future:  "text-violet-500 dark:text-violet-400",
  stuck:   "text-orange-500 dark:text-orange-400",
  muted:   "text-muted-foreground",
} as const;

type SharedProps = {
  panel: Panel;
  setPanel: (p: Panel) => void;
  isGerente: boolean;
};

function Section({
  title, tone, icon: Icon, leads, subtitle,
  panel, setPanel, isGerente,
}: {
  title: string;
  tone: keyof typeof TONE_CLS;
  icon: React.ElementType;
  leads: FollowUpLead[];
  subtitle?: string;
} & SharedProps) {
  if (leads.length === 0) return null;

  return (
    <section>
      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        <Icon className={cn("size-4", TONE_CLS[tone])} />
        <h2 className={cn("text-sm font-semibold", TONE_CLS[tone])}>
          {title}
        </h2>
        <span className="rounded-full bg-muted px-1.5 py-0.5 font-mono text-xs font-bold">
          {leads.length}
        </span>
        {subtitle && (
          <span className="text-xs text-muted-foreground">— {subtitle}</span>
        )}
      </div>
      <div className="space-y-1.5">
        {leads.map((lead) => (
          <LeadCard
            key={lead.id}
            lead={lead}
            panel={panel}
            setPanel={setPanel}
            isGerente={isGerente}
          />
        ))}
      </div>
    </section>
  );
}

// ── Lead card ─────────────────────────────────────────────────────────────────

function LeadCard({ lead, panel, setPanel, isGerente }: { lead: FollowUpLead } & SharedProps) {
  const qc = useQueryClient();

  const myKind =
    panel.kind !== "none" && (panel as { leadId: string }).leadId === lead.id
      ? panel.kind
      : null;

  function openPanel(kind: "concluir" | "reagendar") {
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

  const idle       = daysSince(lead.last_contact_at);
  const nextDate   = lead.next_return_at ? new Date(lead.next_return_at) : null;
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const isOverdue  = nextDate && nextDate < todayStart;
  const stuckDays  = lead.status_changed_at
    ? daysSince(lead.status_changed_at)
    : daysSince(lead.created_at);

  return (
    <div
      className={cn(
        "rounded-2xl border bg-card px-4 py-3",
        lead.is_priority
          ? "border-amber-400/60 dark:border-amber-500/40"
          : myKind
            ? "border-primary/30"
            : "border-border",
      )}
    >
      <div className="flex flex-wrap items-start gap-3">
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
            <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-semibold">
              {statusLabel(lead.status)}
            </span>
            {lead.interaction_count > 0 && (
              <span className="rounded-full bg-primary/10 px-1.5 py-0.5 font-mono text-xs font-semibold text-primary">
                {lead.interaction_count}✕
              </span>
            )}
          </div>

          {/* Vehicle + contact info */}
          <p className="mt-0.5 text-xs text-muted-foreground">
            {[lead.interest_brand, lead.interest_model].filter(Boolean).join(" ") || "Interesse não definido"}
            {idle !== null ? (
              <>
                {" · "}
                <span className={idle >= 7 ? "font-semibold text-destructive" : ""}>
                  {idle}d sem contato
                </span>
              </>
            ) : (
              <span className="font-semibold text-destructive"> · nunca contatado</span>
            )}
            {isGerente && lead.responsavel_nome && (
              <span className="ml-1.5 inline-flex items-center gap-0.5">
                <User className="size-2.5" /> {lead.responsavel_nome}
              </span>
            )}
          </p>

          {/* Next action */}
          {(lead.next_action_type || nextDate) && (
            <div className="mt-1 flex items-center gap-1.5">
              <CalendarClock className={cn("size-3", isOverdue ? "text-destructive" : "text-muted-foreground")} />
              <span className={cn("text-xs", isOverdue ? "font-semibold text-destructive" : "text-muted-foreground")}>
                {lead.next_action_type ? followUpTypeLabel(lead.next_action_type) : "Retorno"}
                {nextDate && (
                  <>
                    {" em "}
                    {nextDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </>
                )}
                {lead.next_action_notes && (
                  <span className="ml-1.5 text-muted-foreground">· {lead.next_action_notes}</span>
                )}
              </span>
            </div>
          )}

          {/* Parado em etapa */}
          {!lead.next_return_at && stuckDays !== null && stuckDays >= STUCK_DAYS && (
            <p className="mt-0.5 text-xs font-semibold text-orange-500 dark:text-orange-400">
              Parado em {statusLabel(lead.status)} há {stuckDays}d
            </p>
          )}
        </div>

        {/* Action buttons */}
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
            onClick={() => openPanel("concluir")}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-[10px] px-3 text-xs font-semibold transition-colors",
              myKind === "concluir"
                ? "bg-emerald-600/10 text-emerald-600 dark:text-emerald-400"
                : "border border-border hover:bg-muted",
            )}
          >
            <CheckCircle2 className="size-3.5" /> Concluir
          </button>
          <button
            onClick={() => openPanel("reagendar")}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-[10px] px-3 text-xs font-semibold transition-colors",
              myKind === "reagendar"
                ? "bg-primary/10 text-primary"
                : "border border-border hover:bg-muted",
            )}
          >
            <RotateCcw className="size-3.5" /> Reagendar
          </button>
        </div>
      </div>
    </div>
  );
}
