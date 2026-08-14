import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDashboardSession } from "@/lib/auth/session";
import { StaffManager } from "@/components/staff/staff-manager";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Staff",
};

export default async function StaffPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(ROUTES.login);

  const session = await getDashboardSession(supabase, user.id);
  if (!session) redirect(ROUTES.pendingApproval);

  return (
    <StaffManager
      userId={session.shop.user_id}
      actorRole={session.staffMember.role}
      actorAuthId={user.id}
      currency={session.shop.currency}
    />
  );
}
