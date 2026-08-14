import type { LucideIcon } from "lucide-react";
import type { AppRoute } from "@/lib/routes";
import type {
  AccountStatus,
  BusinessType,
  InventoryMovementReason,
  KdsStatus,
  OrderStatus,
  OrderType,
  PaymentMethod,
  SalaryPayBasis,
  StaffRole,
  SubscriptionPlan,
  TableStatus,
} from "@/types/enums";

export interface Shop {
  user_id: string;
  owner_auth_id: string;
  business_name: string;
  slug: string;
  business_type: BusinessType;
  status: AccountStatus;
  subscription_plan: SubscriptionPlan | string;
  timezone: string;
  currency: string;
  tax_rate: number;
  kds_enabled: boolean;
  salary_pay_basis: SalaryPayBasis | string;
  receipt_footer: string | null;
  receipt_logo_url: string | null;
  created_at: string;
}

export interface Location {
  id: string;
  user_id: string;
  name: string;
  address: string | null;
  is_active: boolean;
  printer_name: string | null;
  printer_connection: string;
  printer_address: string | null;
  created_at: string;
}

export interface Profile {
  id: string;
  full_name: string | null;
  phone: string | null;
  email?: string | null;
  created_at: string;
}

export interface StaffMember {
  id: string;
  user_id: string;
  auth_id: string;
  location_id: string | null;
  role: StaffRole;
  is_active: boolean;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  salary: number;
  created_at: string;
}

export interface StaffMemberView extends StaffMember {
  location_name: string | null;
}

export interface PlatformAdmin {
  auth_id: string;
  created_at?: string;
}

export interface Category {
  id: string;
  user_id: string;
  location_id: string | null;
  name: string;
  sort_order: number;
  created_at: string;
}

export interface MenuItem {
  id: string;
  user_id: string;
  location_id: string | null;
  category_id: string | null;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_active: boolean;
  track_inventory: boolean;
  created_at: string;
}

export interface ModifierGroup {
  id: string;
  user_id: string;
  menu_item_id: string;
  name: string;
  is_required: boolean;
  min_select: number;
  max_select: number;
  created_at: string;
}

export interface Modifier {
  id: string;
  user_id: string;
  modifier_group_id: string;
  name: string;
  price_delta: number;
  created_at: string;
}

export interface ModifierGroupWithOptions extends ModifierGroup {
  modifiers: Modifier[];
}

export interface MenuItemWithGroups extends MenuItem {
  modifier_groups: ModifierGroupWithOptions[];
}

export interface InventoryItem {
  id: string;
  user_id: string;
  location_id: string;
  name: string;
  unit: string;
  quantity_on_hand: number;
  reorder_threshold: number;
  cost_per_unit: number;
  created_at: string;
}

export interface InventoryItemView extends InventoryItem {
  is_low: boolean;
}

export interface RecipeItem {
  id: string;
  user_id: string;
  menu_item_id: string;
  inventory_item_id: string;
  quantity_required: number;
  created_at: string;
}

export interface RecipeLineView extends RecipeItem {
  inventory_name: string;
  inventory_unit: string;
}

export interface InventoryMovement {
  id: string;
  user_id: string;
  inventory_item_id: string;
  change_qty: number;
  reason: InventoryMovementReason | string;
  reference_order_id: string | null;
  created_at: string;
}

export interface RestaurantTable {
  id: string;
  user_id: string;
  location_id: string;
  label: string;
  seats: number;
  status: TableStatus | string;
  created_at: string;
}

export interface TableWithOrder extends RestaurantTable {
  activeOrder: Pick<
    Order,
    "id" | "status" | "grand_total" | "created_at" | "order_type"
  > | null;
}

export interface Order {
  id: string;
  user_id: string;
  location_id: string;
  table_id: string | null;
  customer_id: string | null;
  order_type: OrderType;
  status: OrderStatus;
  opened_by: string | null;
  subtotal: number;
  discount_total: number;
  tax_total: number;
  grand_total: number;
  payment_method: string | null;
  client_generated_id: string | null;
  created_at: string;
  closed_at: string | null;
}

