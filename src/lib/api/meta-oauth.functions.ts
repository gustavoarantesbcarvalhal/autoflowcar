import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const GRAPH_API = "https://graph.facebook.com/v19.0";

async function assertAdminLoja(supabase: SupabaseClient<Database>) {
  const { data, error } = await supabase.rpc("get_meu_perfil");
  if (error || !data || !data[0]) throw new Error("Não autenticado");
  const { perfil, tenant_id } = data[0] as { perfil: string; tenant_id: string };
  if (perfil !== "admin_loja") throw new Error("Apenas o admin da loja pode gerenciar integrações");
  return { perfil, tenant_id };
}

// HMAC-SHA256 state signing/verification (Web Crypto — available in Node 18+)
async function signPayload(payload: string): Promise<string> {
  const secret = process.env.META_APP_SECRET ?? "insecure-fallback";
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(mac)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function verifyState(state: string): Promise<{ tenant_id: string }> {
  const dot = state.lastIndexOf(".");
  if (dot < 0) throw new Error("State inválido");
  const payloadB64 = state.slice(0, dot);
  const sig        = state.slice(dot + 1);
  const expected   = await signPayload(payloadB64);
  if (sig !== expected) throw new Error("Assinatura de state inválida");
  let parsed: { t: string; ts: number };
  try {
    parsed = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
  } catch {
    throw new Error("State corrompido");
  }
  if (Date.now() - parsed.ts > 10 * 60 * 1000) throw new Error("State expirado. Inicie novamente.");
  return { tenant_id: parsed.t };
}

// ============================================================
// iniciarMetaOAuth — gera URL OAuth + state HMAC-assinado
// ============================================================
export const iniciarMetaOAuth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { tenant_id } = await assertAdminLoja(context.supabase);

    const appId       = process.env.META_APP_ID ?? "";
    const redirectUri = process.env.META_OAUTH_REDIRECT_URI ?? "";

    if (!appId) throw new Error("Meta App não configurado. Contacte o suporte DriverLeads.");

    const raw       = JSON.stringify({ t: tenant_id, ts: Date.now() });
    const payloadB64 = Buffer.from(raw).toString("base64url");
    const sig        = await signPayload(payloadB64);
    const state      = `${payloadB64}.${sig}`;

    const scopes = [
      "pages_show_list",
      "pages_read_engagement",
      "leads_retrieval",
      "ads_read",
      "pages_manage_metadata",
    ].join(",");

    const url = new URL("https://www.facebook.com/dialog/oauth");
    url.searchParams.set("client_id", appId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("scope", scopes);
    url.searchParams.set("state", state);
    url.searchParams.set("response_type", "code");

    return { url: url.toString() };
  });

// ============================================================
// trocarCodigoMeta — chamado pela rota /meta-oauth-callback
// Não requer auth: o state HMAC prova a identidade do tenant.
// ============================================================
export const trocarCodigoMeta = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    code:  z.string().min(1),
    state: z.string().min(1),
  }))
  .handler(async ({ data }) => {
    const { tenant_id } = await verifyState(data.state);

    const appId       = process.env.META_APP_ID       ?? "";
    const appSecret   = process.env.META_APP_SECRET   ?? "";
    const redirectUri = process.env.META_OAUTH_REDIRECT_URI ?? "";

    // Troca code por short-lived token
    const shortRes = await fetch(
      `${GRAPH_API}/oauth/access_token?` +
      new URLSearchParams({ client_id: appId, client_secret: appSecret, code: data.code, redirect_uri: redirectUri }),
    );
    if (!shortRes.ok) {
      const err = await shortRes.json() as { error?: { message?: string } };
      throw new Error(err?.error?.message ?? "Erro ao trocar código OAuth");
    }
    const shortData = await shortRes.json() as { access_token: string };

    // Eleva para long-lived token (~60 dias)
    const longRes = await fetch(
      `${GRAPH_API}/oauth/access_token?` +
      new URLSearchParams({
        grant_type:        "fb_exchange_token",
        client_id:         appId,
        client_secret:     appSecret,
        fb_exchange_token: shortData.access_token,
      }),
    );
    const longData = longRes.ok
      ? await longRes.json() as { access_token: string; expires_in?: number }
      : { access_token: shortData.access_token, expires_in: 3600 };

    const expiresAt = new Date(Date.now() + (longData.expires_in ?? 5_184_000) * 1000).toISOString();

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("tenant_integrations")
      .upsert({
        tenant_id,
        platform:                  "meta_lead_ads",
        fb_user_access_token:      longData.access_token,
        fb_user_token_expires_at:  expiresAt,
        // status permanece inativo até selecionar a página
        status:                    "inativo",
        last_error:                null,
        last_error_at:             null,
      }, { onConflict: "tenant_id,platform" });

    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// listarPaginasMeta — busca páginas do usuário na Graph API
// ============================================================
export const listarPaginasMeta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { tenant_id } = await assertAdminLoja(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: integration } = await supabaseAdmin
      .from("tenant_integrations")
      .select("fb_user_access_token")
      .eq("tenant_id", tenant_id)
      .eq("platform", "meta_lead_ads")
      .maybeSingle();

    if (!integration?.fb_user_access_token) {
      throw new Error("Token não encontrado. Reconecte com o Facebook.");
    }

    const res = await fetch(
      `${GRAPH_API}/me/accounts?fields=id,name,access_token&access_token=${integration.fb_user_access_token}`,
    );
    if (!res.ok) {
      const err = await res.json() as { error?: { message?: string } };
      throw new Error(err?.error?.message ?? "Erro ao buscar páginas");
    }
    const d = await res.json() as { data: Array<{ id: string; name: string; access_token: string }> };
    return { pages: d.data ?? [] };
  });

