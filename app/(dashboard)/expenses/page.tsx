import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDashboardSession } from "@/lib/auth/session";
import { ExpensesManager } from "@/components/expenses/expenses-manager";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Expenses",
};

export default async function ExpensesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(ROUTES.login);

  const session = await getDashboardSession(supabase, user.id);
  if (!session) redirect(ROUTES.pendingApproval);

  return (
    <ExpensesManager
      userId={session.shop.user_id}
      authId={user.id}
      currency={session.shop.currency}
    />
  );
}
