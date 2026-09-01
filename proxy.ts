import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const AUTH_CHECK_TIMEOUT_MS = 10_000;

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookies) => {
          cookies.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        }
      },
      global: {
        fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(AUTH_CHECK_TIMEOUT_MS) })
      }
    }
  );

  const isLoginPage = request.nextUrl.pathname === "/login";
  let hasSession = false;

  try {
    const { data } = await supabase.auth.getClaims();
    hasSession = Boolean(data?.claims);
  } catch {
    hasSession = false;
  }

  if (!hasSession && !isLoginPage) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (hasSession && isLoginPage) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
