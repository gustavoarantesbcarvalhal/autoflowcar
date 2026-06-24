import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, UserCheck, UserX, Loader2, Users } from "lucide-react";
import { criarUsuarioTenant, atualizarUsuarioTenant } from "@/lib/api/usuarios.functions";
import type { UserPerfil } from "@/hooks/useAuth";

type TenantPerfil = Exclude<UserPerfil, "super_admin">;

export const Route = createFileRoute("/usuarios")({
  head: () => ({ meta: [{ title: "Usuários — DriverLeads" }] }),
  component: UsuariosPage,
});

type UserProfile = {
  id: string;
  nome: string;
  email: string;
  perfil: UserPerfil;
  ativo: boolean;
  created_at: string;
};

const PERFIL_LABEL: Record<string, string> = {
  admin_loja: "Admin",
  gerente: "Gerente",
  vendedor: "Vendedor",
};

const PERFIL_COLOR: Record<string, string> = {
  admin_loja: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  gerente: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  vendedor: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
};

const PERFIS_DISPONIVEIS: { value: TenantPerfil; label: string }[] = [
  { value: "admin_loja", label: "Admin" },
  { value: "gerente", label: "Gerente" },
  { value: "vendedor", label: "Vendedor" },
];

async function fetchUsuarios(): Promise<UserProfile[]> {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("id, nome, email, perfil, ativo, created_at")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as UserProfile[];
}

// ─── Tipos de modal ────────────────────────────────────────────
type ModalState =
  | { type: "closed" }
  | { type: "criar" }
  | { type: "editar"; user: UserProfile };

const MODAL_CLOSED: ModalState = { type: "closed" };

