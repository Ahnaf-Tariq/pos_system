"use client";

import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ImagePlus, Plus, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { uploadMenuImage } from "@/lib/menu/catalog";
import { menuItemSchema, type MenuItemInput } from "@/lib/validations/menu";
import type {
  Category,
  MenuItemWithGroups,
  Modifier,
  ModifierGroup,
} from "@/types/interfaces";
import { formatMoney, cn } from "@/lib/utils";
import { Select, Modal, Input as AntInput } from "antd";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { PromptModal } from "@/components/ui/prompt-modal";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ItemEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  locationId: string | null;
  currency: string;
  categories: Category[];
  item: MenuItemWithGroups | null;
  defaultCategoryId: string | null;
  onSaved: () => Promise<void> | void;
}

export function ItemEditorDialog({
  open,
  onOpenChange,
  userId,
  locationId,
  currency,
  categories,
  item,
  defaultCategoryId,
  onSaved,
}: ItemEditorDialogProps) {
  const [uploading, setUploading] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [groups, setGroups] = useState<
    (ModifierGroup & { modifiers: Modifier[] })[]
  >([]);
  const [groupPromptOpen, setGroupPromptOpen] = useState(false);
  const [groupPromptLoading, setGroupPromptLoading] = useState(false);
  const [optionPromptOpen, setOptionPromptOpen] = useState(false);
  const [optionPromptLoading, setOptionPromptLoading] = useState(false);
  const [optionGroupId, setOptionGroupId] = useState<string | null>(null);
  const [optionName, setOptionName] = useState("");
  const [optionDelta, setOptionDelta] = useState("0");

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<MenuItemInput>({
    resolver: zodResolver(menuItemSchema),
    defaultValues: {
      name: "",
      description: "",
      price: 0,
      category_id: defaultCategoryId,
      is_active: true,
      track_inventory: false,
      image_url: "",
    },
  });

  const isActive = watch("is_active");
  const trackInventory = watch("track_inventory");
  const categoryId = watch("category_id");

  useEffect(() => {
    if (!open) return;
    if (item) {
      reset({
        name: item.name,
        description: item.description ?? "",
        price: Number(item.price),
        category_id: item.category_id,
        is_active: item.is_active,
        track_inventory: item.track_inventory,
        image_url: item.image_url ?? "",
      });
      setImageUrl(item.image_url);
      setGroups(item.modifier_groups);
    } else {
      reset({
        name: "",
        description: "",
        price: 0,
        category_id: defaultCategoryId,
        is_active: true,
        track_inventory: false,
        image_url: "",
      });
      setImageUrl(null);
      setGroups([]);
    }
  }, [open, item, defaultCategoryId, reset]);

  async function handleImageChange(file: File | null) {
    if (!file) return;
    setUploading(true);
    try {
      const supabase = createClient();
      const url = await uploadMenuImage({ supabase, userId, file });
      setImageUrl(url);
      setValue("image_url", url);
      toast.success("Image uploaded");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Image upload failed";
      toast.error(message);
    } finally {
      setUploading(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  }

  function removeImage() {
    setImageUrl(null);
    setValue("image_url", "");
    if (imageInputRef.current) imageInputRef.current.value = "";
  }

  async function onSubmit(values: MenuItemInput) {
    if (!locationId) {
      toast.error("Select a location in the header first");
      return;
    }

    const supabase = createClient();

    const payload = {
      user_id: userId,
      location_id: locationId,
      name: values.name.trim(),
      description: values.description?.trim() || null,
      price: values.price,
      category_id: values.category_id || null,
      is_active: values.is_active,
      track_inventory: values.track_inventory,
      image_url: imageUrl,
    };

    if (item) {
      const { error: updateError } = await supabase
        .from("menu_items")
        .update(payload)
        .eq("id", item.id)
        .eq("user_id", userId);

      if (updateError) {
        toast.error(updateError.message);
        return;
      }
      toast.success("Menu item updated");
    } else {
      const { data: created, error: createError } = await supabase
        .from("menu_items")
        .insert(payload)
        .select("*")
        .single();

      if (createError || !created) {
        const message = createError?.message ?? "Could not create item";
        toast.error(message);
        return;
      }

      // Persist any groups drafted before the item existed
      for (const group of groups) {
        const { data: createdGroup, error: groupError } = await supabase
          .from("modifier_groups")
          .insert({
            user_id: userId,
            menu_item_id: created.id,
            name: group.name,
            is_required: group.is_required,
            min_select: group.min_select,
            max_select: group.max_select,
          })
          .select("*")
          .single();

        if (groupError || !createdGroup) {
          const message =
            groupError?.message ?? "Could not save modifier group";
          toast.error(message);
          return;
        }

        if (group.modifiers.length > 0) {
          const { error: modifiersError } = await supabase
            .from("modifiers")
            .insert(
              group.modifiers.map((modifier) => ({
                user_id: userId,
                modifier_group_id: createdGroup.id,
                name: modifier.name,
                price_delta: modifier.price_delta,
              })),
            );
          if (modifiersError) {
            toast.error(modifiersError.message);
            return;
          }
        }
      }
      toast.success("Menu item created");
    }

    await onSaved();
    onOpenChange(false);
  }

  async function addGroup(name: string) {
    if (!name.trim()) return;
    setGroupPromptLoading(true);

    try {
      if (!item) {
        setGroups((current) => [
          ...current,
          {
            id: crypto.randomUUID(),
            user_id: userId,
            menu_item_id: "draft",
            name: name.trim(),
            is_required: false,
            min_select: 0,
            max_select: 1,
            created_at: new Date().toISOString(),
            modifiers: [],
          },
        ]);
        setGroupPromptOpen(false);
        return;
      }

      const supabase = createClient();
      const { data, error: groupError } = await supabase
        .from("modifier_groups")
        .insert({
          user_id: userId,
          menu_item_id: item.id,
          name: name.trim(),
          is_required: false,
          min_select: 0,
          max_select: 1,
        })
        .select("*")
        .single();

      if (groupError || !data) {
        const message = groupError?.message ?? "Could not add group";
        toast.error(message);
        return;
      }

      setGroups((current) => [
        ...current,
        { ...(data as ModifierGroup), modifiers: [] },
      ]);
      toast.success("Modifier group added");
      setGroupPromptOpen(false);
    } finally {
      setGroupPromptLoading(false);
    }
  }

  function openAddModifier(groupId: string) {
    setOptionGroupId(groupId);
    setOptionName("");
    setOptionDelta("0");
    setOptionPromptOpen(true);
  }

  async function confirmAddModifier() {
    if (!optionGroupId) return;
    const name = optionName.trim();
    if (!name) return;
    const priceDelta = Number(optionDelta ?? 0);
    if (Number.isNaN(priceDelta)) {
      toast.error("Price delta must be a number");
      return;
    }

    setOptionPromptLoading(true);
    const groupId = optionGroupId;

    try {
      if (
        !item ||
        groups.some(
          (group) => group.id === groupId && group.menu_item_id === "draft",
        )
      ) {
        setGroups((current) =>
          current.map((group) =>
            group.id === groupId
              ? {
                  ...group,
                  modifiers: [
                    ...group.modifiers,
                    {
                      id: crypto.randomUUID(),
                      user_id: userId,
                      modifier_group_id: groupId,
                      name,
                      price_delta: priceDelta,
                      created_at: new Date().toISOString(),
                    },
                  ],
                }
              : group,
          ),
        );
        setOptionPromptOpen(false);
        return;
      }

      const supabase = createClient();
      const { data, error: modifierError } = await supabase
        .from("modifiers")
        .insert({
          user_id: userId,
          modifier_group_id: groupId,
          name,
          price_delta: priceDelta,
        })
        .select("*")
        .single();

      if (modifierError || !data) {
        const message = modifierError?.message ?? "Could not add option";
        toast.error(message);
        return;
      }

      setGroups((current) =>
        current.map((group) =>
          group.id === groupId
            ? { ...group, modifiers: [...group.modifiers, data as Modifier] }
            : group,
        ),
      );
      toast.success("Modifier option added");
      setOptionPromptOpen(false);
    } finally {
      setOptionPromptLoading(false);
    }
  }

  async function toggleGroupRequired(groupId: string, isRequired: boolean) {
    setGroups((current) =>
      current.map((group) =>
        group.id === groupId
          ? {
              ...group,
              is_required: isRequired,
              min_select: isRequired
                ? Math.max(group.min_select, 1)
                : group.min_select,
            }
          : group,
      ),
    );

    if (
      !item ||
      groups.find((group) => group.id === groupId)?.menu_item_id === "draft"
    )
      return;

    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("modifier_groups")
      .update({
        is_required: isRequired,
        min_select: isRequired ? 1 : 0,
      })
      .eq("id", groupId)
      .eq("user_id", userId);
    if (updateError) {
      toast.error(updateError.message);
    }
  }

  async function removeGroup(groupId: string) {
    const target = groups.find((group) => group.id === groupId);
    setGroups((current) => current.filter((group) => group.id !== groupId));
    if (!item || target?.menu_item_id === "draft") return;

    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from("modifier_groups")
      .delete()
      .eq("id", groupId)
      .eq("user_id", userId);
    if (deleteError) {
      toast.error(deleteError.message);
      return;
    }
    toast.success("Modifier group removed");
  }

  async function removeModifier(groupId: string, modifierId: string) {
    setGroups((current) =>
      current.map((group) =>
        group.id === groupId
          ? {
              ...group,
              modifiers: group.modifiers.filter(
                (modifier) => modifier.id !== modifierId,
              ),
            }
          : group,
      ),
    );

    const target = groups.find((group) => group.id === groupId);
    if (!item || target?.menu_item_id === "draft") return;

    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from("modifiers")
      .delete()
      .eq("id", modifierId)
      .eq("user_id", userId);
    if (deleteError) {
      toast.error(deleteError.message);
      return;
    }
    toast.success("Modifier option removed");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl">
        <DialogHeader className="shrink-0">
          <DialogTitle>{item ? "Edit menu item" : "Add menu item"}</DialogTitle>
          <DialogDescription>
            Set pricing, image, availability, and optional modifier groups.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex min-h-0 flex-1 flex-col gap-4"
        >
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  {...register("name")}
                  placeholder="Chicken Biryani"
                />
                {errors.name ? (
                  <p className="text-sm text-destructive">
                    {errors.name.message}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  className="resize-none"
                  {...register("description")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="price">Price ({currency})</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  {...register("price", { valueAsNumber: true })}
                />
                {errors.price ? (
                  <p className="text-sm text-destructive">
                    {errors.price.message}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="category_id">Category</Label>
                <Select
                  id="category_id"
                  className="w-full"
                  value={categoryId ?? ""}
                  onChange={(value) =>
                    setValue("category_id", value === "" ? null : value)
                  }
                  options={[
                    { value: "", label: "Uncategorized" },
                    ...categories.map((category) => ({
                      value: category.id,
                      label: category.name,
                    })),
                  ]}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="image">Image</Label>
              <div className="relative size-24 shrink-0">
                <label
                  htmlFor="image"
                  className={cn(
                    "flex size-24 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed border-border bg-secondary/30 transition-colors hover:border-primary/60 hover:bg-secondary/50",
                    uploading && "pointer-events-none opacity-60",
                    imageUrl && "border-solid",
                  )}
                >
                  {imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imageUrl}
                      alt="Menu item"
                      className="size-full object-cover"
                    />
                  ) : (
                    <span className="flex flex-col items-center gap-1 text-primary">
                      <ImagePlus className="size-5" />
                      <span className="text-[10px] font-medium">
                        {uploading ? "…" : "Add"}
                      </span>
                    </span>
                  )}
                  <input
                    ref={imageInputRef}
                    id="image"
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    disabled={uploading}
                    className="sr-only"
                    onChange={(event) =>
                      handleImageChange(event.target.files?.[0] ?? null)
                    }
                  />
                </label>
                {imageUrl ? (
                  <button
                    type="button"
                    title="Remove image"
                    aria-label="Remove image"
                    className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-sm hover:opacity-90"
                    onClick={removeImage}
                  >
                    <X className="size-3" />
                  </button>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-6">
              <label className="flex items-center gap-3 text-sm">
                <Switch
                  checked={isActive}
                  onCheckedChange={(checked) => setValue("is_active", checked)}
                />
                Active on POS
              </label>
              <label className="flex items-center gap-3 text-sm">
                <Checkbox
                  checked={trackInventory}
                  onCheckedChange={(checked) =>
                    setValue("track_inventory", checked === true)
                  }
                />
                Track inventory / recipes
              </label>
            </div>
            {trackInventory ? (
              <p className="text-xs text-muted-foreground">
                Recipe ingredient links are managed in Inventory (next module).
                This flag marks the item for stock deduction later.
              </p>
            ) : null}

            <div className="space-y-3 rounded-lg border border-border p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold">Modifier groups</h3>
                  <p className="text-xs text-muted-foreground">
                    Sizes, add-ons, spice level — with optional price deltas.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setGroupPromptOpen(true)}
                >
                  <Plus className="size-4" />
                  Add group
                </Button>
              </div>

              {groups.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No modifier groups yet.
                </p>
              ) : (
                <div className="space-y-4">
                  {groups.map((group) => (
                    <div
                      key={group.id}
                      className="rounded-md border border-border/80 bg-secondary/30 p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">{group.name}</p>
                          <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                            <Checkbox
                              checked={group.is_required}
                              onCheckedChange={(checked) =>
                                toggleGroupRequired(group.id, checked === true)
                              }
                            />
                            Required
                          </label>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeGroup(group.id)}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>

                      <div className="mt-3 space-y-2">
                        {group.modifiers.map((modifier) => (
                          <div
                            key={modifier.id}
                            className="flex items-center justify-between gap-2 rounded-md bg-card px-3 py-2 text-sm"
                          >
                            <span>{modifier.name}</span>
                            <div className="flex items-center gap-2">
                              <span className="money text-xs">
                                {Number(modifier.price_delta) >= 0 ? "+" : ""}
                                {formatMoney(
                                  Number(modifier.price_delta),
                                  currency,
                                )}
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() =>
                                  removeModifier(group.id, modifier.id)
                                }
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                          </div>
                        ))}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => openAddModifier(group.id)}
                        >
                          <Plus className="size-4" />
                          Add option
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="shrink-0 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || uploading}>
              {isSubmitting ? "Saving…" : item ? "Save changes" : "Create item"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>

      <PromptModal
        open={groupPromptOpen}
        title="Add modifier group"
        description="Example: Size, Extras, Spice level"
        placeholder="Group name"
        confirmText="Add"
        confirmLoading={groupPromptLoading}
        onConfirm={(value) => void addGroup(value)}
        onCancel={() => {
          if (!groupPromptLoading) setGroupPromptOpen(false);
        }}
      />

      <Modal
        open={optionPromptOpen}
        title="Add option"
        okText="Add"
        cancelText="Cancel"
        confirmLoading={optionPromptLoading}
        onOk={() => void confirmAddModifier()}
        onCancel={() => {
          if (!optionPromptLoading) setOptionPromptOpen(false);
        }}
        centered
        destroyOnHidden
        okButtonProps={{ disabled: !optionName.trim() }}
      >
        <div className="space-y-3 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor="option_name">Option name</Label>
            <AntInput
              id="option_name"
              autoFocus
              value={optionName}
              placeholder="e.g. Large"
              onChange={(event) => setOptionName(event.target.value)}
              onPressEnter={() => void confirmAddModifier()}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="option_delta">Price delta</Label>
            <AntInput
              id="option_delta"
              value={optionDelta}
              placeholder="e.g. 50 or -20"
              onChange={(event) => setOptionDelta(event.target.value)}
              onPressEnter={() => void confirmAddModifier()}
            />
          </div>
        </div>
      </Modal>
    </Dialog>
  );
}
