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

// HOOK FOR MERCADO PAGO: when the Mercado Pago subscription is wired, create the checkout/preapproval here
// and return its URL. Credentials must come from server-side env vars (never NEXT_PUBLIC_*).
export async function createSubscriptionCheckoutUrl(): Promise<string | null> {
  return null;
}
