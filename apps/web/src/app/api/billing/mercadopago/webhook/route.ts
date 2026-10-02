import { createHmac, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { applyPixPayment } from "@/lib/pix";
import { applyWalletPayment } from "@/lib/wallet";
import { getAuthorizedPaymentPreapprovalId, getPreapproval, mapPreapprovalStatus } from "@/lib/billing";

export const dynamic = "force-dynamic";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Mercado Pago signs notifications: x-signature "ts=<ts>,v1=<hmac>" over "id:<data.id>;request-id:<x-request-id>;ts:<ts>;".
function validSignature(request: Request, dataId: string) {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  const header = request.headers.get("x-signature") ?? "";
  const requestId = request.headers.get("x-request-id") ?? "";
  if (!secret || !header) return false;
  const parts = Object.fromEntries(header.split(",").map((part) => part.trim().split("=").map((v) => v.trim()) as [string, string]));
  if (!parts.ts || !parts.v1) return false;
  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${parts.ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest();
  const received = Buffer.from(parts.v1, "hex");
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const dataId = String(url.searchParams.get("data.id") ?? (body as { data?: { id?: unknown } }).data?.id ?? "");
  const type = String(url.searchParams.get("type") ?? (body as { type?: unknown }).type ?? "");
  if (!process.env.MERCADOPAGO_WEBHOOK_SECRET || !process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  if (!dataId || !validSignature(request, dataId)) return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  if (type === "payment") {
    // Pix mensalidade: the payment is re-read from Mercado Pago and applied once (see lib/pix.ts).
    try {
      const pix = await applyPixPayment(dataId);
      return NextResponse.json({ ok: true, pix: pix === "ignored" ? await applyWalletPayment(dataId) : pix });
    } catch (error) {
      if (error instanceof Error && error.message === "mercadopago_404") return NextResponse.json({ ok: true, ignored: "unknown_resource" });
      return NextResponse.json({ error: "processing_failed" }, { status: 500 });
    }
  }
  if (!["subscription_preapproval", "subscription_authorized_payment"].includes(type)) return NextResponse.json({ ok: true, ignored: type });

  try {
    // Always read the current state from Mercado Pago instead of trusting the notification body, so
    // retries and out-of-order deliveries converge to the same result (idempotent).
    const preapprovalId = type === "subscription_preapproval" ? dataId : await getAuthorizedPaymentPreapprovalId(dataId);
    if (!preapprovalId) return NextResponse.json({ ok: true, ignored: "no_preapproval" });
    const preapproval = await getPreapproval(preapprovalId);
    const organizationId = preapproval.external_reference ?? "";
    const status = mapPreapprovalStatus(preapproval.status);
    if (!uuidPattern.test(organizationId) || !status) return NextResponse.json({ ok: true, ignored: "no_change" });

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    const update: Record<string, string | null> = { subscription_status: status, subscription_provider: "mercadopago", subscription_external_id: preapproval.id };
    if (preapproval.next_payment_date) update.current_period_end = preapproval.next_payment_date;
    const { error } = await supabase.from("organizations").update(update).eq("id", organizationId).eq("account_type", "residencial");
    if (error) return NextResponse.json({ error: "update_failed" }, { status: 500 });
    return NextResponse.json({ ok: true, status });
  } catch (error) {
    // Unknown ids (e.g. the panel's "simulate notification" with a fake id) are not an error: ack so MP does not retry.
    if (error instanceof Error && error.message === "mercadopago_404") return NextResponse.json({ ok: true, ignored: "unknown_resource" });
    return NextResponse.json({ error: "processing_failed" }, { status: 500 });
  }
}
