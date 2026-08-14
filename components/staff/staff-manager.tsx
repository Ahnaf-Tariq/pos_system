"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Select } from "antd";
import { Pencil, Plus, Trash2, Wallet, Eye } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { addStaffAction } from "@/lib/staff/actions";
import {
  canAssignRole,
  fetchStaffMembers,
} from "@/lib/staff/catalog";
import type { StaffMemberView } from "@/types/interfaces";
import type { InviteStaffInput } from "@/lib/validations/staff";
import { useLocationContext } from "@/components/dashboard/location-provider";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { useTablePagination } from "@/hooks/use-table-pagination";
import { roleLabel } from "@/lib/navigation";
import { formatDate, formatMoney } from "@/lib/utils";
import { StaffRole } from "@/types/enums";
import { PaySalaryModal } from "@/components/staff/pay-salary-modal";
import { StaffFormModal } from "@/components/staff/staff-form-modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AppLoader } from "@/components/ui/app-loader";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { Switch } from "@/components/ui/switch";
import { TablePagination } from "@/components/ui/table-pagination";
import Link from "next/link";
import { staffDetailPath } from "@/lib/routes";

interface StaffManagerProps {
  userId: string;
  actorRole: StaffRole;
  actorAuthId: string;
  currency: string;
}

/** Roles that can be assigned / changed via UI (Owner is fixed, not selectable). */
const NON_OWNER_ROLES: StaffRole[] = [
  StaffRole.MANAGER,
  StaffRole.CASHIER,
  StaffRole.WAITER,
  StaffRole.KITCHEN,
];

