"use client";

import { useEffect } from "react";
import toast from "react-hot-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClient } from "@/lib/supabase/client";
import { customerSchema, type CustomerInput } from "@/lib/validations/customer";
import type { Customer } from "@/types/interfaces";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface CustomerEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  locationId: string | null;
  /** Pass a customer to edit; null/undefined to add */
  customer?: Pick<
    Customer,
    "id" | "full_name" | "phone" | "email" | "loyalty_points" | "notes"
  > | null;
  /** When false, loyalty field is hidden (POS quick-add) */
  showLoyalty?: boolean;
  onSaved: (customer: Customer) => void;
}

export function CustomerEditorDialog({
  open,
  onOpenChange,
  userId,
  locationId,
  customer = null,
  showLoyalty = true,
  onSaved,
}: CustomerEditorDialogProps) {
  const isEditing = Boolean(customer?.id);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CustomerInput>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      full_name: "",
      phone: "",
      email: "",
      loyalty_points: 0,
      notes: "",
    },
  });

  useEffect(() => {
    if (!open) return;
    reset({
      full_name: customer?.full_name ?? "",
      phone: customer?.phone ?? "",
      email: customer?.email ?? "",
      loyalty_points: Number(customer?.loyalty_points ?? 0),
      notes: customer?.notes ?? "",
    });
  }, [open, customer, reset]);

  async function onSave(values: CustomerInput) {
    const supabase = createClient();
    const payload = {
      user_id: userId,
      location_id: locationId,
      full_name: values.full_name.trim(),
      phone: values.phone?.trim() || null,
      email: values.email?.trim() || null,
      loyalty_points: showLoyalty
        ? values.loyalty_points
        : (customer?.loyalty_points ?? 0),
      notes: values.notes?.trim() || null,
    };

    if (!isEditing && !locationId) {
      toast.error("Select a location first");
      return;
    }

    if (isEditing && customer) {
      const { data, error } = await supabase
        .from("customers")
        .update(payload)
        .eq("id", customer.id)
        .eq("user_id", userId)
        .select("*")
        .single();

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success("Customer updated");
      onOpenChange(false);
      onSaved(data as Customer);
      return;
    }

    const { data, error } = await supabase
      .from("customers")
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Customer created");
    onOpenChange(false);
    onSaved(data as Customer);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit customer" : "Add customer"}
          </DialogTitle>
          <DialogDescription>
            Store contact details{showLoyalty ? " and loyalty points" : ""}.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSave)} className="grid grid-cols-2 gap-2">
          <div className="space-y-2">
            <Label htmlFor="customer-full_name">Full name</Label>
            <Input
              id="customer-full_name"
              placeholder="Enter full name..."
              {...register("full_name")}
            />
            {errors.full_name ? (
              <p className="text-sm text-destructive">
                {errors.full_name.message}
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="customer-phone">Phone</Label>
            <Input
              id="customer-phone"
              type="tel"
              placeholder="Enter phone number..."
              {...register("phone")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="customer-email">Email</Label>
            <Input
              id="customer-email"
              type="email"
              placeholder="Enter email..."
              {...register("email")}
            />
          </div>
          {showLoyalty ? (
            <div className="space-y-2">
              <Label htmlFor="customer-loyalty_points">Loyalty points</Label>
              <Input
                id="customer-loyalty_points"
                type="number"
                placeholder="Enter loyalty points..."
                step="1"
                {...register("loyalty_points", { valueAsNumber: true })}
              />
            </div>
          ) : null}
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="customer-notes">Notes</Label>
            <Textarea
              id="customer-notes"
              placeholder="Enter notes..."
              rows={3}
              className="resize-none"
              {...register("notes")}
            />
          </div>
          <DialogFooter className="sm:col-span-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
