"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  openDrawerSchema,
  type OpenDrawerFormValues,
  type OpenDrawerInput,
} from "@/lib/validations/cash-drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface OpenDrawerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: OpenDrawerInput) => Promise<void>;
}

export function OpenDrawerDialog({
  open,
  onOpenChange,
  onSubmit,
}: OpenDrawerDialogProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<OpenDrawerFormValues, unknown, OpenDrawerInput>({
    resolver: zodResolver(openDrawerSchema),
    defaultValues: { opening_balance: 0 },
  });

  useEffect(() => {
    if (!open) return;
    reset({ opening_balance: 0 });
  }, [open, reset]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Open drawer</DialogTitle>
          <DialogDescription>
            Count cash in drawer before opening.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={handleSubmit(async (values) => {
            await onSubmit(values);
          })}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="opening-balance">Opening balance</Label>
            <Input
              id="opening-balance"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              {...register("opening_balance")}
            />
            {errors.opening_balance ? (
              <p className="text-sm text-destructive">
                {errors.opening_balance.message}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Opening…" : "Open drawer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
