"use client";

import { Minus, Plus, Trash2 } from "lucide-react";
import { usePosStore } from "@/lib/pos-store";
import { formatMoney, cn } from "@/lib/utils";

interface PosCartProps {
  currency: string;
}

export function PosCart({ currency }: PosCartProps) {
  const items = usePosStore((state) => state.items);
  const selectedLocalId = usePosStore((state) => state.selectedLocalId);
  const setSelectedLocalId = usePosStore((state) => state.setSelectedLocalId);
  const setQuantity = usePosStore((state) => state.setQuantity);
  const removeItem = usePosStore((state) => state.removeItem);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">Cart</h2>
        <p className="text-xs text-muted-foreground">
          {items.length} line items
        </p>
      </div>

      <div className="min-h-[18rem] flex-1 space-y-2 overflow-y-auto overscroll-contain p-3 lg:min-h-0">
        {items.length === 0 ? (
          <p className="px-1 py-8 text-center text-sm text-muted-foreground">
            Tap menu items to build the order.
          </p>
        ) : (
          items.map((item) => (
            <button
              key={item.localId}
              type="button"
              onClick={() => setSelectedLocalId(item.localId)}
              className={cn(
                "w-full rounded-md border px-3 py-2.5 text-left transition-colors",
                selectedLocalId === item.localId
                  ? "border-primary bg-sidebar-accent"
                  : "border-border bg-card hover:bg-secondary/60",
              )}
            >
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.name}</p>
                  {item.selected_modifiers.length > 0 ? (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {item.selected_modifiers
                        .map((modifier) => modifier.name)
                        .join(", ")}
                    </p>
                  ) : null}
                </div>

                <span className="money shrink-0 text-sm">
                  {formatMoney(item.unit_price * item.quantity, currency)}
                </span>

                <div
                  className="flex shrink-0 items-center gap-0.5"
                  onClick={(event) => event.stopPropagation()}
                >
                  <button
                    type="button"
                    className="inline-flex size-7 items-center justify-center rounded text-muted-foreground hover:bg-secondary hover:text-foreground"
                    aria-label="Decrease quantity"
                    onClick={() => setQuantity(item.localId, item.quantity - 1)}
                  >
                    <Minus className="size-3.5" />
                  </button>
                  <span className="min-w-5 text-center text-xs font-semibold tabular-nums">
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    className="inline-flex size-7 items-center justify-center rounded text-muted-foreground hover:bg-secondary hover:text-foreground"
                    aria-label="Increase quantity"
                    onClick={() => setQuantity(item.localId, item.quantity + 1)}
                  >
                    <Plus className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    className="inline-flex size-7 items-center justify-center rounded text-muted-foreground hover:bg-secondary hover:text-destructive"
                    aria-label="Remove item"
                    onClick={() => removeItem(item.localId)}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