// ─── Componente principal ──────────────────────────────────────
function UsuariosPage() {
  const { perfil: callerPerfil, user: callerUser, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [modal, setModal] = useState<ModalState>(MODAL_CLOSED);

  // Guard: apenas admin_loja e gerente
  useEffect(() => {
    if (loading) return;
    if (callerPerfil === "vendedor" || callerPerfil === "super_admin" || !callerPerfil) {
      navigate({ to: "/", replace: true });
    }
  }, [loading, callerPerfil, navigate]);

  const { data, isLoading } = useQuery({
    queryKey: ["usuarios"],
    queryFn: fetchUsuarios,
    enabled: callerPerfil === "admin_loja" || callerPerfil === "gerente",
  });

  const toggleAtivo = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      await atualizarUsuarioTenant({ data: { id, ativo } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["usuarios"] });
      toast.success("Usuário atualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const usuarios = data ?? [];
  const ativos = usuarios.filter((u) => u.ativo).length;

  if (loading || !callerPerfil) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-6">
      {/* Cabeçalho */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Users className="size-6 text-primary" /> Equipe da Loja
          </h1>
          <p className="text-sm text-muted-foreground">
            {isLoading ? "…" : `${ativos} usuário${ativos !== 1 ? "s" : ""} ativo${ativos !== 1 ? "s" : ""}`}
          </p>
        </div>
        <button
          onClick={() => setModal({ type: "criar" })}
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="size-4" /> Novo Usuário
        </button>
      </div>

      {/* Tabela */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            <Loader2 className="mx-auto mb-2 size-5 animate-spin" />
            Carregando usuários…
          </div>
        ) : usuarios.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="mx-auto mb-3 size-10 text-muted-foreground/50" />
            <p className="text-sm font-medium">Nenhum usuário cadastrado ainda.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Crie o primeiro usuário da equipe.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Nome
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  E-mail
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Perfil
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {usuarios.map((u) => {
                const isMe = u.id === callerUser?.id;
                const canEdit =
                  callerPerfil === "admin_loja" ||
                  (callerPerfil === "gerente" && u.perfil !== "admin_loja");
                return (
                  <tr key={u.id} className={`transition-colors hover:bg-muted/30 ${!u.ativo ? "opacity-50" : ""}`}>
                    <td className="px-4 py-3 font-medium">
                      {u.nome}
                      {isMe && (
                        <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                          você
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${PERFIL_COLOR[u.perfil] ?? ""}`}>
                        {PERFIL_LABEL[u.perfil] ?? u.perfil}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                          u.ativo
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        <span className={`size-1.5 rounded-full ${u.ativo ? "bg-green-500" : "bg-muted-foreground"}`} />
                        {u.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {canEdit && (
                          <>
                            <button
                              onClick={() => setModal({ type: "editar", user: u })}
                              title="Editar"
                              className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            >
                              <Pencil className="size-3.5" />
                            </button>
                            {!isMe && (
                              <button
                                onClick={() => toggleAtivo.mutate({ id: u.id, ativo: !u.ativo })}
                                disabled={toggleAtivo.isPending}
                                title={u.ativo ? "Desativar" : "Ativar"}
                                className={`grid size-8 place-items-center rounded-md transition-colors hover:bg-muted ${
                                  u.ativo
                                    ? "text-destructive hover:text-destructive"
                                    : "text-green-600 hover:text-green-600"
                                }`}
                              >
                                {u.ativo ? (
                                  <UserX className="size-3.5" />
                                ) : (
                                  <UserCheck className="size-3.5" />
                                )}
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modais */}
      {modal.type === "criar" && (
        <CriarUsuarioModal
          callerPerfil={callerPerfil}
          onClose={() => setModal(MODAL_CLOSED)}
          onSuccess={() => {
            setModal(MODAL_CLOSED);
            qc.invalidateQueries({ queryKey: ["usuarios"] });
          }}
        />
      )}

      {modal.type === "editar" && (
        <EditarUsuarioModal
          user={modal.user}
          callerPerfil={callerPerfil}
          onClose={() => setModal(MODAL_CLOSED)}
          onSuccess={() => {
            setModal(MODAL_CLOSED);
            qc.invalidateQueries({ queryKey: ["usuarios"] });
          }}
        />
      )}
    </div>
  );
}

// ─── Modal: Criar Usuário ──────────────────────────────────────
function CriarUsuarioModal({
  callerPerfil,
  onClose,
  onSuccess,
}: {
  callerPerfil: UserPerfil;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    nome: "",
    email: "",
    perfil: "vendedor" as TenantPerfil,
    senha_temporaria: "",
  });
  const [saving, setSaving] = useState(false);

  const perfisDisponiveis =
    callerPerfil === "gerente"
      ? PERFIS_DISPONIVEIS.filter((p) => p.value !== "admin_loja")
      : PERFIS_DISPONIVEIS;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await criarUsuarioTenant({ data: form });
      toast.success(`Usuário ${form.nome} criado com sucesso`);
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar usuário");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalWrapper title="Novo Usuário" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Nome completo">
          <input
            value={form.nome}
            onChange={(e) => setForm({ ...form, nome: e.target.value })}
            placeholder="Maria da Silva"
            required
            minLength={2}
            className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-primary/60"
          />
        </Field>
        <Field label="E-mail">
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="maria@loja.com"
            required
            className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-primary/60"
          />
        </Field>
        <Field label="Perfil">
          <select
            value={form.perfil}
            onChange={(e) => setForm({ ...form, perfil: e.target.value as TenantPerfil })}
            className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-primary/60"
          >
            {perfisDisponiveis.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Senha temporária">
          <input
            type="password"
            value={form.senha_temporaria}
            onChange={(e) => setForm({ ...form, senha_temporaria: e.target.value })}
            placeholder="Mínimo 8 caracteres"
            required
            minLength={8}
            className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-primary/60"
          />
        </Field>
        <p className="text-xs text-muted-foreground">
          O usuário poderá alterar a senha no primeiro acesso.
        </p>
        <ModalFooter onClose={onClose} saving={saving} label="Criar Usuário" />
      </form>
    </ModalWrapper>
  );
}

// ─── Modal: Editar Usuário ─────────────────────────────────────
function EditarUsuarioModal({
  user,
  callerPerfil,
  onClose,
  onSuccess,
}: {
  user: UserProfile;
  callerPerfil: UserPerfil;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    nome: user.nome,
    perfil: user.perfil as TenantPerfil,
  });
  const [saving, setSaving] = useState(false);

  const perfisDisponiveis =
    callerPerfil === "gerente"
      ? PERFIS_DISPONIVEIS.filter((p) => p.value !== "admin_loja")
      : PERFIS_DISPONIVEIS;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await atualizarUsuarioTenant({ data: { id: user.id, ...form } });
      toast.success("Usuário atualizado");
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar usuário");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalWrapper title={`Editar — ${user.nome}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Nome completo">
          <input
            value={form.nome}
            onChange={(e) => setForm({ ...form, nome: e.target.value })}
            required
            minLength={2}
            className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-primary/60"
          />
        </Field>
        <Field label="Perfil">
          <select
            value={form.perfil}
            onChange={(e) => setForm({ ...form, perfil: e.target.value as TenantPerfil })}
            className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-primary/60"
          >
            {perfisDisponiveis.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </Field>
        <ModalFooter onClose={onClose} saving={saving} label="Salvar" />
      </form>
    </ModalWrapper>
  );
}

// ─── Primitivos de UI ──────────────────────────────────────────
function ModalWrapper({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            ✕
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

function ModalFooter({
  onClose,
  saving,
  label,
}: {
  onClose: () => void;
  saving: boolean;
  label: string;
}) {
  return (
    <div className="flex justify-end gap-2 pt-2">
      <button
        type="button"
        onClick={onClose}
        disabled={saving}
        className="h-9 rounded-md border border-border px-4 text-sm font-medium hover:bg-muted disabled:opacity-50"
      >
        Cancelar
      </button>
      <button
        type="submit"
        disabled={saving}
        className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {saving && <Loader2 className="size-3.5 animate-spin" />}
        {label}
      </button>
    </div>
  );
}
