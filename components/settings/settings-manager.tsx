"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Controller, useForm } from "react-hook-form";
import { Select } from "antd";
import { zodResolver } from "@hookform/resolvers/zod";
import { ImagePlus, Pencil, Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fetchShopSettings, uploadReceiptLogo } from "@/lib/settings/catalog";
import {
  getCachedDashboardSession,
  setCachedDashboardSession,
} from "@/lib/offline/session-cache";
import {
  businessProfileSchema,
  CURRENCIES,
  locationSchema,
  receiptSettingsSchema,
  TIMEZONES,
  type BusinessProfileInput,
  type LocationInput,
  type ReceiptSettingsInput,
} from "@/lib/validations/settings";
import { BusinessType, SalaryPayBasis } from "@/types/enums";
import type { Location, Shop } from "@/types/interfaces";
import { formatDate, cn } from "@/lib/utils";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { Button } from "@/components/ui/button";
import { AppLoader } from "@/components/ui/app-loader";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmModal } from "@/components/ui/confirm-modal";

interface SettingsManagerProps {
  userId: string;
}

export function SettingsManager({ userId }: SettingsManagerProps) {
  const router = useRouter();
  const [shop, setShop] = useState<Shop | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [locationOpen, setLocationOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Location | null>(null);

  const profileForm = useForm<BusinessProfileInput>({
    resolver: zodResolver(businessProfileSchema),
  });
  const receiptForm = useForm<ReceiptSettingsInput>({
    resolver: zodResolver(receiptSettingsSchema),
  });
  const locationForm = useForm<LocationInput>({
    resolver: zodResolver(locationSchema),
    defaultValues: {
      name: "",
      address: "",
      is_active: true,
      printer_name: "",
      printer_connection: "browser",
      printer_address: "",
    },
  });

  const refresh = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true);
      try {
        const supabase = createClient();
        const data = await fetchShopSettings(supabase, userId);
        setShop(data.shop);
        setLocations(data.locations);
        profileForm.reset({
          business_name: data.shop.business_name,
          business_type: data.shop.business_type,
          timezone: data.shop.timezone,
          currency: data.shop.currency,
          tax_rate: Number(data.shop.tax_rate ?? 0),
          salary_pay_basis:
            data.shop.salary_pay_basis === SalaryPayBasis.DAILY
              ? SalaryPayBasis.DAILY
              : SalaryPayBasis.MONTHLY,
          kds_enabled: data.shop.kds_enabled !== false,
        });
        receiptForm.reset({
          receipt_footer: data.shop.receipt_footer ?? "",
          receipt_logo_url: data.shop.receipt_logo_url ?? "",
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Could not load settings";
        toast.error(message);
      } finally {
        setLoading(false);
      }
    },
    [userId, profileForm, receiptForm],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useRealtimeRefresh({
    userId,
    tables: ["locations"],
    onChange: () => void refresh({ silent: true }),
  });

  async function saveProfile(values: BusinessProfileInput) {
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("users")
      .update({
        business_name: values.business_name.trim(),
        business_type: values.business_type,
        timezone: values.timezone,
        currency: values.currency.toUpperCase(),
        tax_rate: values.tax_rate,
        salary_pay_basis: values.salary_pay_basis,
        kds_enabled: values.kds_enabled,
      })
      .eq("user_id", userId);

    if (updateError) {
      toast.error(updateError.message);
      return;
    }
    toast.success("Business profile saved");

    const cached = await getCachedDashboardSession();
    if (cached && cached.shop.user_id === userId) {
      await setCachedDashboardSession({
        ...cached,
        shop: {
          ...cached.shop,
          business_name: values.business_name.trim(),
          business_type: values.business_type,
          timezone: values.timezone,
          currency: values.currency.toUpperCase(),
          tax_rate: values.tax_rate,
          salary_pay_basis: values.salary_pay_basis,
          kds_enabled: values.kds_enabled,
        },
      });
    }

    await refresh();
    router.refresh();
  }

  async function saveReceipt(values: ReceiptSettingsInput) {
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("users")
      .update({
        receipt_footer: values.receipt_footer?.trim() || null,
        receipt_logo_url: values.receipt_logo_url || null,
      })
      .eq("user_id", userId);

    if (updateError) {
      toast.error(updateError.message);
      return;
    }
    toast.success("Receipt settings saved");
    await refresh();
  }

  async function handleLogoUpload(file: File | null) {
    if (!file) return;
    setUploadingLogo(true);
    try {
      const supabase = createClient();
      const url = await uploadReceiptLogo({ supabase, userId, file });
      receiptForm.setValue("receipt_logo_url", url);
      toast.success("Logo uploaded");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Logo upload failed";
      toast.error(message);
    } finally {
      setUploadingLogo(false);
    }
  }

  function openCreateLocation() {
    setEditingLocation(null);
    locationForm.reset({
      name: "",
      address: "",
      is_active: true,
      printer_name: "",
      printer_connection: "browser",
      printer_address: "",
    });
    setLocationOpen(true);
  }

  function openEditLocation(location: Location) {
    setEditingLocation(location);
    locationForm.reset({
      name: location.name,
      address: location.address ?? "",
      is_active: location.is_active,
      printer_name: location.printer_name ?? "",
      printer_connection:
        (location.printer_connection as "browser" | "network" | "usb") ||
        "browser",
      printer_address: location.printer_address ?? "",
    });
    setLocationOpen(true);
  }

  async function saveLocation(values: LocationInput) {
    const supabase = createClient();
    const payload = {
      user_id: userId,
      name: values.name.trim(),
      address: values.address?.trim() || null,
      is_active: values.is_active,
      printer_name: values.printer_name?.trim() || null,
      printer_connection: values.printer_connection,
      printer_address: values.printer_address?.trim() || null,
    };

    if (editingLocation) {
      const { error: updateError } = await supabase
        .from("locations")
        .update(payload)
        .eq("id", editingLocation.id)
        .eq("user_id", userId);
      if (updateError) {
        toast.error(updateError.message);
        return;
      }
    } else {
      const { error: insertError } = await supabase
        .from("locations")
        .insert(payload);
      if (insertError) {
        toast.error(insertError.message);
        return;
      }
    }

    setLocationOpen(false);
    const successMessage = editingLocation
      ? "Location updated"
      : "Location created";
    toast.success(successMessage);
    await refresh();
  }

  function requestDeleteLocation(location: Location) {
    if (locations.length <= 1) {
      toast.error("Keep at least one location");
      return;
    }
    setDeleteTarget(location);
    setDeleteOpen(true);
  }

  async function confirmDeleteLocation() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from("locations")
      .delete()
      .eq("id", deleteTarget.id)
      .eq("user_id", userId);
    if (deleteError) {
      toast.error(deleteError.message);
    } else {
      toast.success("Location deleted");
      setDeleteOpen(false);
      setDeleteTarget(null);
      await refresh();
    }
    setDeleteLoading(false);
  }

  if (loading && !shop) {
    return <AppLoader fullPage />;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Business profile, locations, tax, receipts, and printers.
        </p>
      </div>

      <section className="space-y-4 rounded-lg border border-border bg-card p-5">
        <div>
          <h2 className="text-lg font-semibold">Business profile</h2>
          <p className="text-sm text-muted-foreground">
            Name, type, timezone, currency, and tax rate.
          </p>
        </div>
        <form
          onSubmit={profileForm.handleSubmit(saveProfile)}
          className="grid gap-4 sm:grid-cols-2"
        >
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="business_name">Business name</Label>
            <Input
              id="business_name"
              {...profileForm.register("business_name")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="business_type">Business type</Label>
            <Controller
              name="business_type"
              control={profileForm.control}
              render={({ field }) => (
                <Select
                  id="business_type"
                  className="w-full"
                  value={field.value}
                  onChange={field.onChange}
                  options={[
                    { value: BusinessType.RESTAURANT, label: "Restaurant" },
                    { value: BusinessType.RETAIL, label: "Retail" },
                  ]}
                />
              )}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="currency">Currency</Label>
            <Controller
              name="currency"
              control={profileForm.control}
              render={({ field }) => (
                <Select
                  id="currency"
                  className="w-full"
                  value={field.value}
                  onChange={field.onChange}
                  options={CURRENCIES.map((currency) => ({
                    value: currency,
                    label: currency,
                  }))}
                />
              )}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="timezone">Timezone</Label>
            <Controller
              name="timezone"
              control={profileForm.control}
              render={({ field }) => (
                <Select
                  id="timezone"
                  className="w-full"
                  value={field.value}
                  onChange={field.onChange}
                  options={TIMEZONES.map((timezone) => ({
                    value: timezone,
                    label: timezone,
                  }))}
                />
              )}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tax_rate">Tax rate (%)</Label>
            <Input
              id="tax_rate"
              type="number"
              step="0.001"
              min="0"
              {...profileForm.register("tax_rate", { valueAsNumber: true })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="salary_pay_basis">Staff salary basis</Label>
            <Controller
              name="salary_pay_basis"
              control={profileForm.control}
              render={({ field }) => (
                <Select
                  id="salary_pay_basis"
                  className="w-full"
                  value={field.value ?? SalaryPayBasis.MONTHLY}
                  onChange={field.onChange}
                  options={[
                    { value: SalaryPayBasis.MONTHLY, label: "Monthly" },
                    { value: SalaryPayBasis.DAILY, label: "Daily" },
                  ]}
                />
              )}
            />
            <p className="text-xs text-muted-foreground">
              Default is monthly if unset. Controls Pay Salary periods on Staff.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="kds_enabled">Kitchen display</Label>
            <Controller
              name="kds_enabled"
              control={profileForm.control}
              render={({ field }) => (
                <label
                  htmlFor="kds_enabled"
                  className="flex min-h-8 items-center justify-between gap-3 rounded-md border border-border px-3"
                >
                  <span className="text-sm text-muted-foreground">
                    Send POS orders to KDS and show it in the sidebar
                  </span>
                  <Switch
                    id="kds_enabled"
                    checked={field.value !== false}
                    onCheckedChange={field.onChange}
                  />
                </label>
              )}
            />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={profileForm.formState.isSubmitting}>
              Save profile
            </Button>
          </div>
        </form>
      </section>

      <section className="space-y-4 rounded-lg border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Locations</h2>
            <p className="text-sm text-muted-foreground">
              Branches and per-location printer setup.
            </p>
          </div>
          <Button type="button" onClick={openCreateLocation}>
            <Plus className="size-4" />
            Add location
          </Button>
        </div>

        <div className="space-y-3">
          {locations.map((location) => (
            <div
              key={location.id}
              className="flex flex-col gap-3 rounded-md border border-border p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{location.name}</p>
                  <Badge variant={location.is_active ? "success" : "secondary"}>
                    {location.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {location.address || "No address"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Printer: {location.printer_name || "Not set"} ·{" "}
                  {location.printer_connection || "browser"}
                  {location.printer_address
                    ? ` · ${location.printer_address}`
                    : ""}
                </p>
                <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                  Created {formatDate(location.created_at)}
                </p>
              </div>
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 text-primary hover:text-primary"
                  title="Edit"
                  aria-label="Edit"
                  onClick={() => openEditLocation(location)}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 text-destructive hover:text-destructive"
                  title="Delete"
                  aria-label="Delete"
                  onClick={() => requestDeleteLocation(location)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4 rounded-lg border border-border bg-card p-5">
        <div>
          <h2 className="text-lg font-semibold">Receipt template</h2>
          <p className="text-sm text-muted-foreground">
            Logo and footer text for printed receipts.
          </p>
        </div>
        <form
          onSubmit={receiptForm.handleSubmit(saveReceipt)}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="receipt_logo">Logo</Label>
            <label
              htmlFor="receipt_logo"
              className={cn(
                "relative flex min-h-[140px] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-lg border border-dashed border-border bg-secondary/30 transition-colors hover:border-primary/60 hover:bg-secondary/50",
                uploadingLogo && "pointer-events-none opacity-60",
              )}
            >
              {receiptForm.watch("receipt_logo_url") ? (
                <>
                  <img
                    src={receiptForm.watch("receipt_logo_url") || ""}
                    alt="Receipt logo preview"
                    className="h-full max-h-36 w-full object-contain p-4"
                  />
                  <div className="absolute right-3 bottom-3 flex items-center gap-2">
                    <span className="rounded-md bg-background/90 px-2 py-1 text-xs text-muted-foreground backdrop-blur">
                      Click to change
                    </span>
                    <button
                      type="button"
                      title="Remove logo"
                      aria-label="Remove logo"
                      className="rounded-md bg-destructive px-2 py-1 text-xs font-medium text-destructive-foreground backdrop-blur hover:opacity-90"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        receiptForm.setValue("receipt_logo_url", "");
                        toast.success(
                          "Logo removed — save receipt settings to apply",
                        );
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center gap-2 px-4 py-6 text-center">
                  <span className="flex size-12 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary">
                    <ImagePlus className="size-5" />
                  </span>
                  <p className="text-sm font-medium text-foreground">
                    {uploadingLogo ? "Uploading…" : "Upload receipt logo"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    PNG, JPG or WebP · click to browse
                  </p>
                </div>
              )}
              <input
                id="receipt_logo"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                disabled={uploadingLogo}
                className="sr-only"
                onChange={(event) => {
                  handleLogoUpload(event.target.files?.[0] ?? null);
                  event.target.value = "";
                }}
              />
            </label>
          </div>
          <div className="space-y-2">
            <Label htmlFor="receipt_footer">Footer text</Label>
            <Textarea
              id="receipt_footer"
              rows={3}
              placeholder="Thank you for dining with us!"
              {...receiptForm.register("receipt_footer")}
            />
          </div>
          <Button
            type="submit"
            disabled={receiptForm.formState.isSubmitting || uploadingLogo}
          >
            Save receipt settings
          </Button>
        </form>
      </section>

      <Dialog open={locationOpen} onOpenChange={setLocationOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingLocation ? "Edit location" : "Add location"}
            </DialogTitle>
            <DialogDescription>
              Configure branch details and printer connection.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={locationForm.handleSubmit(saveLocation)}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" {...locationForm.register("name")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input id="address" {...locationForm.register("address")} />
            </div>
            <label className="flex items-center gap-3 text-sm">
              <Switch
                checked={locationForm.watch("is_active")}
                onCheckedChange={(checked) =>
                  locationForm.setValue("is_active", checked)
                }
              />
              Active location
            </label>

            <div className="rounded-md border border-border p-3 space-y-3">
              <p className="text-sm font-semibold">Printer</p>
              <div className="space-y-2">
                <Label htmlFor="printer_name">Printer name</Label>
                <Input
                  id="printer_name"
                  placeholder="Counter Epson"
                  {...locationForm.register("printer_name")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="printer_connection">Connection</Label>
                <Controller
                  name="printer_connection"
                  control={locationForm.control}
                  render={({ field }) => (
                    <Select
                      id="printer_connection"
                      className="w-full"
                      value={field.value}
                      onChange={field.onChange}
                      options={[
                        { value: "browser", label: "Browser print" },
                        { value: "network", label: "Network" },
                        { value: "usb", label: "USB" },
                      ]}
                    />
                  )}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="printer_address">Address / IP</Label>
                <Input
                  id="printer_address"
                  placeholder="192.168.1.50 or leave blank for browser"
                  {...locationForm.register("printer_address")}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setLocationOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={locationForm.formState.isSubmitting}
              >
                Save location
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmModal
        open={deleteOpen}
        title={
          deleteTarget
            ? `Delete location "${deleteTarget.name}"?`
            : "Delete location?"
        }
        confirmText="Delete"
        cancelText="Cancel"
        danger
        confirmLoading={deleteLoading}
        onConfirm={() => void confirmDeleteLocation()}
        onCancel={() => {
          if (!deleteLoading) {
            setDeleteOpen(false);
            setDeleteTarget(null);
          }
        }}
      />
    </div>
  );
}
