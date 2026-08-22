"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { CalendarCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { StaffAttendance, StaffMemberView } from "@/types/interfaces";
import { AttendanceStatus, StaffRole } from "@/types/enums";
import {
  fetchAttendanceForDate,
  formatWorkDate,
  markRemainingPresent,
  setStaffAttendance,
  shopTodayKey,
} from "@/lib/staff/attendance";
import { AttendanceMarkButtons } from "@/components/staff/attendance-mark-buttons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";

interface StaffAttendanceRegisterProps {
  userId: string;
  actorAuthId: string;
  timezone: string;
  staff: StaffMemberView[];
}

export function StaffAttendanceRegister({
  userId,
  actorAuthId,
  timezone,
  staff,
}: StaffAttendanceRegisterProps) {
  const todayKey = shopTodayKey(timezone);
  const [workDate, setWorkDate] = useState(todayKey);
  const [rows, setRows] = useState<StaffAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const eligible = useMemo(
    () =>
      staff.filter(
        (member) => member.is_active && member.role !== StaffRole.OWNER,
      ),
    [staff],
  );

  const statusByStaffId = useMemo(() => {
    const map = new Map<string, AttendanceStatus>();
    for (const row of rows) map.set(row.staff_member_id, row.status);
    return map;
  }, [rows]);

  const refresh = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true);
      try {
        const supabase = createClient();
        const next = await fetchAttendanceForDate(supabase, userId, workDate);
        setRows(next);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Could not load attendance",
        );
      } finally {
        setLoading(false);
      }
    },
    [userId, workDate],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useRealtimeRefresh({
    userId,
    tables: ["staff_attendance"],
    onChange: () => void refresh({ silent: true }),
  });

  const isFuture = workDate > todayKey;
  const unmarkedIds = eligible
    .filter((member) => !statusByStaffId.has(member.id))
    .map((member) => member.id);

  async function mark(member: StaffMemberView, status: AttendanceStatus) {
    setBusyId(member.id);
    try {
      const supabase = createClient();
      await setStaffAttendance(supabase, {
        userId,
        staffMemberId: member.id,
        workDate,
        status,
        markedBy: actorAuthId,
        currentStatus: statusByStaffId.get(member.id) ?? null,
        timezone,
      });
      await refresh({ silent: true });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not mark attendance",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function markAllPresent() {
    if (unmarkedIds.length === 0) return;
    setBusyId("all");
    try {
      const supabase = createClient();
      await markRemainingPresent(supabase, {
        userId,
        staffMemberIds: unmarkedIds,
        workDate,
        markedBy: actorAuthId,
        timezone,
      });
      toast.success("Marked remaining staff present");
      await refresh({ silent: true });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not mark attendance",
      );
    } finally {
      setBusyId(null);
    }
  }

  const presentCount = eligible.filter(
    (member) => statusByStaffId.get(member.id) === AttendanceStatus.PRESENT,
  ).length;
  const halfCount = eligible.filter(
    (member) => statusByStaffId.get(member.id) === AttendanceStatus.HALF_DAY,
  ).length;
  const absentCount = eligible.filter(
    (member) => statusByStaffId.get(member.id) === AttendanceStatus.ABSENT,
  ).length;
  const leaveCount = eligible.filter(
    (member) => statusByStaffId.get(member.id) === AttendanceStatus.LEAVE,
  ).length;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <CalendarCheck className="size-4 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Attendance
            </h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Mark who came on {formatWorkDate(workDate)}. Click the same status
            again to clear. Pay salary stays separate.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="date"
            value={workDate}
            max={todayKey}
            onChange={(event) => setWorkDate(event.target.value || todayKey)}
            className="w-[160px]"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={
              isFuture || unmarkedIds.length === 0 || busyId === "all"
            }
            onClick={() => void markAllPresent()}
          >
            Mark remaining present
          </Button>
        </div>
      </div>

      {eligible.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No active staff to mark for this location.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="flex flex-wrap gap-3 border-b border-border px-4 py-2 text-xs text-muted-foreground">
            <span>Present {presentCount}</span>
            <span>Half-day {halfCount}</span>
            <span>Absent {absentCount}</span>
            <span>Leave {leaveCount}</span>
            <span>Unmarked {unmarkedIds.length}</span>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Staff</th>
                <th className="px-4 py-3 font-medium">Mark</th>
              </tr>
            </thead>
            <tbody>
              {eligible.map((member) => (
                <tr key={member.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">
                    {member.full_name?.trim() || "Unnamed staff"}
                  </td>
                  <td className="px-4 py-3">
                    {loading ? (
                      <span className="text-xs text-muted-foreground">
                        Loading…
                      </span>
                    ) : (
                      <AttendanceMarkButtons
                        value={statusByStaffId.get(member.id) ?? null}
                        disabled={isFuture || busyId === member.id}
                        onSelect={(status) => void mark(member, status)}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
