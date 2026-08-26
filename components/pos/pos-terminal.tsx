"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Plus, Printer, Send, Settings2, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  WriteQueueType,
  type Category,
  type Customer,
  type MenuItemWithGroups,
  type RestaurantTable,
  type SelectedModifier,
} from "@/types/interfaces";
import { OrderType, TableStatus, type PaymentMethod } from "@/types/enums";
import {
  getCartGrandTotal,
  getCartSubtotal,
  getCartTaxTotal,
  usePosStore,
} from "@/lib/pos-store";
import { enqueueOfflineOrder } from "@/lib/offline/db";
import { syncPendingWrites } from "@/lib/offline/sync-engine";
import { checkConnectivity } from "@/lib/offline/network";
import {
  allTablesCacheKey,
  customersCacheKey,
  menuCacheKey,
} from "@/lib/offline/cache-keys";
import { useOfflineQuery } from "@/hooks/use-offline-query";
import { CacheSyncNote } from "@/components/offline/cache-sync-note";
import { fetchCustomersList } from "@/lib/customers/catalog";
import { fetchMenuCatalog } from "@/lib/menu/catalog";
import {
  assertRecipeStockForCart,
  RecipeStockError,
} from "@/lib/inventory/deduct";
import { cn, formatMoney } from "@/lib/utils";
import { ROUTES } from "@/lib/routes";
import { useLocationContext } from "@/components/dashboard/location-provider";
import { useShopRealtime } from "@/hooks/use-shop-realtime";
import { PosCart } from "@/components/pos/cart";
import { ModifierPicker } from "@/components/pos/modifier-picker";
import { PaymentModal } from "@/components/pos/payment-modal";
import { CustomerEditorDialog } from "@/components/customers/customer-editor-dialog";
import { openThermalReceipt } from "@/lib/receipts/open-thermal";
import { Select } from "antd";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { queueWrite } from "@/lib/offline/write-queue";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";

interface PosTerminalProps {
  userId: string;
  authId: string;
  currency: string;
  taxRatePercent: number;
  categories: Category[];
  items: MenuItemWithGroups[];
  tables: RestaurantTable[];
  customers: Customer[];
  initialTableId?: string | null;
  kdsEnabled?: boolean;
}

