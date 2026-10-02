import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { mpFetch, RESIDENCIAL_PRICE_BRL } from "@/lib/billing";

export const PIX_GRACE_DAYS = 3;
export const PIX_EXPIRES_HOURS = 72;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type PixCharge = { id: string; qr_code: string | null; qr_code_base64: string | null; ticket_url: string | null; expires_at: string | null; amount: number };

export function serviceClient() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("service_role_missing");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
}

function addMonths(date: Date, months: number) {
  const next = new Date(date.getTime());
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}

// Creates (or reuses) the open Pix charge of an organization. The amount is always the server-side price.
export async function createPixCharge(args: { organizationId: string; userId: string; payerEmail: string; origin: string }): Promise<PixCharge> {
  const supabase = serviceClient();
  const nowIso = new Date().toISOString();
  const { data: open } = await supabase.from("pix_charges").select("id, qr_code, qr_code_base64, ticket_url, expires_at, amount")
    .eq("organization_id", args.organizationId).eq("status", "pending").gt("expires_at", nowIso).not("mp_payment_id", "is", null)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (open) return { ...open, amount: Number(open.amount) } as PixCharge;

  const expiresAt = new Date(Date.now() + PIX_EXPIRES_HOURS * 3_600_000);
  const chargeId = randomUUID();
  const { error: insertError } = await supabase.from("pix_charges").insert({ id: chargeId, organization_id: args.organizationId, amount: RESIDENCIAL_PRICE_BRL, status: "pending", expires_at: expiresAt.toISOString(), created_by: args.userId });
  if (insertError) throw new Error("pix_charge_insert_failed");
  try {
    const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
    const notificationUrl = new URL("/api/billing/mercadopago/webhook", args.origin);
    if (bypass) notificationUrl.searchParams.set("x-vercel-protection-bypass", bypass);
    const payment = await mpFetch("/v1/payments", {
      method: "POST",
      headers: { "X-Idempotency-Key": chargeId },
      body: JSON.stringify({
        transaction_amount: RESIDENCIAL_PRICE_BRL,
        description: "Telektro Residencial - mensalidade",
        payment_method_id: "pix",
        external_reference: chargeId,
        notification_url: notificationUrl.toString(),
        date_of_expiration: expiresAt.toISOString().replace("Z", "+00:00"),
        payer: { email: process.env.MERCADOPAGO_PAYER_EMAIL_OVERRIDE || args.payerEmail },
      }),
    });
    const data = payment?.point_of_interaction?.transaction_data ?? {};
    if (!payment.id || !data.qr_code) throw new Error("pix_no_qr");
    const row = { mp_payment_id: String(payment.id), qr_code: String(data.qr_code), qr_code_base64: data.qr_code_base64 ? String(data.qr_code_base64) : null, ticket_url: data.ticket_url ? String(data.ticket_url) : null };
    const { error } = await supabase.from("pix_charges").update(row).eq("id", chargeId);
    if (error) throw new Error("pix_charge_update_failed");
    return { id: chargeId, ...row, expires_at: expiresAt.toISOString(), amount: RESIDENCIAL_PRICE_BRL };
  } catch (caught) {
    await supabase.from("pix_charges").delete().eq("id", chargeId).eq("status", "pending");
    throw caught;
  }
}

// Reads the payment from Mercado Pago (never trusts a notification body) and applies it exactly once.
// Returns "paid" when this charge is paid (now or before), "expired", or "pending".
export async function applyPixPayment(paymentId: string): Promise<"paid" | "expired" | "pending" | "ignored"> {
  const payment = await mpFetch(`/v1/payments/${encodeURIComponent(paymentId)}`);
  const chargeId = String(payment.external_reference ?? "");
  if (payment.payment_method_id !== "pix" || !uuidPattern.test(chargeId)) return "ignored";
  const supabase = serviceClient();
  const { data: charge } = await supabase.from("pix_charges").select("id, organization_id, mp_payment_id, amount, status").eq("id", chargeId).maybeSingle();
  if (!charge || charge.mp_payment_id !== String(payment.id)) return "ignored";
  if (charge.status === "paid") return "paid";
  const status = String(payment.status ?? "");
  if (["cancelled", "expired", "rejected"].includes(status)) {
    await supabase.from("pix_charges").update({ status: "expired" }).eq("id", charge.id).eq("status", "pending");
    return "expired";
  }
  if (status !== "approved") return "pending";
  // Amount and currency must match what we charged, otherwise do nothing.
  if (Number(payment.transaction_amount) !== Number(charge.amount) || (payment.currency_id && payment.currency_id !== "BRL")) return "ignored";

  const { data: org } = await supabase.from("organizations").select("account_type, subscription_status, subscription_provider, trial_ends_at")
    .eq("id", charge.organization_id).maybeSingle();
  if (!org || org.account_type !== "residencial") return "ignored";
  const { data: lastPaid } = await supabase.from("pix_charges").select("period_end").eq("organization_id", charge.organization_id).eq("status", "paid")
    .order("period_end", { ascending: false }).limit(1).maybeSingle();
  // The period starts after the free trial and after any period already paid, so nothing is lost or charged twice.
  const candidates = [Date.now()];
  if (org.subscription_status === "trialing" && org.trial_ends_at) candidates.push(new Date(org.trial_ends_at).getTime());
  if (lastPaid?.period_end) candidates.push(new Date(lastPaid.period_end).getTime());
  const periodStart = new Date(Math.max(...candidates));
  const periodEnd = addMonths(periodStart, 1);

  // Conditional update: only one delivery of the notification can flip pending -> paid.
  const { data: claimed } = await supabase.from("pix_charges").update({ status: "paid", paid_at: new Date().toISOString(), period_start: periodStart.toISOString(), period_end: periodEnd.toISOString() })
    .eq("id", charge.id).eq("status", "pending").select("id");
  if (!claimed?.length) return "paid";

  const cardActive = org.subscription_provider === "mercadopago" && org.subscription_status === "active";
  if (!cardActive) {
    const graceEnd = new Date(periodEnd.getTime() + PIX_GRACE_DAYS * 86_400_000);
    const { error } = await supabase.from("organizations").update({ subscription_status: "past_due", subscription_provider: "mercadopago_pix", current_period_end: graceEnd.toISOString() })
      .eq("id", charge.organization_id).eq("account_type", "residencial");
    if (error) {
      await supabase.from("pix_charges").update({ status: "pending", paid_at: null, period_start: null, period_end: null }).eq("id", charge.id);
      throw new Error("org_update_failed");
    }
  }
  return "paid";
}

// Safety net when the webhook is late: re-check this organization's open charges at Mercado Pago.
export async function syncPendingPix(organizationId: string): Promise<boolean> {
  try {
    const supabase = serviceClient();
    const { data } = await supabase.from("pix_charges").select("mp_payment_id").eq("organization_id", organizationId).eq("status", "pending").not("mp_payment_id", "is", null).limit(3);
    let paid = false;
    for (const row of data ?? []) if ((await applyPixPayment(String(row.mp_payment_id))) === "paid") paid = true;
    return paid;
  } catch {
    return false;
  }
}
