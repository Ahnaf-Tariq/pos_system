"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { DatePicker } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { createClient } from "@/lib/supabase/client";
import type { StaffAttendance } from "@/types/interfaces";
import { AttendanceStatus } from "@/types/enums";
import {
  ATTENDANCE_OPTIONS,
  attendanceStatusClass,
  attendanceStatusLabel,
  fetchAttendanceForStaffRange,
  formatWorkDate,
  monthRange,
  setStaffAttendance,
  shopDateKey,
  shopTodayKey,
  summarizeAttendance,
} from "@/lib/staff/attendance";
import { AttendanceMarkButtons } from "@/components/staff/attendance-mark-buttons";
import { cn } from "@/lib/utils";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface StaffAttendanceCalendarProps {
  userId: string;
  actorAuthId: string;
  staffMemberId: string;
  timezone: string;
  createdAt: string;
  canMark: boolean;
}

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function StaffAttendanceCalendar({
  userId,
  actorAuthId,
  staffMemberId,
  timezone,
  createdAt,
  canMark,
}: StaffAttendanceCalendarProps) {
  const todayKey = shopTodayKey(timezone);
  const joinedKey = shopDateKey(timezone, createdAt);
  const [fromDate, setFromDate] = useState<string | null>(null);
  const [toDate, setToDate] = useState<string | null>(null);
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());
  const [rows, setRows] = useState<StaffAttendance[]>([]);
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [busy, setBusy] = useState(false);

  const viewMonthStart = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-01`;
  const viewMonthEnd = (() => {
    const last = new Date(viewYear, viewMonth + 1, 0);
    return `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}`;
  })();

  const rangeFrom = fromDate
    ? (fromDate < joinedKey ? joinedKey : fromDate)
    : (viewMonthStart < joinedKey ? joinedKey : viewMonthStart);
  const rangeTo = toDate
    ? (toDate > todayKey ? todayKey : toDate)
    : (viewMonthEnd > todayKey ? todayKey : viewMonthEnd);

  const refresh = useCallback(async () => {
    try {
      const supabase = createClient();
      const next = await fetchAttendanceForStaffRange(
        supabase,
        userId,
        staffMemberId,
        rangeFrom,
        rangeTo,
      );
      setRows(next);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not load attendance",
      );
    }
  }, [userId, staffMemberId, rangeFrom, rangeTo]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useRealtimeRefresh({
    userId,
    tables: ["staff_attendance"],
    onChange: () => void refresh(),
  });

  const byDate = useMemo(() => {
    const map = new Map<string, AttendanceStatus>();
    for (const row of rows) map.set(row.work_date, row.status);
    return map;
  }, [rows]);

  const summary =
    rangeFrom > rangeTo
      ? {
        present: 0,
        halfDay: 0,
        absent: 0,
        leave: 0,
        unmarked: 0,
        presentEquivalent: 0,
      }
      : summarizeAttendance({
        rows,
        fromDate: rangeFrom,
        toDate: rangeTo,
      });

  const selectedStatus = byDate.get(selectedDate) ?? null;
  const selectedUnavailable =
    selectedDate < rangeFrom ||
    selectedDate > rangeTo ||
    selectedDate > todayKey ||
    selectedDate < joinedKey;

  async function mark(status: AttendanceStatus) {
    if (!canMark || selectedUnavailable) return;
    setBusy(true);
    try {
      const supabase = createClient();
      await setStaffAttendance(supabase, {
        userId,
        staffMemberId,
        workDate: selectedDate,
        status,
        markedBy: actorAuthId,
        currentStatus: selectedStatus,
        timezone,
      });
      await refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not mark attendance",
      );
    } finally {
      setBusy(false);
    }
  }

  function onFromChange(value: Dayjs | null) {
    const key = value ? value.format("YYYY-MM-DD") : null;
    setFromDate(key);
    if (key && toDate && toDate < key) setToDate(null);
  }

  function onToChange(value: Dayjs | null) {
    const key = value ? value.format("YYYY-MM-DD") : null;
    setToDate(key);
    if (key && fromDate && fromDate > key) setFromDate(null);
  }

  function jumpToMonth(offset: number) {
    const target = dayjs(new Date(viewYear, viewMonth + offset, 1));
    const targetMonthKey = target.format("YYYY-MM");
    const joinedMonthKey = dayjs(joinedKey).format("YYYY-MM");
    const todayMonthKey = dayjs(todayKey).format("YYYY-MM");
    if (targetMonthKey < joinedMonthKey || targetMonthKey > todayMonthKey) return;
    setViewYear(target.year());
    setViewMonth(target.month());
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Attendance
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Filter a range, then mark a day. Same status clears it.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DatePicker
            className="w-[150px]"
            value={fromDate ? dayjs(fromDate) : null}
            disabledDate={(current) => {
              if (!current) return false;
              const key = current.format("YYYY-MM-DD");
              return key < joinedKey || (toDate ? key > toDate : false) || key > todayKey;
            }}
            onChange={onFromChange}
            placeholder="From"
          />
          <DatePicker
            className="w-[150px]"
            value={toDate ? dayjs(toDate) : null}
            disabledDate={(current) => {
              if (!current) return false;
              const key = current.format("YYYY-MM-DD");
              return (fromDate ? key < fromDate : false) || key > todayKey || key < joinedKey;
            }}
            onChange={onToChange}
            placeholder="To"
          />
          { (fromDate || toDate) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setFromDate(null); setToDate(null); setViewYear(new Date().getFullYear()); setViewMonth(new Date().getMonth()); }}
            >
              <X className="size-4" />
            </Button>
          ) }
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {ATTENDANCE_OPTIONS.map((item) => {
          const count =
            item.status === AttendanceStatus.PRESENT
              ? summary.present
              : item.status === AttendanceStatus.HALF_DAY
                ? summary.halfDay
                : item.status === AttendanceStatus.ABSENT
                  ? summary.absent
                  : summary.leave;
          return (
            <span
              key={item.status}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs",
                attendanceStatusClass(item.status),
              )}
            >
              {item.label}
              <span className="tabular-nums font-semibold">{count}</span>
            </span>
          );
        })}
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/40 px-2.5 py-1 text-xs text-muted-foreground">
          Unmarked
          <span className="tabular-nums font-semibold text-foreground">
            {summary.unmarked}
          </span>
        </span>
      </div>

      <div className="space-y-4">
        <MonthGrid
          year={viewYear}
          monthIndex={viewMonth}
          byDate={byDate}
          rangeFrom={rangeFrom}
          rangeTo={rangeTo}
          todayKey={todayKey}
          joinedKey={joinedKey}
          selectedDate={selectedDate}
          onSelect={setSelectedDate}
          onPrev={() => jumpToMonth(-1)}
          onNext={() => jumpToMonth(1)}
        />
      </div>

      {canMark ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
          <p className="text-sm text-muted-foreground">
            {formatWorkDate(selectedDate)}
            {" · "}
            {selectedUnavailable
              ? "outside selected range"
              : attendanceStatusLabel(selectedStatus)}
          </p>
          <AttendanceMarkButtons
            value={selectedStatus}
            disabled={busy || selectedUnavailable}
            onSelect={(status) => void mark(status)}
          />
        </div>
      ) : null}
    </section>
  );
}

function MonthGrid({
  year,
  monthIndex,
  byDate,
  rangeFrom,
  rangeTo,
  todayKey,
  joinedKey,
  selectedDate,
  onSelect,
  onPrev,
  onNext,
}: {
  year: number;
  monthIndex: number;
  byDate: Map<string, AttendanceStatus>;
  rangeFrom: string;
  rangeTo: string;
  todayKey: string;
  joinedKey: string;
  selectedDate: string;
  onSelect: (dateKey: string) => void;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  const { start, lastDay } = monthRange(year, monthIndex);
  const weekday = new Date(`${start}T00:00:00.000Z`).getUTCDay();
  const leadBlanks = weekday === 0 ? 6 : weekday - 1;
  const monthLabel = new Date(Date.UTC(year, monthIndex, 1)).toLocaleDateString(
    "en-GB",
    { month: "long", year: "numeric", timeZone: "UTC" },
  );

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-2 text-sm font-medium">
        {onPrev ? (
          <Button variant="ghost" size="icon" className="size-7" onClick={onPrev}>
            <ChevronLeft className="size-4" />
          </Button>
        ) : <div className="size-7" />}
        <span>{monthLabel}</span>
        {onNext ? (
          <Button variant="ghost" size="icon" className="size-7" onClick={onNext}>
            <ChevronRight className="size-4" />
          </Button>
        ) : <div className="size-7" />}
      </div>
      <div className="grid grid-cols-7 gap-px bg-border">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="bg-secondary/50 py-2 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
          >
            {day}
          </div>
        ))}
        {Array.from({ length: leadBlanks }).map((_, index) => (
          <div key={`blank-${index}`} className="min-h-16 bg-background/60" />
        ))}
        {Array.from({ length: lastDay }).map((_, index) => {
          const day = index + 1;
          const dateKey = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const status = byDate.get(dateKey) ?? null;
          const outOfRange =
            dateKey < rangeFrom ||
            dateKey > rangeTo ||
            dateKey > todayKey ||
            dateKey < joinedKey;
          const isSelected = dateKey === selectedDate;

          return (
            <button
              key={dateKey}
              type="button"
              disabled={outOfRange}
              onClick={() => onSelect(dateKey)}
              className={cn(
                "flex min-h-16 flex-col items-start justify-between bg-card px-2 py-1.5 text-left transition disabled:cursor-not-allowed",
                outOfRange
                  ? "bg-background/60 text-muted-foreground/35"
                  : "hover:bg-secondary/40",
                isSelected && !outOfRange && "ring-inset ring-2 ring-primary",
                status && !outOfRange && attendanceStatusClass(status),
              )}
            >
              <span
                className={cn(
                  "text-sm tabular-nums",
                  dateKey === todayKey &&
                  !outOfRange &&
                  "font-semibold text-primary",
                )}
              >
                {day}
              </span>
              {!outOfRange ? (
                <span className="text-[10px] font-medium leading-tight">
                  {status ? attendanceStatusLabel(status) : "—"}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
