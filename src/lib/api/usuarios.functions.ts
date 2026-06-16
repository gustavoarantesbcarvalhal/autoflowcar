import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

const UserPerfilSchema = z.enum(["admin_loja", "gerente", "vendedor"]);

type CallerInfo = { perfil: string; tenant_id: string };

async function assertPodeGerirUsuarios(
  supabase: SupabaseClient<Database>,
): Promise<CallerInfo> {
  const { data, error } = await supabase.rpc("get_meu_perfil");
  if (error || !data || (data as unknown[]).length === 0) {
    throw new Error("Acesso negado: perfil não encontrado");
  }
  const row = (data as Record<string, unknown>[])[0];
  const perfil = row.perfil as string;
  const tenant_id = row.tenant_id as string | null;
  if (!["admin_loja", "gerente"].includes(perfil)) {
    throw new Error("Acesso negado: apenas admin_loja e gerente podem gerenciar usuários");
  }
  if (!tenant_id) {
    throw new Error("Acesso negado: usuário sem tenant associado");
  }
  return { perfil, tenant_id };
}

// ============================================================
// criarUsuarioTenant
// ============================================================
export const criarUsuarioTenant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      nome: z.string().min(2),
      email: z.string().email(),
      perfil: UserPerfilSchema,
      senha_temporaria: z.string().min(8),
    }),
  )
  .handler(async ({ data, context }) => {
    const caller = await assertPodeGerirUsuarios(context.supabase);

    if (caller.perfil === "gerente" && data.perfil === "admin_loja") {
      throw new Error("Acesso negado: gerente não pode criar admin_loja");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.senha_temporaria,
      email_confirm: true,
    });

    if (authError || !authUser.user) {
      throw new Error(authError?.message ?? "Erro ao criar usuário no Auth");
    }

    const { error: profileError } = await supabaseAdmin.from("user_profiles").insert({
      id: authUser.user.id,
      tenant_id: caller.tenant_id,
      nome: data.nome,
      email: data.email,
      perfil: data.perfil,
      ativo: true,
    });

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
      throw new Error(profileError.message ?? "Erro ao criar perfil");
    }

    return { user_id: authUser.user.id };
  });

// ============================================================
// atualizarUsuarioTenant
// ============================================================
export const atualizarUsuarioTenant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.string().uuid(),
      nome: z.string().min(2).optional(),
      perfil: UserPerfilSchema.optional(),
      ativo: z.boolean().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const caller = await assertPodeGerirUsuarios(context.supabase);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: target, error: fetchError } = await supabaseAdmin
      .from("user_profiles")
      .select("id, tenant_id, perfil")
      .eq("id", data.id)
      .maybeSingle();

    if (fetchError || !target) {
      throw new Error("Usuário não encontrado");
    }

    if (target.tenant_id !== caller.tenant_id) {
      throw new Error("Acesso negado: usuário pertence a outro tenant");
    }

    if (caller.perfil === "gerente" && target.perfil === "admin_loja") {
      throw new Error("Acesso negado: gerente não pode editar admin_loja");
    }

    if (caller.perfil === "gerente" && data.perfil === "admin_loja") {
      throw new Error("Acesso negado: gerente não pode atribuir perfil admin_loja");
    }

    if (data.id === context.userId && data.ativo === false) {
      throw new Error("Você não pode desativar sua própria conta");
    }

    const { id, ...updates } = data;
    const { error: updateError } = await supabaseAdmin
      .from("user_profiles")
      .update(updates)
      .eq("id", id);

    if (updateError) throw new Error(updateError.message);
    return { ok: true };
  });
