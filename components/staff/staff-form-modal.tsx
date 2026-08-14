"use client";

import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { Select } from "antd";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  inviteStaffSchema,
  type InviteStaffInput,
} from "@/lib/validations/staff";
import type { StaffMemberView } from "@/types/interfaces";
import { roleLabel } from "@/lib/navigation";
import { StaffRole } from "@/types/enums";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface LocationOption {
  id: string;
  name: string;
}

interface StaffFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "add" | "edit";
  member?: StaffMemberView | null;
  locations: LocationOption[];
  roleOptions: StaffRole[];
  defaultLocationId: string;
  onSubmit: (values: InviteStaffInput) => Promise<void>;
}

function emptyDefaults(defaultLocationId: string): InviteStaffInput {
  return {
    email: "",
    fullName: "",
    phone: "",
    role: StaffRole.CASHIER,
    locationId: defaultLocationId,
    salary: 0,
  };
}

function memberDefaults(
  member: StaffMemberView,
  defaultLocationId: string,
): InviteStaffInput {
  return {
    fullName: member.full_name?.trim() || "",
    email: member.email?.trim() || "",
    phone: member.phone?.trim() || "",
    role: member.role,
    locationId: member.location_id || defaultLocationId,
    salary: Number(member.salary ?? 0),
  };
}

export function StaffFormModal({
  open,
  onOpenChange,
  mode,
  member = null,
  locations,
  roleOptions,
  defaultLocationId,
  onSubmit,
}: StaffFormModalProps) {
  const isEdit = mode === "edit";
  const isOwner = isEdit && member?.role === StaffRole.OWNER;

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    control,
    formState: { errors, isSubmitting },
  } = useForm<InviteStaffInput>({
    resolver: zodResolver(inviteStaffSchema),
    defaultValues: emptyDefaults(defaultLocationId),
  });

  const selectedRole = watch("role");

  useEffect(() => {
    if (!open) return;

    if (isEdit && member)
      reset(memberDefaults(member, defaultLocationId));
    else
      reset(emptyDefaults(defaultLocationId));
  }, [open, isEdit, member, defaultLocationId, reset]);

  async function handleFormSubmit(values: InviteStaffInput) {
    await onSubmit(values);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit staff" : "Add staff"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? `Update details for ${member?.full_name?.trim() || "this staff member"}.`
              : "Add them to this shop with a role."}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit(handleFormSubmit)}
          className="grid grid-cols-2 gap-4"
        >
          <div className="space-y-2">
            <Label htmlFor="staff-fullName">Full name</Label>
            <Input
              id="staff-fullName"
              {...register("fullName")}
              placeholder="Enter full name..."
            />
            {errors.fullName ? (
              <p className="text-sm text-destructive">
                {errors.fullName.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="staff-email">Email</Label>
            <Input
              id="staff-email"
              type="email"
              {...register("email")}
              placeholder="Enter email..."
            />
            {errors.email ? (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="staff-phone">Phone number</Label>
            <Input
              id="staff-phone"
              type="tel"
              placeholder="03xx xxx xxxx"
              {...register("phone")}
            />
            {errors.phone ? (
              <p className="text-sm text-destructive">{errors.phone.message}</p>
            ) : null}
          </div>

          {isOwner ? (
            <div className="space-y-2">
              <Label>Salary</Label>
              <Input value="—" disabled readOnly />
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="staff-salary">Salary</Label>
              <Input
                id="staff-salary"
                type="number"
                min="0"
                placeholder="Enter salary..."
                step="0.01"
                {...register("salary", { valueAsNumber: true })}
              />
              {errors.salary ? (
                <p className="text-sm text-destructive">
                  {errors.salary.message}
                </p>
              ) : null}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="staff-role">Role</Label>
            {isOwner ? (
              <div>
                <Badge
                  variant="outline"
                  className="rounded-full border-primary/40 bg-primary/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary"
                >
                  Owner
                </Badge>
              </div>
            ) : (
              <Select
                id="staff-role"
                className="w-full"
                value={selectedRole}
                onChange={(value) => setValue("role", value as StaffRole)}
                options={roleOptions.map((role) => ({
                  value: role,
                  label: roleLabel(role),
                }))}
              />
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="staff-locationId">Location</Label>
            <Controller
              name="locationId"
              control={control}
              render={({ field }) => (
                <Select
                  id="staff-locationId"
                  className="w-full"
                  value={field.value || undefined}
                  placeholder="Select location"
                  onChange={(value) => field.onChange(value)}
                  options={locations.map((location) => ({
                    value: location.id,
                    label: location.name,
                  }))}
                />
              )}
            />
            {errors.locationId ? (
              <p className="text-sm text-destructive">
                {errors.locationId.message}
              </p>
            ) : null}
          </div>

          <DialogFooter className="col-span-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? isEdit
                  ? "Saving…"
                  : "Adding…"
                : isEdit
                  ? "Save changes"
                  : "Add staff"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