export interface Customer {
  id: string;
  user_id: string;
  location_id: string | null;
  full_name: string;
  phone: string | null;
  email: string | null;
  loyalty_points: number;
  notes: string | null;
  created_at: string;
}

export interface CustomerStats extends Customer {
  order_count: number;
  total_spend: number;
}

export interface SelectedModifier {
  id: string;
  name: string;
  price_delta: number;
}

export interface OrderItem {
  id: string;
  user_id: string;
  order_id: string;
  menu_item_id: string;
  quantity: number;
  unit_price: number;
  selected_modifiers: SelectedModifier[];
  notes: string | null;
  kds_status: KdsStatus | string;
  created_at: string;
}

export interface CartLineItem {
  localId: string;
  menu_item_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  selected_modifiers: SelectedModifier[];
  notes?: string;
}

export interface SessionContext {
  authId: string;
  shop: Shop | null;
  staffMember: StaffMember | null;
  profile: Profile | null;
  isSuperAdmin: boolean;
}

export interface DashboardSession {
  authId: string;
  email: string | null;
  shop: Shop;
  staffMember: StaffMember;
  profile: Profile | null;
  locations: Location[];
  lowStockCount: number;
}

export interface NavItem {
  title: string;
  href: AppRoute;
  icon: LucideIcon;
  roles: StaffRole[];
}

export interface OrderListFilters {
  locationId?: string | null;
  status?: OrderStatus | "all";
  orderType?: OrderType | "all";
  staffAuthId?: string | "all";
  search?: string;
  fromDate?: string;
  toDate?: string;
}

export interface OrderListRow extends Order {
  table_label: string | null;
  opened_by_name: string | null;
  item_count: number;
}

export interface OrderDetailItem extends OrderItem {
  menu_item_name: string;
  selected_modifiers: SelectedModifier[];
}

export interface OrderDetail extends OrderListRow {
  items: OrderDetailItem[];
}

export interface KdsTicketItem extends OrderItem {
  menu_item_name: string;
  selected_modifiers: SelectedModifier[];
}

export interface KdsTicket {
  order: Pick<
    Order,
    | "id"
    | "user_id"
    | "location_id"
    | "table_id"
    | "customer_id"
    | "order_type"
    | "status"
    | "created_at"
    | "grand_total"
  > & {
    table_label: string | null;
  };
  items: KdsTicketItem[];
  stage: KdsStatus;
}

export interface SalaryPayment {
  id: string;
  user_id: string;
  staff_member_id: string;
  amount: number;
  pay_basis: SalaryPayBasis | string;
  period_key: string;
  paid_by: string | null;
  notes: string | null;
  created_at: string;
}

export type SalaryRowStatus = "paid" | "pending";

export interface StaffSalaryRow {
  key: string;
  periodKey: string;
  periodLabel: string;
  amount: number | null;
  createdAt: string | null;
  status: SalaryRowStatus;
  notes: string | null;
  paymentId: string | null;
}

export interface StaffDetailData {
  member: StaffMemberView;
  salaryPayments: SalaryPayment[];
  salaryRows: StaffSalaryRow[];
  salaryPaidTotal: number;
  currentPeriodKey: string;
  currentPeriodPaid: boolean;
}

export interface AddStaffResult {
  ok: boolean;
  message: string;
}

export type NotificationType =
  | "sale_completed"
  | "order_served"
  | "table_freed"
  | "staff_added"
  | "low_stock";

export interface ShopNotification {
  id: string;
  user_id: string;
  location_id: string | null;
  type: NotificationType | string;
  title: string;
  body: string | null;
  href: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
}

export interface DashboardOverview {
  salesToday: number;
  ordersToday: number;
  averageTicket: number;
  topItems: Array<{
    menu_item_id: string;
    name: string;
    quantity: number;
    revenue: number;
  }>;
}

