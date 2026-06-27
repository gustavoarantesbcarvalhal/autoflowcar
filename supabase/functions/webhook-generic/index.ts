// Edge Function: webhook-generic
// Recebe leads de sites, landing pages e APIs próprias.
// Autenticação: X-DL-Token header → identifica o tenant.
//
// Payload esperado (application/json):
//   { name, phone?, email?, message?, source? }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-DL-Token",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const db          = createClient(supabaseUrl, serviceKey);

  // 1. Identificar tenant pelo token — NUNCA pelo payload
  const token = req.headers.get("X-DL-Token") ?? req.headers.get("x-dl-token") ?? "";
  if (!token) {
    return new Response(JSON.stringify({ error: "X-DL-Token header obrigatório" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: integration, error: intErr } = await db
    .from("tenant_integrations")
    .select("id, tenant_id, status")
    .eq("webhook_verify_token", token)
    .eq("platform", "generic")
    .maybeSingle();

  if (intErr || !integration) {
    return new Response(JSON.stringify({ error: "Token inválido" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (integration.status !== "ativo") {
    return new Response(JSON.stringify({ error: "Integração inativa" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const tenantId = integration.tenant_id as string;

  // 2. Parse e validação do payload
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const name  = String(body.name  ?? "").trim();
  const phone = String(body.phone ?? "").trim();
  const email = String(body.email ?? "").trim();

  if (!name) {
    return new Response(JSON.stringify({ error: "Campo 'name' obrigatório" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 3. Deduplicação por payload hash (idempotência)
  const rawText = JSON.stringify({ tenantId, name, phone, email });
  const hashBuf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rawText));
  const hashHex = Array.from(new Uint8Array(hashBuf)).map((b) => b.toString(16).padStart(2, "0")).join("");

  const { data: existingEvent } = await db
    .from("webhook_events_log")
    .select("id")
    .eq("payload_hash", hashHex)
    .maybeSingle();

  if (existingEvent) {
    return new Response(JSON.stringify({ ok: true, duplicated: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 4. Normalizar telefone
  const normalizedPhone = phone.replace(/^\+?55/, "").replace(/\D/g, "") || null;

  // 5. Deduplicação de lead dentro do tenant
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

    await db.from("customers").update({ last_contact_at: new Date().toISOString() })
      .eq("id", customerId).eq("tenant_id", tenantId);

    await db.from("interactions").insert({
      customer_id: customerId,
      tenant_id:   tenantId,
      type:        "nota",
      content:     `Lead recebido novamente via API/Site em ${new Date().toLocaleString("pt-BR")}`,
    });
  } else {
    const { data: customer, error: custErr } = await db
      .from("customers")
      .insert({
        tenant_id:       tenantId,
        name,
        phone:           phone || null,
        whatsapp:        phone || null,
        email:           email || null,
        source:          "site",
        source_platform: "generic",
        source_campaign: String(body.source ?? "") || null,
        source_raw:      body,
        status:          "novo_lead",
        notes:           body.message ? String(body.message) : null,
      })
      .select("id")
      .single();

    if (custErr || !customer) {
      await db.from("webhook_events_log").insert({
        tenant_id:     tenantId,
        platform:      "generic",
        payload_hash:  hashHex,
        status:        "error",
        error_message: custErr?.message ?? "Erro ao inserir customer",
        raw_payload:   body,
      });
      return new Response(JSON.stringify({ error: "Erro interno" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    customerId  = customer.id as string;
    eventStatus = "processed";

    await db.from("interactions").insert({
      customer_id: customerId,
      tenant_id:   tenantId,
      type:        "nota",
      content:     `Lead recebido via API/Site${body.source ? ` (${body.source})` : ""} em ${new Date().toLocaleString("pt-BR")}`,
    });

    // Notificação interna
    await db.from("notifications").insert({
      tenant_id: tenantId,
      type:      "novo_lead",
      title:     `Novo lead: ${name}`,
      body:      phone || email || null,
      metadata:  {
        customer_id: customerId,
        platform:    "generic",
        source:      body.source ?? null,
      },
    });

    await db.from("lead_dedup_index").upsert({
      tenant_id:        tenantId,
      customer_id:      customerId,
      normalized_phone: normalizedPhone,
      email_lower:      email ? email.toLowerCase() : null,
    }, { onConflict: "tenant_id,normalized_phone", ignoreDuplicates: true });

    await db.from("tenant_integrations")
      .update({ last_sync_at: new Date().toISOString(), status: "ativo" })
      .eq("id", integration.id);
  }

  await db.from("webhook_events_log").insert({
    tenant_id:           tenantId,
    platform:            "generic",
    payload_hash:        hashHex,
    status:              eventStatus,
    created_customer_id: customerId,
    raw_payload:         body,
    processed_at:        new Date().toISOString(),
  });

  return new Response(JSON.stringify({ ok: true, customer_id: customerId }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
