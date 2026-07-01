import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import {
  AlertCircle, Copy, RefreshCw, X, Eye, EyeOff, Zap, Globe,
  Clock, ChevronRight, Wifi, WifiOff, Loader2, XCircle,
  Building2, Activity, Sparkles, Save, ArrowRight,
  CheckCircle2, AlertTriangle, ChevronLeft,
} from "lucide-react";
import {
  salvarWhatsAppIntegracao,
  desconectarIntegracao,
  testarIntegracao,
  regenerarToken,
  ativarGeneric,
  atualizarDadosLoja,
} from "@/lib/api/integracoes.functions";
import {
  iniciarMetaOAuth,
  listarPaginasMeta,
  listarContasAnunciosMeta,
  conectarPaginaMeta,
  salvarContaAnunciosMeta,
} from "@/lib/api/meta-oauth.functions";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PageHeader } from "@/components/page-header";
import { inputCls } from "@/components/form-field";

export const Route = createFileRoute("/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações — DriverLeads" }] }),
  component: ConfiguracoesPage,
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Section = "loja" | "integracoes" | "api" | "webhooks" | "automacoes";

type Integration = {
  id: string;
  platform: string;
  status: string;
  fb_page_id: string | null;
  fb_page_name: string | null;
  fb_user_access_token: string | null;
  fb_user_token_expires_at: string | null;
  fb_ad_account_id: string | null;
  fb_ad_account_name: string | null;
  fb_webhook_subscribed_at: string | null;
  waba_phone_number_id: string | null;
  webhook_verify_token: string | null;
  last_sync_at: string | null;
  last_error: string | null;
  last_error_at: string | null;
};

type MetaPage      = { id: string; name: string; access_token: string };
type MetaAdAccount = { id: string; name: string; account_status: number };

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

// Visual status derived from DB fields
type VisualStatus = "ativo" | "atencao" | "erro" | "pendente" | "desconectado";

function getVisualStatus(integration: Integration | null): VisualStatus {
  if (!integration || integration.status === "inativo") {
    if (integration?.fb_user_access_token && !integration.fb_page_id) return "pendente";
    return "desconectado";
  }
  if (integration.status === "erro") return "erro";
  if (integration.status === "ativo") {
    if (integration.fb_user_token_expires_at) {
      const days = (new Date(integration.fb_user_token_expires_at).getTime() - Date.now()) / 86_400_000;
      if (days < 7) return "atencao";
    }
    return "ativo";
  }
  return "desconectado";
}

// ---------------------------------------------------------------------------
// Sidebar nav
// ---------------------------------------------------------------------------

