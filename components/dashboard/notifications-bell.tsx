"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  CircleDollarSign,
  PackageMinus,
  UserPlus,
  UtensilsCrossed,
  LayoutGrid,
} from "lucide-react";
import { Dropdown } from "antd";
import { createClient } from "@/lib/supabase/client";
import {
  NOTIFICATIONS_CHANGED_EVENT,
  fetchNotifications,
  markAllNotificationsRead,
} from "@/lib/notifications/create";
import type { ShopNotification } from "@/types/interfaces";
import { useLocationContext } from "@/components/dashboard/location-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface NotificationsBellProps {
  userId: string;
}

export function NotificationsBell({ userId }: NotificationsBellProps) {
  const router = useRouter();
  const { selectedLocationId } = useLocationContext();
  const [items, setItems] = useState<ShopNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const unreadCount = items.filter((item) => !item.is_read).length;

  const refresh = useCallback(async () => {
    try {
      const supabase = createClient();
      const rows = await fetchNotifications(
        supabase,
        userId,
        selectedLocationId,
      );
      setItems(rows);
    } catch (error) {
      console.error("[notifications]", error);
    } finally {
      setLoading(false);
    }
  }, [userId, selectedLocationId]);

  /** Coalesce bursts of insert events into one fetch. */
  const scheduleRefresh = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => {
      void refresh();
    }, 150);
  }, [refresh]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Same-tab: POS/KDS/tables write notifications in this browser
  useEffect(() => {
    function onLocalChange(event: Event) {
      const detail = (event as CustomEvent<{ userId?: string | null }>).detail;
      if (detail?.userId && detail.userId !== userId) return;
      scheduleRefresh();
    }

    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, onLocalChange);
    return () => {
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, onLocalChange);
    };
  }, [userId, scheduleRefresh]);

  // Other tabs / server writes (staff invite, etc.)
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => scheduleRefresh(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, scheduleRefresh]);

  // Soft fallback while the dashboard stays open
  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 12_000);

    function onVisible() {
      if (document.visibilityState === "visible") void refresh();
    }
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisible);
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    };
  }, [refresh]);

  async function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) return;

    // Pull latest before marking read (covers race after a sale)
    await refresh();

    try {
      const supabase = createClient();
      const { data: latest } = await supabase
        .from("notifications")
        .select("id")
        .eq("user_id", userId)
        .eq("is_read", false)
        .limit(1);

      if (!latest?.length) return;

      await markAllNotificationsRead(supabase, userId);
      setItems((prev) => prev.map((item) => ({ ...item, is_read: true })));
    } catch (error) {
      console.error("[notifications] mark read", error);
    }
  }

  return (
    <Dropdown
      open={open}
      onOpenChange={(next) => void handleOpenChange(next)}
      trigger={["click"]}
      placement="bottomRight"
      popupRender={() => (
        <div className="w-[min(100vw-2rem,22rem)] overflow-hidden rounded-lg border border-border bg-card shadow-lg">
          <div className="border-b border-border px-3 py-2.5">
            <p className="text-sm font-semibold text-foreground">
              Notifications
            </p>
            <p className="text-xs text-muted-foreground">
              {unreadCount > 0
                ? `${unreadCount > 9 ? "9+" : unreadCount} unread`
                : "All caught up"}
            </p>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                Loading…
              </p>
            ) : items.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                No notifications yet.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={cn(
                        "flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-secondary/60",
                        !item.is_read && "bg-primary/5",
                      )}
                      onClick={() => {
                        setOpen(false);
                        if (item.href) router.push(item.href);
                      }}
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md",
                          notificationIconClass(item.type),
                        )}
                      >
                        {notificationIcon(item.type)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-2">
                          <span className="text-sm font-medium text-foreground">
                            {item.title}
                          </span>
                          {!item.is_read ? (
                            <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" />
                          ) : null}
                        </span>
                        {item.body ? (
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {item.body}
                          </span>
                        ) : null}
                        <span className="mt-0.5 block text-[10px] text-muted-foreground/80">
                          {formatRelativeTime(item.created_at)}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    >
      <Button
        variant="ghost"
        size="icon"
        className="relative min-h-11 min-w-11"
        aria-label="Notifications"
      >
        <Bell className="size-4" />
        {unreadCount > 0 ? (
          <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </Button>
    </Dropdown>
  );
}

function notificationIcon(type: string) {
  const className = "size-3.5";
  switch (type) {
    case "sale_completed":
      return <CircleDollarSign className={className} />;
    case "order_served":
      return <UtensilsCrossed className={className} />;
    case "table_freed":
      return <LayoutGrid className={className} />;
    case "staff_added":
      return <UserPlus className={className} />;
    case "low_stock":
      return <PackageMinus className={className} />;
    default:
      return <Bell className={className} />;
  }
}

function notificationIconClass(type: string) {
  switch (type) {
    case "sale_completed":
      return "bg-primary/15 text-primary";
    case "order_served":
      return "bg-sky-500/15 text-sky-400";
    case "table_freed":
      return "bg-amber-500/15 text-amber-400";
    case "staff_added":
      return "bg-violet-500/15 text-violet-400";
    case "low_stock":
      return "bg-destructive/15 text-destructive";
    default:
      return "bg-secondary text-muted-foreground";
  }
}

function formatRelativeTime(iso: string) {
  const then = new Date(iso).getTime();
  const diffMs = Date.now() - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
