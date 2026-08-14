"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fetchMenuCatalog } from "@/lib/menu/catalog";
import type { Category, MenuItemWithGroups } from "@/types/interfaces";
import { formatMoney, cn } from "@/lib/utils";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ItemEditorDialog } from "@/components/menu/item-editor-dialog";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { PromptModal } from "@/components/ui/prompt-modal";

interface MenuManagerProps {
  userId: string;
  currency: string;
  initialCategories: Category[];
  initialItems: MenuItemWithGroups[];
}

export function MenuManager({
  userId,
  currency,
  initialCategories,
  initialItems,
}: MenuManagerProps) {
  const [categories, setCategories] = useState(initialCategories);
  const [items, setItems] = useState(initialItems);
  const [selectedCategoryId, setSelectedCategoryId] = useState<
    string | "all" | "uncategorized"
  >("all");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItemWithGroups | null>(
    null,
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<
    | { type: "category"; category: Category }
    | { type: "item"; item: MenuItemWithGroups }
    | null
  >(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameLoading, setRenameLoading] = useState(false);
  const [renameTarget, setRenameTarget] = useState<Category | null>(null);

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.sort_order - b.sort_order),
    [categories],
  );

  const visibleItems = useMemo(() => {
    if (selectedCategoryId === "all") return items;
    if (selectedCategoryId === "uncategorized")
      return items.filter((item) => !item.category_id);
    return items.filter((item) => item.category_id === selectedCategoryId);
  }, [items, selectedCategoryId]);

  async function refresh() {
    const supabase = createClient();
    const catalog = await fetchMenuCatalog(supabase, userId);
    setCategories(catalog.categories);
    setItems(catalog.items);
  }

  useRealtimeRefresh({
    userId,
    tables: ["categories", "menu_items", "modifier_groups", "modifiers"],
    onChange: () => void refresh(),
  });

  async function createCategory() {
    const name = newCategoryName.trim();
    if (!name) return;
    const supabase = createClient();
    const nextOrder =
      categories.reduce(
        (max, category) => Math.max(max, category.sort_order),
        -1,
      ) + 1;

    const { error: insertError } = await supabase.from("categories").insert({
      user_id: userId,
      name,
      sort_order: nextOrder,
    });

    if (insertError) {
      toast.error(insertError.message);
      return;
    }

    setNewCategoryName("");
    toast.success("Category created");
    await refresh();
  }

  function openRenameCategory(category: Category) {
    setRenameTarget(category);
    setRenameOpen(true);
  }

  async function renameCategory(name: string) {
    if (!renameTarget) return;
    if (!name.trim() || name.trim() === renameTarget.name) {
      setRenameOpen(false);
      setRenameTarget(null);
      return;
    }

    setRenameLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("categories")
      .update({ name: name.trim() })
      .eq("id", renameTarget.id)
      .eq("user_id", userId);

    if (updateError) {
      toast.error(updateError.message);
      setRenameLoading(false);
      return;
    }

    toast.success("Category renamed");
    setRenameOpen(false);
    setRenameTarget(null);
    setRenameLoading(false);
    await refresh();
  }

  function requestDeleteCategory(category: Category) {
    setPendingDelete({ type: "category", category });
    setConfirmOpen(true);
  }

  async function confirmDeleteCategory(category: Category) {
    const supabase = createClient();
    await supabase
      .from("menu_items")
      .update({ category_id: null })
      .eq("category_id", category.id)
      .eq("user_id", userId);

    const { error: deleteError } = await supabase
      .from("categories")
      .delete()
      .eq("id", category.id)
      .eq("user_id", userId);

    if (deleteError) {
      toast.error(deleteError.message);
      return;
    }

    if (selectedCategoryId === category.id) setSelectedCategoryId("all");
    toast.success("Category deleted");
    setConfirmOpen(false);
    setPendingDelete(null);
    await refresh();
  }

  function requestDeleteItem(item: MenuItemWithGroups) {
    setPendingDelete({ type: "item", item });
    setConfirmOpen(true);
  }

  async function confirmDeleteItem(item: MenuItemWithGroups) {
    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from("menu_items")
      .delete()
      .eq("id", item.id)
      .eq("user_id", userId);

    if (deleteError) {
      toast.error(deleteError.message);
      return;
    }
    toast.success("Menu item deleted");
    setConfirmOpen(false);
    setPendingDelete(null);
    await refresh();
  }

  async function handleConfirmDelete() {
    if (!pendingDelete) return;
    setConfirmLoading(true);
    try {
      if (pendingDelete.type === "category") {
        await confirmDeleteCategory(pendingDelete.category);
      } else {
        await confirmDeleteItem(pendingDelete.item);
      }
    } finally {
      setConfirmLoading(false);
    }
  }

  async function moveCategory(categoryId: string, direction: "up" | "down") {
    const ordered = [...sortedCategories];
    const index = ordered.findIndex((category) => category.id === categoryId);
    if (index < 0) return;
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= ordered.length) return;

    const current = ordered[index];
    const swap = ordered[swapIndex];
    const supabase = createClient();

    const { error: firstError } = await supabase
      .from("categories")
      .update({ sort_order: swap.sort_order })
      .eq("id", current.id)
      .eq("user_id", userId);
    if (firstError) {
      toast.error(firstError.message);
      return;
    }

    const { error: secondError } = await supabase
      .from("categories")
      .update({ sort_order: current.sort_order })
      .eq("id", swap.id)
      .eq("user_id", userId);
    if (secondError) {
      toast.error(secondError.message);
      return;
    }

    toast.success("Categories reordered");
    await refresh();
  }

  async function toggleItemActive(item: MenuItemWithGroups, isActive: boolean) {
    setBusyId(item.id);
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("menu_items")
      .update({ is_active: isActive })
      .eq("id", item.id)
      .eq("user_id", userId);

    setBusyId(null);
    if (updateError) {
      toast.error(updateError.message);
      return;
    }

    toast.success(isActive ? "Item activated" : "Item deactivated");
    setItems((current) =>
      current.map((row) =>
        row.id === item.id ? { ...row, is_active: isActive } : row,
      ),
    );
  }

  function openCreateItem() {
    setEditingItem(null);
    setEditorOpen(true);
  }

  function openEditItem(item: MenuItemWithGroups) {
    setEditingItem(item);
    setEditorOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Menu</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Categories, items, images, and modifiers for your POS.
          </p>
        </div>
        <Button onClick={openCreateItem} size="sm">
          <Plus className="size-4" />
          Add item
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="space-y-4 rounded-lg border border-border bg-card p-4">
          <div>
            <h2 className="text-sm font-semibold">Categories</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Reorder with the arrows.
            </p>
          </div>

          <div className="flex gap-2">
            <Input
              value={newCategoryName}
              onChange={(event) => setNewCategoryName(event.target.value)}
              placeholder="New category"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void createCategory();
                }
              }}
            />
            <Button type="button" variant="outline" onClick={createCategory}>
              Add
            </Button>
          </div>

          <div className="space-y-1">
            <CategoryFilterButton
              label="All items"
              count={items.length}
              active={selectedCategoryId === "all"}
              onClick={() => setSelectedCategoryId("all")}
            />
            <CategoryFilterButton
              label="Uncategorized"
              count={items.filter((item) => !item.category_id).length}
              active={selectedCategoryId === "uncategorized"}
              onClick={() => setSelectedCategoryId("uncategorized")}
            />

            {sortedCategories.map((category, index) => {
              const count = items.filter(
                (item) => item.category_id === category.id,
              ).length;
              return (
                <div
                  key={category.id}
                  className="flex items-center gap-1 rounded-md border border-transparent hover:border-border"
                >
                  <button
                    type="button"
                    onClick={() => setSelectedCategoryId(category.id)}
                    className={cn(
                      "min-h-11 flex-1 rounded-md px-3 text-left text-sm",
                      selectedCategoryId === category.id
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-foreground hover:bg-secondary",
                    )}
                  >
                    <span className="font-medium">{category.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {count}
                    </span>
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9"
                    disabled={index === 0}
                    onClick={() => moveCategory(category.id, "up")}
                  >
                    <ArrowUp className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9"
                    disabled={index === sortedCategories.length - 1}
                    onClick={() => moveCategory(category.id, "down")}
                  >
                    <ArrowDown className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => openRenameCategory(category)}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => requestDeleteCategory(category)}
                  >
                    <Trash2 className="size-3.5 text-destructive" />
                  </Button>
                </div>
              );
            })}
          </div>
        </aside>

        <section className="space-y-3">
          {visibleItems.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-card/40 p-10 text-center">
              <p className="text-sm text-muted-foreground">
                No items here yet. Add your first menu item to start selling on
                POS.
              </p>
              <Button className="mt-4" onClick={openCreateItem}>
                <Plus className="size-4" />
                Add item
              </Button>
            </div>
          ) : (
            visibleItems.map((item) => (
              <article
                key={item.id}
                className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center"
              >
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-md border border-border bg-secondary">
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

                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate font-semibold">{item.name}</h3>
                    {!item.is_active ? (
                      <Badge variant="secondary">Inactive</Badge>
                    ) : null}
                    {item.track_inventory ? (
                      <Badge variant="outline">Tracks stock</Badge>
                    ) : null}
                    {item.modifier_groups.length > 0 ? (
                      <Badge variant="outline">
                        {item.modifier_groups.length} modifier group
                        {item.modifier_groups.length === 1 ? "" : "s"}
                      </Badge>
                    ) : null}
                  </div>
                  {item.description ? (
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {item.description}
                    </p>
                  ) : null}
                  <p className="money text-base">
                    {formatMoney(Number(item.price), currency)}
                  </p>
                </div>

                <div className="flex items-center gap-3 sm:flex-col sm:items-end">
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Switch
                      checked={item.is_active}
                      disabled={busyId === item.id}
                      onCheckedChange={(checked) =>
                        toggleItemActive(item, checked)
                      }
                      title={
                        item.is_active ? "Deactivate item" : "Activate item"
                      }
                    />
                  </label>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      title="Edit"
                      aria-label="Edit"
                      onClick={() => openEditItem(item)}
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
                      onClick={() => requestDeleteItem(item)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              </article>
            ))
          )}
        </section>
      </div>

      <ItemEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        userId={userId}
        currency={currency}
        categories={sortedCategories}
        item={editingItem}
        defaultCategoryId={
          selectedCategoryId !== "all" && selectedCategoryId !== "uncategorized"
            ? selectedCategoryId
            : null
        }
        onSaved={refresh}
      />

      <ConfirmModal
        open={confirmOpen}
        title={
          pendingDelete?.type === "category"
            ? `Delete category "${pendingDelete.category.name}"?`
            : pendingDelete?.type === "item"
              ? `Delete "${pendingDelete.item.name}"?`
              : "Delete?"
        }
        description={
          pendingDelete?.type === "category"
            ? "Items become uncategorized."
            : pendingDelete?.type === "item"
              ? "This cannot be undone."
              : undefined
        }
        confirmText="Delete"
        cancelText="Cancel"
        danger
        confirmLoading={confirmLoading}
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => {
          if (!confirmLoading) {
            setConfirmOpen(false);
            setPendingDelete(null);
          }
        }}
      />

      <PromptModal
        open={renameOpen}
        title="Rename category"
        description="Enter a new name for this category."
        defaultValue={renameTarget?.name ?? ""}
        placeholder="Category name"
        confirmText="Save"
        confirmLoading={renameLoading}
        onConfirm={(value) => void renameCategory(value)}
        onCancel={() => {
          if (!renameLoading) {
            setRenameOpen(false);
            setRenameTarget(null);
          }
        }}
      />
    </div>
  );
}

function CategoryFilterButton({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-11 w-full items-center justify-between rounded-md px-3 text-sm",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-foreground hover:bg-secondary",
      )}
    >
      <span className="font-medium">{label}</span>
      <span className="text-xs text-muted-foreground">{count}</span>
    </button>
  );
}
