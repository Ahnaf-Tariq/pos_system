import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDashboardSession } from "@/lib/auth/session";
import { fetchStaffDetail } from "@/lib/staff/detail";
import { fetchShopSalaryPayBasis } from "@/lib/staff/salary";
import { StaffDetailView } from "@/components/staff/staff-detail";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Staff detail",
};

interface StaffDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function StaffDetailPage({
  params,
}: StaffDetailPageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(ROUTES.login);

  const session = await getDashboardSession(supabase, user.id);
  if (!session) redirect(ROUTES.pendingApproval);

  const payBasis = await fetchShopSalaryPayBasis(
    supabase,
    session.shop.user_id,
  );
  const detail = await fetchStaffDetail(
    supabase,
    session.shop.user_id,
    id,
    payBasis,
  );

  if (!detail) notFound();

  return (
    <StaffDetailView
      userId={session.shop.user_id}
      actorAuthId={user.id}
      staffId={id}
      currency={session.shop.currency}
      payBasis={payBasis}
      timezone={session.shop.timezone}
      initialData={detail}
    />
  );
}