const SECTIONS: Array<{ id: Section; label: string; icon: React.FC<{ className?: string }> }> = [
  { id: "loja",        label: "Dados da Loja",  icon: Building2 },
  { id: "integracoes", label: "Integrações",     icon: Zap       },
  { id: "api",         label: "API",             icon: Globe     },
  { id: "webhooks",    label: "Webhooks",        icon: Activity  },
  { id: "automacoes",  label: "Automações",      icon: Sparkles  },
];

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: VisualStatus | null }) {
  if (status === "ativo")
    return (
      <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
        <span className="size-1.5 rounded-full bg-emerald-500" />Conectado
      </span>
    );
  if (status === "atencao")
    return (
      <span className="flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-400">
        <AlertTriangle className="size-3" />Atenção
      </span>
    );
  if (status === "erro")
    return (
      <span className="flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-bold text-destructive">
        <AlertCircle className="size-3" />Erro
      </span>
    );
  if (status === "pendente")
    return (
      <span className="flex items-center gap-1 rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-bold text-sky-700 dark:text-sky-400">
        <span className="size-1.5 animate-pulse rounded-full bg-sky-500" />Pendente
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

const inp = inputCls;

// Opens Meta OAuth in a popup and resolves with the result via postMessage
function openOAuthPopup(url: string): Promise<{ status: "success" | "error" | "cancelled"; error?: string }> {
  return new Promise((resolve) => {
    const w = 620, h = 720;
    const left = Math.round(window.screenX + (window.outerWidth  - w) / 2);
    const top  = Math.round(window.screenY + (window.outerHeight - h) / 2);
    const popup = window.open(url, "meta-oauth", `width=${w},height=${h},left=${left},top=${top},popup=1`);

    function cleanup() {
      window.removeEventListener("message", onMessage);
      clearInterval(pollTimer);
    }
    function onMessage(e: MessageEvent) {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type !== "META_OAUTH") return;
      cleanup();
      resolve({ status: e.data.status, error: e.data.error });
    }
    const pollTimer = setInterval(() => {
      if (popup?.closed) { cleanup(); resolve({ status: "cancelled" }); }
    }, 500);
    window.addEventListener("message", onMessage);
  });
}

// ---------------------------------------------------------------------------
// Integration Dashboard (overview)
// ---------------------------------------------------------------------------

function IntegrationDashboard({
  integrations,
  isLoading,
  onNavigate,
}: {
  integrations: Integration[];
  isLoading: boolean;
  onNavigate: (section: Section) => void;
}) {
  const cards = [
    {
      platform:    "meta_lead_ads",
      label:       "Meta Lead Ads",
      description: "Facebook + Instagram",
      icon: (
        <svg className="size-5" viewBox="0 0 24 24" fill="#1877F2">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      ),
      iconBg:  "bg-[#1877F2]/10",
      section: "integracoes" as Section,
    },
    {
      platform:    "meta_ctwa",
      label:       "WhatsApp Business",
      description: "Click-to-WhatsApp Ads",
      icon: (
        <svg className="size-5" viewBox="0 0 24 24" fill="#25D366">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
      ),
      iconBg:  "bg-[#25D366]/10",
      section: "integracoes" as Section,
    },
    {
      platform:    "generic",
      label:       "API / Site",
      description: "Landing pages e formulários",
      icon:        <Globe className="size-5 text-primary" />,
      iconBg:      "bg-primary/10",
      section:     "api" as Section,
    },
  ];

  if (isLoading) {
    return (
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl border border-border bg-card" />)}
      </div>
    );
  }

  return (
    <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
      {cards.map((c) => {
        const integration = integrations.find((i) => i.platform === c.platform) ?? null;
        const vs          = getVisualStatus(integration);
        const subtitle    = integration?.fb_page_name
          ? integration.fb_page_name
          : integration?.waba_phone_number_id
          ? integration.waba_phone_number_id
          : integration?.status === "ativo" ? "Ativo" : null;

        return (
          <button
            key={c.platform}
            onClick={() => onNavigate(c.section)}
            className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/30 hover:bg-muted/40"
          >
            <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", c.iconBg)}>
              {c.icon}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold">{c.label}</p>
                <StatusBadge status={vs} />
              </div>
              <p className="truncate text-[11px] text-muted-foreground">
                {subtitle ?? c.description}
              </p>
            </div>
            <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5" />
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Meta Lead Ads — OAuth Wizard Card
// ---------------------------------------------------------------------------

type MetaWizardStep =
  | "disconnected"
  | "not_configured"
  | "connecting"
  | "loading_pages"
  | "select_page"
  | "loading_accounts"
  | "select_ad_account"
  | "saving"
  | "connected"
  | "error";

function MetaCard({
  integration,
  onRefresh,
}: {
  integration: Integration | null;
  onRefresh: () => void;
}) {
  const qc  = useQueryClient();
  const vs  = getVisualStatus(integration);

  function deriveBaseStep(): MetaWizardStep {
    if (!integration || integration.status === "inativo") {
      if (integration?.fb_user_access_token && !integration.fb_page_id) return "select_page";
      return "disconnected";
    }
    if (integration.status === "erro")  return "error";
    if (integration.status === "ativo") return "connected";
    return "disconnected";
  }

  const [step, setStep]               = useState<MetaWizardStep>(deriveBaseStep);
  const [pages, setPages]             = useState<MetaPage[]>([]);
  const [adAccounts, setAdAccts]      = useState<MetaAdAccount[]>([]);
  const [selPage, setSelPage]         = useState<MetaPage | null>(null);
  const [selAcct, setSelAcct]         = useState<MetaAdAccount | null>(null);
  const [testMsg, setTestMsg]         = useState<{ ok: boolean; msg: string } | null>(null);
  const [showDisconnect, setShowDisc] = useState(false);
  const isMounted = useRef(true);
  useEffect(() => { isMounted.current = true; return () => { isMounted.current = false; }; }, []);

  // Sync step when integration changes from outside (disconnect / refetch → connected)
  useEffect(() => {
    const base = deriveBaseStep();
    if (base === "connected" || base === "error" || base === "disconnected") {
      setStep(base);
    }
    if (base === "select_page" && step === "disconnected") {
      setStep("select_page");
      loadPages();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [integration?.status, integration?.fb_page_id, integration?.fb_user_access_token]);

  async function loadPages() {
    setStep("loading_pages");
    try {
      const { pages: p } = await listarPaginasMeta({ data: undefined });
      if (!isMounted.current) return;
      setPages(p);
      setStep("select_page");
    } catch (e) {
      if (!isMounted.current) return;
      toast.error(e instanceof Error ? e.message : "Erro ao carregar páginas");
      setStep("disconnected");
    }
  }

  async function handleConnect() {
    setStep("connecting");
    try {
      const { url } = await iniciarMetaOAuth({ data: undefined });
      const result  = await openOAuthPopup(url);
      if (!isMounted.current) return;
      if (result.status === "success") {
        onRefresh();
        await loadPages();
      } else if (result.status === "error") {
        toast.error(result.error ?? "Erro na autenticação Facebook");
        setStep("disconnected");
      } else {
        setStep("disconnected");
      }
    } catch (e) {
      if (!isMounted.current) return;
      const msg = e instanceof Error ? e.message : "Erro ao iniciar OAuth";
      if (msg.toLowerCase().includes("não configurado") || msg.toLowerCase().includes("nao configurado")) {
        setStep("not_configured");
      } else {
        toast.error(msg);
        setStep("disconnected");
      }
    }
  }

  async function handleSelectPage(page: MetaPage) {
    setSelPage(page);
    setStep("loading_accounts");
    try {
      const { accounts } = await listarContasAnunciosMeta({ data: undefined });
      if (!isMounted.current) return;
      setAdAccts(accounts);
      setStep("select_ad_account");
    } catch {
      // Contas de anúncios são opcionais
      if (!isMounted.current) return;
      await handleSave(page, null);
    }
  }

  async function handleSave(page: MetaPage, account: MetaAdAccount | null) {
    setStep("saving");
    try {
      await conectarPaginaMeta({ data: { page_id: page.id, page_access_token: page.access_token, page_name: page.name } });
      if (account) {
        await salvarContaAnunciosMeta({ data: { ad_account_id: account.id, ad_account_name: account.name } });
      }
      toast.success(`Meta Lead Ads conectado: ${page.name}`);
      onRefresh();
      qc.invalidateQueries({ queryKey: ["integrations"] });
    } catch (e) {
      if (!isMounted.current) return;
      toast.error(e instanceof Error ? e.message : "Erro ao ativar integração");
      setStep("select_page");
    }
  }

  const disconnect = useMutation({
    mutationFn: () => desconectarIntegracao({ data: { platform: "meta_lead_ads" } }),
    onSuccess: () => { toast.success("Meta Lead Ads desconectado"); setStep("disconnected"); onRefresh(); },
    onError:   (e: Error) => toast.error(e.message),
  });

  const test = useMutation({
    mutationFn: () => testarIntegracao({ data: { platform: "meta_lead_ads" } }),
    onSuccess: (res) => { setTestMsg({ ok: true,  msg: res.detail }); qc.invalidateQueries({ queryKey: ["integrations"] }); },
    onError:   (e: Error) => { setTestMsg({ ok: false, msg: e.message }); },
  });

  // ── Render ──

  if (step === "disconnected" || step === "connecting") {
    return (
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-border p-5">
          <div className="flex size-10 items-center justify-center rounded-xl bg-[#1877F2]/10">
            <svg className="size-5" viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold">Meta Lead Ads</p>
            <p className="text-xs text-muted-foreground">Facebook + Instagram</p>
          </div>
          <StatusBadge status="desconectado" />
        </div>
        {/* Body */}
        <div className="p-5">
          <p className="mb-4 text-sm text-muted-foreground">
            Conecte sua conta do Facebook para receber leads de todos os seus anúncios automaticamente, sem configurar campanha por campanha.
          </p>
          <ul className="mb-5 space-y-2">
            {[
              "Login seguro via OAuth — sem inserir tokens manualmente",
              "Todos os formulários da Página capturam leads automaticamente",
              "Atribuição de campanha, conjunto e anúncio em cada lead",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2 text-xs text-muted-foreground">
                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />
                {item}
              </li>
            ))}
          </ul>
          <button
            onClick={handleConnect}
            disabled={step === "connecting"}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#1877F2] text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {step === "connecting"
              ? <><Loader2 className="size-4 animate-spin" />Abrindo Facebook…</>
              : <><svg className="size-4" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>Continuar com Facebook</>
            }
          </button>
        </div>
      </div>
    );
  }

  if (step === "not_configured") {
    return (
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex items-center gap-3 border-b border-border p-5">
          <div className="flex size-10 items-center justify-center rounded-xl bg-[#1877F2]/10">
            <svg className="size-5" viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold">Meta Lead Ads</p>
            <p className="text-xs text-muted-foreground">Facebook + Instagram</p>
          </div>
          <span className="flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-400">
            <AlertTriangle className="size-3" />Pendente configuração
          </span>
        </div>
        <div className="p-5">
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-900/20">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                Integração não configurada
              </p>
              <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">
                Esta integração ainda não foi configurada pelo administrador da plataforma. As variáveis de ambiente
                <code className="mx-1 rounded bg-amber-100 px-1 py-0.5 font-mono text-[10px] dark:bg-amber-900/40">META_APP_ID</code>
                e
                <code className="mx-1 rounded bg-amber-100 px-1 py-0.5 font-mono text-[10px] dark:bg-amber-900/40">META_OAUTH_REDIRECT_URI</code>
                precisam ser definidas no painel da DriverLeads antes de usar esta funcionalidade.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href="mailto:suporte@driverleads.com.br?subject=Configuração Meta Ads OAuth"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Entrar em contato com o suporte
            </a>
            <button
              onClick={() => setStep("disconnected")}
              className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-sm text-muted-foreground hover:bg-muted"
            >
              Voltar
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === "loading_pages") {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-card p-10 shadow-sm">
        <Loader2 className="size-6 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Carregando suas Páginas do Facebook…</p>
      </div>
    );
  }

  if (step === "select_page") {
    return (
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex items-center gap-3 border-b border-border p-4">
          <button onClick={() => setStep("disconnected")} className="grid size-7 place-items-center rounded-lg text-muted-foreground hover:bg-muted">
            <ChevronLeft className="size-4" />
          </button>
          <div>
            <p className="text-sm font-semibold">Selecione a Página da loja</p>
            <p className="text-xs text-muted-foreground">Passo 1 de 2</p>
          </div>
          <span className="ml-auto rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold text-primary">1/2</span>
        </div>
        {pages.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-sm text-muted-foreground">Nenhuma Página encontrada na sua conta.</p>
            <p className="mt-1 text-xs text-muted-foreground">Certifique-se de que você é Administrador da Página no Facebook.</p>
            <button onClick={() => setStep("disconnected")} className="mt-4 text-xs font-semibold text-primary hover:underline">
              Voltar e tentar novamente
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {pages.map((page) => (
              <li key={page.id}>
                <button
                  onClick={() => handleSelectPage(page)}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/60"
                >
                  <div className="flex size-9 items-center justify-center rounded-full bg-[#1877F2]/10 text-[11px] font-black text-[#1877F2]">
                    {page.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{page.name}</p>
                    <p className="font-mono text-[10px] text-muted-foreground">{page.id}</p>
                  </div>
                  <ChevronRight className="size-4 text-muted-foreground/50" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  if (step === "loading_accounts") {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-card p-10 shadow-sm">
        <Loader2 className="size-6 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Carregando Contas de Anúncios…</p>
      </div>
    );
  }

  if (step === "select_ad_account") {
    return (
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex items-center gap-3 border-b border-border p-4">
          <button onClick={() => { setSelAcct(null); setStep("select_page"); }} className="grid size-7 place-items-center rounded-lg text-muted-foreground hover:bg-muted">
            <ChevronLeft className="size-4" />
          </button>
          <div>
            <p className="text-sm font-semibold">Conta de Anúncios <span className="text-muted-foreground">(opcional)</span></p>
            <p className="text-xs text-muted-foreground">Página: {selPage?.name}</p>
          </div>
          <span className="ml-auto rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold text-primary">2/2</span>
        </div>
        <div className="p-4">
          <p className="mb-3 text-xs text-muted-foreground">
            Selecionar a conta de anúncios permite enriquecer a atribuição de campanha. Você pode pular esta etapa e configurar depois.
          </p>
          {adAccounts.length > 0 && (
            <ul className="mb-3 divide-y divide-border overflow-hidden rounded-xl border border-border">
              {adAccounts.map((acct) => (
                <li key={acct.id}>
                  <button
                    onClick={() => { setSelAcct(acct); handleSave(selPage!, acct); }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{acct.name}</p>
                      <p className="font-mono text-[10px] text-muted-foreground">{acct.id}</p>
                    </div>
                    <ChevronRight className="size-4 text-muted-foreground/50" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button
            onClick={() => handleSave(selPage!, null)}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/60"
          >
            Pular esta etapa <ArrowRight className="size-3.5" />
          </button>
        </div>
      </div>
    );
  }

  if (step === "saving") {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-card p-10 shadow-sm">
        <Loader2 className="size-6 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Ativando integração…</p>
      </div>
    );
  }

  // connected / error / atencao states
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 p-5">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-[#1877F2]/10">
            <svg className="size-5" viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
          </div>
          <div>
            <p className="text-sm font-semibold">Meta Lead Ads</p>
            <p className="text-xs text-muted-foreground">Facebook + Instagram</p>
          </div>
        </div>
        <StatusBadge status={vs} />
      </div>

      {/* Error banner */}
      {integration?.last_error && (
        <div className="mx-5 mb-1 flex items-start gap-2 rounded-xl bg-destructive/10 p-3 text-xs text-destructive">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" />{integration.last_error}
        </div>
      )}

      {/* Attention banner */}
      {vs === "atencao" && integration?.fb_user_token_expires_at && (
        <div className="mx-5 mb-1 flex items-start gap-2 rounded-xl bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          Token do Facebook expira em{" "}
          {Math.ceil((new Date(integration.fb_user_token_expires_at).getTime() - Date.now()) / 86_400_000)} dias.
          Reconecte para renovar.
        </div>
      )}

      {/* Info */}
      <div className="space-y-1 px-5 pb-1 text-xs text-muted-foreground">
        {integration?.fb_page_name && (
          <p>Página: <span className="font-semibold text-foreground">{integration.fb_page_name}</span></p>
        )}
        {integration?.fb_ad_account_name && (
          <p>Conta de anúncios: <span className="font-semibold text-foreground">{integration.fb_ad_account_name}</span></p>
        )}
        {integration?.fb_webhook_subscribed_at && (
          <p>Webhook ativado em: {new Date(integration.fb_webhook_subscribed_at).toLocaleString("pt-BR")}</p>
        )}
        {integration?.last_sync_at && (
          <p className="flex items-center gap-1"><Clock className="size-3" />Último lead: {new Date(integration.last_sync_at).toLocaleString("pt-BR")}</p>
        )}
      </div>

      {/* Test result */}
      {testMsg && (
        <div className={cn("mx-5 mt-3 flex items-center gap-2 rounded-xl p-2.5 text-xs",
          testMsg.ok ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-destructive/10 text-destructive",
        )}>
          {testMsg.ok ? <CheckCircle2 className="size-3.5" /> : <AlertCircle className="size-3.5" />}
          {testMsg.msg}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2 p-5 pt-4">
        <button
          onClick={() => { setTestMsg(null); test.mutate(); }}
          disabled={test.isPending}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium hover:bg-muted disabled:opacity-60"
        >
          {test.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Wifi className="size-3.5" />}
          Testar conexão
        </button>
        <button
          onClick={handleConnect}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium hover:bg-muted"
        >
          <RefreshCw className="size-3.5" /> Reconectar
        </button>
        <button
          onClick={() => setShowDisc(true)}
          disabled={disconnect.isPending}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-destructive/40 px-3 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-60"
        >
          {disconnect.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <WifiOff className="size-3.5" />}
          Desconectar
        </button>
      </div>

      <ConfirmDialog
        open={showDisconnect}
        onOpenChange={setShowDisc}
        title="Desconectar Meta Lead Ads?"
        description="Os leads existentes não serão afetados. Você pode reconectar a qualquer momento."
        confirmLabel="Desconectar"
        variant="danger"
        isPending={disconnect.isPending}
        onConfirm={() => disconnect.mutate()}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// WhatsApp Business Card (manual — OAuth em roadmap)
// ---------------------------------------------------------------------------

function WhatsAppCard({
  integration,
  onConnect,
  onRefresh,
}: {
  integration: Integration | null;
  onConnect: () => void;
  onRefresh: () => void;
}) {
  const qc  = useQueryClient();
  const vs  = getVisualStatus(integration);
  const [testMsg, setTestMsg]   = useState<{ ok: boolean; msg: string } | null>(null);
  const [showDisconnect, setShowDisc] = useState(false);

  const disconnect = useMutation({
    mutationFn: () => desconectarIntegracao({ data: { platform: "meta_ctwa" } }),
    onSuccess: () => { toast.success("WhatsApp Business desconectado"); onRefresh(); },
    onError:   (e: Error) => toast.error(e.message),
  });

  const test = useMutation({
    mutationFn: () => testarIntegracao({ data: { platform: "meta_ctwa" } }),
    onSuccess: (res) => { setTestMsg({ ok: true, msg: res.detail }); qc.invalidateQueries({ queryKey: ["integrations"] }); },
    onError:   (e: Error) => setTestMsg({ ok: false, msg: e.message }),
  });

  const isActive = integration?.status === "ativo";

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex items-start justify-between gap-3 p-5">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-[#25D366]/10">
            <svg className="size-5" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
          </div>
          <div>
            <p className="text-sm font-semibold">WhatsApp Business</p>
            <p className="text-xs text-muted-foreground">Click-to-WhatsApp Ads</p>
          </div>
        </div>
        <StatusBadge status={vs} />
      </div>

      {integration?.last_error && (
        <div className="mx-5 mb-1 flex items-start gap-2 rounded-xl bg-destructive/10 p-2.5 text-xs text-destructive">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" />{integration.last_error}
        </div>
      )}

      {isActive && integration?.waba_phone_number_id && (
        <div className="space-y-1 px-5 pb-1 text-xs text-muted-foreground">
          <p>Phone Number ID: <span className="font-mono">{integration.waba_phone_number_id}</span></p>
          {integration.last_sync_at && (
            <p className="flex items-center gap-1"><Clock className="size-3" />Último lead: {new Date(integration.last_sync_at).toLocaleString("pt-BR")}</p>
          )}
        </div>
      )}

      {testMsg && (
        <div className={cn("mx-5 mt-1 flex items-center gap-2 rounded-xl p-2.5 text-xs",
          testMsg.ok ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-destructive/10 text-destructive",
        )}>
          {testMsg.ok ? <CheckCircle2 className="size-3.5" /> : <AlertCircle className="size-3.5" />}
          {testMsg.msg}
        </div>
      )}

      <div className="flex flex-wrap gap-2 p-5 pt-4">
        {isActive ? (
          <>
            <button onClick={() => { setTestMsg(null); test.mutate(); }} disabled={test.isPending} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium hover:bg-muted disabled:opacity-60">
              {test.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Wifi className="size-3.5" />} Testar conexão
            </button>
            <button onClick={() => setShowDisc(true)} disabled={disconnect.isPending} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-destructive/40 px-3 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-60">
              {disconnect.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <WifiOff className="size-3.5" />} Desconectar
            </button>
          </>
        ) : (
          <button onClick={onConnect} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90">
            <Zap className="size-3.5" /> Conectar
          </button>
        )}
      </div>

      <ConfirmDialog
        open={showDisconnect}
        onOpenChange={setShowDisc}
        title="Desconectar WhatsApp Business?"
        description="Os leads existentes não serão afetados. Você pode reconectar a qualquer momento."
        confirmLabel="Desconectar"
        variant="danger"
        isPending={disconnect.isPending}
        onConfirm={() => disconnect.mutate()}
      />
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
// WhatsApp manual connect modal
// ---------------------------------------------------------------------------

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
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
// API Genérica card
// ---------------------------------------------------------------------------

function GenericCard({ integration, onRefresh }: { integration: Integration | null; onRefresh: () => void }) {
  const [showToken, setShowToken]   = useState(false);
  const [showRegen, setShowRegen]   = useState(false);
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
  const displayToken = showToken ? token : (token ? token.slice(0, 8) + "•••••••••••••••" : "");

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
        <StatusBadge status={integration ? "ativo" : "desconectado"} />
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
              <button onClick={() => copyToClipboard(webhookUrl, "URL copiada!")} className="grid size-8 shrink-0 place-items-center rounded-lg border border-border hover:bg-muted"><Copy className="size-3.5" /></button>
            </div>
          </div>
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">X-DL-Token (autenticação)</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded-lg bg-muted px-2.5 py-1.5 font-mono text-xs">{displayToken}</code>
              <button onClick={() => setShowToken((v) => !v)} className="grid size-8 shrink-0 place-items-center rounded-lg border border-border hover:bg-muted">{showToken ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}</button>
              <button onClick={() => copyToClipboard(token, "Token copiado!")} className="grid size-8 shrink-0 place-items-center rounded-lg border border-border hover:bg-muted"><Copy className="size-3.5" /></button>
              <button onClick={() => setShowRegen(true)} disabled={regen.isPending} className="grid size-8 shrink-0 place-items-center rounded-lg border border-border hover:bg-muted disabled:opacity-60">
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

      <ConfirmDialog
        open={showRegen}
        onOpenChange={setShowRegen}
        title="Regenerar token?"
        description="O token atual deixará de funcionar imediatamente. Atualize todas as integrações que o utilizam."
        confirmLabel="Regenerar"
        variant="danger"
        isPending={regen.isPending}
        onConfirm={() => regen.mutate()}
      />
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
      const { data, error } = await supabase.from("tenants").select("id,nome,logo_url,cor_primaria").single();
      if (error) throw error;
      return data as TenantInfo;
    },
  });

  const [nome, setNome]               = useState("");
  const [logoUrl, setLogoUrl]         = useState("");
  const [corPrimaria, setCorPrimaria] = useState("");
  const [dirty, setDirty]             = useState(false);

  useEffect(() => {
    if (tenant) { setNome(tenant.nome ?? ""); setLogoUrl(tenant.logo_url ?? ""); setCorPrimaria(tenant.cor_primaria ?? ""); setDirty(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant?.id]);

  const save = useMutation({
    mutationFn: () => atualizarDadosLoja({ data: { nome, logo_url: logoUrl || null, cor_primaria: corPrimaria || null } }),
    onSuccess: () => { toast.success("Dados salvos com sucesso"); setDirty(false); qc.invalidateQueries({ queryKey: ["tenant-info"] }); },
    onError:   (e: Error) => toast.error(e.message),
  });

  const readOnly = perfil !== "admin_loja";

  if (isLoading) return <div className="space-y-4">{[0,1,2].map((i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-muted" />)}</div>;

  return (
    <div className="space-y-6">
      <div><h2 className="text-base font-semibold">Dados da Loja</h2><p className="text-sm text-muted-foreground">Informações básicas da sua concessionária</p></div>
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nome da loja</label>
            <input value={nome} onChange={(e) => { setNome(e.target.value); setDirty(true); }} className={inp} disabled={readOnly} placeholder="Ex: Loja ABC Veículos" />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Logo URL</label>
            <input value={logoUrl} onChange={(e) => { setLogoUrl(e.target.value); setDirty(true); }} className={inp} disabled={readOnly} placeholder="https://..." />
            {logoUrl && <img src={logoUrl} alt="Logo" className="mt-2 h-10 rounded object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />}
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cor primária</label>
            <div className="flex items-center gap-3">
              <input type="color" value={corPrimaria || "#000000"} onChange={(e) => { setCorPrimaria(e.target.value); setDirty(true); }} disabled={readOnly} className="h-10 w-14 cursor-pointer rounded-lg border border-border bg-background p-0.5 disabled:cursor-not-allowed disabled:opacity-50" />
              <input value={corPrimaria} onChange={(e) => { setCorPrimaria(e.target.value); setDirty(true); }} className={cn(inp, "flex-1")} disabled={readOnly} placeholder="#000000" />
            </div>
          </div>
        </div>
        {!readOnly && (
          <div className="mt-5 flex justify-end">
            <button onClick={() => save.mutate()} disabled={!dirty || !nome || save.isPending} className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
              {save.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              {save.isPending ? "Salvando…" : "Salvar alterações"}
            </button>
          </div>
        )}
        {readOnly && <p className="mt-4 text-xs text-muted-foreground">Apenas o administrador da loja pode alterar esses dados.</p>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section: Usuários
// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// Section: Integrações
// ---------------------------------------------------------------------------

function IntegracoesSection({
  integrations,
  isLoading,
  onRefresh,
  onNavigate,
}: {
  integrations: Integration[];
  isLoading: boolean;
  onRefresh: () => void;
  onNavigate: (s: Section) => void;
}) {
  const [showWaModal, setShowWaModal] = useState(false);

  function getInt(platform: string): Integration | null {
    return integrations.find((i) => i.platform === platform) ?? null;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold">Integrações</h2>
        <p className="text-sm text-muted-foreground">Conecte fontes externas de entrada de leads</p>
      </div>

      <IntegrationDashboard integrations={integrations} isLoading={isLoading} onNavigate={onNavigate} />

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {[0,1,2,3].map((i) => <div key={i} className="h-44 animate-pulse rounded-2xl border border-border bg-card" />)}
        </div>
      ) : (
        <>
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Canais ativos</p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <MetaCard     integration={getInt("meta_lead_ads")} onRefresh={onRefresh} />
              <WhatsAppCard integration={getInt("meta_ctwa")}     onConnect={() => setShowWaModal(true)} onRefresh={onRefresh} />
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

      {showWaModal && <WhatsAppConnectModal onClose={() => setShowWaModal(false)} onSaved={onRefresh} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section: API
// ---------------------------------------------------------------------------

function ApiSection({ integrations, isLoading, onRefresh }: { integrations: Integration[]; isLoading: boolean; onRefresh: () => void }) {
  return (
    <div className="space-y-6">
      <div><h2 className="text-base font-semibold">API Genérica</h2><p className="text-sm text-muted-foreground">Receba leads de qualquer fonte via HTTP</p></div>
      {isLoading ? (
        <div className="h-36 animate-pulse rounded-2xl border border-border bg-card" />
      ) : (
        <GenericCard integration={integrations.find((i) => i.platform === "generic") ?? null} onRefresh={onRefresh} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section: Webhooks (log)
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
    refetchInterval: 30_000,
  });

  const filtered = events.filter((e) => {
    if (filter.platform !== "all" && e.platform !== filter.platform) return false;
    if (filter.status   !== "all" && e.status   !== filter.status)   return false;
    return true;
  });

  const activeFilters = (filter.platform !== "all" ? 1 : 0) + (filter.status !== "all" ? 1 : 0);
  const sel = "h-8 rounded-lg border border-border bg-background px-2.5 text-xs outline-none focus:border-primary/60";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div><h2 className="text-base font-semibold">Log de Webhooks</h2><p className="text-sm text-muted-foreground">Histórico de eventos recebidos pelas integrações</p></div>
        <button onClick={() => refetch()} className="grid size-8 place-items-center rounded-lg border border-border text-muted-foreground hover:bg-muted"><RefreshCw className="size-3.5" /></button>
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
        {activeFilters > 0 && (
          <button onClick={() => setFilter({ platform: "all", status: "all" })} className="flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-xs text-muted-foreground hover:bg-muted">
            <X className="size-3" /> Limpar
            <span className="ml-0.5 rounded-full bg-primary/15 px-1.5 py-px text-[9px] font-bold text-primary">{activeFilters}</span>
          </button>
        )}
        <span className="ml-auto text-xs text-muted-foreground">{filtered.length} evento{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[0,1,2,3,4].map((i) => <div key={i} className="h-10 animate-pulse rounded-xl bg-muted" />)}</div>
      ) : !filtered.length ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <CheckCircle2 className="mb-2 size-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Nenhum evento encontrado</p>
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border">
          {filtered.map((e) => (
            <li key={e.id} className={cn(
              "flex items-center gap-3 px-4 py-2.5 text-xs",
              e.status === "error" && "bg-destructive/5",
            )}>
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
      <div><h2 className="text-base font-semibold">Automações</h2><p className="text-sm text-muted-foreground">Regras e fluxos automáticos de atendimento</p></div>
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
        .select("id,platform,status,fb_page_id,fb_page_name,fb_user_access_token,fb_user_token_expires_at,fb_ad_account_id,fb_ad_account_name,fb_webhook_subscribed_at,waba_phone_number_id,webhook_verify_token,last_sync_at,last_error,last_error_at");
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
      <PageHeader
        title="Configurações"
        subtitle="Gerencie sua loja, usuários e integrações"
      />

      {/* Mobile tabs */}
      <div className="mb-4 flex gap-1 overflow-x-auto pb-1 md:hidden">
        {SECTIONS.map((s) => (
          <button key={s.id} onClick={() => setSection(s.id)} className={cn("flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors", section === s.id ? "bg-primary/10 text-primary font-semibold" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
            <s.icon className="size-3.5" />{s.label}
          </button>
        ))}
      </div>

      <div className="flex gap-6">
        {/* Desktop sidebar */}
        <nav className="hidden w-52 shrink-0 flex-col gap-0.5 md:flex">
          {SECTIONS.map((s) => (
            <button key={s.id} onClick={() => setSection(s.id)} className={cn("flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-sm font-medium text-left transition-colors", section === s.id ? "bg-primary/10 text-primary font-semibold" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
              <s.icon className="size-4 shrink-0" />{s.label}
            </button>
          ))}
        </nav>

        {/* Content */}
        <div className="min-w-0 flex-1">
          {section === "loja"        && <LojaSection perfil={perfil} />}
          {section === "integracoes" && (
            <IntegracoesSection
              integrations={integrations}
              isLoading={intLoading}
              onRefresh={refreshIntegrations}
              onNavigate={setSection}
            />
          )}
          {section === "api"         && <ApiSection integrations={integrations} isLoading={intLoading} onRefresh={refreshIntegrations} />}
          {section === "webhooks"    && <WebhooksSection />}
          {section === "automacoes"  && <AutomacoesSection />}
        </div>
      </div>
    </div>
  );
}
