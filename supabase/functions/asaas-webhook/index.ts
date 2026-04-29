import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

// Webhook público do Asaas.
// Autenticação: header `asaas-access-token` deve bater com o secret ASAAS_WEBHOOK_TOKEN.
// Mapeia eventos de Payment/Subscription para profiles.subscription_status.

const STATUS_ACTIVE = "active";
const STATUS_OVERDUE = "overdue";
const STATUS_INACTIVE = "inactive";

function eventToStatus(event: string): string | null {
  switch (event) {
    case "PAYMENT_CONFIRMED":
    case "PAYMENT_RECEIVED":
    case "PAYMENT_RECEIVED_IN_CASH":
    case "PAYMENT_APPROVED_BY_RISK_ANALYSIS":
      return STATUS_ACTIVE;
    case "PAYMENT_OVERDUE":
      return STATUS_OVERDUE;
    case "PAYMENT_DELETED":
    case "PAYMENT_REFUNDED":
    case "PAYMENT_REFUND_IN_PROGRESS":
    case "PAYMENT_CHARGEBACK_REQUESTED":
    case "PAYMENT_CHARGEBACK_DISPUTE":
    case "PAYMENT_REPROVED_BY_RISK_ANALYSIS":
    case "SUBSCRIPTION_DELETED":
    case "SUBSCRIPTION_INACTIVATED":
      return STATUS_INACTIVE;
    default:
      return null;
  }
}

function ok(body: unknown = { received: true }) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS" || req.method === "GET") {
    return ok({ ok: true });
  }

  try {
    const expectedToken = Deno.env.get("ASAAS_WEBHOOK_TOKEN");
    const receivedToken = req.headers.get("asaas-access-token");
    if (!expectedToken || receivedToken !== expectedToken) {
      console.warn("asaas-webhook: invalid access token header");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    let body: Record<string, unknown> = {};
    try {
      const raw = await req.text();
      if (raw) body = JSON.parse(raw);
    } catch (_e) {
      body = {};
    }

    const event = (body.event as string | undefined) ?? "";
    const payment = (body.payment as Record<string, unknown> | undefined) ?? undefined;
    const subscription = (body.subscription as Record<string, unknown> | undefined) ?? undefined;

    const customerId =
      (payment?.customer as string | undefined) ??
      (subscription?.customer as string | undefined) ??
      null;
    const subscriptionId =
      (payment?.subscription as string | undefined) ??
      (subscription?.id as string | undefined) ??
      null;

    const newStatus = eventToStatus(event);
    if (!newStatus) {
      console.log("asaas-webhook: ignoring event", event);
      return ok();
    }

    if (!customerId && !subscriptionId) {
      console.warn("asaas-webhook: event without customer/subscription id", event);
      return ok();
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Localiza profile por customer_id (preferido) ou subscription_id (fallback).
    let profileId: string | null = null;
    if (customerId) {
      const { data, error } = await supabase
        .from("profiles")
        .select("id")
        .eq("asaas_customer_id", customerId)
        .maybeSingle();
      if (error) console.error("asaas-webhook: profile by customer error", error);
      profileId = data?.id ?? null;
    }
    if (!profileId && subscriptionId) {
      const { data, error } = await supabase
        .from("profiles")
        .select("id")
        .eq("asaas_subscription_id", subscriptionId)
        .maybeSingle();
      if (error) console.error("asaas-webhook: profile by subscription error", error);
      profileId = data?.id ?? null;
    }

    if (!profileId) {
      console.warn("asaas-webhook: no matching profile", { customerId, subscriptionId, event });
      return ok();
    }

    const { error: updErr } = await supabase
      .from("profiles")
      .update({ subscription_status: newStatus })
      .eq("id", profileId);

    if (updErr) {
      console.error("asaas-webhook: update profile error", updErr);
      return ok();
    }

    console.log("asaas-webhook: status updated", { profileId, event, newStatus });
    return ok();
  } catch (err) {
    console.error("asaas-webhook unexpected error", err);
    return ok();
  }
});
