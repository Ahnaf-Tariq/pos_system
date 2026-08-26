"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { DashboardSession } from "@/types/interfaces";
import { DashboardShell } from "@/components/dashboard/shell";
import { RoleRouteGuard } from "@/components/dashboard/role-route-guard";
import { getCachedDashboardSession } from "@/lib/offline/session-cache";
import { AppLoader } from "@/components/ui/app-loader";

export function OfflineDashboardBootstrap({
  authId,
  email,
  children,
}: {
  authId: string;
  email: string | null;
  children: ReactNode;
}) {
  const [session, setSession] = useState<DashboardSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void getCachedDashboardSession().then((cached) => {
      if (cached && cached.authId === authId) {
        setSession({ ...cached, email: email ?? cached.email });
      } else if (cached) {
        setSession(cached);
      }
      setLoading(false);
    });
  }, [authId, email]);

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <AppLoader />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background p-6">
        <div className="max-w-md rounded-lg border border-border bg-card p-6 text-center">
          <h1 className="text-lg font-semibold tracking-tight">
            Session not cached
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Open the dashboard once while online so your session can be saved
            for offline use.
          </p>
        </div>
      </div>
    );
  }

  return (
    <DashboardShell session={session}>
      <RoleRouteGuard
        role={session.staffMember.role}
        kdsEnabled={session.shop.kds_enabled !== false}
      >
        {children}
      </RoleRouteGuard>
    </DashboardShell>
  )
}