export interface ReportFilters {
  locationId?: string | null;
  fromDate: string;
  toDate: string;
}

export interface DaySalesPoint {
  date: string;
  total: number;
  orders: number;
}

export interface HourSalesPoint {
  hour: number;
  total: number;
  orders: number;
}

export interface PeriodSalesPoint {
  key: string;
  label: string;
  total: number;
  orders: number;
}

export interface ItemRanking {
  menu_item_id: string;
  name: string;
  quantity: number;
  revenue: number;
}

export interface StaffPerformance {
  auth_id: string;
  name: string;
  orders: number;
  revenue: number;
  average_ticket: number;
}

export type SalesPeriod = "daily" | "weekly" | "monthly" | "yearly";

export interface ReportBundle {
  paidOrders: number;
  revenue: number;
  averageTicket: number;
  discountTotal: number;
  voidCount: number;
  voidTotal: number;
  byDay: DaySalesPoint[];
  byHour: HourSalesPoint[];
  byPeriod: PeriodSalesPoint[];
  itemRanking: ItemRanking[];
  staffPerformance: StaffPerformance[];
  voids: Array<{
    id: string;
    created_at: string;
    grand_total: number;
    opened_by_name: string | null;
  }>;
  discounts: Array<{
    id: string;
    created_at: string;
    discount_total: number;
    grand_total: number;
  }>;
}

export interface ThermalReceiptItem {
  name: string;
  quantity: number;
  unit_price: number;
  amount: number;
  modifiers: SelectedModifier[];
  notes: string | null;
}

export interface ThermalReceiptData {
  order: Order;
  shopName: string;
  currency: string;
  taxRatePercent: number;
  receiptLogoUrl: string | null;
  receiptFooter: string | null;
  customerName: string | null;
  customerPhone: string | null;
  tableLabel: string | null;
  items: ThermalReceiptItem[];
}

export interface PlatformShopRow extends Shop {
  owner_email: string | null;
  owner_name: string | null;
}

export interface PlatformMetrics {
  totalShops: number;
  pendingShops: number;
  approvedShops: number;
  rejectedShops: number;
  suspendedShops: number;
  totalPaidOrders: number;
  totalRevenue: number;
  signupsByDay: Array<{ date: string; count: number }>;
  revenueByDay: Array<{ date: string; revenue: number; orders: number }>;
}

export type OfflineOrderAction = "send_to_kitchen" | "pay";

export interface OfflineOrderRecord {
  id?: number;
  client_generated_id: string;
  user_id: string;
  location_id: string;
  table_id: string | null;
  customer_id: string | null;
  order_type: OrderType;
  status: "sent_to_kitchen" | "paid";
  opened_by: string;
  subtotal: number;
  discount_total: number;
  tax_total: number;
  grand_total: number;
  payment_method: PaymentMethod | null;
  items: CartLineItem[];
  notes: string | null;
  pending_sync: boolean;
  action: OfflineOrderAction;
  created_at: string;
  last_error: string | null;
}

export interface ShopAccessRow {
  user_id: string;
  status: AccountStatus;
  business_name: string;
}

export interface PosState {
  items: CartLineItem[];
  orderType: OrderType;
  tableId: string | null;
  customerId: string | null;
  discountTotal: number;
  notes: string;
  selectedLocalId: string | null;
  addItem: (input: {
    menu_item_id: string;
    name: string;
    basePrice: number;
    selected_modifiers?: SelectedModifier[];
    notes?: string;
  }) => void;
  removeItem: (localId: string) => void;
  setQuantity: (localId: string, quantity: number) => void;
  setSelectedLocalId: (localId: string | null) => void;
  setOrderType: (orderType: OrderType) => void;
  setTableId: (tableId: string | null) => void;
  setCustomerId: (customerId: string | null) => void;
  setDiscountTotal: (amount: number) => void;
  setNotes: (notes: string) => void;
  clearCart: () => void;
}
