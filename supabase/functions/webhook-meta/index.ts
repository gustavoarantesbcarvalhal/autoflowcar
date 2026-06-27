// Edge Function: webhook-meta
// Recebe leads do Meta Lead Ads (Facebook + Instagram).
//
// GET  → verificação do webhook pelo Meta (hub.challenge)
// POST → notificação de lead (leadgen_id) → busca dados na Graph API → insere customer
//
// Env vars necessárias (Supabase Secrets):
//   META_APP_SECRET         — app secret do Meta App (DriverLeads)
//   META_WEBHOOK_VERIFY_TOKEN — token configurado no painel do Meta App

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GRAPH_API = "https://graph.facebook.com/v19.0";

Deno.serve(async (req: Request) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const appSecret   = Deno.env.get("META_APP_SECRET") ?? "";
  const verifyToken = Deno.env.get("META_WEBHOOK_VERIFY_TOKEN") ?? "";

  // ── GET: verificação do endpoint pelo Meta ──────────────────
  if (req.method === "GET") {
    const url    = new URL(req.url);
    const mode   = url.searchParams.get("hub.mode");
    const token  = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === verifyToken && challenge) {
      return new Response(challenge, { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // ── POST: evento de lead ────────────────────────────────────
  const rawBody = await req.text();

  // Validar assinatura HMAC-SHA256
  const sigHeader = req.headers.get("x-hub-signature-256") ?? "";
  if (appSecret && sigHeader) {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(appSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const mac  = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
    const hex  = Array.from(new Uint8Array(mac)).map((b) => b.toString(16).padStart(2, "0")).join("");
    const expected = `sha256=${hex}`;
    if (sigHeader !== expected) {
      console.error("[webhook-meta] HMAC inválido");
      return new Response("Forbidden", { status: 403 });
    }
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  // Meta envia entry[] com changes[]
  const entries = (payload.entry as Array<Record<string, unknown>>) ?? [];
  const db = createClient(supabaseUrl, serviceKey);

  for (const entry of entries) {
    const pageId  = String(entry.id ?? "");
    const changes = (entry.changes as Array<Record<string, unknown>>) ?? [];

    for (const change of changes) {
      if (change.field !== "leadgen") continue;

      const value    = change.value as Record<string, unknown>;
      const leadgenId = String(value.leadgen_id ?? "");
      if (!leadgenId || !pageId) continue;

      // Dedup de evento (idempotência)
      const hashBuf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`meta:${leadgenId}`));
      const hashHex = Array.from(new Uint8Array(hashBuf)).map((b) => b.toString(16).padStart(2, "0")).join("");

      const { data: dupEvent } = await db
        .from("webhook_events_log")
        .select("id")
        .eq("payload_hash", hashHex)
        .maybeSingle();

      if (dupEvent) continue; // já processado

      // Identificar tenant pelo page_id
      const { data: integration } = await db
        .from("tenant_integrations")
        .select("id, tenant_id, fb_page_access_token, status")
        .eq("fb_page_id", pageId)
        .eq("platform", "meta_lead_ads")
        .maybeSingle();

      if (!integration || integration.status !== "ativo") {
        await db.from("webhook_events_log").insert({
          tenant_id:    null,
          platform:     "meta_lead_ads",
          payload_hash: hashHex,
          status:       "error",
          error_message: `Nenhuma integração ativa para page_id=${pageId}`,
          raw_payload:  payload,
        });
        continue;
      }

      const tenantId    = integration.tenant_id as string;
      const accessToken = integration.fb_page_access_token as string;

      // Buscar dados do lead na Graph API
      let leadData: Record<string, unknown> | null = null;
      try {
        const graphRes = await fetch(`${GRAPH_API}/${leadgenId}?access_token=${accessToken}&fields=field_data,created_time`);
        if (!graphRes.ok) throw new Error(`Graph API ${graphRes.status}`);
        leadData = await graphRes.json() as Record<string, unknown>;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Erro Graph API";
        await db.from("webhook_events_log").insert({
          tenant_id:    tenantId,
          platform:     "meta_lead_ads",
          payload_hash: hashHex,
          status:       "error",
          error_message: msg,
          raw_payload:  payload,
        });
        await db.from("tenant_integrations")
          .update({ status: "erro", last_error: msg, last_error_at: new Date().toISOString() })
          .eq("id", integration.id);
        continue;
      }

      // Extrair campos do lead
      const fields = (leadData.field_data as Array<{ name: string; values: string[] }>) ?? [];
      function getField(name: string): string {
        const f = fields.find((x) => x.name === name || x.name === name.replace("_", " "));
        return f?.values?.[0] ?? "";
      }
      const name  = getField("full_name") || getField("first_name") + " " + getField("last_name");
      const phone = getField("phone_number") || getField("phone");
      const email = getField("email");

      if (!name.trim()) {
        await db.from("webhook_events_log").insert({
          tenant_id:    tenantId,
          platform:     "meta_lead_ads",
          payload_hash: hashHex,
          status:       "error",
          error_message: "Lead sem nome",
          raw_payload:  leadData,
        });
        continue;
      }

      const normalizedPhone = phone.replace(/^\+?55/, "").replace(/\D/g, "") || null;

      // Deduplicação de lead dentro do tenant
      let existingCustomerId: string | null = null;
      if (normalizedPhone) {
        const { data: dedup } = await db
          .from("lead_dedup_index")
          .select("customer_id")
          .eq("tenant_id", tenantId)
          .eq("normalized_phone", normalizedPhone)
          .maybeSingle();
        if (dedup) existingCustomerId = dedup.customer_id as string;
      }

      let customerId: string;
      let eventStatus: string;

      if (existingCustomerId) {
        customerId  = existingCustomerId;
        eventStatus = "duplicated";

        await db.from("customers")
          .update({ last_contact_at: new Date().toISOString() })
          .eq("id", customerId).eq("tenant_id", tenantId);

        await db.from("interactions").insert({
          customer_id: customerId,
          tenant_id:   tenantId,
          type:        "nota",
          content:     `Lead recebido novamente via Meta Lead Ads (leadgen_id: ${leadgenId}) em ${new Date().toLocaleString("pt-BR")}`,
        });
      } else {
        const source = fields.find((f) => f.name === "campaign_name") ? "facebook" : "facebook";

        const { data: customer, error: custErr } = await db
          .from("customers")
          .insert({
            tenant_id:       tenantId,
            name:            name.trim(),
            phone:           phone || null,
            whatsapp:        phone || null,
            email:           email || null,
            source,
            source_platform: "meta_lead_ads",
            source_campaign: getField("campaign_name") || getField("ad_name") || null,
            source_raw:      leadData,
            status:          "novo_lead",
          })
          .select("id")
          .single();

        if (custErr || !customer) {
          await db.from("webhook_events_log").insert({
            tenant_id:    tenantId,
            platform:     "meta_lead_ads",
            payload_hash: hashHex,
            status:       "error",
            error_message: custErr?.message ?? "Erro ao inserir customer",
            raw_payload:  leadData,
          });
          continue;
        }

        customerId  = customer.id as string;
        eventStatus = "processed";

        await db.from("interactions").insert({
          customer_id: customerId,
          tenant_id:   tenantId,
          type:        "nota",
          content:     `Lead recebido via Meta Lead Ads (leadgen_id: ${leadgenId}) em ${new Date().toLocaleString("pt-BR")}`,
        });

        await db.from("lead_dedup_index").upsert({
          tenant_id:        tenantId,
          customer_id:      customerId,
          normalized_phone: normalizedPhone,
          email_lower:      email ? email.toLowerCase() : null,
        }, { onConflict: "tenant_id,normalized_phone", ignoreDuplicates: true });
      }

      await db.from("webhook_events_log").insert({
        tenant_id:           tenantId,
        platform:            "meta_lead_ads",
        payload_hash:        hashHex,
        status:              eventStatus,
        created_customer_id: customerId,
        raw_payload:         leadData,
        processed_at:        new Date().toISOString(),
      });

      await db.from("tenant_integrations")
        .update({ last_sync_at: new Date().toISOString(), last_error: null, last_error_at: null })
        .eq("id", integration.id);
    }
  }

  // Meta exige 200 OK mesmo que haja erro interno
  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
