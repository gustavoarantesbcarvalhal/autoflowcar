import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { FOLLOW_UP_TYPES, followUpTypeLabel, daysSince, statusLabel } from "@/lib/crm";
import { WaButton } from "@/components/wa-button";
import {
  CheckCircle2, Clock, RotateCcw,
  AlertCircle, CalendarClock, Inbox, User,
  Star, AlertTriangle, Filter,
} from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/followup")({
  head: () => ({ meta: [{ title: "Follow-up — DriverLeads" }] }),
  component: FollowupPage,
});

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
  | { kind: "concluir"; leadId: string }
  | { kind: "reagendar"; leadId: string };

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

const STUCK_DAYS = 14;

function groupLeads(leads: FollowUpLead[], filterVendedorId?: string) {
  const filtered = filterVendedorId
    ? leads.filter((l) => l.responsavel_id === filterVendedorId)
    : leads;

  const now        = new Date();
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
        const d = daysSince(lead.last_contact_at);
        if (d === null || d >= 7) semData.push(lead);
      }
    }
  }

  return { vencidos, hoje, proximos7, futuro, semData, parados };
}

function FollowupPage() {
  const { perfil } = useAuth();
  const isGerente = perfil === "gerente" || perfil === "admin_loja" || perfil === "super_admin";
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({ queryKey: ["followup"], queryFn: fetchFollowUps });

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

  const { vencidos, hoje, proximos7, futuro, semData, parados } = groups;
  const urgentes = vencidos.length + hoje.length;
  const totalFU  = urgentes + proximos7.length + futuro.length + semData.length + parados.length;

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
    <div className="mx-auto max-w-4xl p-4 md:p-8">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Central de Follow-up</h1>
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
              className="h-9 rounded-lg border border-border bg-background px-2 text-sm"
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
            <div key={i} className="h-24 animate-pulse rounded-2xl border border-border bg-card" />
          ))}
        </div>
      ) : totalFU === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-20 text-center">
          <CheckCircle2 className="mx-auto mb-3 size-10 text-success" />
          <p className="text-sm font-semibold">Nenhum lead para acompanhar</p>
          <p className="mt-1 text-xs text-muted-foreground">Todos os leads ativos estão em dia.</p>
        </div>
      ) : (
        <div className="space-y-8">
          <Section title="Vencidos"           tone="danger"  icon={AlertCircle}   leads={vencidos}  {...shared} />
          <Section title="Hoje"               tone="warning" icon={Clock}         leads={hoje}      {...shared} />
          <Section title="Próximos 7 dias"    tone="info"    icon={CalendarClock} leads={proximos7} {...shared} />
          <Section
            title="Agendados (+ de 7 dias)"
            tone="future"
            icon={CalendarClock}
            leads={futuro}
            subtitle="retorno planejado além da próxima semana"
            {...shared}
          />
          <Section
            title="Parados em etapa"
            tone="stuck"
            icon={AlertTriangle}
            leads={parados}
            subtitle={`sem movimentação há ${STUCK_DAYS}+ dias`}
            {...shared}
          />
          <Section
            title="Sem data programada"
            tone="muted"
            icon={Inbox}
            leads={semData}
            subtitle="sem contato há 7+ dias ou nunca contatados"
            {...shared}
          />
        </div>
      )}
    </div>
  );
}

const TONE_CLS = {
  danger:  "text-destructive",
  warning: "text-amber-500 dark:text-amber-400",
  info:    "text-primary",
  future:  "text-violet-500 dark:text-violet-400",
  stuck:   "text-orange-500 dark:text-orange-400",
  muted:   "text-muted-foreground",
} as const;

function Section({
  title, tone, icon: Icon, leads, subtitle,
  panel, setPanel, onConcluir, onReagendar, isPending, isGerente,
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
      <div className="mb-3 flex flex-wrap items-center gap-2">
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
    </section>
  );
}

function LeadCard({
  lead, panel, setPanel, onConcluir, onReagendar, isPending, isGerente,
}: { lead: FollowUpLead } & SharedProps) {
  const qc = useQueryClient();

  const myKind =
    panel.kind !== "none" && (panel as { leadId: string }).leadId === lead.id
      ? panel.kind
      : null;

  function togglePanel(kind: "concluir" | "reagendar") {
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
      "overflow-hidden rounded-2xl border bg-card",
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
                "size-4",
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
          <p className="mt-1 text-xs text-muted-foreground">
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
          </p>

          {/* Responsável (gerente) */}
          {isGerente && lead.responsavel_nome && (
            <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
              <User className="size-3" /> {lead.responsavel_nome}
            </p>
          )}

          {/* Next action */}
          {(lead.next_action_type || nextDate) && (
            <div className="mt-1.5 flex items-center gap-1.5">
              <CalendarClock className={cn("size-3.5", isOverdue ? "text-destructive" : "text-muted-foreground")} />
              <span className={cn("text-xs", isOverdue ? "font-semibold text-destructive" : "text-muted-foreground")}>
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
                <span className="truncate text-xs text-muted-foreground">
                  · {lead.next_action_notes}
                </span>
              )}
            </div>
          )}

          {/* Parado em etapa */}
          {!lead.next_return_at && stuckDays !== null && stuckDays >= STUCK_DAYS && (
            <p className="mt-1 text-xs font-semibold text-orange-500 dark:text-orange-400">
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
              "inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors",
              myKind === "concluir"
                ? "bg-success/15 text-success"
                : "border border-border hover:bg-muted",
            )}
          >
            <CheckCircle2 className="size-3.5" /> Concluir
          </button>
          <button
            onClick={() => togglePanel("reagendar")}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors",
              myKind === "reagendar"
                ? "bg-primary/10 text-primary"
                : "border border-border hover:bg-muted",
            )}
          >
            <RotateCcw className="size-3.5" /> Reagendar
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
    </div>
  );
}

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
    <div className="border-t border-border bg-muted/30 px-4 py-3">
      <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-success">
        Registrar contato realizado
      </p>
      <div className="flex flex-wrap gap-2">
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
          className="h-9 rounded-lg border border-border bg-background px-2 text-sm"
        >
          {FOLLOW_UP_TYPES.map((t) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
        <input
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          placeholder="Observação (opcional)"
          className="h-9 min-w-40 flex-1 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary/60"
        />
        <button
          onClick={() => onConcluir({ leadId, tipo, nota })}
          disabled={isPending}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-success px-4 text-sm font-semibold text-success-foreground hover:opacity-90 disabled:opacity-60"
        >
          <CheckCircle2 className="size-3.5" /> Confirmar
        </button>
        <button
          onClick={onCancel}
          className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-sm text-muted-foreground hover:bg-muted"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

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
    <div className="border-t border-border bg-muted/30 px-4 py-3">
      <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-primary">
        Reagendar próxima ação
      </p>
      <div className="flex flex-wrap gap-2">
        <input
          type="datetime-local"
          value={novaData}
          onChange={(e) => setNovaData(e.target.value)}
          className="h-9 rounded-lg border border-border bg-background px-2 text-sm"
        />
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
          className="h-9 rounded-lg border border-border bg-background px-2 text-sm"
        >
          {FOLLOW_UP_TYPES.map((t) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
        <input
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          placeholder="Observação (opcional)"
          className="h-9 min-w-40 flex-1 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary/60"
        />
        <button
          onClick={() => { if (novaData) onReagendar({ leadId: lead.id, novaData, tipo, nota }); }}
          disabled={!novaData || isPending}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          Salvar
        </button>
        <button
          onClick={onCancel}
          className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-sm text-muted-foreground hover:bg-muted"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
