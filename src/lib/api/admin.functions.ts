import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

// ============================================================
// diagnosarServidor — retorna info segura das env vars do servidor
// ============================================================
export const diagnosarServidor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const url = import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
    const adminJwt = process.env.SUPABASE_ADMIN_JWT || "";
    const legacyKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    const publishable = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || "";

    return {
      supabase_url: url,
      SUPABASE_ADMIN_JWT_exists: adminJwt.length > 0,
      SUPABASE_ADMIN_JWT_prefix: adminJwt.slice(0, 20),
      SUPABASE_ADMIN_JWT_format: adminJwt.startsWith("eyJ") ? "JWT ✓" : adminJwt.startsWith("sb_") ? "sb_* ✗" : adminJwt.length === 0 ? "AUSENTE ← cadastrar no Lovable" : "desconhecido",
      SUPABASE_SERVICE_ROLE_KEY_still_present: legacyKey.length > 0,
      publishable_key_prefix: publishable.slice(0, 20),
    };
  });

const TenantPlanoSchema = z.enum(["starter", "pro", "white_label"]);

// ============================================================
// Helpers
// ============================================================

async function assertSuperAdmin(supabase: SupabaseClient<Database>, userId: string): Promise<void> {
  const { data, error } = await supabase
    .from("super_admins")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) {
    throw new Error("Acesso negado: apenas super admins podem executar esta operação");
  }
}

async function getSuperAdminNome(
  supabaseAdmin: SupabaseClient<Database>,
  userId: string,
): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("super_admins")
    .select("nome")
    .eq("id", userId)
    .maybeSingle();
  return data?.nome ?? null;
}

async function logAcao(
  supabaseAdmin: SupabaseClient<Database>,
  opts: {
    tenant_id: string | null;
    tenant_nome: string;
    acao: string;
    feito_por_id: string;
    feito_por_nome: string | null;
  },
) {
  await supabaseAdmin.from("tenant_actions_log").insert({
    tenant_id:      opts.tenant_id,
    tenant_nome:    opts.tenant_nome,
    acao:           opts.acao,
    feito_por_id:   opts.feito_por_id,
    feito_por_nome: opts.feito_por_nome,
  });
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
    await assertSuperAdmin(context.supabase, context.userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email_admin,
      password: data.senha_temporaria,
      email_confirm: true,
    });

    if (authError || !authUser.user) {
      throw new Error(authError?.message ?? "Erro ao criar usuário");
    }

    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from("tenants")
      .insert({
        nome: data.nome,
        email_admin: data.email_admin,
        plano: data.plano,
        status: "ativo",
        created_by_id: context.userId,
      })
      .select("id")
      .single();

    if (tenantError || !tenant) {
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
      throw new Error(tenantError?.message ?? "Erro ao criar loja");
    }

    const { error: profileError } = await supabaseAdmin.from("user_profiles").insert({
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

    const adminNome = await getSuperAdminNome(supabaseAdmin, context.userId);
    await logAcao(supabaseAdmin, {
      tenant_id:      tenant.id,
      tenant_nome:    data.nome,
      acao:           "criado",
      feito_por_id:   context.userId,
      feito_por_nome: adminNome,
    });

    return { tenant_id: tenant.id, user_id: authUser.user.id };
  });

// ============================================================
// atualizarTenant — edição de dados (nome, email, plano)
// ============================================================

export const atualizarTenant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.string().uuid(),
      nome: z.string().min(2).optional(),
      plano: TenantPlanoSchema.optional(),
      email_admin: z.string().email().optional(),
      logo_url: z.string().url().nullable().optional(),
      cor_primaria: z.string().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { id, ...updates } = data;
    const { error } = await supabaseAdmin.from("tenants").update(updates).eq("id", id);

    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// bloquearTenant
// ============================================================

export const bloquearTenant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: tenant } = await supabaseAdmin
      .from("tenants").select("nome").eq("id", data.id).single();

    const { error } = await supabaseAdmin.from("tenants").update({
      status:         "bloqueado",
      blocked_at:     new Date().toISOString(),
      blocked_by_id:  context.userId,
    }).eq("id", data.id);

    if (error) throw new Error(error.message);

    const adminNome = await getSuperAdminNome(supabaseAdmin, context.userId);
    await logAcao(supabaseAdmin, {
      tenant_id:      data.id,
      tenant_nome:    tenant?.nome ?? "",
      acao:           "bloqueado",
      feito_por_id:   context.userId,
      feito_por_nome: adminNome,
    });

    return { ok: true };
  });

// ============================================================
// desbloquearTenant
// ============================================================

