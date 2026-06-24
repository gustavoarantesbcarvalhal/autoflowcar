import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  criarTenantComAdmin,
  atualizarTenant,
  bloquearTenant,
  desbloquearTenant,
  arquivarTenant,
  reativarTenant,
  excluirTenant,
  diagnosarServidor,
} from "@/lib/api/admin.functions";
import type { Tables } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";
import {
  Building2, CheckCircle2, AlertCircle, Archive,
  LogOut, Plus, Pencil, Lock, Unlock, Loader2,
  X, Trash2, RotateCcw,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

type Tenant = Tables<"tenants">;
type FilterTab = "todas" | "ativo" | "inativo" | "bloqueado";

// ============================================================
// Helpers
// ============================================================

const STATUS_LABELS: Record<string, string> = {
  ativo:     "Ativa",
  inativo:   "Arquivada",
  bloqueado: "Bloqueada",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
      status === "ativo"     && "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
      status === "inativo"   && "bg-muted text-muted-foreground",
      status === "bloqueado" && "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    )}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

const inputCls =
  "h-10 w-full rounded-md border border-border bg-surface px-3 text-sm outline-none transition-colors focus:border-primary/60 focus:ring-2 focus:ring-primary/20";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium">{label}</label>
      {children}
    </div>
  );
}

// ============================================================
// Modal criar / editar tenant
// ============================================================

