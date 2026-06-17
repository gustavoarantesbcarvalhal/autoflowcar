import { createContext, useEffect, useState, type ReactNode } from "react";
import type { User, AuthChangeEvent } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type UserPerfil = "super_admin" | "admin_loja" | "gerente" | "vendedor";
export type TenantPlano = "starter" | "pro" | "white_label";
export type TenantStatus = "ativo" | "inativo" | "bloqueado";

interface PerfilData {
  perfil: UserPerfil;
  tenant_id: string | null;
  plano: TenantPlano | null;
  tenant_status: TenantStatus | null;
  nome: string;
  email: string;
}

export interface AuthContextType {
  user: User | null;
  perfil: UserPerfil | null;
  tenant_id: string | null;
  plano: TenantPlano | null;
  tenantStatus: TenantStatus | null;
  nome: string | null;
  isSuperAdmin: boolean;
  temAcesso: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  refreshPerfil: () => Promise<void>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext<AuthContextType | null>(null);

async function fetchPerfil(): Promise<PerfilData | null> {
  const { data, error } = await supabase.rpc("get_meu_perfil");
  if (error || !data || (data as unknown[]).length === 0) return null;
  const row = (data as Record<string, unknown>[])[0];
  return {
    perfil: row.perfil as UserPerfil,
    tenant_id: (row.tenant_id as string) ?? null,
    plano: (row.plano as TenantPlano) ?? null,
    tenant_status: (row.tenant_status as TenantStatus) ?? null,
    nome: row.nome as string,
    email: row.email as string,
  };
}

// Eventos que não mudam identidade do usuário nem suas permissões —
// não é necessário recarregar o perfil nem entrar em estado de loading.
const SKIP_RELOAD_EVENTS = new Set<AuthChangeEvent>(["TOKEN_REFRESHED", "USER_UPDATED"]);

// Verifica sincronamente se existe uma sessão no localStorage.
// Supabase v2 armazena a sessão como `sb-{projectRef}-auth-token`.
// Se não existe, sabemos imediatamente (sem rede) que não há usuário logado
// e podemos iniciar com loading=false, eliminando o spinner desnecessário.
function hasStoredSession(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return Object.keys(localStorage).some(
      (k) => k.endsWith("-auth-token") && !k.endsWith("-code-verifier"),
    );
  } catch {
    return false;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [perfilData, setPerfilData] = useState<PerfilData | null>(null);
  // Inicia como false quando não há sessão armazenada: evita spinner antes de /login.
  // Inicia como true quando há sessão: aguarda validação/refresh do Supabase.
  const [loading, setLoading] = useState(() => hasStoredSession());

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      const currentUser = session?.user ?? null;

      if (SKIP_RELOAD_EVENTS.has(event)) {
        setUser(currentUser);
        return;
      }

      setLoading(true);
      setUser(currentUser);

      if (currentUser) {
        const data = await fetchPerfil();
        setPerfilData(data);
      } else {
        setPerfilData(null);
      }

      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    // Estado limpo via SIGNED_IN no handler acima — sem necessidade de
    // setar perfilData manualmente aqui.
  }

  async function signOut() {
    // Não limpar estado manualmente: o evento SIGNED_OUT dispara o handler
    // acima que faz setLoading(true) → setUser(null) → setPerfilData(null)
    // → setLoading(false) na ordem correta.
    await supabase.auth.signOut();
  }

  async function resetPassword(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login?reset=true`,
    });
    if (error) throw error;
  }

  async function refreshPerfil() {
    setLoading(true);
    const data = await fetchPerfil();
    setPerfilData(data);
    setLoading(false);
  }

  const isSuperAdmin = perfilData?.perfil === "super_admin";
  const temAcesso = !!(perfilData && (isSuperAdmin || perfilData.tenant_status === "ativo"));

  return (
    <AuthContext.Provider
      value={{
        user,
        perfil: perfilData?.perfil ?? null,
        tenant_id: perfilData?.tenant_id ?? null,
        plano: perfilData?.plano ?? null,
        tenantStatus: perfilData?.tenant_status ?? null,
        nome: perfilData?.nome ?? null,
        isSuperAdmin,
        temAcesso,
        loading,
        signIn,
        signOut,
        resetPassword,
        refreshPerfil,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
