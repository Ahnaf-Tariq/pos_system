import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDashboardSession } from "@/lib/auth/session";
import { fetchMenuCatalog } from "@/lib/menu/catalog";
import { fetchCustomersList } from "@/lib/customers/catalog";
import { PosTerminal } from "@/components/pos/pos-terminal";
import { ROUTES } from "@/lib/routes";
import type { RestaurantTable } from "@/types/interfaces";

export const metadata: Metadata = {
  title: "POS",
};

export default async function PosPage({
  searchParams,
}: {
  searchParams: Promise<{ tableId?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(ROUTES.login);

  const session = await getDashboardSession(supabase, user.id);
  if (!session) redirect(ROUTES.pendingApproval);

  const catalog = await fetchMenuCatalog(supabase, session.shop.user_id);
  const [tablesResult, customers] = await Promise.all([
    supabase
      .from("restaurant_tables")
      .select("*")
      .eq("user_id", session.shop.user_id)
      .order("label", { ascending: true }),
    fetchCustomersList(supabase, session.shop.user_id).catch(() => []),
  ]);

  return (
    <PosTerminal
      userId={session.shop.user_id}
      authId={user.id}
      currency={session.shop.currency}
      taxRatePercent={Number(session.shop.tax_rate ?? 0)}
      categories={catalog.categories}
      items={catalog.items}
      tables={(tablesResult.data as RestaurantTable[]) ?? []}
      customers={customers}
      initialTableId={params.tableId ?? null}
    />
  );
}
