import { NextResponse } from "next/server";

// HOOK FOR MERCADO PAGO (not wired yet). The webhook should: verify the signature with the Mercado Pago
// secret, load the subscription, and update public.organizations (subscription_status, current_period_end,
// subscription_provider, subscription_external_id) with a server-side service role client.
export async function POST() {
  return NextResponse.json({ error: "not_implemented" }, { status: 501 });
}
