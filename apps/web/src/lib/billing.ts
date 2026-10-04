import { createClient } from "@supabase/supabase-js";
// Access rules for subscription gating. Keep in sync with public.org_has_access() in the database.
export type BillingOrganization = {
  account_type: string;
  subscription_status: string;
  trial_ends_at: string | null;
  current_period_end: string | null;
};

export const RESIDENCIAL_PRICE_LABEL = "R$ 19,90/mês";
export const CONDO_PRICE_LABEL = "R$ 199,00/mês (até 5 moradores, +R$ 19,90 por morador extra)";

export function organizationHasAccess(org: BillingOrganization, now = Date.now()) {
  if (org.account_type === "eletroposto") return true;
  if (org.subscription_status === "active") return true;
  if (org.subscription_status === "trialing") return org.trial_ends_at ? new Date(org.trial_ends_at).getTime() > now : false;
  if (org.current_period_end) return new Date(org.current_period_end).getTime() > now;
  return false;
}

export function trialDaysLeft(org: BillingOrganization, now = Date.now()) {
  if (org.account_type === "eletroposto" || org.subscription_status !== "trialing" || !org.trial_ends_at) return null;
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

// Cada aplicacao do Mercado Pago (residencial, condominio, eletroposto) pode ter credenciais proprias.
// O eletroposto usa MERCADOPAGO_ELETROPOSTO_ACCESS_TOKEN e, se ausente, cai no token padrao.
export function eletropostoAccessToken() {
  return process.env.MERCADOPAGO_ELETROPOSTO_ACCESS_TOKEN || process.env.MERCADOPAGO_ACCESS_TOKEN || "";
}

export async function mpFetch(path: string, init?: RequestInit, tokenOverride?: string) {
  const token = tokenOverride ?? process.env.MERCADOPAGO_ACCESS_TOKEN;
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
export async function createSubscriptionCheckoutUrl(args: { organizationId: string; origin: string; payerEmail: string; trialEndsAt?: string | null }): Promise<string> {
  const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET; // only needed on protected Vercel previews
  const notificationUrl = new URL("/api/billing/mercadopago/webhook", args.origin);
  if (bypass) notificationUrl.searchParams.set("x-vercel-protection-bypass", bypass);
  // Keep the remaining free-trial days: the first charge only happens after the trial ends.
  const trialMs = args.trialEndsAt ? new Date(args.trialEndsAt).getTime() - Date.now() : 0;
  const trialDays = trialMs > 0 ? Math.min(Math.ceil(trialMs / 86_400_000), 30) : 0;
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
      auto_recurring: { frequency: 1, frequency_type: "months", transaction_amount: RESIDENCIAL_PRICE_BRL, currency_id: "BRL", ...(trialDays > 0 ? { free_trial: { frequency: trialDays, frequency_type: "days" } } : {}) },
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

// Safety net when the webhook did not arrive: look the organization's preapproval up at Mercado Pago and sync the status.
// Only the organization id the caller already has access to is used, and the state always comes from Mercado Pago.
export async function reconcileSubscription(organizationId: string): Promise<boolean> {
  if (!mercadoPagoConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) return false;
  try {
    const found = await mpFetch(`/preapproval/search?external_reference=${encodeURIComponent(organizationId)}&limit=10`);
    const results = (Array.isArray(found.results) ? found.results : []) as MercadoPagoPreapproval[];
    const authorized = results.find((item) => item.external_reference === organizationId && item.status === "authorized");
    if (!authorized) return false;
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    const update: Record<string, string | null> = { subscription_status: "active", subscription_provider: "mercadopago", subscription_external_id: authorized.id };
    if (authorized.next_payment_date) update.current_period_end = authorized.next_payment_date;
    const { error } = await supabase.from("organizations").update(update).eq("id", organizationId).eq("account_type", "residencial");
    return !error;
  } catch {
    return false;
  }
}
