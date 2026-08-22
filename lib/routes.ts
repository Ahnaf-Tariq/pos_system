export const ROUTES = {
  home: "/",
  login: "/login",
  signup: "/signup",
  pendingApproval: "/pending-approval",

  dashboardRoot: "/dashboard",
  dashboard: "/dashboard",
  pos: "/pos",
  kds: "/kds",
  tables: "/tables",
  menu: "/menu",
  inventory: "/inventory",
  vendors: "/vendors",
  orders: "/orders",
  reports: "/reports",
  staff: "/staff",
  customers: "/customers",
  settings: "/settings",

  platformRoot: "/platform",
  platformShops: "/platform/admin/shops",
  platformMetrics: "/platform/admin/metrics",
} as const;

export function staffDetailPath(staffId: string): string {
  return `/staff/${staffId}`;
}

export function receiptPath(orderId: string): string {
  return `/receipt/${orderId}`;
}

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];

export function isDashboardPath(pathname: string): boolean {
  if (pathname === ROUTES.dashboardRoot) return true;

  const dashboardPaths: string[] = [
    ROUTES.pos,
    ROUTES.kds,
    ROUTES.tables,
    ROUTES.menu,
    ROUTES.inventory,
    ROUTES.vendors,
    ROUTES.orders,
    ROUTES.reports,
    ROUTES.staff,
    ROUTES.customers,
    ROUTES.settings,
  ];

  return (
    dashboardPaths.some(
      (path) => pathname === path || pathname.startsWith(`${path}/`),
    ) || pathname.startsWith(`${ROUTES.dashboardRoot}/`)
  );
}

export function isPlatformPath(pathname: string): boolean {
  return (
    pathname === ROUTES.platformRoot ||
    pathname.startsWith(`${ROUTES.platformRoot}/`)
  );
}

export function isAuthPath(pathname: string): boolean {
  return (
    pathname === ROUTES.login ||
    pathname === ROUTES.signup ||
    pathname === ROUTES.pendingApproval
  );
}
