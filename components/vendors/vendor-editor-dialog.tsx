"use client";

import { useEffect } from "react";
import toast from "react-hot-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClient } from "@/lib/supabase/client";
import { vendorSchema, type VendorInput } from "@/lib/validations/vendor";
import type { Vendor, VendorEditorDialogProps } from "@/types/interfaces";
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

export function VendorEditorDialog({
  open,
  onOpenChange,
  userId,
  locationId,
  vendor = null,
  onSaved,
}: VendorEditorDialogProps) {
  const isEditing = Boolean(vendor?.id);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<VendorInput>({
    resolver: zodResolver(vendorSchema),
    defaultValues: {
      name: "",
      phone: "",
      email: "",
    },
  });

  useEffect(() => {
    if (!open) return;
    reset({
      name: vendor?.name ?? "",
      phone: vendor?.phone ?? "",
      email: vendor?.email ?? "",
    });
  }, [open, vendor, reset]);

  async function onSave(values: VendorInput) {
    if (!isEditing && !locationId) {
      toast.error("Select a location first");
      return;
    }

    const supabase = createClient();
    const payload = {
      user_id: userId,
      location_id: locationId,
      name: values.name.trim(),
      phone: values.phone.trim(),
      email: values.email?.trim() || null,
    };

    if (isEditing && vendor) {
      const { data, error } = await supabase
        .from("vendors")
        .update({
          name: payload.name,
          phone: payload.phone,
          email: payload.email,
        })
        .eq("id", vendor.id)
        .eq("user_id", userId)
        .select("*")
        .single();

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success("Vendor updated");
      onOpenChange(false);
      onSaved(data as Vendor);
      return;
    }

    const { data, error } = await supabase
      .from("vendors")
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Vendor added");
    onOpenChange(false);
    onSaved(data as Vendor);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit vendor" : "Add vendor"}</DialogTitle>
          <DialogDescription>
            Suppliers for the currently selected location.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSave)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="vendor-name">Name</Label>
            <Input
              id="vendor-name"
              placeholder="Enter vendor name..."
              {...register("name")}
            />
            {errors.name ? (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            ) : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="vendor-phone">Phone</Label>
              <Input
                id="vendor-phone"
                type="tel"
                placeholder="Enter phone number..."
                {...register("phone")}
              />
              {errors.phone ? (
                <p className="text-sm text-destructive">
                  {errors.phone.message}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="vendor-email">Email</Label>
              <Input
                id="vendor-email"
                type="email"
                placeholder="Enter email..."
                {...register("email")}
              />
              {errors.email ? (
                <p className="text-sm text-destructive">
                  {errors.email.message}
                </p>
              ) : null}
            </div>
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
              {isSubmitting ? "Saving…" : isEditing ? "Save" : "Add vendor"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
