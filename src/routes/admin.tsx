import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { criarTenantComAdmin, atualizarTenant } from "@/lib/api/admin.functions";
import type { Tables } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";
import {
  Building2,
  CheckCircle2,
  Crown,
  Star,
  LogOut,
  Plus,
  Pencil,
  Lock,
  Unlock,
  Loader2,
  X,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

type Tenant = Tables<"tenants">;

// ============================================================
// Helpers
// ============================================================

const STATUS_LABELS: Record<string, string> = {
  ativo: "Ativo",
  inativo: "Inativo",
  bloqueado: "Bloqueado",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        status === "ativo" &&
          "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
        status === "inativo" && "bg-muted text-muted-foreground",
        status === "bloqueado" && "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
      )}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ============================================================
// Modal para criar / editar tenant
// ============================================================

interface TenantModalProps {
  tenant?: Tenant | null;
  onClose: () => void;
  onSuccess: () => void;
}

function TenantModal({ tenant, onClose, onSuccess }: TenantModalProps) {
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
        await atualizarTenant({
          data: { id: tenant.id, nome, email_admin: emailAdmin, plano },
        });
        toast.success("Loja atualizada com sucesso!");
      } else {
        await criarTenantComAdmin({
          data: {
            nome,
            email_admin: emailAdmin,
            nome_admin: nomeAdmin,
            plano,
            senha_temporaria: senha,
          },
        });
        toast.success("Loja criada com sucesso!");
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
          <button
            onClick={onClose}
            className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted"
          >
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          {error && (
            <div className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              {error}
            </div>
          )}

          <Field label="Nome da loja">
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: AutoFlow Campinas"
              required
              className={inputCls}
            />
          </Field>

          <Field label="E-mail do admin">
            <input
              type="email"
              value={emailAdmin}
              onChange={(e) => setEmailAdmin(e.target.value)}
              placeholder="admin@loja.com"
              required
              className={inputCls}
            />
          </Field>

          {!isEdit && (
            <>
              <Field label="Nome do admin">
                <input
                  value={nomeAdmin}
                  onChange={(e) => setNomeAdmin(e.target.value)}
                  placeholder="João Silva"
                  required
                  className={inputCls}
                />
              </Field>

              <Field label="Senha temporária">
                <input
                  type="password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  required
                  minLength={8}
                  className={inputCls}
                />
              </Field>
            </>
          )}

          <Field label="Plano">
            <select
              value={plano}
              onChange={(e) => setPlano(e.target.value as "starter" | "pro" | "white_label")}
              className={inputCls}
            >
              <option value="starter">Starter</option>
              <option value="pro">Pro</option>
              <option value="white_label">White Label</option>
            </select>
          </Field>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-md border border-border py-2 text-sm font-medium transition-colors hover:bg-muted"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-md",
                "bg-primary py-2 text-sm font-semibold text-primary-foreground",
                "transition-colors hover:bg-primary/90 disabled:opacity-60",
              )}
            >
              {submitting && <Loader2 className="size-4 animate-spin" />}
              {isEdit ? "Salvar" : "Criar loja"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium">{label}</label>
      {children}
    </div>
  );
}

const inputCls =
  "h-10 w-full rounded-md border border-border bg-surface px-3 text-sm outline-none transition-colors focus:border-primary/60 focus:ring-2 focus:ring-primary/20";

// ============================================================
// Metrics cards
// ============================================================

function MetricCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
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
// Main admin page
// ============================================================

