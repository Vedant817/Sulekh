import { NextResponse, type NextRequest } from "next/server";

import { createServerClient } from "@supabase/ssr";

import { getClientEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/types";

/** Route prefixes that require an authenticated session. */
const PROTECTED_PREFIXES = ["/workspace", "/review"];
/** Auth routes an already-signed-in user should be bounced away from. */
const AUTH_ROUTES = ["/login", "/signup"];

/**
 * Refresh the Supabase session cookie on every request and gate access to
 * protected routes. Unauthenticated hits on a protected route redirect to
 * /login (preserving the intended destination); signed-in users on an auth
 * route are sent to the workspace.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });
  const env = getClientEnv();

  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // getUser() validates the token with the auth server; a network/auth failure
  // yields no user, which we treat as unauthenticated (fail closed).
  let isAuthed = false;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    isAuthed = Boolean(user);
  } catch {
    isAuthed = false;
  }

  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  const isAuthRoute = AUTH_ROUTES.some((p) => pathname === p);

  if (isProtected && !isAuthed) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(url);
  }

  if (isAuthRoute && isAuthed) {
    const url = request.nextUrl.clone();
    url.pathname = "/workspace";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