export function StaffManager({
  userId,
  actorRole,
  actorAuthId,
  currency,
}: StaffManagerProps) {
  const { locations } = useLocationContext();
  const defaultLocationId =
    locations.find((location) => location.name.trim().toLowerCase() === "main")
      ?.id ??
    locations[0]?.id ??
    "";

  const [staff, setStaff] = useState<StaffMemberView[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"add" | "edit">("add");
  const [editing, setEditing] = useState<StaffMemberView | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<StaffMemberView | null>(
    null,
  );

  const refresh = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true);
      try {
        const supabase = createClient();
        const rows = await fetchStaffMembers(supabase, userId);
        setStaff(rows);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Could not load staff";
        toast.error(message);
      } finally {
        setLoading(false);
      }
    },
    [userId],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useRealtimeRefresh({
    userId,
    tables: ["staff_members", "salary_payments"],
    onChange: () => void refresh({ silent: true }),
  });

  const {
    pageItems: pagedStaff,
    page,
    setPage,
    totalPages,
    totalItems,
    from,
    to,
  } = useTablePagination(staff);

  const roleOptions = NON_OWNER_ROLES.filter((role) =>
    canAssignRole(actorRole, role),
  );

  function openAddStaff() {
    setFormMode("add");
    setEditing(null);
    setFormOpen(true);
  }

  function openEditStaff(member: StaffMemberView) {
    setFormMode("edit");
    setEditing(member);
    setFormOpen(true);
  }

  function closeFormModal(open: boolean) {
    setFormOpen(open);
    if (!open) setEditing(null);
  }

  async function onAddStaff(values: InviteStaffInput) {
    const result = await addStaffAction({
      email: values.email,
      fullName: values.fullName,
      phone: values.phone,
      role: values.role,
      locationId: values.locationId,
      salary: values.salary,
    });
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success(result.message);
    const { emitNotificationsChanged } =
      await import("@/lib/notifications/create");
    emitNotificationsChanged(userId);
    setFormOpen(false);
    setEditing(null);
    await refresh();
  }

  async function onEditStaff(values: InviteStaffInput) {
    if (!editing) return;

    if (
      !canAssignRole(actorRole, values.role) &&
      values.role !== editing.role
    ) {
      toast.error("You cannot assign that role");
      return;
    }

    if (editing.role !== StaffRole.OWNER && values.role === StaffRole.OWNER) {
      toast.error("Staff cannot be promoted to owner from here");
      return;
    }

    if (editing.role === StaffRole.OWNER && values.role !== StaffRole.OWNER) {
      const owners = staff.filter(
        (row) =>
          row.role === StaffRole.OWNER &&
          row.is_active &&
          row.id !== editing.id,
      );
      if (owners.length === 0) {
        toast.error("Keep at least one active owner on the shop");
        return;
      }
    }

    const salary =
      values.role === StaffRole.OWNER || editing.role === StaffRole.OWNER
        ? 0
        : Number(values.salary) || 0;

    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("staff_members")
      .update({
        full_name: values.fullName.trim(),
        email: values.email.trim().toLowerCase(),
        phone: values.phone?.trim() || null,
        role: values.role,
        location_id: values.locationId,
        salary,
      })
      .eq("id", editing.id)
      .eq("user_id", userId);

    if (updateError) {
      toast.error(updateError.message);
      return;
    }

    toast.success("Staff updated");
    setFormOpen(false);
    setEditing(null);
    await refresh({ silent: true });
  }

  async function updateMember(
    member: StaffMemberView,
    patch: Partial<
      Pick<StaffMemberView, "role" | "location_id" | "is_active" | "salary">
    >,
  ) {
    if (patch.role && !canAssignRole(actorRole, patch.role)) {
      const message = "You cannot assign that role";
      toast.error(message);
      return;
    }

    if (member.role !== StaffRole.OWNER && patch.role === StaffRole.OWNER) {
      toast.error("Staff cannot be promoted to owner from here");
      return;
    }

    if (
      member.role === StaffRole.OWNER &&
      patch.role &&
      patch.role !== StaffRole.OWNER
    ) {
      const owners = staff.filter(
        (row) =>
          row.role === StaffRole.OWNER && row.is_active && row.id !== member.id,
      );
      if (owners.length === 0) {
        const message = "Keep at least one active owner on the shop";
        toast.error(message);
        return;
      }
    }

    if (member.auth_id === actorAuthId && patch.is_active === false) {
      const message = "You cannot deactivate your own account";
      toast.error(message);
      return;
    }

    setBusyId(member.id);
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("staff_members")
      .update({
        role: patch.role ?? member.role,
        location_id:
          patch.location_id === undefined
            ? member.location_id
            : patch.location_id,
        is_active: patch.is_active ?? member.is_active,
        salary:
          patch.salary === undefined ? member.salary : Number(patch.salary),
      })
      .eq("id", member.id)
      .eq("user_id", userId);

    setBusyId(null);
    if (updateError) {
      toast.error(updateError.message);
      return;
    }
    toast.success("Staff member updated");
    await refresh();
  }

  function requestDelete(member: StaffMemberView) {
    if (member.auth_id === actorAuthId) {
      const message = "You cannot delete your own account";
      toast.error(message);
      return;
    }

    if (member.role === StaffRole.OWNER) {
      const otherOwners = staff.filter(
        (row) =>
          row.role === StaffRole.OWNER && row.is_active && row.id !== member.id,
      );
      if (otherOwners.length === 0) {
        const message = "Keep at least one active owner on the shop";
        toast.error(message);
        return;
      }
    }

    setDeleteTarget(member);
    setDeleteOpen(true);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from("staff_members")
      .delete()
      .eq("id", deleteTarget.id)
      .eq("user_id", userId);

    setDeleteLoading(false);
    if (deleteError) {
      toast.error(deleteError.message);
      return;
    }

    toast.success("Staff member removed");
    setDeleteOpen(false);
    setDeleteTarget(null);
    await refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Staff</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Add teammates, set roles, and assign locations.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setPayOpen(true)}
          >
            <Wallet className="size-4" />
            Pay salary
          </Button>
          <Button type="button" size="sm" onClick={openAddStaff}>
            <Plus className="size-4" />
            Add staff
          </Button>
        </div>
      </div>

      {loading ? (
        <AppLoader fullPage />
      ) : staff.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No staff members found.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Person</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Location</th>
                <th className="px-4 py-3 font-medium">Salary</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pagedStaff.map((member) => {
                const disabled = busyId === member.id;
                return (
                  <tr key={member.id} className="border-t border-border">
                    <td className="px-4 py-3">
                      <p className="font-medium">
                        {member.full_name?.trim() || "Unnamed staff"}
                      </p>
                      {member.email?.trim() ? (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {member.email.trim()}
                        </p>
                      ) : null}
                      {member.auth_id === actorAuthId ? (
                        <Badge variant="outline" className="mt-1">
                          You
                        </Badge>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {member.phone?.trim() || "—"}
                    </td>
                    <td className="px-4 py-3">
                      {member.role === StaffRole.OWNER ? (
                        <Badge
                          variant="outline"
                          className="rounded-full border-primary/40 bg-primary/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary"
                        >
                          Owner
                        </Badge>
                      ) : (
                        <Select
                          className="w-full min-w-[60px] h-7"
                          size="small"
                          value={member.role}
                          disabled={
                            disabled || !canAssignRole(actorRole, member.role)
                          }
                          onChange={(value) =>
                            void updateMember(member, {
                              role: value as StaffRole,
                            })
                          }
                          options={NON_OWNER_ROLES.map((role) => ({
                            value: role,
                            label: roleLabel(role),
                            disabled: !canAssignRole(actorRole, role),
                          }))}
                        />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Select
                        className="w-full max-w-[180px] h-7"
                        size="small"
                        value={member.location_id ?? ""}
                        disabled={disabled}
                        onChange={(value) =>
                          void updateMember(member, {
                            location_id: value || null,
                          })
                        }
                        options={[
                          { value: "", label: "All locations" },
                          ...locations.map((location) => ({
                            value: location.id,
                            label: location.name,
                          })),
                        ]}
                      />
                    </td>
                    <td className="px-4 py-3 money text-xs">
                      {member.role === StaffRole.OWNER
                        ? "—"
                        : formatMoney(Number(member.salary ?? 0), currency)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground tabular-nums">
                      {formatDate(member.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={member.is_active}
                          disabled={disabled}
                          onCheckedChange={(checked) =>
                            void updateMember(member, { is_active: checked })
                          }
                          title={member.is_active ? "Deactivate" : "Activate"}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Button
                          asChild
                          size="icon"
                          variant="ghost"
                          className="size-8"
                        >
                          <Link
                            href={staffDetailPath(member.id)}
                            title="View Detail"
                            aria-label="View Detail"
                          >
                            <Eye className="size-4" />
                          </Link>
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="size-8"
                          title="Edit staff"
                          aria-label="Edit staff"
                          disabled={disabled}
                          onClick={() => openEditStaff(member)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="size-8 text-destructive hover:text-destructive"
                          title="Delete"
                          aria-label="Delete"
                          disabled={disabled || member.auth_id === actorAuthId}
                          onClick={() => requestDelete(member)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <TablePagination
            page={page}
            totalPages={totalPages}
            totalItems={totalItems}
            from={from}
            to={to}
            onPageChange={setPage}
          />
        </div>
      )}

      <StaffFormModal
        open={formOpen}
        onOpenChange={closeFormModal}
        mode={formMode}
        member={editing}
        locations={locations}
        roleOptions={roleOptions}
        defaultLocationId={defaultLocationId}
        onSubmit={formMode === "add" ? onAddStaff : onEditStaff}
      />

      <PaySalaryModal
        open={payOpen}
        onOpenChange={setPayOpen}
        userId={userId}
        actorAuthId={actorAuthId}
        currency={currency}
        staff={staff}
        onPaid={() => void refresh({ silent: true })}
      />

      <ConfirmModal
        open={deleteOpen}
        title={
          deleteTarget
            ? `Remove ${deleteTarget.full_name?.trim() || "this staff member"}?`
            : "Remove staff?"
        }
        description="They will lose access to this shop. Their login account is not deleted."
        confirmText="Delete"
        cancelText="Cancel"
        danger
        confirmLoading={deleteLoading}
        onConfirm={() => void confirmDelete()}
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
