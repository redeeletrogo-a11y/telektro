import { NextResponse, type NextRequest } from "next/server";

// Remember the claim token, then send the visitor to sign in. After login "/" sends them back to /c/<token>.
export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const response = NextResponse.redirect(new URL("/login", request.url));
  if (/^[a-f0-9]{32}$/.test(token)) {
    response.cookies.set("telektro_claim", token, { httpOnly: true, sameSite: "lax", secure: true, maxAge: 60 * 60 * 24, path: "/" });
  }
  return response;
}