export const desbloquearTenant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: tenant } = await supabaseAdmin
      .from("tenants").select("nome").eq("id", data.id).single();

    const { error } = await supabaseAdmin.from("tenants").update({
      status:        "ativo",
      blocked_at:    null,
      blocked_by_id: null,
    }).eq("id", data.id);

    if (error) throw new Error(error.message);

    const adminNome = await getSuperAdminNome(supabaseAdmin, context.userId);
    await logAcao(supabaseAdmin, {
      tenant_id:      data.id,
      tenant_nome:    tenant?.nome ?? "",
      acao:           "desbloqueado",
      feito_por_id:   context.userId,
      feito_por_nome: adminNome,
    });

    return { ok: true };
  });

// ============================================================
// arquivarTenant — preserva dados, bloqueia acesso (status=inativo)
// ============================================================

export const arquivarTenant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: tenant } = await supabaseAdmin
      .from("tenants").select("nome").eq("id", data.id).single();

    const { error } = await supabaseAdmin.from("tenants").update({
      status:          "inativo",
      archived_at:     new Date().toISOString(),
      archived_by_id:  context.userId,
    }).eq("id", data.id);

    if (error) throw new Error(error.message);

    const adminNome = await getSuperAdminNome(supabaseAdmin, context.userId);
    await logAcao(supabaseAdmin, {
      tenant_id:      data.id,
      tenant_nome:    tenant?.nome ?? "",
      acao:           "arquivado",
      feito_por_id:   context.userId,
      feito_por_nome: adminNome,
    });

    return { ok: true };
  });

// ============================================================
// reativarTenant
// ============================================================

export const reativarTenant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: tenant } = await supabaseAdmin
      .from("tenants").select("nome").eq("id", data.id).single();

    const { error } = await supabaseAdmin.from("tenants").update({
      status:          "ativo",
      archived_at:     null,
      archived_by_id:  null,
      blocked_at:      null,
      blocked_by_id:   null,
    }).eq("id", data.id);

    if (error) throw new Error(error.message);

    const adminNome = await getSuperAdminNome(supabaseAdmin, context.userId);
    await logAcao(supabaseAdmin, {
      tenant_id:      data.id,
      tenant_nome:    tenant?.nome ?? "",
      acao:           "reativado",
      feito_por_id:   context.userId,
      feito_por_nome: adminNome,
    });

    return { ok: true };
  });

// ============================================================
// excluirTenant — exclusão permanente com confirmação de nome
// Ordem de deleção respeita FKs (NO ACTION nas tabelas CRM):
//   interactions → appointments → customers → vehicles → tenant
//   (user_profiles em CASCADE, apagam junto com o tenant)
// ============================================================

export const excluirTenant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.string().uuid(),
      nome_confirmado: z.string().min(1),
    }),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Verificar que o nome bate antes de qualquer deleção
    const { data: tenant, error: fetchErr } = await supabaseAdmin
      .from("tenants").select("nome").eq("id", data.id).single();

    if (fetchErr || !tenant) throw new Error("Loja não encontrada");

    if (tenant.nome.trim() !== data.nome_confirmado.trim()) {
      throw new Error("O nome digitado não corresponde ao nome da loja");
    }

    // Coletar user IDs antes de deletar (user_profiles cascadeiam com o tenant)
    const { data: profiles } = await supabaseAdmin
      .from("user_profiles").select("id").eq("tenant_id", data.id);
    const userIds = (profiles ?? []).map((p) => p.id);

    // Log antes da exclusão (para preservar referência ao nome)
    const adminNome = await getSuperAdminNome(supabaseAdmin, context.userId);
    await logAcao(supabaseAdmin, {
      tenant_id:      null,
      tenant_nome:    tenant.nome,
      acao:           "excluido",
      feito_por_id:   context.userId,
      feito_por_nome: adminNome,
    });

    // Deleção em cascata manual (FKs com NO ACTION)
    await supabaseAdmin.from("interactions").delete().eq("tenant_id", data.id);
    await supabaseAdmin.from("appointments").delete().eq("tenant_id", data.id);
    await supabaseAdmin.from("customers").delete().eq("tenant_id", data.id);
    await supabaseAdmin.from("vehicles").delete().eq("tenant_id", data.id);

    // Deletar tenant (user_profiles cascadeiam automaticamente)
    const { error: delErr } = await supabaseAdmin.from("tenants").delete().eq("id", data.id);
    if (delErr) throw new Error(delErr.message);

    // Deletar usuários do Auth
    for (const uid of userIds) {
      await supabaseAdmin.auth.admin.deleteUser(uid);
    }

    return { ok: true };
  });
