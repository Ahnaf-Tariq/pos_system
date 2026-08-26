"use client";

import { useState, type ReactNode } from "react";
import type { DashboardSession } from "@/types/interfaces";
import { LocationProvider } from "@/components/dashboard/location-provider";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { DashboardHeader } from "@/components/dashboard/header";
import { OfflineProvider } from "@/components/offline/offline-provider";
import { OfflineBanner } from "@/components/offline/offline-banner";
import { OfflineGate } from "@/components/offline/offline-gate";
import { ServiceWorkerRegister } from "@/components/offline/service-worker-register";
import { SessionCacheWriter } from "@/components/offline/session-cache-writer";
import { SessionProvider } from "@/components/dashboard/session-context";

export function DashboardShell({
  session,
  isSuperAdmin = false,
  children,
}: {
  session: DashboardSession;
  isSuperAdmin?: boolean;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const staffName =
    session.profile?.full_name?.trim() || session.email || "Staff";
  const locationIds = session.locations.map((location) => location.id);

  return (
    <LocationProvider
      shopUserId={session.shop.user_id}
      locations={session.locations}
      staffLocationId={session.staffMember.location_id}
    >
      <OfflineProvider userId={session.shop.user_id} locationIds={locationIds}>
        <SessionCacheWriter session={session} />
        <ServiceWorkerRegister />
        <div className="flex h-svh overflow-hidden bg-background">
          <DashboardSidebar
            businessName={session.shop.business_name}
            role={session.staffMember.role}
            kdsEnabled={session.shop.kds_enabled !== false}
            collapsed={collapsed}
            onToggle={() => setCollapsed((value) => !value)}
          />
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <DashboardHeader
              staffName={staffName}
              role={session.staffMember.role}
              userId={session.shop.user_id}
              isSuperAdmin={isSuperAdmin}
            />
            <OfflineBanner />
            <main className="min-h-0 flex-1 overflow-y-auto p-2.5 md:p-4">
              <OfflineGate>
                <SessionProvider session={session}>{children}</SessionProvider>
              </OfflineGate>
            </main>
          </div>
        </div>
      </OfflineProvider>
    </LocationProvider>
  );
}
