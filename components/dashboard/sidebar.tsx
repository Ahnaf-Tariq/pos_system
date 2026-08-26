"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/lib/routes";
import { getNavItemsForRole } from "@/lib/navigation";
import {
  isGracefulOfflineRoute,
  isOfflineCapableRoute,
} from "@/lib/offline/constants";
import { useConnectivity } from "@/components/offline/offline-provider";
import type { StaffRole } from "@/types/enums";
import { Button } from "@/components/ui/button";

interface DashboardSidebarProps {
  businessName: string;
  role: StaffRole;
  kdsEnabled?: boolean;
  collapsed: boolean;
  onToggle: () => void;
}

export function DashboardSidebar({
  businessName,
  role,
  kdsEnabled = true,
  collapsed,
  onToggle,
}: DashboardSidebarProps) {
  const pathname = usePathname();
  const { online } = useConnectivity();
  const items = getNavItemsForRole(role, { kdsEnabled });

  function handleOfflineNav(
    event: React.MouseEvent<HTMLAnchorElement>,
    href: string,
  ) {
    if (online) return;

    if (isOfflineCapableRoute(href)) {
      event.preventDefault();
      window.location.assign(href);
    }
  }

  return (
    <aside
      className={cn(
        "relative z-50 flex h-svh shrink-0 flex-col overflow-visible border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200",
        collapsed ? "w-[72px]" : "w-60",
      )}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute top-3.5 -right-3.5 z-50 size-7 rounded-full border border-border bg-card text-muted-foreground shadow-sm hover:bg-secondary"
        onClick={onToggle}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? (
          <ChevronRight className="size-4" />
        ) : (
          <ChevronLeft className="size-4" />
        )}
      </Button>

      <div className="flex h-14 shrink-0 items-center border-b border-sidebar-border px-3 pr-5">
        <Link
          href={ROUTES.dashboard}
          onClick={(event) => {
            if (!online) event.preventDefault();
          }}
          className={cn(
            "min-w-0 font-semibold tracking-tight",
            collapsed && "mx-auto",
            !online && "pointer-events-none opacity-60",
          )}
        >
          {collapsed ? (
            <span className="text-primary">A</span>
          ) : (
            <span className="block truncate">
              <span className="text-xl text-primary">{businessName}</span>
            </span>
          )}
        </Link>
      </div>

      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
        {items.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== ROUTES.dashboard && pathname.startsWith(item.href));
          const Icon = item.icon;
          const offlineBlocked =
            !online &&
            !isOfflineCapableRoute(item.href) &&
            !isGracefulOfflineRoute(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.title}
              onClick={(event) => handleOfflineNav(event, item.href)}
              className={cn(
                "flex min-h-9 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
                collapsed && "justify-center px-0",
                offlineBlocked && "pointer-events-none opacity-40",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              <Icon className="size-4 shrink-0" />
              {!collapsed ? <span>{item.title}</span> : null}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
