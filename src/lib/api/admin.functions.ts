import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

const TenantPlanoSchema = z.enum(["starter", "pro", "white_label"]);

/**
 * Verifica se o usuário autenticado existe na tabela super_admins.
 * Usa o cliente com token do usuário (respeita RLS): a política
 * "super_admins_self_select" só devolve a linha se id = auth.uid(),
 * portanto a ausência de resultado é suficiente para negar acesso.
 */
async function assertSuperAdmin(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from("super_admins")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) {
    throw new Error(
      "Acesso negado: apenas super admins podem executar esta operação",
    );
  }
}

// ============================================================
// criarTenantComAdmin
// ============================================================

export const criarTenantComAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      nome: z.string().min(2),
      email_admin: z.string().email(),
      plano: TenantPlanoSchema,
      senha_temporaria: z.string().min(8),
      nome_admin: z.string().min(2),
    }),
  )
  .handler(async ({ data, context }) => {
    // 1. Verificar que o chamador é super_admin
    await assertSuperAdmin(context.supabase, context.userId);

    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    // 2. Criar usuário no Supabase Auth
    const { data: authUser, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email: data.email_admin,
        password: data.senha_temporaria,
        email_confirm: true,
      });

    if (authError || !authUser.user) {
      throw new Error(authError?.message ?? "Erro ao criar usuário");
    }

    // 3. Criar tenant
    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from("tenants")
      .insert({
        nome: data.nome,
        email_admin: data.email_admin,
        plano: data.plano,
        status: "ativo",
      })
      .select("id")
      .single();

    if (tenantError || !tenant) {
      // Rollback: remover usuário auth criado
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
      throw new Error(tenantError?.message ?? "Erro ao criar loja");
    }

    // 4. Criar user_profile vinculando usuário ao tenant
    const { error: profileError } = await supabaseAdmin
      .from("user_profiles")
      .insert({
        id: authUser.user.id,
        tenant_id: tenant.id,
        nome: data.nome_admin,
        email: data.email_admin,
        perfil: "admin_loja",
        ativo: true,
      });

    if (profileError) {
      // Rollback: remover tenant e usuário auth criados
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
      await supabaseAdmin.from("tenants").delete().eq("id", tenant.id);
      throw new Error(profileError.message ?? "Erro ao criar perfil");
    }

    return { tenant_id: tenant.id, user_id: authUser.user.id };
  });

// ============================================================
// atualizarTenant
// ============================================================

export const atualizarTenant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.string().uuid(),
      nome: z.string().min(2).optional(),
      plano: TenantPlanoSchema.optional(),
      status: z.enum(["ativo", "inativo", "bloqueado"]).optional(),
      email_admin: z.string().email().optional(),
      logo_url: z.string().url().nullable().optional(),
      cor_primaria: z.string().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    // 1. Verificar que o chamador é super_admin
    await assertSuperAdmin(context.supabase, context.userId);

    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    // 2. Executar update com service role (após autorização confirmada)
    const { id, ...updates } = data;
    const { error } = await supabaseAdmin
      .from("tenants")
      .update(updates)
      .eq("id", id);

    if (error) throw new Error(error.message);
    return { ok: true };
  });
