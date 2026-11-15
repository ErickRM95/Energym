import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@energym/shared";

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return supabaseResponse;

  const supabase = createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options));
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  const isAuthScreen = path === "/login" || path === "/signup";
  const isPublic = isAuthScreen || path.startsWith("/acceso/invitar");

  if (!data.user && !isPublic) {
    const redirect = NextResponse.redirect(new URL("/login", request.url));
    copyCookies(supabaseResponse, redirect);
    return redirect;
  }

  if (data.user && isAuthScreen) {
    const redirect = NextResponse.redirect(new URL("/", request.url));
    copyCookies(supabaseResponse, redirect);
    return redirect;
  }

  return supabaseResponse;
}

function copyCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((cookie) => to.cookies.set(cookie));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
