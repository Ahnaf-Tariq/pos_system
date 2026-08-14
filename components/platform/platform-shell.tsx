"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, Building2, LogOut } from "lucide-react";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { Button } from "@/components/ui/button";

const NAV = [
  { href: ROUTES.platformShops, label: "Shops", icon: Building2 },
  { href: ROUTES.platformMetrics, label: "Metrics", icon: BarChart3 },
] as const;

export function PlatformShell({
  email,
  children,
}: {
  email: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
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

  return (
    <div className="flex h-svh overflow-hidden bg-background">
      <aside className="flex h-svh w-56 shrink-0 flex-col border-r border-border bg-sidebar">
        <div className="shrink-0 border-b border-sidebar-border px-4 py-4">
          <Link
            href={ROUTES.platformShops}
            className="font-semibold tracking-tight"
          >
            <span className="text-primary">Auric</span> Platform
          </Link>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {email ?? "Super admin"}
          </p>
        </div>
        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
          {NAV.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex min-h-9 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="shrink-0 space-y-2 border-t border-sidebar-border p-3">
          <Button asChild variant="outline" className="w-full">
            <Link href={ROUTES.dashboard}>Shop dashboard</Link>
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => setLogoutOpen(true)}
          >
            <LogOut className="size-4" />
            Logout
          </Button>
        </div>
      </aside>
      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto p-4 md:p-6">
        {children}
      </main>

      <ConfirmModal
        open={logoutOpen}
        title="Log out?"
        description="You will need to sign in again to access the platform."
        confirmText="Logout"
        cancelText="Cancel"
        danger
        confirmLoading={loggingOut}
        onConfirm={handleLogout}
        onCancel={() => {
          if (!loggingOut) setLogoutOpen(false);
        }}
      />
    </div>
  );
}
