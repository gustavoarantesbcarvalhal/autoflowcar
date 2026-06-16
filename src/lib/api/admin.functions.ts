import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const TenantPlanoSchema = z.enum(["starter", "pro", "white_label"]);

export const criarTenantComAdmin = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      nome: z.string().min(2),
      email_admin: z.string().email(),
      plano: TenantPlanoSchema,
      senha_temporaria: z.string().min(8),
      nome_admin: z.string().min(2),
    }),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    // 1. Criar usuário no Supabase Auth
    const { data: authUser, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email: data.email_admin,
        password: data.senha_temporaria,
        email_confirm: true,
      });

    if (authError || !authUser.user) {
      throw new Error(authError?.message ?? "Erro ao criar usuário");
    }

    // 2. Criar tenant
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
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
      throw new Error(tenantError?.message ?? "Erro ao criar loja");
    }

    // 3. Criar user_profile vinculando usuário ao tenant
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
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
      await supabaseAdmin.from("tenants").delete().eq("id", tenant.id);
      throw new Error(profileError.message ?? "Erro ao criar perfil");
    }

    return { tenant_id: tenant.id, user_id: authUser.user.id };
  });

export const atualizarTenant = createServerFn({ method: "POST" })
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
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const { id, ...updates } = data;
    const { error } = await supabaseAdmin
      .from("tenants")
      .update(updates)
      .eq("id", id);

    if (error) throw new Error(error.message);
    return { ok: true };
  });
