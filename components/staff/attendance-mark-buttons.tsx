"use client";

import { AttendanceStatus } from "@/types/enums";
import {
  ATTENDANCE_OPTIONS,
  attendanceStatusClass,
} from "@/lib/staff/attendance";
import { cn } from "@/lib/utils";

interface AttendanceMarkButtonsProps {
  value: AttendanceStatus | null;
  disabled?: boolean;
  onSelect: (status: AttendanceStatus) => void;
}

export function AttendanceMarkButtons({
  value,
  disabled,
  onSelect,
}: AttendanceMarkButtonsProps) {
  return (
    <div className="flex flex-wrap gap-1">
      {ATTENDANCE_OPTIONS.map((item) => {
        const isActive = value === item.status;
        return (
          <button
            key={item.status}
            type="button"
            disabled={disabled}
            aria-pressed={isActive}
            onClick={() => onSelect(item.status)}
            className={cn(
              "inline-flex cursor-pointer items-center rounded-md border px-2 py-0.5 text-[11px] font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
              isActive
                ? attendanceStatusClass(item.status)
                : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
