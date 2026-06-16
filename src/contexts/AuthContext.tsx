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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [perfilData, setPerfilData] = useState<PerfilData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      const currentUser = session?.user ?? null;

      // Refresh de token e atualização de metadados não alteram acesso.
      // Apenas atualiza o user object sem entrar em estado de loading.
      if (SKIP_RELOAD_EVENTS.has(event)) {
        setUser(currentUser);
        return;
      }

      // Para todos os outros eventos (INITIAL_SESSION, SIGNED_IN, SIGNED_OUT,
      // PASSWORD_RECOVERY, MFA_CHALLENGE_VERIFIED): re-entra em loading ANTES
      // de setar user. Isso garante que nenhum render intermediário mostre
      // user≠null com perfilData=null (causa do flash de BlockedScreen).
      setLoading(true);
      setUser(currentUser);

      if (currentUser) {
        const data = await fetchPerfil();
        setPerfilData(data);
      } else {
        setPerfilData(null);
      }

      // loading=false só depois que o perfil está resolvido.
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
