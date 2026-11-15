import { NextResponse, type NextRequest } from "next/server";
import { createMercadoPagoState, mercadoPagoAuthorizationUrl, mercadoPagoOAuthConfigured } from "@/lib/mercadopago-oauth";
import { requireEletropostoOwner } from "../owner";

export const dynamic = "force-dynamic";

function homeRedirect(request: NextRequest, reason: string) {
  const url = new URL("/", request.url);
  url.searchParams.set("mp", reason);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const organizationId = request.nextUrl.searchParams.get("organization_id") ?? "";
  const owner = await requireEletropostoOwner(organizationId).catch(() => null);
  if (!owner) return homeRedirect(request, "forbidden");
  if (!mercadoPagoOAuthConfigured()) return homeRedirect(request, "config");
  const redirectUri = new URL("/api/eletroposto/mercadopago/callback", request.url).toString();
  const state = createMercadoPagoState(organizationId);
  return NextResponse.redirect(mercadoPagoAuthorizationUrl(redirectUri, state));
}
