"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Modal, Select } from "antd";
import { createClient } from "@/lib/supabase/client";
import type { AttendancePeriodSummary, StaffMemberView } from "@/types/interfaces";
import {
  currentSalaryPeriodKey,
  fetchSalaryPaymentsForPeriod,
  fetchShopSalaryPayBasis,
  payStaffSalary,
  salaryPeriodLabel,
} from "@/lib/staff/salary";
import {
  fetchAttendanceForStaffRange,
  periodAttendanceWindow,
  shopDateKey,
  shopTodayKey,
  summarizeAttendance,
} from "@/lib/staff/attendance";
import { SalaryPayBasis, StaffRole } from "@/types/enums";
import { formatMoney } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface PaySalaryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  actorAuthId: string;
  currency: string;
  timezone: string;
  staff: StaffMemberView[];
  onPaid: () => void;
  defaultStaffMemberId?: string;
  lockStaff?: boolean;
}

export function PaySalaryModal({
  open,
  onOpenChange,
  userId,
  actorAuthId,
  currency,
  timezone,
  staff,
  onPaid,
  defaultStaffMemberId,
  lockStaff = false,
}: PaySalaryModalProps) {
  const [payBasis, setPayBasis] = useState<string>(SalaryPayBasis.MONTHLY);
  const [periodKey, setPeriodKey] = useState("");
  const [paidStaffIds, setPaidStaffIds] = useState<Set<string>>(new Set());
  const [staffMemberId, setStaffMemberId] = useState<string | undefined>();
  const [notes, setNotes] = useState("");
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [paying, setPaying] = useState(false);
  const [attendanceHint, setAttendanceHint] =
    useState<AttendancePeriodSummary | null>(null);

  const activeStaff = useMemo(
    () =>
      staff.filter(
        (member) => member.is_active && member.role !== StaffRole.OWNER,
      ),
    [staff],
  );

  const selected = activeStaff.find((member) => member.id === staffMemberId);
  const salaryAmount = Number(selected?.salary ?? 0);

  useEffect(() => {
    if (!open) return;

    void (async () => {
      setLoadingMeta(true);
      setStaffMemberId(undefined);
      setNotes("");
      try {
        const supabase = createClient();
        const basis = await fetchShopSalaryPayBasis(supabase, userId);
        const key = currentSalaryPeriodKey(basis);
        const payments = await fetchSalaryPaymentsForPeriod(
          supabase,
          userId,
          key,
        );
        setPayBasis(basis);
        setPeriodKey(key);
        const paidIds = new Set(payments.map((row) => row.staff_member_id));
        setPaidStaffIds(paidIds);

        if (
          defaultStaffMemberId &&
          !paidIds.has(defaultStaffMemberId)
        ) {
          setStaffMemberId(defaultStaffMemberId);
        }
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Could not load salary data",
        );
      } finally {
        setLoadingMeta(false);
      }
    })();
  }, [open, userId, defaultStaffMemberId]);

  useEffect(() => {
    if (!open || !staffMemberId || !periodKey) {
      setAttendanceHint(null);
      return;
    }

    void (async () => {
      try {
        const supabase = createClient();
        const member = activeStaff.find((row) => row.id === staffMemberId);
        const joinedKey = member
          ? shopDateKey(timezone, member.created_at)
          : undefined;
        const { fromDate, toDate } = periodAttendanceWindow({
          payBasis,
          periodKey,
          todayKey: shopTodayKey(timezone),
          joinedKey,
        });
        if (fromDate > toDate) {
          setAttendanceHint(null);
          return;
        }
        const rows = await fetchAttendanceForStaffRange(
          supabase,
          userId,
          staffMemberId,
          fromDate,
          toDate,
        );
        setAttendanceHint(
          summarizeAttendance({ rows, fromDate, toDate }),
        );
      } catch {
        setAttendanceHint(null);
      }
    })();
  }, [open, staffMemberId, periodKey, payBasis, userId, timezone, activeStaff]);

  const staffOptions = activeStaff.map((member) => {
    const isPaid = paidStaffIds.has(member.id);
    const name = member.full_name?.trim() || "Unnamed staff";
    return {
      value: member.id,
      label: isPaid ? `${name} (Paid)` : name,
      disabled: isPaid,
    };
  });

  async function handlePay() {
    if (!staffMemberId || !selected) {
      toast.error("Select a staff member");
      return;
    }
    if (paidStaffIds.has(staffMemberId)) {
      toast.error(
        payBasis === SalaryPayBasis.DAILY
          ? "Already paid for today"
          : "Already paid for this month",
      );
      return;
    }
    if (salaryAmount <= 0) {
      toast.error("Set a salary on this staff member first");
      return;
    }

    setPaying(true);
    try {
      const supabase = createClient();
      await payStaffSalary(supabase, {
        userId,
        staffMemberId,
        amount: salaryAmount,
        payBasis,
        periodKey,
        paidBy: actorAuthId,
        notes,
      });
      toast.success(
        `Paid ${selected.full_name?.trim() || "staff"} · ${formatMoney(salaryAmount, currency)}`,
      );
      onPaid();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not pay salary");
    } finally {
      setPaying(false);
    }
  }

  return (
    <Modal
      title="Pay salary"
      open={open}
      onCancel={() => {
        if (!paying) onOpenChange(false);
      }}
      onOk={() => void handlePay()}
      okText={paying ? "Paying…" : "Pay salary"}
      confirmLoading={paying}
      okButtonProps={{
        disabled: loadingMeta || !staffMemberId || salaryAmount <= 0,
      }}
      destroyOnHidden
    >
      <div className="space-y-4 pt-2">
        <p className="text-sm text-muted-foreground">
          Pay basis:{" "}
          <span className="font-medium text-foreground capitalize">
            {payBasis}
          </span>
          {periodKey ? (
            <>
              {" "}
              · Period{" "}
              <span className="font-medium text-foreground">
                {salaryPeriodLabel(payBasis, periodKey)}
              </span>
            </>
          ) : null}
          . Change monthly/daily in Settings.
        </p>

        <div className="space-y-2">
          <Label>Staff</Label>
          <Select
            className="w-full"
            placeholder={loadingMeta ? "Loading…" : "Select staff"}
            value={staffMemberId}
            onChange={(value) => setStaffMemberId(value)}
            options={staffOptions}
            disabled={loadingMeta || lockStaff}
            showSearch={!lockStaff}
            optionFilterProp="label"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="pay-salary-amount">Salary</Label>
          <Input
            id="pay-salary-amount"
            readOnly
            disabled
            value={selected ? formatMoney(salaryAmount, currency) : ""}
            placeholder="Select staff to see salary"
          />
          {attendanceHint && selected ? (
            <p className="text-xs text-muted-foreground">
              Attendance this period: {attendanceHint.present} present,{" "}
              {attendanceHint.halfDay} half-day, {attendanceHint.absent} absent,{" "}
              {attendanceHint.leave} leave, {attendanceHint.unmarked} unmarked
              ({attendanceHint.presentEquivalent} present-day
              {attendanceHint.presentEquivalent === 1 ? "" : "s"} counted). Pay
              amount is not changed by attendance.
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="pay-salary-notes">Notes (optional)</Label>
          <Textarea
            id="pay-salary-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className="resize-none"
            placeholder="Add a note for this payment…"
            rows={3}
            disabled={loadingMeta || paying}
          />
        </div>
      </div>
    </Modal>
  );
}
