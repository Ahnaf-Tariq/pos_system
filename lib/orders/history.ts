import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Order,
  OrderDetail,
  OrderDetailItem,
  OrderItem,
  OrderListFilters,
  OrderListRow,
  SelectedModifier,
} from "@/types/interfaces";
import { OrderStatus } from "@/types/enums";

export async function fetchOrders(
  supabase: SupabaseClient,
  userId: string,
  filters: OrderListFilters,
): Promise<OrderListRow[]> {
  let query = supabase
    .from("orders")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (filters.locationId) query = query.eq("location_id", filters.locationId);
  if (filters.status && filters.status !== "all")
    query = query.eq("status", filters.status);
  if (filters.orderType && filters.orderType !== "all")
    query = query.eq("order_type", filters.orderType);
  if (filters.staffAuthId && filters.staffAuthId !== "all")
    query = query.eq("opened_by", filters.staffAuthId);
  if (filters.fromDate)
    query = query.gte("created_at", `${filters.fromDate}T00:00:00`);
  if (filters.toDate)
    query = query.lte("created_at", `${filters.toDate}T23:59:59`);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const orders = (data as Order[]) ?? [];
  if (orders.length === 0) return [];

  const orderIds = orders.map((order) => order.id);
  const tableIds = orders
    .map((order) => order.table_id)
    .filter((id): id is string => Boolean(id));
  const staffIds = orders
    .map((order) => order.opened_by)
    .filter((id): id is string => Boolean(id));

  const [{ data: items }, { data: tables }, { data: profiles }] =
    await Promise.all([
      supabase
        .from("order_items")
        .select("order_id")
        .eq("user_id", userId)
        .in("order_id", orderIds),
      tableIds.length
        ? supabase
            .from("restaurant_tables")
            .select("id, label")
            .in("id", tableIds)
        : Promise.resolve({ data: [] as { id: string; label: string }[] }),
      staffIds.length
        ? supabase.from("profiles").select("id, full_name").in("id", staffIds)
        : Promise.resolve({
            data: [] as { id: string; full_name: string | null }[],
          }),
    ]);

  const itemCountByOrder = new Map<string, number>();
  for (const item of items ?? []) {
    itemCountByOrder.set(
      item.order_id,
      (itemCountByOrder.get(item.order_id) ?? 0) + 1,
    );
  }
  const tableLabelById = new Map(
    (tables ?? []).map((table) => [table.id, table.label]),
  );
  const staffNameById = new Map(
    (profiles ?? []).map((profile) => [profile.id, profile.full_name]),
  );

  let rows: OrderListRow[] = orders.map((order) => ({
    ...order,
    subtotal: Number(order.subtotal),
    discount_total: Number(order.discount_total),
    tax_total: Number(order.tax_total),
    grand_total: Number(order.grand_total),
    table_label: order.table_id
      ? (tableLabelById.get(order.table_id) ?? null)
      : null,
    opened_by_name: order.opened_by
      ? (staffNameById.get(order.opened_by) ?? null)
      : null,
    item_count: itemCountByOrder.get(order.id) ?? 0,
  }));

  const search = filters.search?.trim().toLowerCase();
  if (search) {
    rows = rows.filter((order) => {
      return (
        order.id.toLowerCase().includes(search) ||
        (order.table_label ?? "").toLowerCase().includes(search) ||
        (order.opened_by_name ?? "").toLowerCase().includes(search) ||
        (order.payment_method ?? "").toLowerCase().includes(search)
      );
    });
  }

  return rows;
}

export async function fetchOrderDetail(
  supabase: SupabaseClient,
  userId: string,
  orderId: string,
): Promise<OrderDetail | null> {
  const { data: order, error } = await supabase
    .from("orders")
    .select("*")
    .eq("user_id", userId)
    .eq("id", orderId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!order) return null;

  const [{ data: items }, { data: table }, { data: profile }] =
    await Promise.all([
      supabase
        .from("order_items")
        .select("*, menu_items(name)")
        .eq("user_id", userId)
        .eq("order_id", orderId),
      order.table_id
        ? supabase
            .from("restaurant_tables")
            .select("label")
            .eq("id", order.table_id)
            .maybeSingle()
        : Promise.resolve({ data: null as { label: string } | null }),
      order.opened_by
        ? supabase
            .from("profiles")
            .select("full_name")
            .eq("id", order.opened_by)
            .maybeSingle()
        : Promise.resolve({
            data: null as { full_name: string | null } | null,
          }),
    ]);

  const detailItems: OrderDetailItem[] = (items ?? []).map((row) => ({
    id: row.id,
    user_id: row.user_id,
    order_id: row.order_id,
    menu_item_id: row.menu_item_id,
    quantity: row.quantity,
    unit_price: Number(row.unit_price),
    selected_modifiers: (row.selected_modifiers as SelectedModifier[]) ?? [],
    notes: row.notes,
    kds_status: row.kds_status,
    menu_item_name:
      (row.menu_items as { name?: string } | null)?.name ?? "Item",
    created_at: row.created_at,
  }));

  return {
    ...(order as Order),
    subtotal: Number(order.subtotal),
    discount_total: Number(order.discount_total),
    tax_total: Number(order.tax_total),
    grand_total: Number(order.grand_total),
    table_label: table?.label ?? null,
    opened_by_name: profile?.full_name ?? null,
    item_count: detailItems.length,
    items: detailItems,
  };
}

export async function voidOrder(
  supabase: SupabaseClient,
  userId: string,
  orderId: string,
) {
  const { error } = await supabase
    .from("orders")
    .update({
      status: OrderStatus.VOID,
      closed_at: new Date().toISOString(),
    })
    .eq("id", orderId)
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
}

export async function fetchStaffOptions(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ auth_id: string; full_name: string }[]> {
  const { data: staff, error } = await supabase
    .from("staff_members")
    .select("auth_id")
    .eq("user_id", userId)
    .eq("is_active", true);

  if (error) throw new Error(error.message);
  const authIds = (staff ?? []).map((row) => row.auth_id);
  if (authIds.length === 0) return [];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", authIds);

  return (profiles ?? []).map((profile) => ({
    auth_id: profile.id,
    full_name: profile.full_name?.trim() || "Staff",
  }));
}
