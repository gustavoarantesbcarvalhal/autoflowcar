// Edge Function: webhook-whatsapp
// Recebe mensagens do WhatsApp Business Cloud API.
// Identifica o tenant pelo phone_number_id (número da loja).
//
// GET  → verificação do endpoint pelo Meta
// POST → mensagem recebida (Click-to-WhatsApp ou mensagem orgânica)
//
// Env vars:
//   WA_WEBHOOK_VERIFY_TOKEN  — token de verificação (configurado no Meta App)
//   META_APP_SECRET          — app secret para validar HMAC

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const appSecret   = Deno.env.get("META_APP_SECRET") ?? "";
  const verifyToken = Deno.env.get("WA_WEBHOOK_VERIFY_TOKEN") ?? Deno.env.get("META_WEBHOOK_VERIFY_TOKEN") ?? "";

  // ── GET: verificação ────────────────────────────────────────
  if (req.method === "GET") {
    const url       = new URL(req.url);
    const mode      = url.searchParams.get("hub.mode");
    const token     = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === verifyToken && challenge) {
      return new Response(challenge, { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const rawBody = await req.text();

  // Validar HMAC
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
    if (`sha256=${hex}` !== sigHeader) {
      return new Response("Forbidden", { status: 403 });
    }
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  if (payload.object !== "whatsapp_business_account") {
    return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
  }

  const db = createClient(supabaseUrl, serviceKey);

  const entries = (payload.entry as Array<Record<string, unknown>>) ?? [];
  for (const entry of entries) {
    const changes = (entry.changes as Array<Record<string, unknown>>) ?? [];
    for (const change of changes) {
      if (change.field !== "messages") continue;

      const value         = change.value as Record<string, unknown>;
      const metadata      = value.metadata as Record<string, unknown> | null;
      const phoneNumberId = String(metadata?.phone_number_id ?? "");
      if (!phoneNumberId) continue;

      const messages = (value.messages as Array<Record<string, unknown>>) ?? [];
      const contacts = (value.contacts as Array<Record<string, unknown>>) ?? [];
      if (!messages.length) continue;

      const msg     = messages[0];
      const contact = contacts[0] ?? {};
      const profile = (contact.profile as Record<string, unknown>) ?? {};

      const fromPhone  = String(msg.from ?? "");
      const fromName   = String(profile.name ?? fromPhone);
      const msgText    = (msg.type === "text") ? String((msg.text as Record<string, unknown>)?.body ?? "") : "";
      const referral   = msg.referral as Record<string, unknown> | null;
      const isCTWA     = referral?.source_type === "ad";
      const sourcePlatform = isCTWA ? "meta_ctwa" : "whatsapp_organic";

      // Dedup de evento
      const msgId    = String(msg.id ?? "");
      const hashBuf  = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`wa:${msgId}:${fromPhone}`));
      const hashHex  = Array.from(new Uint8Array(hashBuf)).map((b) => b.toString(16).padStart(2, "0")).join("");

      const { data: dupEvent } = await db
        .from("webhook_events_log")
        .select("id")
        .eq("payload_hash", hashHex)
        .maybeSingle();

      if (dupEvent) continue;

      // Identificar tenant pelo phone_number_id
      const { data: integration } = await db
        .from("tenant_integrations")
        .select("id, tenant_id, status")
        .eq("waba_phone_number_id", phoneNumberId)
        .eq("platform", "meta_ctwa")
        .maybeSingle();

      if (!integration || integration.status !== "ativo") {
        await db.from("webhook_events_log").insert({
          tenant_id:    null,
          platform:     sourcePlatform,
          payload_hash: hashHex,
          status:       "error",
          error_message: `Nenhuma integração para phone_number_id=${phoneNumberId}`,
          raw_payload:  payload,
        });
        continue;
      }

      const tenantId        = integration.tenant_id as string;
      const normalizedPhone = fromPhone.replace(/^\+?55/, "").replace(/\D/g, "") || null;

      // Deduplicação de lead
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
          type:        "whatsapp",
          content:     msgText || `Mensagem WhatsApp recebida em ${new Date().toLocaleString("pt-BR")}`,
        });
      } else {
        const { data: customer, error: custErr } = await db
          .from("customers")
          .insert({
            tenant_id:       tenantId,
            name:            fromName,
            phone:           fromPhone || null,
            whatsapp:        fromPhone || null,
            source:          "instagram",
            source_platform: sourcePlatform,
            source_campaign: isCTWA ? String(referral?.headline ?? "") : null,
            source_raw:      { message: msg, contact, referral },
            status:          "novo_lead",
            notes:           msgText || null,
          })
          .select("id")
          .single();

        if (custErr || !customer) {
          await db.from("webhook_events_log").insert({
            tenant_id:    tenantId,
            platform:     sourcePlatform,
            payload_hash: hashHex,
            status:       "error",
            error_message: custErr?.message ?? "Erro ao inserir customer",
            raw_payload:  payload,
          });
          continue;
        }

        customerId  = customer.id as string;
        eventStatus = "processed";

        await db.from("interactions").insert({
          customer_id: customerId,
          tenant_id:   tenantId,
          type:        "whatsapp",
          content:     msgText || `Mensagem WhatsApp recebida${isCTWA ? " via anúncio" : ""} em ${new Date().toLocaleString("pt-BR")}`,
        });

        await db.from("lead_dedup_index").upsert({
          tenant_id:        tenantId,
          customer_id:      customerId,
          normalized_phone: normalizedPhone,
          email_lower:      null,
        }, { onConflict: "tenant_id,normalized_phone", ignoreDuplicates: true });
      }

      await db.from("webhook_events_log").insert({
        tenant_id:           tenantId,
        platform:            sourcePlatform,
        payload_hash:        hashHex,
        status:              eventStatus,
        created_customer_id: customerId,
        raw_payload:         { message: msg, contact, referral },
        processed_at:        new Date().toISOString(),
      });

      await db.from("tenant_integrations")
        .update({ last_sync_at: new Date().toISOString(), last_error: null, last_error_at: null })
        .eq("id", integration.id);
    }
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