function AdminPage() {
  const { user, isSuperAdmin, loading, nome, signOut } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);

  // Guard: only super_admin
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

  const updateMutation = useMutation({
    mutationFn: async (vars: {
      id: string;
      plano?: "starter" | "pro" | "white_label";
      status?: "ativo" | "inativo" | "bloqueado";
    }) => {
      await atualizarTenant({ data: vars });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-tenants"] }),
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar");
    },
  });

  function toggleBloqueio(tenant: Tenant) {
    const novoStatus = tenant.status === "bloqueado" ? "ativo" : "bloqueado";
    updateMutation.mutate(
      { id: tenant.id, status: novoStatus },
      {
        onSuccess: () =>
          toast.success(
            novoStatus === "bloqueado" ? `${tenant.nome} bloqueada` : `${tenant.nome} desbloqueada`,
          ),
      },
    );
  }

  function changePlano(tenant: Tenant, plano: "starter" | "pro" | "white_label") {
    updateMutation.mutate(
      { id: tenant.id, plano },
      { onSuccess: () => toast.success("Plano atualizado") },
    );
  }

  const metrics = {
    total: tenants.length,
    ativas: tenants.filter((t) => t.status === "ativo").length,
    pro: tenants.filter((t) => t.plano === "pro").length,
    white_label: tenants.filter((t) => t.plano === "white_label").length,
  };

  if (loading || !isSuperAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface text-foreground">
      {/* Admin header */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="grid size-7 place-items-center rounded bg-primary">
            <div className="size-3 rotate-45 bg-primary-foreground" />
          </div>
          <span className="font-bold tracking-tight">AUTOFLOW</span>
          <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
            Super Admin
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-muted-foreground sm:block">{nome}</span>
          <button
            onClick={async () => {
              await signOut();
              navigate({ to: "/login" });
            }}
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <LogOut className="size-4" />
            Sair
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        {/* Page header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Painel de Lojas</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Gerencie todas as lojas cadastradas na plataforma
            </p>
          </div>
          <button
            onClick={() => {
              setEditingTenant(null);
              setModalOpen(true);
            }}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus className="size-4" />
            Nova loja
          </button>
        </div>

        {/* Metrics */}
        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <MetricCard
            label="Total de lojas"
            value={metrics.total}
            icon={Building2}
            color="bg-primary/10 text-primary"
          />
          <MetricCard
            label="Lojas ativas"
            value={metrics.ativas}
            icon={CheckCircle2}
            color="bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
          />
          <MetricCard
            label="Plano Pro"
            value={metrics.pro}
            icon={Star}
            color="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400"
          />
          <MetricCard
            label="White Label"
            value={metrics.white_label}
            icon={Crown}
            color="bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400"
          />
        </div>

        {/* Tenants table */}
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="border-b border-border px-5 py-4">
            <h2 className="font-semibold">Todas as lojas</h2>
          </div>

          {isLoading ? (
            <div className="flex h-48 items-center justify-center">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : tenants.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center gap-2 text-muted-foreground">
              <Building2 className="size-8 opacity-40" />
              <p className="text-sm">Nenhuma loja cadastrada ainda</p>
              <button
                onClick={() => {
                  setEditingTenant(null);
                  setModalOpen(true);
                }}
                className="text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                Criar primeira loja
              </button>
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
                  {tenants.map((tenant) => (
                    <TenantRow
                      key={tenant.id}
                      tenant={tenant}
                      onEdit={() => {
                        setEditingTenant(tenant);
                        setModalOpen(true);
                      }}
                      onToggleBloqueio={() => toggleBloqueio(tenant)}
                      onChangePlano={(p) => changePlano(tenant, p)}
                      updating={updateMutation.isPending}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Modal create / edit */}
      {modalOpen && (
        <TenantModal
          tenant={editingTenant}
          onClose={() => setModalOpen(false)}
          onSuccess={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}

// ============================================================
// Tenant table row
// ============================================================

function TenantRow({
  tenant,
  onEdit,
  onToggleBloqueio,
  onChangePlano,
  updating,
}: {
  tenant: Tenant;
  onEdit: () => void;
  onToggleBloqueio: () => void;
  onChangePlano: (p: "starter" | "pro" | "white_label") => void;
  updating: boolean;
}) {
  return (
    <tr className="border-b border-border/60 last:border-0 hover:bg-muted/30">
      <td className="px-5 py-3.5">
        <span className="font-medium">{tenant.nome}</span>
      </td>
      <td className="px-5 py-3.5 text-sm text-muted-foreground">{tenant.email_admin}</td>
      <td className="px-5 py-3.5">
        <select
          value={tenant.plano}
          disabled={updating}
          onChange={(e) => onChangePlano(e.target.value as "starter" | "pro" | "white_label")}
          className={cn(
            "rounded-md border border-border bg-transparent py-0.5 pl-2 pr-6 text-xs font-medium",
            "cursor-pointer outline-none transition-colors hover:border-primary/50 focus:border-primary/60",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
        >
          <option value="starter">Starter</option>
          <option value="pro">Pro</option>
          <option value="white_label">White Label</option>
        </select>
      </td>
      <td className="px-5 py-3.5">
        <StatusBadge status={tenant.status} />
      </td>
      <td className="px-5 py-3.5 text-sm text-muted-foreground">{formatDate(tenant.created_at)}</td>
      <td className="px-5 py-3.5">
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={onEdit}
            title="Editar"
            className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Pencil className="size-3.5" />
          </button>
          <button
            onClick={onToggleBloqueio}
            disabled={updating}
            title={tenant.status === "bloqueado" ? "Desbloquear" : "Bloquear"}
            className={cn(
              "grid size-8 place-items-center rounded-md transition-colors",
              "disabled:cursor-not-allowed disabled:opacity-50",
              tenant.status === "bloqueado"
                ? "text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30"
                : "text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30",
            )}
          >
            {tenant.status === "bloqueado" ? (
              <Unlock className="size-3.5" />
            ) : (
              <Lock className="size-3.5" />
            )}
          </button>
        </div>
      </td>
    </tr>
  );
}
