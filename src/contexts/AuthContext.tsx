import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type UserPerfil =
  | "super_admin"
  | "admin_loja"
  | "gerente"
  | "vendedor";
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

const AuthContext = createContext<AuthContextType | null>(null);

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [perfilData, setPerfilData] = useState<PerfilData | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadPerfil() {
    const data = await fetchPerfil();
    setPerfilData(data);
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) await loadPerfil();
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        await loadPerfil();
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
  }

  async function signOut() {
    setPerfilData(null);
    await supabase.auth.signOut();
  }

  async function resetPassword(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login?reset=true`,
    });
    if (error) throw error;
  }

  async function refreshPerfil() {
    await loadPerfil();
  }

  const isSuperAdmin = perfilData?.perfil === "super_admin";
  const temAcesso = !!(
    perfilData &&
    (isSuperAdmin || perfilData.tenant_status === "ativo")
  );

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

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}
