"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Briefcase,
  CalendarDays,
  Mail,
  MapPin,
  Phone,
  Wallet,
} from "lucide-react";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import { fetchStaffDetail } from "@/lib/staff/detail";
import type { StaffDetailData } from "@/types/interfaces";
import { roleLabel } from "@/lib/navigation";
import { formatDate, formatDateTime, formatMoney, cn } from "@/lib/utils";
import { StaffRole } from "@/types/enums";
import { ROUTES } from "@/lib/routes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AppLoader } from "@/components/ui/app-loader";
import { PaySalaryModal } from "@/components/staff/pay-salary-modal";
import { StaffAttendanceCalendar } from "@/components/staff/staff-attendance-calendar";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";

interface StaffDetailViewProps {
  userId: string;
  actorAuthId: string;
  staffId: string;
  currency: string;
  payBasis: string;
  timezone: string;
  initialData: StaffDetailData;
}

function initials(name: string | null | undefined) {
  const parts = (name?.trim() || "S").split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

export function StaffDetailView({
  userId,
  actorAuthId,
  staffId,
  currency,
  payBasis,
  timezone,
  initialData,
}: StaffDetailViewProps) {
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [tab, setTab] = useState<"staff" | "attendance">("staff");

  const refresh = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true);
      try {
        const supabase = createClient();
        const next = await fetchStaffDetail(
          supabase,
          userId,
          staffId,
          payBasis,
        );
        if (next) setData(next);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Could not refresh staff detail",
        );
      } finally {
        setLoading(false);
      }
    },
    [userId, staffId, payBasis],
  );

  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  useRealtimeRefresh({
    userId,
    tables: ["salary_payments", "staff_members", "staff_attendance"],
    onChange: () => void refresh({ silent: true }),
  });

  const { member, salaryRows, salaryPaidTotal, currentPeriodPaid } = data;
  const name = member.full_name?.trim() || "Unnamed staff";
  const isOwner = member.role === StaffRole.OWNER;
  const canPay =
    !isOwner &&
    member.is_active &&
    Number(member.salary ?? 0) > 0 &&
    !currentPeriodPaid;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href={ROUTES.staff}>
            <ArrowLeft className="size-4" />
            Back to staff
          </Link>
        </Button>
      </div>

      <section className="relative overflow-hidden rounded-xl border border-border bg-card">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(46,242,197,0.16),transparent_55%),radial-gradient(ellipse_at_bottom_left,rgba(92,255,217,0.08),transparent_50%)]"
        />
        <div className="relative flex flex-col gap-6 p-3 sm:p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex size-16 shrink-0 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 text-lg font-semibold tracking-wide text-primary shadow-[0_0_40px_-12px_rgba(46,242,197,0.7)]">
              {initials(name)}
            </div>
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-2xl font-semibold tracking-tight">
                  {name}
                </h1>
                <Badge
                  variant="outline"
                  className="rounded-full border-primary/40 bg-primary/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary"
                >
                  {roleLabel(member.role)}
                </Badge>
                <Badge
                  variant="outline"
                  className={
                    member.is_active
                      ? "rounded-full border-primary/30 bg-primary/5 text-[10px] uppercase tracking-wide text-primary"
                      : "rounded-full border-border text-[10px] uppercase tracking-wide text-muted-foreground"
                  }
                >
                  {member.is_active ? "Active" : "Inactive"}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                {member.email?.trim() ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Mail className="size-3.5 text-primary/70" />
                    {member.email.trim()}
                  </span>
                ) : null}
                {member.phone?.trim() ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Phone className="size-3.5 text-primary/70" />
                    {member.phone.trim()}
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="size-3.5 text-primary/70" />
                  {member.location_name?.trim() || "All locations"}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="size-3.5 text-primary/70" />
                  Joined {formatDate(member.created_at)}
                </span>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-1.5 sm:min-w-[220px]">
            <div className="rounded-lg border border-border/80 bg-background/50 px-2.5 py-2 backdrop-blur-sm">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Base salary
              </p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums text-primary">
                {isOwner
                  ? "—"
                  : formatMoney(Number(member.salary ?? 0), currency)}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground capitalize">
                {isOwner ? "Owner · not applicable" : `${payBasis} basis`}
              </p>
            </div>
            {!isOwner ? (
              <div className="rounded-lg border border-border/80 bg-background/50 px-2.5 py-2 backdrop-blur-sm">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Total paid out
                </p>
                <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">
                  {formatMoney(salaryPaidTotal, currency)}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {salaryRows.filter((row) => row.status === "paid").length}{" "}
                  payment
                  {salaryRows.filter((row) => row.status === "paid").length ===
                  1
                    ? ""
                    : "s"}
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <div className="flex gap-1 border-b border-border mt-2">
        <button
          type="button"
          onClick={() => setTab("staff")}
          className={cn(
            "cursor-pointer border-b-2 px-3 py-2 text-sm font-medium transition",
            tab === "staff"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          Staff
        </button>
        <button
          type="button"
          onClick={() => setTab("attendance")}
          className={cn(
            "cursor-pointer border-b-2 px-3 py-2 text-sm font-medium transition",
            tab === "attendance"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          Attendance
        </button>
      </div>

      {tab === "attendance" ? (
        isOwner ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Owner accounts are not tracked on the attendance register.
          </p>
        ) : (
          <StaffAttendanceCalendar
            userId={userId}
            actorAuthId={actorAuthId}
            staffMemberId={staffId}
            timezone={timezone}
            createdAt={member.created_at}
            canMark
          />
        )
      ) : (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Wallet className="size-4 text-primary" />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Salary record
              </h2>
            </div>
            {!isOwner ? (
              <Button
                type="button"
                size="sm"
                disabled={!canPay}
                onClick={() => setPayOpen(true)}
                title={
                  currentPeriodPaid
                    ? "Already paid for this period"
                    : Number(member.salary ?? 0) <= 0
                      ? "Set a salary first"
                      : "Pay salary"
                }
              >
                <Wallet className="size-4" />
                Pay salary
              </Button>
            ) : null}
          </div>

          {isOwner ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border p-10 text-center">
              <Briefcase className="size-8 text-primary/50" />
              <p className="text-sm text-muted-foreground">
                Owner accounts are not included in salary payouts.
              </p>
            </div>
          ) : loading && salaryRows.length === 0 ? (
            <AppLoader />
          ) : (
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-secondary/40 text-left text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Period</th>
                    <th className="px-4 py-3 font-medium">Amount</th>
                    <th className="px-4 py-3 font-medium">Paid on</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {salaryRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-10 text-center text-muted-foreground"
                      >
                        No salary periods yet.
                      </td>
                    </tr>
                  ) : (
                    salaryRows.map((row) => (
                      <tr key={row.key} className="border-t border-border">
                        <td className="px-4 py-3 font-medium">
                          {row.periodLabel}
                        </td>
                        <td className="px-4 py-3 tabular-nums text-primary">
                          {row.amount == null
                            ? "—"
                            : formatMoney(row.amount, currency)}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground tabular-nums">
                          {row.createdAt ? formatDateTime(row.createdAt) : "—"}
                        </td>
                        <td className="px-4 py-3">
                          {row.status === "paid" ? (
                            <Badge
                              variant="outline"
                              className="rounded-full border-primary/40 bg-primary/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary"
                            >
                              Paid
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="rounded-full border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300"
                            >
                              Pending
                            </Badge>
                          )}
                        </td>
                        <td className="max-w-[220px] truncate px-4 py-3 text-muted-foreground">
                          {row.notes?.trim() || "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <PaySalaryModal
        open={payOpen}
        onOpenChange={setPayOpen}
        userId={userId}
        actorAuthId={actorAuthId}
        currency={currency}
        timezone={timezone}
        staff={[member]}
        defaultStaffMemberId={member.id}
        lockStaff
        onPaid={() => void refresh({ silent: true })}
      />
    </div>
  );
}
