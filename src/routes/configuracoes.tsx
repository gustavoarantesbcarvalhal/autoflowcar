import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  AlertCircle, Copy, RefreshCw, X, Eye, EyeOff, Zap, Globe,
  Clock, ChevronRight, Wifi, WifiOff, Loader2, XCircle,
  Building2, Users, Activity, Sparkles, Save, ArrowRight, CheckCircle2,
} from "lucide-react";
import {
  salvarMetaIntegracao,
  salvarWhatsAppIntegracao,
  desconectarIntegracao,
  testarIntegracao,
  regenerarToken,
  ativarGeneric,
  atualizarDadosLoja,
} from "@/lib/api/integracoes.functions";

export const Route = createFileRoute("/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações — DriverLeads" }] }),
  component: ConfiguracoesPage,
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Section = "loja" | "usuarios" | "integracoes" | "api" | "webhooks" | "automacoes";

type Integration = {
  id: string;
  platform: string;
  status: "ativo" | "inativo" | "erro";
  fb_page_id: string | null;
  waba_phone_number_id: string | null;
  webhook_verify_token: string;
  last_sync_at: string | null;
  last_error: string | null;
  last_error_at: string | null;
};

type WebhookEvent = {
  id: string;
  platform: string;
  status: string;
  created_at: string;
  error_message: string | null;
};

type TenantInfo = {
  id: string;
  nome: string;
  logo_url: string | null;
  cor_primaria: string | null;
};

// ---------------------------------------------------------------------------
// Sidebar nav config
// ---------------------------------------------------------------------------

const SECTIONS: Array<{ id: Section; label: string; icon: React.FC<{ className?: string }> }> = [
  { id: "loja",        label: "Dados da Loja",  icon: Building2  },
  { id: "usuarios",    label: "Usuários",        icon: Users      },
  { id: "integracoes", label: "Integrações",     icon: Zap        },
  { id: "api",         label: "API",             icon: Globe      },
  { id: "webhooks",    label: "Webhooks",        icon: Activity   },
  { id: "automacoes",  label: "Automações",      icon: Sparkles   },
];

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: "ativo" | "inativo" | "erro" | null }) {
  if (status === "ativo")
    return (
      <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
        <span className="size-1.5 rounded-full bg-emerald-500" />Conectado
      </span>
    );
  if (status === "erro")
    return (
      <span className="flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-bold text-destructive">
        <AlertCircle className="size-3" />Erro
      </span>
    );
  return (
    <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
      <span className="size-1.5 rounded-full bg-muted-foreground/40" />Desconectado
    </span>
  );
}

function EventStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    processed:  "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
    duplicated: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    error:      "bg-destructive/15 text-destructive",
    received:   "bg-sky-500/15 text-sky-700 dark:text-sky-400",
  };
  const label: Record<string, string> = {
    processed: "Processado", duplicated: "Duplicado", error: "Erro", received: "Recebido",
  };
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", map[status] ?? "bg-muted text-muted-foreground")}>
      {label[status] ?? status}
    </span>
  );
}

function platformLabel(p: string): string {
  const m: Record<string, string> = {
    meta_lead_ads:    "Meta Lead Ads",
    meta_ctwa:        "WhatsApp Business",
    whatsapp_organic: "WhatsApp Orgânico",
    generic:          "API Genérica",
  };
  return m[p] ?? p;
}

function copyToClipboard(text: string, label = "Copiado!") {
  navigator.clipboard.writeText(text).then(() => toast.success(label));
}

const inp = "h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary/60 transition-colors";

// ---------------------------------------------------------------------------
// Modals
// ---------------------------------------------------------------------------

function MetaConnectModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [pageId, setPageId]       = useState("");
  const [token, setToken]         = useState("");
  const [showToken, setShowToken] = useState(false);

  const save = useMutation({
    mutationFn: () => salvarMetaIntegracao({ data: { fb_page_id: pageId, fb_page_access_token: token } }),
    onSuccess: (res) => { toast.success(`Conectado: ${res.page_name || "Página Meta"}`); onSaved(); onClose(); },
    onError:   (e: Error) => toast.error(e.message),
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold">Conectar Meta Lead Ads</h2>
          <button onClick={onClose} className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted"><X className="size-4" /></button>
        </div>
        <div className="px-5 py-4">
          <div className="mb-4 rounded-xl bg-sky-500/10 p-3 text-xs text-sky-700 dark:text-sky-400">
            <p className="font-semibold">Como obter o Page Access Token:</p>
            <ol className="mt-1.5 list-decimal pl-4 space-y-0.5 text-sky-600 dark:text-sky-300">
              <li>Acesse Meta Business Manager → Configurações</li>
              <li>Usuários do Sistema → Adicionar ativo → selecione sua Página</li>
              <li>Gerar novo token → marque "pages_read_engagement" e "leads_retrieval"</li>
            </ol>
          </div>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">ID da Página Facebook</label>
              <input placeholder="Ex: 123456789012345" value={pageId} onChange={(e) => setPageId(e.target.value)} className={inp} />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Page Access Token</label>
              <div className="relative">
                <input type={showToken ? "text" : "password"} placeholder="EAAxxxxxxxxxx..." value={token} onChange={(e) => setToken(e.target.value)} className={cn(inp, "pr-10")} />
                <button type="button" onClick={() => setShowToken((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showToken ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
          <button onClick={onClose} className="h-10 rounded-lg border border-border px-4 text-sm font-medium hover:bg-muted">Cancelar</button>
          <button onClick={() => save.mutate()} disabled={!pageId || !token || save.isPending} className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
            {save.isPending && <Loader2 className="size-4 animate-spin" />}
            {save.isPending ? "Validando…" : "Validar e Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function WhatsAppConnectModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [phoneId, setPhoneId]     = useState("");
  const [token, setToken]         = useState("");
  const [showToken, setShowToken] = useState(false);

  const save = useMutation({
    mutationFn: () => salvarWhatsAppIntegracao({ data: { waba_phone_number_id: phoneId, wa_api_token: token } }),
    onSuccess: (res) => { toast.success(`Conectado: ${res.name || res.phone_number || "WhatsApp Business"}`); onSaved(); onClose(); },
    onError:   (e: Error) => toast.error(e.message),
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold">Conectar WhatsApp Business</h2>
          <button onClick={onClose} className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted"><X className="size-4" /></button>
        </div>
        <div className="px-5 py-4">
          <div className="mb-4 rounded-xl bg-sky-500/10 p-3 text-xs text-sky-700 dark:text-sky-400">
            <p className="font-semibold">Requisitos:</p>
            <ul className="mt-1 list-disc pl-4 space-y-0.5 text-sky-600 dark:text-sky-300">
              <li>Conta aprovada na WhatsApp Business API (Cloud API)</li>
              <li>Phone Number ID disponível no Meta Business Manager</li>
              <li>Token de acesso permanente do sistema</li>
            </ul>
          </div>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Phone Number ID</label>
              <input placeholder="Ex: 123456789012345" value={phoneId} onChange={(e) => setPhoneId(e.target.value)} className={inp} />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">API Token (permanente)</label>
              <div className="relative">
                <input type={showToken ? "text" : "password"} placeholder="EAAxxxxxxxxxx..." value={token} onChange={(e) => setToken(e.target.value)} className={cn(inp, "pr-10")} />
                <button type="button" onClick={() => setShowToken((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showToken ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
          <button onClick={onClose} className="h-10 rounded-lg border border-border px-4 text-sm font-medium hover:bg-muted">Cancelar</button>
          <button onClick={() => save.mutate()} disabled={!phoneId || !token || save.isPending} className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
            {save.isPending && <Loader2 className="size-4 animate-spin" />}
            {save.isPending ? "Validando…" : "Validar e Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Integration cards (Integrações section)
// ---------------------------------------------------------------------------

function MetaCard({ integration, onConnect, onRefresh }: { integration: Integration | null; onConnect: () => void; onRefresh: () => void }) {
  const qc = useQueryClient();

  const disconnect = useMutation({
    mutationFn: () => desconectarIntegracao({ data: { platform: "meta_lead_ads" } }),
    onSuccess: () => { toast.success("Meta desconectado"); onRefresh(); },
    onError:   (e: Error) => toast.error(e.message),
  });

  const test = useMutation({
    mutationFn: () => testarIntegracao({ data: { platform: "meta_lead_ads" } }),
    onSuccess: (res) => { toast.success(`Conexão OK — ${res.detail}`); qc.invalidateQueries({ queryKey: ["integrations"] }); },
    onError:   (e: Error) => toast.error(e.message),
  });

  const isActive = integration?.status === "ativo";

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-[#1877F2]/15">
            <svg className="size-5" viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
          </div>
          <div>
            <p className="text-sm font-semibold">Meta Lead Ads</p>
            <p className="text-xs text-muted-foreground">Facebook + Instagram</p>
          </div>
        </div>
        <StatusBadge status={integration?.status ?? null} />
      </div>

      {integration?.last_error && (
        <div className="mt-3 flex items-start gap-2 rounded-xl bg-destructive/10 p-2.5 text-xs text-destructive">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" />{integration.last_error}
        </div>
      )}

      {isActive && (
        <div className="mt-3 space-y-1 text-xs text-muted-foreground">
          {integration?.fb_page_id && <p>Página ID: <span className="font-mono">{integration.fb_page_id}</span></p>}
          {integration?.last_sync_at && <p className="flex items-center gap-1"><Clock className="size-3" />Última sync: {new Date(integration.last_sync_at).toLocaleString("pt-BR")}</p>}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {isActive ? (
          <>
            <button onClick={() => test.mutate()} disabled={test.isPending} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium hover:bg-muted disabled:opacity-60">
              {test.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Wifi className="size-3.5" />} Testar
            </button>
            <button onClick={() => { if (confirm("Desconectar Meta Lead Ads?")) disconnect.mutate(); }} disabled={disconnect.isPending} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-destructive/40 px-3 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-60">
              <WifiOff className="size-3.5" /> Desconectar
            </button>
          </>
        ) : (
          <button onClick={onConnect} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90">
            <Zap className="size-3.5" /> Conectar
          </button>
        )}
      </div>
    </div>
  );
}

function WhatsAppCard({ integration, onConnect, onRefresh }: { integration: Integration | null; onConnect: () => void; onRefresh: () => void }) {
  const qc = useQueryClient();

  const disconnect = useMutation({
    mutationFn: () => desconectarIntegracao({ data: { platform: "meta_ctwa" } }),
    onSuccess: () => { toast.success("WhatsApp Business desconectado"); onRefresh(); },
    onError:   (e: Error) => toast.error(e.message),
  });

  const test = useMutation({
    mutationFn: () => testarIntegracao({ data: { platform: "meta_ctwa" } }),
    onSuccess: (res) => { toast.success(`Conexão OK — ${res.detail}`); qc.invalidateQueries({ queryKey: ["integrations"] }); },
    onError:   (e: Error) => toast.error(e.message),
  });

  const isActive = integration?.status === "ativo";

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-[#25D366]/15">
            <svg className="size-5" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          </div>
          <div>
            <p className="text-sm font-semibold">WhatsApp Business</p>
            <p className="text-xs text-muted-foreground">Click-to-WhatsApp Ads</p>
          </div>
        </div>
        <StatusBadge status={integration?.status ?? null} />
      </div>

      {integration?.last_error && (
        <div className="mt-3 flex items-start gap-2 rounded-xl bg-destructive/10 p-2.5 text-xs text-destructive">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" />{integration.last_error}
        </div>
      )}

      {isActive && integration?.waba_phone_number_id && (
        <div className="mt-3 space-y-1 text-xs text-muted-foreground">
          <p>Phone Number ID: <span className="font-mono">{integration.waba_phone_number_id}</span></p>
          {integration.last_sync_at && <p className="flex items-center gap-1"><Clock className="size-3" />Última sync: {new Date(integration.last_sync_at).toLocaleString("pt-BR")}</p>}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {isActive ? (
          <>
            <button onClick={() => test.mutate()} disabled={test.isPending} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium hover:bg-muted disabled:opacity-60">
              {test.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Wifi className="size-3.5" />} Testar
            </button>
            <button onClick={() => { if (confirm("Desconectar WhatsApp Business?")) disconnect.mutate(); }} disabled={disconnect.isPending} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-destructive/40 px-3 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-60">
              <WifiOff className="size-3.5" /> Desconectar
            </button>
          </>
        ) : (
          <button onClick={onConnect} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90">
            <Zap className="size-3.5" /> Conectar
          </button>
        )}
      </div>
    </div>
  );
}

function ComingSoonCard({ name, icon }: { name: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/50 p-5 opacity-60">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-muted">{icon}</div>
        <div>
          <p className="text-sm font-semibold">{name}</p>
          <p className="text-xs text-muted-foreground">Em breve</p>
        </div>
        <span className="ml-auto rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-semibold text-muted-foreground">Em breve</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// API section card (API genérica)
// ---------------------------------------------------------------------------

function GenericCard({ integration, onRefresh }: { integration: Integration | null; onRefresh: () => void }) {
  const [showToken, setShowToken] = useState(false);
  const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL ?? "").replace("/rest/v1", "");
  const webhookUrl  = `${supabaseUrl}/functions/v1/webhook-generic`;

  const activate = useMutation({
    mutationFn: () => ativarGeneric({ data: undefined }),
    onSuccess: () => onRefresh(),
    onError:   (e: Error) => toast.error(e.message),
  });

  const regen = useMutation({
    mutationFn: () => regenerarToken({ data: undefined }),
    onSuccess: () => { toast.success("Token regenerado"); onRefresh(); },
    onError:   (e: Error) => toast.error(e.message),
  });

  const token        = integration?.webhook_verify_token ?? "";
  const displayToken = showToken ? token : token.slice(0, 8) + "••••••••••••••••••••";

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
            <Globe className="size-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold">Webhook Genérico</p>
            <p className="text-xs text-muted-foreground">Site, Landing Pages, Formulários</p>
          </div>
        </div>
        <StatusBadge status={integration ? "ativo" : null} />
      </div>

      {!integration ? (
        <div className="mt-4">
          <button onClick={() => activate.mutate()} disabled={activate.isPending} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
            {activate.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Zap className="size-3.5" />} Ativar
          </button>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Webhook URL</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded-lg bg-muted px-2.5 py-1.5 font-mono text-xs">{webhookUrl}</code>
              <button onClick={() => copyToClipboard(webhookUrl, "URL copiada!")} className="grid size-8 shrink-0 place-items-center rounded-lg border border-border hover:bg-muted">
                <Copy className="size-3.5" />
              </button>
            </div>
          </div>

          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">X-DL-Token (autenticação)</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded-lg bg-muted px-2.5 py-1.5 font-mono text-xs">{displayToken}</code>
              <button onClick={() => setShowToken((v) => !v)} className="grid size-8 shrink-0 place-items-center rounded-lg border border-border hover:bg-muted">
                {showToken ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              </button>
              <button onClick={() => copyToClipboard(token, "Token copiado!")} className="grid size-8 shrink-0 place-items-center rounded-lg border border-border hover:bg-muted">
                <Copy className="size-3.5" />
              </button>
              <button onClick={() => { if (confirm("Regenerar token? O token atual deixará de funcionar imediatamente.")) regen.mutate(); }} disabled={regen.isPending} className="grid size-8 shrink-0 place-items-center rounded-lg border border-border hover:bg-muted disabled:opacity-60">
                <RefreshCw className={cn("size-3.5", regen.isPending && "animate-spin")} />
              </button>
            </div>
          </div>

          <details className="text-xs">
            <summary className="flex cursor-pointer items-center gap-1 font-medium text-muted-foreground hover:text-foreground">
              <ChevronRight className="size-3.5 transition-transform [[open]_&]:rotate-90" /> Exemplo de requisição
            </summary>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-muted p-3 font-mono text-[10px] leading-relaxed">
{`POST ${webhookUrl}
Headers:
  Content-Type: application/json
  X-DL-Token: ${token.slice(0, 8)}...

Body:
{
  "name": "João Silva",
  "phone": "11999999999",
  "email": "joao@email.com",
  "message": "Interesse no Corolla 2023",
  "source": "landing-page-campanha-junho"
}`}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section: Dados da Loja
// ---------------------------------------------------------------------------

function LojaSection({ perfil }: { perfil: string | null }) {
  const qc = useQueryClient();

  const { data: tenant, isLoading } = useQuery({
    queryKey: ["tenant-info"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("id, nome, logo_url, cor_primaria")
        .single();
      if (error) throw error;
      return data as TenantInfo;
    },
  });

  const [nome, setNome]               = useState("");
  const [logoUrl, setLogoUrl]         = useState("");
  const [corPrimaria, setCorPrimaria] = useState("");
  const [dirty, setDirty]             = useState(false);

  useEffect(() => {
    if (tenant) {
      setNome(tenant.nome ?? "");
      setLogoUrl(tenant.logo_url ?? "");
      setCorPrimaria(tenant.cor_primaria ?? "");
      setDirty(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant?.id]);

  const save = useMutation({
    mutationFn: () =>
      atualizarDadosLoja({
        data: {
          nome,
          logo_url:     logoUrl || null,
          cor_primaria: corPrimaria || null,
        },
      }),
    onSuccess: () => {
      toast.success("Dados salvos com sucesso");
      setDirty(false);
      qc.invalidateQueries({ queryKey: ["tenant-info"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const readOnly = perfil !== "admin_loja";

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold">Dados da Loja</h2>
        <p className="text-sm text-muted-foreground">Informações básicas da sua concessionária</p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nome da loja</label>
            <input
              value={nome}
              onChange={(e) => { setNome(e.target.value); setDirty(true); }}
              className={inp}
              disabled={readOnly}
              placeholder="Ex: Loja ABC Veículos"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Logo URL</label>
            <input
              value={logoUrl}
              onChange={(e) => { setLogoUrl(e.target.value); setDirty(true); }}
              className={inp}
              disabled={readOnly}
              placeholder="https://..."
            />
            {logoUrl && (
              <img src={logoUrl} alt="Logo" className="mt-2 h-10 rounded object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            )}
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cor primária</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={corPrimaria || "#000000"}
                onChange={(e) => { setCorPrimaria(e.target.value); setDirty(true); }}
                disabled={readOnly}
                className="h-10 w-14 cursor-pointer rounded-lg border border-border bg-background p-0.5 disabled:cursor-not-allowed disabled:opacity-50"
              />
              <input
                value={corPrimaria}
                onChange={(e) => { setCorPrimaria(e.target.value); setDirty(true); }}
                className={cn(inp, "flex-1")}
                disabled={readOnly}
                placeholder="#000000"
              />
            </div>
          </div>
        </div>

        {!readOnly && (
          <div className="mt-5 flex justify-end">
            <button
              onClick={() => save.mutate()}
              disabled={!dirty || !nome || save.isPending}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {save.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              {save.isPending ? "Salvando…" : "Salvar alterações"}
            </button>
          </div>
        )}

        {readOnly && (
          <p className="mt-4 text-xs text-muted-foreground">Apenas o administrador da loja pode alterar esses dados.</p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section: Usuários
// ---------------------------------------------------------------------------

function UsuariosSection() {
  const navigate = useNavigate();
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold">Usuários</h2>
        <p className="text-sm text-muted-foreground">Gerencie os usuários da sua loja</p>
      </div>
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
              <Users className="size-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">Gerenciar Usuários</p>
              <p className="text-xs text-muted-foreground">Vendedores, gerentes e administradores</p>
            </div>
          </div>
          <button
            onClick={() => navigate({ to: "/usuarios" as never })}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Acessar <ArrowRight className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section: Integrações
// ---------------------------------------------------------------------------

function IntegracoesSection({
  integrations,
  isLoading,
  onRefresh,
}: {
  integrations: Integration[];
  isLoading: boolean;
  onRefresh: () => void;
}) {
  const [showMetaModal, setShowMetaModal] = useState(false);
  const [showWaModal, setShowWaModal]     = useState(false);

  function getInt(platform: string): Integration | null {
    return integrations.find((i) => i.platform === platform) ?? null;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold">Integrações</h2>
        <p className="text-sm text-muted-foreground">Conecte fontes externas de entrada de leads</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-36 animate-pulse rounded-2xl border border-border bg-card" />
          ))}
        </div>
      ) : (
        <>
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Alta prioridade</p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <MetaCard     integration={getInt("meta_lead_ads")} onConnect={() => setShowMetaModal(true)} onRefresh={onRefresh} />
              <WhatsAppCard integration={getInt("meta_ctwa")}     onConnect={() => setShowWaModal(true)}   onRefresh={onRefresh} />
            </div>
          </div>
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Em breve</p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <ComingSoonCard name="Webmotors" icon={<span className="text-sm font-black text-muted-foreground">WM</span>} />
              <ComingSoonCard name="OLX Autos" icon={<span className="text-sm font-black text-muted-foreground">OLX</span>} />
            </div>
          </div>
        </>
      )}

      {showMetaModal && <MetaConnectModal onClose={() => setShowMetaModal(false)} onSaved={onRefresh} />}
      {showWaModal   && <WhatsAppConnectModal onClose={() => setShowWaModal(false)} onSaved={onRefresh} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section: API
// ---------------------------------------------------------------------------

function ApiSection({
  integrations,
  isLoading,
  onRefresh,
}: {
  integrations: Integration[];
  isLoading: boolean;
  onRefresh: () => void;
}) {
  function getInt(platform: string): Integration | null {
    return integrations.find((i) => i.platform === platform) ?? null;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold">API Genérica</h2>
        <p className="text-sm text-muted-foreground">Receba leads de qualquer fonte via HTTP</p>
      </div>

      {isLoading ? (
        <div className="h-36 animate-pulse rounded-2xl border border-border bg-card" />
      ) : (
        <GenericCard integration={getInt("generic")} onRefresh={onRefresh} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section: Webhooks (log de eventos)
// ---------------------------------------------------------------------------

type EventFilter = { platform: string; status: string };

function WebhooksSection() {
  const [filter, setFilter] = useState<EventFilter>({ platform: "all", status: "all" });

  const { data: events = [], isLoading, refetch } = useQuery({
    queryKey: ["webhook-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("webhook_events_log")
        .select("id,platform,status,created_at,error_message")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as WebhookEvent[];
    },
    refetchInterval: 30000,
  });

  const filtered = events.filter((e) => {
    if (filter.platform !== "all" && e.platform !== filter.platform) return false;
    if (filter.status !== "all" && e.status !== filter.status) return false;
    return true;
  });

  const sel = "h-8 rounded-lg border border-border bg-background px-2.5 text-xs outline-none focus:border-primary/60";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Log de Webhooks</h2>
          <p className="text-sm text-muted-foreground">Histórico de eventos recebidos pelas integrações</p>
        </div>
        <button onClick={() => refetch()} className="grid size-8 place-items-center rounded-lg border border-border text-muted-foreground hover:bg-muted">
          <RefreshCw className="size-3.5" />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select value={filter.platform} onChange={(e) => setFilter((f) => ({ ...f, platform: e.target.value }))} className={sel}>
          <option value="all">Todas as plataformas</option>
          <option value="meta_lead_ads">Meta Lead Ads</option>
          <option value="meta_ctwa">WhatsApp Business</option>
          <option value="whatsapp_organic">WhatsApp Orgânico</option>
          <option value="generic">API Genérica</option>
        </select>
        <select value={filter.status} onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value }))} className={sel}>
          <option value="all">Todos os status</option>
          <option value="processed">Processados</option>
          <option value="duplicated">Duplicados</option>
          <option value="error">Erros</option>
        </select>
        {(filter.platform !== "all" || filter.status !== "all") && (
          <button onClick={() => setFilter({ platform: "all", status: "all" })} className="flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-xs text-muted-foreground hover:bg-muted">
            <X className="size-3" /> Limpar
          </button>
        )}
        <span className="ml-auto text-xs text-muted-foreground">{filtered.length} evento{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-10 animate-pulse rounded-xl bg-muted" />)}
        </div>
      ) : !filtered.length ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <CheckCircle2 className="mb-2 size-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Nenhum evento encontrado</p>
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border">
          {filtered.map((e) => (
            <li key={e.id} className="flex items-center gap-3 px-4 py-2.5 text-xs">
              <EventStatusBadge status={e.status} />
              <span className="font-medium">{platformLabel(e.platform)}</span>
              {e.error_message && <span className="truncate text-destructive">{e.error_message}</span>}
              <span className="ml-auto shrink-0 font-mono text-muted-foreground">
                {new Date(e.created_at).toLocaleString("pt-BR")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section: Automações
// ---------------------------------------------------------------------------

function AutomacoesSection() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold">Automações</h2>
        <p className="text-sm text-muted-foreground">Regras e fluxos automáticos de atendimento</p>
      </div>
      <div className="rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center">
        <Sparkles className="mx-auto mb-3 size-10 text-muted-foreground/30" />
        <p className="text-sm font-semibold text-muted-foreground">Em breve</p>
        <p className="mt-1 text-xs text-muted-foreground">Distribuição de leads, follow-ups automáticos e integrações com Chatbot/IA</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function ConfiguracoesPage() {
  const { perfil } = useAuth();
  const qc         = useQueryClient();
  const [section, setSection] = useState<Section>("loja");

  const { data: integrations = [], isLoading: intLoading } = useQuery({
    queryKey: ["integrations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_integrations")
        .select("id,platform,status,fb_page_id,waba_phone_number_id,webhook_verify_token,last_sync_at,last_error,last_error_at");
      if (error) throw error;
      return (data ?? []) as Integration[];
    },
    enabled: perfil === "admin_loja" || perfil === "gerente",
  });

  function refreshIntegrations() {
    qc.invalidateQueries({ queryKey: ["integrations"] });
    qc.invalidateQueries({ queryKey: ["webhook-events"] });
  }

  if (perfil !== "admin_loja" && perfil !== "gerente") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-8">
        <div className="text-center">
          <XCircle className="mx-auto mb-3 size-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Acesso restrito a administradores.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground">Gerencie sua loja, usuários e integrações</p>
      </div>

      {/* Mobile: horizontal scroll tabs */}
      <div className="mb-4 flex gap-1 overflow-x-auto pb-1 md:hidden">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
              section === s.id
                ? "bg-primary/10 text-primary font-semibold"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <s.icon className="size-3.5" />
            {s.label}
          </button>
        ))}
      </div>

      <div className="flex gap-6">
        {/* Desktop sidebar */}
        <nav className="hidden w-44 shrink-0 flex-col gap-0.5 md:flex">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors text-left",
                section === s.id
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <s.icon className="size-4 shrink-0" />
              {s.label}
            </button>
          ))}
        </nav>

        {/* Content */}
        <div className="min-w-0 flex-1">
          {section === "loja"        && <LojaSection perfil={perfil} />}
          {section === "usuarios"    && <UsuariosSection />}
          {section === "integracoes" && (
            <IntegracoesSection
              integrations={integrations}
              isLoading={intLoading}
              onRefresh={refreshIntegrations}
            />
          )}
          {section === "api"         && (
            <ApiSection
              integrations={integrations}
              isLoading={intLoading}
              onRefresh={refreshIntegrations}
            />
          )}
          {section === "webhooks"    && <WebhooksSection />}
          {section === "automacoes"  && <AutomacoesSection />}
        </div>
      </div>
    </div>
  );
}