function TenantModal({ tenant, onClose, onSuccess }: {
  tenant?: Tenant | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const isEdit = !!tenant;
  const qc = useQueryClient();
  const [nome, setNome] = useState(tenant?.nome ?? "");
  const [emailAdmin, setEmailAdmin] = useState(tenant?.email_admin ?? "");
  const [nomeAdmin, setNomeAdmin] = useState("");
  const [plano, setPlano] = useState<"starter" | "pro" | "white_label">(tenant?.plano ?? "starter");
  const [senha, setSenha] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (isEdit && tenant) {
        await atualizarTenant({ data: { id: tenant.id, nome, email_admin: emailAdmin, plano } });
        toast.success("Loja atualizada");
      } else {
        await criarTenantComAdmin({ data: { nome, email_admin: emailAdmin, nome_admin: nomeAdmin, plano, senha_temporaria: senha } });
        toast.success("Loja criada");
      }
      qc.invalidateQueries({ queryKey: ["admin-tenants"] });
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-semibold">{isEdit ? "Editar loja" : "Nova loja"}</h2>
          <button onClick={onClose} className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted">
            <X className="size-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          {error && (
            <div className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />{error}
            </div>
          )}
          <Field label="Nome da loja">
            <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: DriverLeads Campinas" required className={inputCls} />
          </Field>
          <Field label="E-mail do admin">
            <input type="email" value={emailAdmin} onChange={(e) => setEmailAdmin(e.target.value)} placeholder="admin@loja.com" required className={inputCls} />
          </Field>
          {!isEdit && (
            <>
              <Field label="Nome do admin">
                <input value={nomeAdmin} onChange={(e) => setNomeAdmin(e.target.value)} placeholder="João Silva" required className={inputCls} />
              </Field>
              <Field label="Senha temporária">
                <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Mínimo 8 caracteres" required minLength={8} className={inputCls} />
              </Field>
            </>
          )}
          <Field label="Plano">
            <select value={plano} onChange={(e) => setPlano(e.target.value as "starter" | "pro" | "white_label")} className={inputCls}>
              <option value="starter">Starter</option>
              <option value="pro">Pro</option>
              <option value="white_label">White Label</option>
            </select>
          </Field>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 rounded-md border border-border py-2 text-sm font-medium hover:bg-muted">Cancelar</button>
            <button type="submit" disabled={submitting} className="flex flex-1 items-center justify-center gap-2 rounded-md bg-primary py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
              {submitting && <Loader2 className="size-4 animate-spin" />}
              {isEdit ? "Salvar" : "Criar loja"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================
// Modal exclusão permanente
// ============================================================

function DeleteModal({ tenant, onClose, onConfirm, isPending }: {
  tenant: Tenant;
  onClose: () => void;
  onConfirm: (nomeConfirmado: string) => void;
  isPending: boolean;
}) {
  const [input, setInput] = useState("");
  const match = input.trim() === tenant.nome.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-xl border border-destructive/30 bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-semibold text-destructive">Excluir loja permanentemente</h2>
          <button onClick={onClose} className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted">
            <X className="size-4" />
          </button>
        </div>
        <div className="space-y-4 p-5">
          <p className="text-sm text-muted-foreground">
            Esta ação é <strong className="text-foreground">irreversível</strong>. Todos os leads, veículos, interações e usuários da loja serão excluídos permanentemente.
          </p>
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Digite <span className="font-mono text-destructive">{tenant.nome}</span> para confirmar:
            </label>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={tenant.nome}
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-destructive/60 focus:ring-2 focus:ring-destructive/20"
              autoFocus
            />
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 rounded-md border border-border py-2 text-sm font-medium hover:bg-muted">Cancelar</button>
            <button
              onClick={() => onConfirm(input)}
              disabled={!match || isPending}
              className="flex flex-1 items-center justify-center gap-2 rounded-md bg-destructive py-2 text-sm font-semibold text-destructive-foreground hover:bg-destructive/90 disabled:opacity-40"
            >
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Excluir permanentemente
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Metric card
// ============================================================

function MetricCard({ label, value, icon: Icon, color }: {
  label: string; value: number; icon: React.ElementType; color: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <div className={cn("grid size-8 place-items-center rounded-lg", color)}>
          <Icon className="size-4" />
        </div>
      </div>
      <p className="mt-3 text-3xl font-bold">{value}</p>
    </div>
  );
}

// ============================================================
// AdminPage
// ============================================================

function AdminPage() {
  const { user, isSuperAdmin, loading, nome, signOut } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [deletingTenant, setDeletingTenant] = useState<Tenant | null>(null);
  const [filterTab, setFilterTab] = useState<FilterTab>("todas");
  const [diagResult, setDiagResult] = useState<Record<string, string | boolean> | null>(null);
  const [diagLoading, setDiagLoading] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user || !isSuperAdmin) navigate({ to: "/" });
  }, [loading, user, isSuperAdmin, navigate]);

  const { data: tenants = [], isLoading } = useQuery({
    queryKey: ["admin-tenants"],
    enabled: isSuperAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Tenant[];
    },
  });

  // ── Mutations ──────────────────────────────────────────────

  function makeMutation<T>(fn: (vars: T) => Promise<unknown>, msgs: { ok: string; err?: string }) {
    return useMutation({
      mutationFn: fn,
      onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-tenants"] }); toast.success(msgs.ok); },
      onError: (err: unknown) => toast.error(err instanceof Error ? err.message : (msgs.err ?? "Erro")),
    });
  }

  const bloquear   = makeMutation((id: string) => bloquearTenant({ data: { id } }),    { ok: "Loja bloqueada" });
  const desbloquear= makeMutation((id: string) => desbloquearTenant({ data: { id } }), { ok: "Loja desbloqueada" });
  const arquivar   = makeMutation((id: string) => arquivarTenant({ data: { id } }),    { ok: "Loja arquivada" });
  const reativar   = makeMutation((id: string) => reativarTenant({ data: { id } }),    { ok: "Loja reativada" });
  const excluir    = useMutation({
    mutationFn: ({ id, nome_confirmado }: { id: string; nome_confirmado: string }) =>
      excluirTenant({ data: { id, nome_confirmado } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-tenants"] });
      setDeletingTenant(null);
      toast.success("Loja excluída permanentemente");
    },
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : "Erro ao excluir"),
  });

  // ── Filtros ────────────────────────────────────────────────

  const filtered = filterTab === "todas" ? tenants : tenants.filter((t) => t.status === filterTab);

  const metrics = {
    total:     tenants.length,
    ativas:    tenants.filter((t) => t.status === "ativo").length,
    arquivadas: tenants.filter((t) => t.status === "inativo").length,
    bloqueadas: tenants.filter((t) => t.status === "bloqueado").length,
  };

  const TABS: { id: FilterTab; label: string; count: number }[] = [
    { id: "todas",     label: "Todas",     count: metrics.total },
    { id: "ativo",     label: "Ativas",    count: metrics.ativas },
    { id: "inativo",   label: "Arquivadas", count: metrics.arquivadas },
    { id: "bloqueado", label: "Bloqueadas", count: metrics.bloqueadas },
  ];

  if (loading || !isSuperAdmin) {
    return <div className="flex min-h-screen items-center justify-center bg-surface"><Loader2 className="size-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="min-h-screen bg-surface text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="grid size-7 place-items-center rounded bg-primary">
            <div className="size-3 rotate-45 bg-primary-foreground" />
          </div>
          <span className="font-bold tracking-tight">DRIVERLEADS</span>
          <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
            Super Admin
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-muted-foreground sm:block">{nome}</span>
          <button
            disabled={diagLoading}
            onClick={async () => {
              setDiagLoading(true);
              try { setDiagResult(await diagnosarServidor() as Record<string, string | boolean>); }
              catch (e) { setDiagResult({ erro: e instanceof Error ? e.message : String(e) }); }
              finally { setDiagLoading(false); }
            }}
            className="rounded-md px-3 py-1.5 text-xs font-mono text-muted-foreground hover:bg-amber-100 hover:text-amber-800"
          >
            {diagLoading ? "..." : "diag"}
          </button>
          <button
            disabled={loggingOut}
            onClick={async () => { setLoggingOut(true); try { await signOut(); } finally { setLoggingOut(false); } }}
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-60"
          >
            {loggingOut ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}
            {loggingOut ? "Saindo…" : "Sair"}
          </button>
        </div>
      </header>

      {diagResult && (
        <div className="mx-auto max-w-6xl px-4 pt-4">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-700">Diagnóstico</span>
              <button onClick={() => setDiagResult(null)} className="text-xs text-amber-600 hover:underline">fechar</button>
            </div>
            <pre className="overflow-x-auto text-xs text-amber-900 dark:text-amber-200">{JSON.stringify(diagResult, null, 2)}</pre>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-6xl px-4 py-8">
        {/* Page header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Painel de Lojas</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">Gerencie todas as lojas da plataforma</p>
          </div>
          <button
            onClick={() => { setEditingTenant(null); setModalOpen(true); }}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="size-4" /> Nova loja
          </button>
        </div>

        {/* Metrics */}
        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <MetricCard label="Total de lojas" value={metrics.total}      icon={Building2}    color="bg-primary/10 text-primary" />
          <MetricCard label="Ativas"          value={metrics.ativas}    icon={CheckCircle2} color="bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400" />
          <MetricCard label="Arquivadas"      value={metrics.arquivadas} icon={Archive}      color="bg-muted text-muted-foreground" />
          <MetricCard label="Bloqueadas"      value={metrics.bloqueadas} icon={AlertCircle}  color="bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400" />
        </div>

        {/* Tenant list */}
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          {/* Filter tabs */}
          <div className="flex items-center gap-1 border-b border-border px-4 py-2">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterTab(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                  filterTab === tab.id
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {tab.label}
                <span className={cn(
                  "rounded-full px-1.5 py-0.5 font-mono text-[10px]",
                  filterTab === tab.id ? "bg-primary/20" : "bg-muted",
                )}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="flex h-48 items-center justify-center">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center gap-2 text-muted-foreground">
              <Building2 className="size-8 opacity-40" />
              <p className="text-sm">Nenhuma loja {filterTab !== "todas" ? STATUS_LABELS[filterTab]?.toLowerCase() : "cadastrada"}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <th className="px-5 py-3">Nome</th>
                    <th className="px-5 py-3">E-mail admin</th>
                    <th className="px-5 py-3">Plano</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Cadastro</th>
                    <th className="px-5 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((tenant) => (
                    <TenantRow
                      key={tenant.id}
                      tenant={tenant}
                      onEdit={() => { setEditingTenant(tenant); setModalOpen(true); }}
                      onBloquear={() => bloquear.mutate(tenant.id)}
                      onDesbloquear={() => desbloquear.mutate(tenant.id)}
                      onArquivar={() => arquivar.mutate(tenant.id)}
                      onReativar={() => reativar.mutate(tenant.id)}
                      onExcluir={() => setDeletingTenant(tenant)}
                      disabled={bloquear.isPending || desbloquear.isPending || arquivar.isPending || reativar.isPending}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {modalOpen && (
        <TenantModal
          tenant={editingTenant}
          onClose={() => setModalOpen(false)}
          onSuccess={() => setModalOpen(false)}
        />
      )}

      {deletingTenant && (
        <DeleteModal
          tenant={deletingTenant}
          onClose={() => setDeletingTenant(null)}
          onConfirm={(nomeConfirmado) => excluir.mutate({ id: deletingTenant.id, nome_confirmado: nomeConfirmado })}
          isPending={excluir.isPending}
        />
      )}
    </div>
  );
}

// ============================================================
// TenantRow
// ============================================================

function TenantRow({ tenant, onEdit, onBloquear, onDesbloquear, onArquivar, onReativar, onExcluir, disabled }: {
  tenant: Tenant;
  onEdit: () => void;
  onBloquear: () => void;
  onDesbloquear: () => void;
  onArquivar: () => void;
  onReativar: () => void;
  onExcluir: () => void;
  disabled: boolean;
}) {
  const isAtivo     = tenant.status === "ativo";
  const isBloqueado = tenant.status === "bloqueado";
  const isArquivado = tenant.status === "inativo";

  return (
    <tr className="border-b border-border/60 last:border-0 hover:bg-muted/30">
      <td className="px-5 py-3.5 font-medium">{tenant.nome}</td>
      <td className="px-5 py-3.5 text-sm text-muted-foreground">{tenant.email_admin}</td>
      <td className="px-5 py-3.5">
        <span className="rounded-md border border-border px-2 py-0.5 text-xs font-medium capitalize">
          {tenant.plano.replace("_", " ")}
        </span>
      </td>
      <td className="px-5 py-3.5"><StatusBadge status={tenant.status} /></td>
      <td className="px-5 py-3.5 text-sm text-muted-foreground">{formatDate(tenant.created_at)}</td>
      <td className="px-5 py-3.5">
        <div className="flex items-center justify-end gap-1">
          {/* Editar */}
          <ActionBtn onClick={onEdit} title="Editar" disabled={false}>
            <Pencil className="size-3.5" />
          </ActionBtn>

          {/* Arquivar / Reativar */}
          {isAtivo && (
            <ActionBtn onClick={onArquivar} title="Arquivar" disabled={disabled} className="text-muted-foreground hover:bg-muted">
              <Archive className="size-3.5" />
            </ActionBtn>
          )}
          {isArquivado && (
            <ActionBtn onClick={onReativar} title="Reativar" disabled={disabled} className="text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30">
              <RotateCcw className="size-3.5" />
            </ActionBtn>
          )}

          {/* Bloquear / Desbloquear */}
          {(isAtivo || isArquivado) && (
            <ActionBtn onClick={onBloquear} title="Bloquear" disabled={disabled} className="text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30">
              <Lock className="size-3.5" />
            </ActionBtn>
          )}
          {isBloqueado && (
            <ActionBtn onClick={onDesbloquear} title="Desbloquear" disabled={disabled} className="text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30">
              <Unlock className="size-3.5" />
            </ActionBtn>
          )}

          {/* Excluir permanentemente */}
          <ActionBtn onClick={onExcluir} title="Excluir permanentemente" disabled={false} className="text-destructive hover:bg-destructive/10">
            <Trash2 className="size-3.5" />
          </ActionBtn>
        </div>
      </td>
    </tr>
  );
}

function ActionBtn({ onClick, title, disabled, children, className }: {
  onClick: () => void;
  title: string;
  disabled: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "grid size-8 place-items-center rounded-md text-muted-foreground transition-colors",
        "hover:bg-muted hover:text-foreground",
        "disabled:cursor-not-allowed disabled:opacity-40",
        className,
      )}
    >
      {children}
    </button>
  );
}
