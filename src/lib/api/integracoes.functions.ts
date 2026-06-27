import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const GRAPH_API = "https://graph.facebook.com/v19.0";

// ============================================================
// assertAdminLoja — garante que o usuário é admin_loja
// ============================================================
async function assertAdminLoja(supabase: SupabaseClient<Database>) {
  const { data, error } = await supabase.rpc("get_meu_perfil");
  if (error || !data || !data[0]) throw new Error("Não autenticado");
  const { perfil, tenant_id } = data[0] as { perfil: string; tenant_id: string };
  if (perfil !== "admin_loja") throw new Error("Apenas admin da loja pode gerenciar integrações");
  return { perfil, tenant_id };
}

// ============================================================
// salvarMetaIntegracao
// Valida o Page Access Token na Graph API antes de salvar.
// ============================================================
export const salvarMetaIntegracao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      fb_page_id:           z.string().min(1, "ID da Página obrigatório"),
      fb_page_access_token: z.string().min(1, "Page Access Token obrigatório"),
    }),
  )
  .handler(async ({ data, context }) => {
    const { tenant_id } = await assertAdminLoja(context.supabase);

    // Validar token na Graph API
    const res = await fetch(`${GRAPH_API}/me?access_token=${data.fb_page_access_token}&fields=id,name`);
    if (!res.ok) {
      const err = await res.json() as { error?: { message?: string } };
      throw new Error(`Token inválido: ${err?.error?.message ?? "Erro desconhecido"}`);
    }
    const pageInfo = await res.json() as { id?: string; name?: string };
    const pageId   = String(pageInfo.id ?? "");
    if (pageId && pageId !== data.fb_page_id) {
      throw new Error(`O token pertence à página ${pageId}, mas você informou ${data.fb_page_id}`);
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin
      .from("tenant_integrations")
      .upsert({
        tenant_id,
        platform:             "meta_lead_ads",
        fb_page_id:           data.fb_page_id,
        fb_page_access_token: data.fb_page_access_token,
        status:               "ativo",
        last_error:           null,
        last_error_at:        null,
      }, { onConflict: "tenant_id,platform" });

    if (error) throw new Error(error.message);

    return { ok: true, page_name: pageInfo.name ?? "" };
  });

// ============================================================
// salvarWhatsAppIntegracao
// ============================================================
export const salvarWhatsAppIntegracao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      waba_phone_number_id: z.string().min(1, "Phone Number ID obrigatório"),
      wa_api_token:         z.string().min(1, "API Token obrigatório"),
    }),
  )
  .handler(async ({ data, context }) => {
    const { tenant_id } = await assertAdminLoja(context.supabase);

    // Validar token na WhatsApp Business API
    const res = await fetch(
      `${GRAPH_API}/${data.waba_phone_number_id}?access_token=${data.wa_api_token}&fields=display_phone_number,verified_name`,
    );
    if (!res.ok) {
      const err = await res.json() as { error?: { message?: string } };
      throw new Error(`Token inválido: ${err?.error?.message ?? "Erro desconhecido"}`);
    }
    const waInfo = await res.json() as { display_phone_number?: string; verified_name?: string };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin
      .from("tenant_integrations")
      .upsert({
        tenant_id,
        platform:             "meta_ctwa",
        waba_phone_number_id: data.waba_phone_number_id,
        wa_api_token:         data.wa_api_token,
        status:               "ativo",
        last_error:           null,
        last_error_at:        null,
      }, { onConflict: "tenant_id,platform" });

    if (error) throw new Error(error.message);

    return {
      ok:           true,
      phone_number: waInfo.display_phone_number ?? "",
      name:         waInfo.verified_name ?? "",
    };
  });

