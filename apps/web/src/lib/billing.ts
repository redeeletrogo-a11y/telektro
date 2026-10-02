// Access rules for subscription gating. Keep in sync with public.org_has_access() in the database.
export type BillingOrganization = {
  account_type: string;
  subscription_status: string;
  trial_ends_at: string | null;
  current_period_end: string | null;
};

export const RESIDENCIAL_PRICE_LABEL = "R$ 19,90/mês";

export function organizationHasAccess(org: BillingOrganization, now = Date.now()) {
  if (org.account_type !== "residencial") return true;
  if (org.subscription_status === "active") return true;
  if (org.subscription_status === "trialing") return org.trial_ends_at ? new Date(org.trial_ends_at).getTime() > now : false;
  if (org.current_period_end) return new Date(org.current_period_end).getTime() > now;
  return false;
}

export function trialDaysLeft(org: BillingOrganization, now = Date.now()) {
  if (org.account_type !== "residencial" || org.subscription_status !== "trialing" || !org.trial_ends_at) return null;
  const ms = new Date(org.trial_ends_at).getTime() - now;
  return ms > 0 ? Math.ceil(ms / 86_400_000) : 0;
}

const MP_API = "https://api.mercadopago.com";
export const RESIDENCIAL_PRICE_BRL = 19.9;

export type MercadoPagoPreapproval = {
  id: string;
  status: string;
  external_reference?: string | null;
  next_payment_date?: string | null;
  init_point?: string;
};

export function mercadoPagoConfigured() {
  return Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN);
}

async function mpFetch(path: string, init?: RequestInit) {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) throw new Error("mercadopago_not_configured");
  const response = await fetch(`${MP_API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("mercadopago_error", path, response.status, JSON.stringify(body).slice(0, 500));
    throw new Error(`mercadopago_${response.status}`);
  }
  return body;
}

// Creates a pending monthly subscription (preapproval) and returns the checkout URL where the buyer enters payment.
// The organization id travels in external_reference; the webhook uses it to activate the right organization.
export async function createSubscriptionCheckoutUrl(args: { organizationId: string; origin: string; payerEmail: string }): Promise<string> {
  const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET; // only needed on protected Vercel previews
  const notificationUrl = new URL("/api/billing/mercadopago/webhook", args.origin);
  if (bypass) notificationUrl.searchParams.set("x-vercel-protection-bypass", bypass);
  const body = await mpFetch("/preapproval", {
    method: "POST",
    body: JSON.stringify({
      reason: "Telektro Residencial",
      external_reference: args.organizationId,
      // Mercado Pago requires the payer e-mail. With TEST credentials it must be a test buyer account, so previews can override it.
      payer_email: process.env.MERCADOPAGO_PAYER_EMAIL_OVERRIDE || args.payerEmail,
      back_url: new URL("/", args.origin).toString(),
      notification_url: notificationUrl.toString(),
      status: "pending",
      auto_recurring: { frequency: 1, frequency_type: "months", transaction_amount: RESIDENCIAL_PRICE_BRL, currency_id: "BRL" },
    }),
  });
  if (!body.init_point) throw new Error("mercadopago_no_checkout_url");
  return body.init_point as string;
}

export async function getPreapproval(id: string): Promise<MercadoPagoPreapproval> {
  return mpFetch(`/preapproval/${encodeURIComponent(id)}`);
}

export async function getAuthorizedPaymentPreapprovalId(id: string): Promise<string | null> {
  const body = await mpFetch(`/authorized_payments/${encodeURIComponent(id)}`);
  return body.preapproval_id ? String(body.preapproval_id) : null;
}

// Mercado Pago preapproval status -> organizations.subscription_status. null = keep the current state (e.g. still pending).
export function mapPreapprovalStatus(status: string): "active" | "past_due" | "canceled" | null {
  if (status === "authorized") return "active";
  if (status === "paused") return "past_due";
  if (status === "cancelled") return "canceled";
  return null;
}
