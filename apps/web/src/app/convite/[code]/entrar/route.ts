import { NextResponse, type NextRequest } from "next/server";

// Remember the invite code, then send the visitor to sign in. After login "/" sends them back to /convite/<code>.
export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const response = NextResponse.redirect(new URL("/login", request.url));
  if (/^[a-z0-9]{10,32}$/.test(code)) {
    response.cookies.set("telektro_invite", code, { httpOnly: true, sameSite: "lax", secure: true, maxAge: 60 * 60, path: "/" });
  }
  return response;
}