export function PosTerminal({
  userId,
  authId,
  currency,
  taxRatePercent,
  categories,
  items,
  tables: initialTables,
  customers: initialCustomers,
  initialTableId = null,
  kdsEnabled = true,
}: PosTerminalProps) {
  const router = useRouter();
  const { selectedLocationId } = useLocationContext();
  const [statusTable, setStatusTable] = useState<RestaurantTable | null>(null);
  const [statusUpdating, setStatusUpdating] = useState(false);

  const menuQuery = useOfflineQuery({
    cacheKey: selectedLocationId
      ? menuCacheKey(userId, selectedLocationId)
      : "menu:disabled",
    enabled: Boolean(selectedLocationId),
    fetchFn: async () => {
      const supabase = createClient();
      return fetchMenuCatalog(supabase, userId, selectedLocationId!);
    },
  });

  const customersQuery = useOfflineQuery({
    cacheKey: selectedLocationId
      ? customersCacheKey(userId, selectedLocationId)
      : "customers:disabled",
    enabled: Boolean(selectedLocationId),
    fetchFn: async () => {
      const supabase = createClient();
      return fetchCustomersList(supabase, userId, selectedLocationId!);
    },
  });

  const tablesQuery = useOfflineQuery({
    cacheKey: allTablesCacheKey(userId),
    enabled: true,
    fetchFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("restaurant_tables")
        .select("*")
        .eq("user_id", userId)
        .order("label", { ascending: true });
      if (error) throw new Error(error.message);
      return (data as RestaurantTable[]) ?? [];
    },
  });

  const menuCategories = menuQuery.data?.categories ?? categories;
  const menuItems = menuQuery.data?.items ?? items;
  const customerList = customersQuery.data ?? initialCustomers;
  const tables = tablesQuery.data ?? initialTables;
  const dataLoading =
    menuQuery.loading || customersQuery.loading || tablesQuery.loading;
  const fromCache =
    menuQuery.fromCache || customersQuery.fromCache || tablesQuery.fromCache;
  const lastSyncedAt =
    [
      menuQuery.lastSyncedAt,
      customersQuery.lastSyncedAt,
      tablesQuery.lastSyncedAt,
    ]
      .filter(Boolean)
      .sort()
      .pop() ?? null;

  const [addCustomerOpen, setAddCustomerOpen] = useState(false);
  const [categoryId, setCategoryId] = useState<string | "all">("all");
  const [modifierItem, setModifierItem] = useState<MenuItemWithGroups | null>(
    null,
  );
  const [modifierOpen, setModifierOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lastReceiptOrderId, setLastReceiptOrderId] = useState<string | null>(
    null,
  );

  const cartItems = usePosStore((state) => state.items);
  const orderType = usePosStore((state) => state.orderType);
  const tableId = usePosStore((state) => state.tableId);
  const customerId = usePosStore((state) => state.customerId);
  const discountTotal = usePosStore((state) => state.discountTotal);
  const setOrderType = usePosStore((state) => state.setOrderType);
  const setTableId = usePosStore((state) => state.setTableId);
  const setCustomerId = usePosStore((state) => state.setCustomerId);
  const addItem = usePosStore((state) => state.addItem);
  const clearCart = usePosStore((state) => state.clearCart);
  const setDiscountTotal = usePosStore((state) => state.setDiscountTotal);

  const activeItems = useMemo(
    () => menuItems.filter((item) => item.is_active),
    [menuItems],
  );

  const visibleItems = useMemo(() => {
    if (categoryId === "all") return activeItems;
    return activeItems.filter((item) => item.category_id === categoryId);
  }, [activeItems, categoryId]);

  const locationTables = useMemo(
    () => tables.filter((table) => table.location_id === selectedLocationId),
    [tables, selectedLocationId],
  );

  const customerOptions = useMemo(
    () => [
      { value: "", label: "Walk-in" },
      ...customerList.map((customer) => ({
        value: customer.id,
        label: `${customer.full_name}${customer.phone ? ` · ${customer.phone}` : ""}`,
      })),
    ],
    [customerList],
  );

  const subtotal = getCartSubtotal(cartItems);
  const taxTotal = getCartTaxTotal(cartItems, discountTotal, taxRatePercent);
  const grandTotal = getCartGrandTotal(
    cartItems,
    discountTotal,
    taxRatePercent,
  );

  const refreshPosData = useCallback(() => {
    void menuQuery.refresh();
    void customersQuery.refresh();
    void tablesQuery.refresh();
  }, [menuQuery.refresh, customersQuery.refresh, tablesQuery.refresh]);

  const didSkipInitialLocation = useRef(false);
  useEffect(() => {
    if (!didSkipInitialLocation.current) {
      didSkipInitialLocation.current = true;
      return;
    }
    setCategoryId("all");
    clearCart();
  }, [selectedLocationId, clearCart]);

  useEffect(() => {
    if (
      customerId &&
      !customerList.some((customer) => customer.id === customerId)
    ) {
      setCustomerId(null);
    }
  }, [customerId, customerList, setCustomerId]);

  useEffect(() => {
    if (tableId && !locationTables.some((table) => table.id === tableId)) {
      setTableId(null);
    }
  }, [tableId, locationTables, setTableId]);

  useEffect(() => {
    if (!initialTableId) return;
    const table = locationTables.find((item) => item.id === initialTableId);
    if (!table || table.status !== TableStatus.AVAILABLE) {
      return;
    }

    setOrderType(OrderType.DINE_IN);
    setTableId(initialTableId);
  }, [initialTableId, locationTables, setOrderType, setTableId]);

  useShopRealtime({
    userId,
    locationId: selectedLocationId,
    onChange: refreshPosData,
  });

  function handleItemTap(item: MenuItemWithGroups) {
    if (item.modifier_groups.length > 0) {
      setModifierItem(item);
      setModifierOpen(true);
      return;
    }
    addItem({
      menu_item_id: item.id,
      name: item.name,
      basePrice: Number(item.price),
    });
  }

  function handleModifiersConfirm(selected: SelectedModifier[]) {
    if (!modifierItem) return;
    addItem({
      menu_item_id: modifierItem.id,
      name: modifierItem.name,
      basePrice: Number(modifierItem.price),
      selected_modifiers: selected,
    });
  }

  function handleCustomerSaved(customer: Customer) {
    void customersQuery.refresh();
    setCustomerId(customer.id);
  }

  async function commitOrder(
    action: "send_to_kitchen" | "pay",
    paymentMethod: PaymentMethod | null,
  ) {
    if (!selectedLocationId) {
      const message = "Select a location in the header first";
      toast.error(message);
      return;
    }
    if (cartItems.length === 0) {
      const message = "Cart is empty";
      toast.error(message);
      return;
    }
    if (orderType === OrderType.DINE_IN && !tableId) {
      const message = "Pick a table for dine-in orders";
      toast.error(message);
      return;
    }

    setSubmitting(true);
    const clientGeneratedId = crypto.randomUUID();

    try {
      const online = await checkConnectivity();
      let orderKdsEnabled = kdsEnabled;

      if (online) {
        const supabase = createClient();
        await assertRecipeStockForCart({
          supabase,
          userId,
          locationId: selectedLocationId,
          items: cartItems,
        });

        const { data: shopFlags } = await supabase
          .from("users")
          .select("kds_enabled")
          .eq("user_id", userId)
          .maybeSingle();
        orderKdsEnabled = shopFlags?.kds_enabled !== false;
      }

      await enqueueOfflineOrder({
        client_generated_id: clientGeneratedId,
        user_id: userId,
        location_id: selectedLocationId,
        table_id: orderType === OrderType.DINE_IN ? tableId : null,
        customer_id: customerId,
        order_type: orderType,
        status: action === "pay" ? "paid" : "sent_to_kitchen",
        opened_by: authId,
        subtotal,
        discount_total: discountTotal,
        tax_total: taxTotal,
        grand_total: grandTotal,
        payment_method: paymentMethod,
        items: cartItems,
        notes: null,
        action,
        kds_enabled: orderKdsEnabled,
      });

      if (online) {
        const supabase = createClient();
        await syncPendingWrites(supabase);

        if (action === "pay") {
          const { data: paidOrder } = await supabase
            .from("orders")
            .select("id")
            .eq("user_id", userId)
            .eq("client_generated_id", clientGeneratedId)
            .maybeSingle();

          if (paidOrder?.id) {
            setLastReceiptOrderId(paidOrder.id as string);
            toast.success("Payment recorded. Receipt ready to print.");
            openThermalReceipt(paidOrder.id as string, { print: true });
          } else {
            toast.success("Payment recorded.");
          }
        } else {
          toast.success(
            orderKdsEnabled
              ? "Order queued and sent to kitchen."
              : "Order saved.",
          );
        }
      } else if (action === "pay") {
        toast.success(
          "Payment saved offline. Print receipt when you are back online.",
        );
      } else {
        toast.success(
          orderKdsEnabled
            ? "Order queued and sent to kitchen."
            : "Order saved offline.",
        );
      }

      clearCart();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not submit order";
      toast.error(message);
      if (err instanceof RecipeStockError) router.push(ROUTES.inventory);
    } finally {
      setSubmitting(false);
    }
  }

  async function updateTableStatus(
    table: RestaurantTable,
    status: TableStatus,
  ) {
    if (!selectedLocationId) return;
    setStatusUpdating(true);

    try {
      const online = await checkConnectivity();
      if (online) {
        const supabase = createClient();

        const { error } = await supabase
          .from("restaurant_tables")
          .update({ status })
          .eq("id", table.id)
          .eq("user_id", userId)
          .eq("location_id", selectedLocationId);

        if (error) throw new Error(error.message);
      } else {
        await queueWrite({
          type: WriteQueueType.TABLE_UPDATE_STATUS,
          payload: {
            userId,
            tableId: table.id,
            locationId: selectedLocationId,
            status,
            tableLabel: table.label,
            previousStatus: table.status,
          },
        });
      }

      if (tableId === table.id && status !== TableStatus.AVAILABLE) {
        setTableId(null);
      }

      setStatusTable(null);
      toast.success(
        online
          ? `${table.label} changed to ${status}`
          : "Table status change queued for sync",
      );
      await tablesQuery.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not update table status",
      );
    } finally {
      setStatusUpdating(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 lg:h-[calc(100vh-7.5rem)] lg:min-h-0">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">POS</h1>
          <p className="text-sm text-muted-foreground">
            Fast order entry for the floor.
          </p>
          <CacheSyncNote fromCache={fromCache} lastSyncedAt={lastSyncedAt} />
        </div>
      </div>

      {(menuQuery.noCachedData || customersQuery.noCachedData) &&
      !dataLoading ? (
        <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
          No cached menu data yet. Connect once while online to download.
        </p>
      ) : null}

      <div className="grid gap-3 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1.4fr)_360px]">
        <section className="flex h-[min(70vh,40rem)] min-h-[28rem] flex-col rounded-lg border border-border bg-card lg:h-full lg:min-h-0">
          <div className="shrink-0 space-y-3 border-b border-border p-3">
            <div className="flex flex-wrap gap-2">
              {(
                [
                  OrderType.DINE_IN,
                  OrderType.TAKEAWAY,
                  OrderType.DELIVERY,
                ] as OrderType[]
              ).map((type) => (
                <Button
                  key={type}
                  type="button"
                  variant={orderType === type ? "default" : "outline"}
                  className="min-h-11 capitalize"
                  onClick={() => setOrderType(type)}
                >
                  {type.replace("_", " ")}
                </Button>
              ))}
            </div>

            {orderType === OrderType.DINE_IN ? (
              <div className="flex flex-wrap gap-2">
                {locationTables.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No tables for this location yet. Add them in Tables.
                  </p>
                ) : (
                  locationTables.map((table) => {
                    const isAvailable = table.status === TableStatus.AVAILABLE;
                    const isSelected = tableId === table.id;

                    return (
                      <div
                        key={table.id}
                        className={cn(
                          "inline-flex items-center overflow-hidden rounded-md border text-xs transition-colors",
                          isSelected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-input bg-background",
                          !isAvailable && "cursor-not-allowed opacity-60",
                        )}
                      >
                        <button
                          type="button"
                          disabled={!isAvailable}
                          className="flex h-10 items-center gap-2 px-3 hover:bg-accent/50 disabled:pointer-events-none"
                          onClick={() => {
                            if (!isAvailable) return;
                            setTableId(isSelected ? null : table.id);
                          }}
                        >
                          <span className="font-medium">{table.label}</span>
                          <Badge
                            variant={isAvailable ? "secondary" : "destructive"}
                            className="capitalize"
                          >
                            {table.status}
                          </Badge>
                        </button>

                        <div
                          className={cn(
                            "h-5 w-px",
                            isSelected
                              ? "bg-primary-foreground/30"
                              : "bg-border",
                          )}
                        />

                        <button
                          type="button"
                          title={`Change ${table.label} status`}
                          className="flex h-10 w-8 items-center justify-center hover:bg-accent/50"
                          onClick={(event) => {
                            event.stopPropagation();
                            setStatusTable(table);
                          }}
                        >
                          <Settings2 className="size-4" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <label
                htmlFor="pos-customer"
                className="text-xs text-muted-foreground"
              >
                Customer
              </label>
              <Select
                id="pos-customer"
                className="min-w-[180px] flex-1"
                value={customerId ?? ""}
                onChange={(value) => setCustomerId(value ? value : null)}
                options={customerOptions}
                showSearch={{ optionFilterProp: "label" }}
                popupRender={(menu) => (
                  <>
                    {menu}
                    <div className="border-t border-border p-2">
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-9 w-full justify-start gap-2"
                        onMouseDown={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                        }}
                        onClick={() => setAddCustomerOpen(true)}
                      >
                        <Plus className="size-4" />
                        Add customer
                      </Button>
                    </div>
                  </>
                )}
              />
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1">
              <Button
                type="button"
                size="sm"
                variant={categoryId === "all" ? "default" : "secondary"}
                className="min-h-10 shrink-0"
                onClick={() => setCategoryId("all")}
              >
                All
              </Button>
              {menuCategories.map((category) => (
                <Button
                  key={category.id}
                  type="button"
                  size="sm"
                  variant={categoryId === category.id ? "default" : "secondary"}
                  className="min-h-10 shrink-0"
                  onClick={() => setCategoryId(category.id)}
                >
                  {category.name}
                </Button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {visibleItems.length === 0 ? (
              <div className="flex h-full items-center justify-center p-8 text-center text-sm text-muted-foreground">
                No active menu items. Add them in Menu first.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4">
                {visibleItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleItemTap(item)}
                    className="min-h-[140px] overflow-hidden rounded-lg border border-border bg-secondary/20 text-left transition hover:border-primary hover:bg-sidebar-accent/40"
                  >
                    <div className="aspect-[4/3] bg-secondary">
                      {item.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.image_url}
                          alt={item.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                          No image
                        </div>
                      )}
                    </div>
                    <div className="space-y-1 p-3">
                      <p className="line-clamp-2 text-sm font-medium">
                        {item.name}
                      </p>
                      <p className="money text-sm">
                        {formatMoney(Number(item.price), currency)}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        <aside className="flex min-h-[34rem] flex-col overflow-hidden rounded-lg border border-border bg-card lg:h-full lg:min-h-0">
          <div className="flex min-h-0 flex-1 flex-col">
            <PosCart currency={currency} />
          </div>
          <div className="shrink-0 space-y-3 border-t border-border bg-card p-3">
            <div className="flex items-center gap-2">
              <label
                htmlFor="pos-discount"
                className="shrink-0 text-xs text-muted-foreground"
              >
                Discount
              </label>
              <Input
                id="pos-discount"
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                className="h-9"
                value={discountTotal || ""}
                placeholder="0"
                onChange={(event) => {
                  const raw = event.target.value;
                  if (raw === "") {
                    setDiscountTotal(0);
                    return;
                  }
                  const value = Number(raw);
                  if (Number.isNaN(value)) return;
                  setDiscountTotal(Math.max(0, value));
                }}
              />
              {discountTotal > 0 ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="shrink-0"
                  onClick={() => setDiscountTotal(0)}
                >
                  Clear
                </Button>
              ) : null}
            </div>

            <div className="space-y-1 rounded-md border border-border bg-secondary/20 px-3 py-3 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>{formatMoney(subtotal, currency)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Discount</span>
                <span>-{formatMoney(discountTotal, currency)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Tax ({taxRatePercent}%)</span>
                <span>{formatMoney(taxTotal, currency)}</span>
              </div>
              <div className="flex justify-between pt-1 text-base font-semibold">
                <span>Total</span>
                <span className="money">
                  {formatMoney(grandTotal, currency)}
                </span>
              </div>
            </div>

            <div
              className={kdsEnabled ? "grid grid-cols-2 gap-2" : "grid gap-2"}
            >
              {kdsEnabled ? (
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-9"
                  disabled={submitting || cartItems.length === 0}
                  onClick={() => commitOrder("send_to_kitchen", null)}
                >
                  <Send className="size-4" />
                  Kitchen
                </Button>
              ) : null}
              <Button
                type="button"
                className="min-h-9"
                disabled={submitting || cartItems.length === 0}
                onClick={() => setPaymentOpen(true)}
              >
                <Wallet className="size-4" />
                Pay
              </Button>
            </div>
          </div>
        </aside>
      </div>

      <ModifierPicker
        open={modifierOpen}
        item={modifierItem}
        currency={currency}
        onOpenChange={setModifierOpen}
        onConfirm={handleModifiersConfirm}
      />

      <PaymentModal
        open={paymentOpen}
        currency={currency}
        grandTotal={grandTotal}
        onOpenChange={setPaymentOpen}
        onConfirm={({ paymentMethod }) => {
          void commitOrder("pay", paymentMethod);
        }}
      />

      <CustomerEditorDialog
        open={addCustomerOpen}
        onOpenChange={setAddCustomerOpen}
        userId={userId}
        locationId={selectedLocationId}
        customer={null}
        showLoyalty={false}
        onSaved={handleCustomerSaved}
      />

      <Dialog
        open={Boolean(statusTable)}
        onOpenChange={(open) => {
          if (!open && !statusUpdating) {
            setStatusTable(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change {statusTable?.label} status</DialogTitle>

            <DialogDescription>
              Update the table status directly from the POS.
            </DialogDescription>
          </DialogHeader>

          {statusTable ? (
            <div className="space-y-3">
              <div className="rounded-md border border-border bg-secondary/20 px-3 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {statusTable.label}
                  </span>

                  <Badge
                    variant={
                      statusTable.status === TableStatus.AVAILABLE
                        ? "secondary"
                        : "destructive"
                    }
                    className="capitalize"
                  >
                    {statusTable.status}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {[
                  TableStatus.AVAILABLE,
                  TableStatus.OCCUPIED,
                  TableStatus.RESERVED,
                  TableStatus.DIRTY,
                ].map((status) => (
                  <Button
                    key={status}
                    type="button"
                    variant={
                      statusTable.status === status ? "default" : "outline"
                    }
                    className="min-h-11 capitalize"
                    disabled={statusUpdating}
                    onClick={() => void updateTableStatus(statusTable, status)}
                  >
                    {status}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
