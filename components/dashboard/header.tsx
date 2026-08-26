"use client";

import { useState } from "react";
import { Check, ChevronDown, LogOut, MapPin } from "lucide-react";
import { Dropdown } from "antd";
import type { MenuProps } from "antd";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { ROUTES } from "@/lib/routes";
import { roleLabel } from "@/lib/navigation";
import type { StaffRole } from "@/types/enums";
import { useLocationContext } from "@/components/dashboard/location-provider";
import { NotificationsBell } from "@/components/dashboard/notifications-bell";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface DashboardHeaderProps {
  staffName: string;
  role: StaffRole;
  userId: string;
  isSuperAdmin?: boolean;
}

export function DashboardHeader({
  staffName,
  role,
  userId,
  isSuperAdmin = false,
}: DashboardHeaderProps) {
  const router = useRouter();
  const {
    locations,
    selectedLocation,
    setSelectedLocationId,
    isLocationLocked,
  } = useLocationContext();
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      toast.success("Logged out");
      setLogoutOpen(false);
      router.replace(ROUTES.login);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not log out");
    } finally {
      setLoggingOut(false);
    }
  }

  const locationItems: MenuProps["items"] =
    locations.length === 0
      ? [{ key: "empty", label: "No locations yet", disabled: true }]
      : locations.map((location) => {
          const isActive = selectedLocation?.id === location.id;
          return {
            key: location.id,
            label: (
              <div
                title={isActive ? "Currently Active" : "Make Active"}
                className="flex items-center justify-between gap-3 py-0.5"
              >
                <span
                  className={
                    isActive
                      ? "font-medium text-foreground"
                      : "text-muted-foreground"
                  }
                >
                  {location.name}
                </span>
                {isActive ? <Check className="size-4 text-primary" /> : null}
              </div>
            ),
            onClick: () => setSelectedLocationId(location.id),
          };
        });

  const profileMenuItems: MenuProps["items"] = [
    {
      key: "user-info",
      label: (
        <div className="flex items-start gap-3 py-1">
          <p className="font-medium text-foreground">{staffName}</p>
          <div>
            <Badge
              variant="outline"
              className="rounded-full border-primary/40 bg-primary/10 px-1 py-0 text-[8px] font-medium uppercase tracking-wide text-primary"
            >
              {roleLabel(role)}
            </Badge>
          </div>
        </div>
      ),
      disabled: true,
      style: { opacity: 1, cursor: "default" },
    },
    { type: "divider" },
    {
      key: "logout",
      label: (
        <div className="flex items-center gap-2 text-destructive font-medium">
          <LogOut className="size-4" />
          <span>Logout</span>
        </div>
      ),
      onClick: () => setLogoutOpen(true),
    },
  ];

  return (
    <>
      <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border bg-background/95 px-4 backdrop-blur">
        <div className="min-w-0">
          {isLocationLocked ? (
            <Button variant="outline" className="min-h-9 gap-1.5" disabled>
              <MapPin className="size-4 text-primary" />
              <span className="max-w-[180px] truncate">
                {selectedLocation?.name ?? "Location"}
              </span>
            </Button>
          ) : (
            <Dropdown
              menu={{
                items: [
                  {
                    key: "label",
                    label: "Locations",
                    disabled: true,
                    style: { opacity: 0.65, cursor: "default" },
                  },
                  { type: "divider" },
                  ...locationItems,
                ],
              }}
              // overlayStyle={{ minWidth: "160px" }}
              styles={{ root: { minWidth: "160px" } }}
              trigger={["click"]}
            >
              <Button variant="outline" className="min-h-9 gap-1.5">
                <MapPin className="size-4 text-primary" />
                <span className="max-w-[180px] truncate">
                  {selectedLocation?.name ?? "Select location"}
                </span>
              </Button>
            </Dropdown>
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {isSuperAdmin ? (
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => router.push(ROUTES.platformShops)}
            >
              Platform
            </Button>
          ) : null}

          <NotificationsBell userId={userId} />

          <Dropdown
            menu={{ items: profileMenuItems }}
            // overlayStyle={{ minWidth: "180px" }}
            styles={{ root: { minWidth: "180px" } }}
            trigger={["click"]}
            placement="bottomRight"
          >
            <button
              type="button"
              className="group flex items-center gap-2.5 rounded-full border border-border bg-secondary/50 p-1 pr-2.5 hover:bg-secondary hover:border-border/80 transition-all focus:outline-none"
            >
              <div className="flex size-7 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground text-xs shadow-xs">
                {staffName ? staffName.charAt(0).toUpperCase() : "U"}
              </div>

              <div className="flex items-center gap-2">
                <span className="max-w-[120px] truncate text-sm font-medium text-foreground">
                  {staffName}
                </span>
                <Badge
                  variant="outline"
                  className="rounded-full border-primary/30 bg-primary/10 px-1.5 py-0 text-[10px] font-semibold text-primary"
                >
                  {roleLabel(role)}
                </Badge>
              </div>

              <ChevronDown className="size-3.5 text-muted-foreground group-hover:text-foreground transition-transform" />
            </button>
          </Dropdown>
        </div>
      </header>

      <ConfirmModal
        open={logoutOpen}
        title="Log out?"
        description="You will need to sign in again to access your shop dashboard."
        confirmText="Logout"
        cancelText="Cancel"
        danger
        confirmLoading={loggingOut}
        onConfirm={handleLogout}
        onCancel={() => {
          if (!loggingOut) setLogoutOpen(false);
        }}
      />
    </>
  );
}