// ============================================================
// listarContasAnunciosMeta — busca ad accounts (opcional)
// ============================================================
export const listarContasAnunciosMeta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { tenant_id } = await assertAdminLoja(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: integration } = await supabaseAdmin
      .from("tenant_integrations")
      .select("fb_user_access_token")
      .eq("tenant_id", tenant_id)
      .eq("platform", "meta_lead_ads")
      .maybeSingle();

    if (!integration?.fb_user_access_token) throw new Error("Token não encontrado.");

    const res = await fetch(
      `${GRAPH_API}/me/adaccounts?fields=id,name,account_status&access_token=${integration.fb_user_access_token}`,
    );
    if (!res.ok) {
      const err = await res.json() as { error?: { message?: string } };
      throw new Error(err?.error?.message ?? "Erro ao buscar contas de anúncios");
    }
    const d = await res.json() as { data: Array<{ id: string; name: string; account_status: number }> };
    // account_status === 1 → ativa
    return { accounts: (d.data ?? []).filter((a) => a.account_status === 1) };
  });

// ============================================================
// conectarPaginaMeta — inscreve a página no webhook + salva
// ============================================================
export const conectarPaginaMeta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    page_id:           z.string().min(1),
    page_access_token: z.string().min(1),
    page_name:         z.string().min(1),
  }))
  .handler(async ({ data, context }) => {
    const { tenant_id } = await assertAdminLoja(context.supabase);

    // Inscreve a página no webhook do app (leadgen events)
    const subRes = await fetch(
      `${GRAPH_API}/${data.page_id}/subscribed_apps?access_token=${data.page_access_token}&subscribed_fields=leadgen`,
      { method: "POST" },
    );
    if (!subRes.ok) {
      const err = await subRes.json() as { error?: { message?: string } };
      throw new Error(err?.error?.message ?? "Erro ao ativar webhook na página Meta");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("tenant_integrations")
      .upsert({
        tenant_id,
        platform:                  "meta_lead_ads",
        fb_page_id:                data.page_id,
        fb_page_access_token:      data.page_access_token,
        fb_page_name:              data.page_name,
        fb_webhook_subscribed_at:  new Date().toISOString(),
        status:                    "ativo",
        last_error:                null,
        last_error_at:             null,
      }, { onConflict: "tenant_id,platform" });

    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// salvarContaAnunciosMeta — persiste ad account selecionada
// ============================================================
export const salvarContaAnunciosMeta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    ad_account_id:   z.string().min(1),
    ad_account_name: z.string().min(1),
  }))
  .handler(async ({ data, context }) => {
    const { tenant_id } = await assertAdminLoja(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin
      .from("tenant_integrations")
      .update({ fb_ad_account_id: data.ad_account_id, fb_ad_account_name: data.ad_account_name })
      .eq("tenant_id", tenant_id)
      .eq("platform", "meta_lead_ads");

    if (error) throw new Error(error.message);
    return { ok: true };
  });
