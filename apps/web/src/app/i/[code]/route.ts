import { NextResponse, type NextRequest } from "next/server";

// Link curto de indicação: guarda o código num cookie de 30 dias e leva para /indique.
// A validação do código e o vínculo acontecem na página /indique.
export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const clean = (code ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  const target = new URL("/indique", request.url);
  const response = NextResponse.redirect(target);
  if (/^[A-Z0-9]{6}$/.test(clean)) {
    response.cookies.set("tk_ref", clean, { maxAge: 60 * 60 * 24 * 30, path: "/", sameSite: "lax" });
  }
  return response;
}
