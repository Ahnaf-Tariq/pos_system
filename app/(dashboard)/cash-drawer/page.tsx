import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDashboardSession } from "@/lib/auth/session";
import { CashDrawerManager } from "@/components/cash-drawer/cash-drawer-manager";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Cash drawer",
};

export default async function CashDrawerPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(ROUTES.login);

  const session = await getDashboardSession(supabase, user.id);
  if (!session) redirect(ROUTES.pendingApproval);

  return (
    <CashDrawerManager
      userId={session.shop.user_id}
      authId={user.id}
      currency={session.shop.currency}
    />
  );
}
