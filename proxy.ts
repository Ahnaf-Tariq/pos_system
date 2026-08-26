import { NextResponse, type NextRequest } from "next/server";
import { createProxyClient } from "@/lib/supabase/proxy";
import { resolveAuthUser } from "@/lib/auth/resolve-user";
import { getShopAccessForAuth, isPlatformAdmin } from "@/lib/auth/shop-access";
import { AccountStatus } from "@/types/enums";
import { ROUTES, isDashboardPath, isPlatformPath } from "@/lib/routes";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createProxyClient(request, response);
  const { user, usedCookieFallback } = await resolveAuthUser(supabase);

  const { pathname } = request.nextUrl;
  const isDashboard = isDashboardPath(pathname);
  const isPlatform = isPlatformPath(pathname);
  const isReceipt = pathname.startsWith("/receipt");
  const isLoginOrSignup =
    pathname === ROUTES.login || pathname === ROUTES.signup;

  if ((isDashboard || isPlatform || isReceipt) && !user) {
    const url = request.nextUrl.clone();
    url.pathname = ROUTES.login;
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (!user) return response;

  if (isLoginOrSignup) {
    if (usedCookieFallback) {
      const url = request.nextUrl.clone();
      url.pathname = ROUTES.dashboard;
      return NextResponse.redirect(url);
    }

    const url = request.nextUrl.clone();
    const admin = await isPlatformAdmin(supabase, user.id);
    if (admin) {
      url.pathname = ROUTES.platformRoot;
      return NextResponse.redirect(url);
    }

    const shop = await getShopAccessForAuth(supabase, user.id);
    url.pathname =
      shop?.status === AccountStatus.APPROVED
        ? ROUTES.dashboard
        : ROUTES.pendingApproval;
    return NextResponse.redirect(url);
  }

  if (isPlatform) {
    if (usedCookieFallback) {
      const url = request.nextUrl.clone();
      url.pathname = ROUTES.dashboard;
      return NextResponse.redirect(url);
    }

    const admin = await isPlatformAdmin(supabase, user.id);
    if (!admin) {
      const url = request.nextUrl.clone();
      url.pathname = ROUTES.dashboard;
      return NextResponse.redirect(url);
    }
    return response;
  }

  if (isDashboard || isReceipt) {
    if (usedCookieFallback) {
      return response;
    }

    const shop = await getShopAccessForAuth(supabase, user.id);
    if (!shop || shop.status !== AccountStatus.APPROVED) {
      const url = request.nextUrl.clone();
      url.pathname = ROUTES.pendingApproval;
      return NextResponse.redirect(url);
    }
  }

  if (pathname === ROUTES.pendingApproval) {
    if (usedCookieFallback) {
      const url = request.nextUrl.clone();
      url.pathname = ROUTES.dashboard;
      return NextResponse.redirect(url);
    }

    const shop = await getShopAccessForAuth(supabase, user.id);
    if (shop?.status === AccountStatus.APPROVED) {
      const url = request.nextUrl.clone();
      url.pathname = ROUTES.dashboard;
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/pos/:path*",
    "/kds/:path*",
    "/tables/:path*",
    "/menu/:path*",
    "/inventory/:path*",
    "/vendors/:path*",
    "/cash-drawer/:path*",
    "/expenses/:path*",
    "/orders/:path*",
    "/reports/:path*",
    "/staff/:path*",
    "/customers/:path*",
    "/settings/:path*",
    "/receipt/:path*",
    "/platform/:path*",
    "/pending-approval",
    "/login",
    "/signup",
  ],
};
