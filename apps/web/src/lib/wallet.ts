import { randomUUID } from "node:crypto";
import { mpFetch } from "@/lib/billing";
import { serviceClient } from "@/lib/pix";

export const TOPUP_MIN_CENTS = 1000;
export const TOPUP_MAX_CENTS = 50000;
const TOPUP_EXPIRES_MINUTES = 60;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type WalletTopup = { id: string; amount_cents: number; qr_code: string | null; qr_code_base64: string | null; expires_at: string | null };

export function formatBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Creates a Pix top-up for a resident. Amount is validated here (whole reais between the limits); the payment is the source of truth.
export async function createWalletTopup(args: { organizationId: string; userId: string; amountCents: number; payerEmail: string; origin: string }): Promise<WalletTopup> {
  if (!Number.isInteger(args.amountCents) || args.amountCents % 100 !== 0 || args.amountCents < TOPUP_MIN_CENTS || args.amountCents > TOPUP_MAX_CENTS) throw new Error("amount_invalid");
  const supabase = serviceClient();
  const { data: org } = await supabase.from("organizations").select("account_type, wallet_enabled").eq("id", args.organizationId).maybeSingle();
  if (!org || org.account_type !== "condominio" || !org.wallet_enabled) throw new Error("wallet_disabled");
  const topupId = randomUUID();
  const expiresAt = new Date(Date.now() + TOPUP_EXPIRES_MINUTES * 60_000);
  const { error: insertError } = await supabase.from("wallet_topups").insert({ id: topupId, organization_id: args.organizationId, user_id: args.userId, amount_cents: args.amountCents, expires_at: expiresAt.toISOString() });
  if (insertError) throw new Error("topup_insert_failed");
  try {
    const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
    const notificationUrl = new URL("/api/billing/mercadopago/webhook", args.origin);
    if (bypass) notificationUrl.searchParams.set("x-vercel-protection-bypass", bypass);
    const payment = await mpFetch("/v1/payments", {
      method: "POST",
      headers: { "X-Idempotency-Key": topupId },
      body: JSON.stringify({
        transaction_amount: args.amountCents / 100,
        description: "Telektro - saldo para recargas",
        payment_method_id: "pix",
        external_reference: `wt:${topupId}`,
        notification_url: notificationUrl.toString(),
        date_of_expiration: expiresAt.toISOString().replace("Z", "+00:00"),
        payer: { email: process.env.MERCADOPAGO_PAYER_EMAIL_OVERRIDE || args.payerEmail },
      }),
    });
    const data = payment?.point_of_interaction?.transaction_data ?? {};
    if (!payment.id || !data.qr_code) throw new Error("pix_no_qr");
    const row = { mp_payment_id: String(payment.id), qr_code: String(data.qr_code), qr_code_base64: data.qr_code_base64 ? String(data.qr_code_base64) : null };
    const { error } = await supabase.from("wallet_topups").update(row).eq("id", topupId);
    if (error) throw new Error("topup_update_failed");
    return { id: topupId, amount_cents: args.amountCents, ...row, expires_at: expiresAt.toISOString() };
  } catch (caught) {
    await supabase.from("wallet_topups").delete().eq("id", topupId).eq("status", "pending");
    throw caught;
  }
}

// Reads the payment from Mercado Pago (never trusts the notification) and credits the wallet exactly once.
export async function applyWalletPayment(paymentId: string): Promise<"paid" | "expired" | "pending" | "ignored"> {
  const payment = await mpFetch(`/v1/payments/${encodeURIComponent(paymentId)}`);
  const reference = String(payment.external_reference ?? "");
  const topupId = reference.startsWith("wt:") ? reference.slice(3) : "";
  if (payment.payment_method_id !== "pix" || !uuidPattern.test(topupId)) return "ignored";
  const supabase = serviceClient();
  const { data: topup } = await supabase.from("wallet_topups").select("id, organization_id, user_id, amount_cents, status, mp_payment_id").eq("id", topupId).maybeSingle();
  if (!topup || topup.mp_payment_id !== String(payment.id)) return "ignored";
  if (topup.status === "paid") return "paid";
  const status = String(payment.status ?? "");
  if (["cancelled", "expired", "rejected"].includes(status)) {
    await supabase.from("wallet_topups").update({ status: "expired" }).eq("id", topup.id).eq("status", "pending");
    return "expired";
  }
  if (status !== "approved") return "pending";
  // The paid amount must be exactly what this top-up asked for.
  if (Math.round(Number(payment.transaction_amount) * 100) !== topup.amount_cents || (payment.currency_id && payment.currency_id !== "BRL")) return "ignored";
  // Credit first (unique per payment id, so a repeated notification is a no-op), then mark the top-up paid.
  const { error: ledgerError } = await supabase.from("wallet_ledger").upsert({
    organization_id: topup.organization_id, user_id: topup.user_id, entry_type: "topup", amount_cents: topup.amount_cents, reference: String(payment.id),
    details: { topup_id: topup.id, method: "pix" },
  }, { onConflict: "entry_type,reference", ignoreDuplicates: true });
  if (ledgerError) throw new Error("ledger_insert_failed");
  await supabase.from("wallet_topups").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", topup.id).eq("status", "pending");
  return "paid";
}

export async function syncPendingTopups(organizationId: string, userId: string): Promise<boolean> {
  try {
    const supabase = serviceClient();
    const { data } = await supabase.from("wallet_topups").select("mp_payment_id").eq("organization_id", organizationId).eq("user_id", userId).eq("status", "pending").not("mp_payment_id", "is", null).limit(3);
    let paid = false;
    for (const row of data ?? []) if ((await applyWalletPayment(String(row.mp_payment_id))) === "paid") paid = true;
    return paid;
  } catch {
    return false;
  }
}
