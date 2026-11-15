import { NextResponse, type NextRequest } from "next/server";
import { exchangeMercadoPagoCode, readMercadoPagoState, saveMercadoPagoConnection } from "@/lib/mercadopago-oauth";
import { requireEletropostoOwner } from "../owner";

export const dynamic = "force-dynamic";

function homeRedirect(request: NextRequest, reason: string) {
  const url = new URL("/", request.url);
  url.searchParams.set("mp", reason);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.get("error")) return homeRedirect(request, "denied");
  const code = request.nextUrl.searchParams.get("code") ?? "";
  const state = request.nextUrl.searchParams.get("state") ?? "";
  let organizationId: string | null = null;
  try { organizationId = readMercadoPagoState(state); } catch { organizationId = null; }
  if (!organizationId || code.length < 10 || code.length > 500) return homeRedirect(request, "invalid");
  const owner = await requireEletropostoOwner(organizationId).catch(() => null);
  if (!owner) return homeRedirect(request, "forbidden");
  try {
    const redirectUri = new URL("/api/eletroposto/mercadopago/callback", request.url).toString();
    const token = await exchangeMercadoPagoCode(code, redirectUri);
    await saveMercadoPagoConnection(organizationId, owner.userId, token);
    return homeRedirect(request, "connected");
  } catch (error) {
    const reason = error instanceof Error && error.message === "mercadopago_oauth_migration_missing" ? "migration" : "exchange";
    return homeRedirect(request, reason);
  }
}
