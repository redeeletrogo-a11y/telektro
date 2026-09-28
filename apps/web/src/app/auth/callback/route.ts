import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const providerError = request.nextUrl.searchParams.has("error");
  if (code) {
    try {
      const supabase = await createSupabaseServerClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(new URL("/", request.url));
    } catch {
      // Route the user to the login screen if callback configuration is incomplete.
    }
  }
  return NextResponse.redirect(new URL(providerError ? "/login?error=google" : "/login?error=confirmation", request.url));
}
