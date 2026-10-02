import { createServerClient } from "@supabase/ssr";
import { SITE_URL } from "@/lib/site";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  // The production vercel.app alias must not serve the app: send everything to the canonical domain.
  if (process.env.VERCEL_ENV === "production" && request.nextUrl.hostname === "telektro-chi.vercel.app") {
    return NextResponse.redirect(new URL(`${request.nextUrl.pathname}${request.nextUrl.search}`, SITE_URL), 308);
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Refresh expired auth tokens in the request boundary; do not use getSession for server authorization.
  await supabase.auth.getClaims();
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|apple-icon|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
