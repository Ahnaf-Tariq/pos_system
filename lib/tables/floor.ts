import type { SupabaseClient } from "@supabase/supabase-js";
import type { RestaurantTable, TableWithOrder } from "@/types/interfaces";
import { KdsStatus, OrderStatus, TableStatus } from "@/types/enums";

const FLOOR_ORDER_STATUSES = [
  OrderStatus.OPEN,
  OrderStatus.SENT_TO_KITCHEN,
  OrderStatus.READY,
  OrderStatus.SERVED,
  OrderStatus.PAID,
] as const;

type FloorOrderRow = {
  id: string;
  status: string;
  grand_total: number;
  created_at: string;
  order_type: string;
  table_id: string | null;
};

function toActiveOrder(
  order: FloorOrderRow,
): NonNullable<TableWithOrder["activeOrder"]> {
  return {
    id: order.id,
    status: order.status as NonNullable<
      TableWithOrder["activeOrder"]
    >["status"],
    grand_total: Number(order.grand_total),
    created_at: order.created_at,
    order_type: order.order_type as NonNullable<
      TableWithOrder["activeOrder"]
    >["order_type"],
  };
}

function isOpenFloorStatus(status: string) {
  return (
    status === OrderStatus.OPEN ||
    status === OrderStatus.SENT_TO_KITCHEN ||
    status === OrderStatus.READY ||
    status === OrderStatus.SERVED
  );
}

export async function fetchTablesWithOrders(
  supabase: SupabaseClient,
  userId: string,
  locationId: string,
): Promise<TableWithOrder[]> {
  const [
    { data: tables, error: tablesError },
    { data: orders, error: ordersError },
  ] = await Promise.all([
    supabase
      .from("restaurant_tables")
      .select("*")
      .eq("user_id", userId)
      .eq("location_id", locationId)
      .order("label", { ascending: true }),
    supabase
      .from("orders")
      .select("id, status, grand_total, created_at, order_type, table_id")
      .eq("user_id", userId)
      .eq("location_id", locationId)
      .not("table_id", "is", null)
      .in("status", [...FLOOR_ORDER_STATUSES])
      .order("created_at", { ascending: false }),
  ]);

  if (tablesError) throw new Error(tablesError.message);
  if (ordersError) throw new Error(ordersError.message);

  const floorOrders = (orders as FloorOrderRow[] | null) ?? [];
  const paidIds = floorOrders
    .filter((order) => order.status === OrderStatus.PAID)
    .map((order) => order.id);

  const paidStillInKitchen = new Set<string>();
  if (paidIds.length > 0) {
    const { data: items, error: itemsError } = await supabase
      .from("order_items")
      .select("order_id, kds_status")
      .eq("user_id", userId)
      .in("order_id", paidIds)
      .neq("kds_status", KdsStatus.SERVED);

    if (itemsError) throw new Error(itemsError.message);
    for (const item of items ?? []) {
      paidStillInKitchen.add(item.order_id as string);
    }
  }

  const activeByTable = new Map<string, TableWithOrder["activeOrder"]>();

  for (const order of floorOrders) {
    if (!order.table_id) continue;

    const countsAsActive =
      isOpenFloorStatus(order.status) ||
      (order.status === OrderStatus.PAID && paidStillInKitchen.has(order.id));

    if (!countsAsActive) continue;

    const existing = activeByTable.get(order.table_id);
    if (!existing) {
      activeByTable.set(order.table_id, toActiveOrder(order));
      continue;
    }

    if (
      existing.status === OrderStatus.PAID &&
      isOpenFloorStatus(order.status)
    ) {
      activeByTable.set(order.table_id, toActiveOrder(order));
    }
  }

  return ((tables as RestaurantTable[]) ?? []).map((table) => ({
    ...table,
    activeOrder: activeByTable.get(table.id) ?? null,
  }));
}

export function tableStatusStyles(status: string) {
  switch (status) {
    case TableStatus.OCCUPIED:
      return "border-primary/60 bg-primary/15 text-foreground";
    case TableStatus.RESERVED:
      return "border-warning/50 bg-warning/15 text-foreground";
    case TableStatus.DIRTY:
      return "border-destructive/50 bg-destructive/15 text-foreground";
    case TableStatus.AVAILABLE:
    default:
      return "border-border bg-card text-foreground hover:border-primary/40";
  }
}

export type ElapsedTone = "ok" | "warn" | "hot";

export function tableElapsedMinutes(
  openedAt: string,
  now: number = Date.now(),
): number {
  return Math.max(0, Math.floor((now - new Date(openedAt).getTime()) / 60000));
}

export function elapsedBadgeTone(minutes: number): ElapsedTone {
  if (minutes >= 60) return "hot";
  if (minutes >= 30) return "warn";
  return "ok";
}

export function formatElapsed(minutes: number): string {
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m`;
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
}