// ============================================================
// desconectarIntegracao
// ============================================================
export const desconectarIntegracao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ platform: z.string().min(1) }))
  .handler(async ({ data, context }) => {
    const { tenant_id } = await assertAdminLoja(context.supabase);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin
      .from("tenant_integrations")
      .update({
        status:               "inativo",
        fb_page_access_token: null,
        wa_api_token:         null,
        last_sync_at:         null,
        last_error:           null,
        last_error_at:        null,
      })
      .eq("tenant_id", tenant_id)
      .eq("platform", data.platform);

    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// testarIntegracao — faz chamada real à API e retorna resultado
// ============================================================
export const testarIntegracao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ platform: z.string().min(1) }))
  .handler(async ({ data, context }) => {
    const { tenant_id } = await assertAdminLoja(context.supabase);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: integration, error } = await supabaseAdmin
      .from("tenant_integrations")
      .select("*")
      .eq("tenant_id", tenant_id)
      .eq("platform", data.platform)
      .maybeSingle();

    if (error || !integration) throw new Error("Integração não encontrada");

    if (data.platform === "meta_lead_ads") {
      const res = await fetch(
        `${GRAPH_API}/me?access_token=${integration.fb_page_access_token}&fields=id,name`,
      );
      if (!res.ok) {
        const err = await res.json() as { error?: { message?: string } };
        await supabaseAdmin.from("tenant_integrations")
          .update({ status: "erro", last_error: err?.error?.message ?? "Token inválido", last_error_at: new Date().toISOString() })
          .eq("tenant_id", tenant_id).eq("platform", data.platform);
        throw new Error(err?.error?.message ?? "Token inválido");
      }
      const info = await res.json() as { id?: string; name?: string };
      return { ok: true, detail: `Página: ${info.name ?? info.id}` };
    }

    if (data.platform === "meta_ctwa") {
      const res = await fetch(
        `${GRAPH_API}/${integration.waba_phone_number_id}?access_token=${integration.wa_api_token}&fields=display_phone_number,verified_name`,
      );
      if (!res.ok) {
        const err = await res.json() as { error?: { message?: string } };
        await supabaseAdmin.from("tenant_integrations")
          .update({ status: "erro", last_error: err?.error?.message ?? "Token inválido", last_error_at: new Date().toISOString() })
          .eq("tenant_id", tenant_id).eq("platform", data.platform);
        throw new Error(err?.error?.message ?? "Token inválido");
      }
      const info = await res.json() as { display_phone_number?: string; verified_name?: string };
      return { ok: true, detail: `${info.verified_name ?? ""} (${info.display_phone_number ?? ""})` };
    }

    if (data.platform === "generic") {
      return { ok: true, detail: "Webhook genérico sempre disponível" };
    }

    throw new Error("Plataforma desconhecida");
  });

// ============================================================
// regenerarToken — gera novo webhook_verify_token para generic
// ============================================================
export const regenerarToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { tenant_id } = await assertAdminLoja(context.supabase);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const newToken = crypto.randomUUID();

    const { error } = await supabaseAdmin
      .from("tenant_integrations")
      .upsert({
        tenant_id,
        platform:             "generic",
        webhook_verify_token: newToken,
        status:               "ativo",
      }, { onConflict: "tenant_id,platform" });

    if (error) throw new Error(error.message);
    return { ok: true, token: newToken };
  });

// ============================================================
// atualizarDadosLoja — atualiza nome/logo/cor do tenant
// ============================================================
export const atualizarDadosLoja = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      nome:         z.string().min(1, "Nome obrigatório").max(120),
      logo_url:     z.string().url("URL inválida").nullable().optional(),
      cor_primaria: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Cor inválida").nullable().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { tenant_id } = await assertAdminLoja(context.supabase);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin
      .from("tenants")
      .update({
        nome:         data.nome,
        logo_url:     data.logo_url     ?? null,
        cor_primaria: data.cor_primaria ?? undefined,
      })
      .eq("id", tenant_id);

    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// ativarGeneric — cria a integração generic se não existir
// ============================================================
export const ativarGeneric = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { tenant_id } = await assertAdminLoja(context.supabase);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing } = await supabaseAdmin
      .from("tenant_integrations")
      .select("id, webhook_verify_token")
      .eq("tenant_id", tenant_id)
      .eq("platform", "generic")
      .maybeSingle();

    if (existing) return { ok: true, token: existing.webhook_verify_token as string };

    const newToken = crypto.randomUUID();
    const { error } = await supabaseAdmin
      .from("tenant_integrations")
      .insert({
        tenant_id,
        platform:             "generic",
        webhook_verify_token: newToken,
        status:               "ativo",
      });

    if (error) throw new Error(error.message);
    return { ok: true, token: newToken };
  });
