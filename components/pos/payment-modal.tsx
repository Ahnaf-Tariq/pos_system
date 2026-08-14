"use client";

import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { PaymentMethod } from "@/types/enums";
import { formatMoney } from "@/lib/utils";
import { Numpad } from "@/components/pos/numpad";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PaymentModalProps {
  open: boolean;
  currency: string;
  grandTotal: number;
  onOpenChange: (open: boolean) => void;
  onConfirm: (input: {
    paymentMethod: PaymentMethod;
    amountTendered: number;
  }) => void;
}

export function PaymentModal({
  open,
  currency,
  grandTotal,
  onOpenChange,
  onConfirm,
}: PaymentModalProps) {
  const [method, setMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [tendered, setTendered] = useState("");

  const amountTendered = Number(tendered || 0);
  const change = useMemo(
    () => Math.max(0, amountTendered - grandTotal),
    [amountTendered, grandTotal],
  );

  function handleConfirm() {
    if (method === PaymentMethod.CASH && amountTendered < grandTotal) {
      toast.error("Cash received is less than the total");
      return;
    }
    onConfirm({
      paymentMethod: method,
      amountTendered:
        method === PaymentMethod.CASH ? amountTendered : grandTotal,
    });
    onOpenChange(false);
    setTendered("");
    setMethod(PaymentMethod.CASH);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Take payment</DialogTitle>
          <DialogDescription>
            Total due{" "}
            <span className="money text-base">
              {formatMoney(grandTotal, currency)}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          {([PaymentMethod.CASH, PaymentMethod.CARD] as const).map((value) => (
            <Button
              key={value}
              type="button"
              variant={method === value ? "default" : "outline"}
              className="min-h-11 flex-1 capitalize"
              onClick={() => setMethod(value)}
            >
              {value}
            </Button>
          ))}
        </div>

        {method === PaymentMethod.CASH ? (
          <div className="space-y-3">
            <div className="rounded-md border border-border bg-secondary/40 px-3 py-2">
              <p className="text-xs text-muted-foreground">Cash received</p>
              <p className="money text-xl">
                {formatMoney(amountTendered || 0, currency)}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Change:{" "}
                <span className="text-primary">
                  {formatMoney(change, currency)}
                </span>
              </p>
            </div>
            <Numpad value={tendered} onChange={setTendered} />
            <div className="grid grid-cols-3 gap-2">
              {[
                grandTotal,
                Math.ceil(grandTotal / 100) * 100,
                Math.ceil(grandTotal / 500) * 500,
              ].map((quick) => (
                <Button
                  key={quick}
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  onClick={() => setTendered(String(quick))}
                >
                  {formatMoney(quick, currency)}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Mark this order as paid by card.
          </p>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleConfirm}>
            Complete payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
