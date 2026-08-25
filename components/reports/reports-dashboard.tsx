"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Download, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  defaultReportRange,
  fetchReportBundle,
} from "@/lib/reports/analytics";
import type { ReportBundle, SalesPeriod } from "@/types/interfaces";
import { useLocationContext } from "@/components/dashboard/location-provider";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { StatCard } from "@/components/dashboard/stat-card";
import {
  SalesPeriodChart,
  TopItemsChart,
} from "@/components/reports/report-charts";
import { formatDate, formatMoney } from "@/lib/utils";
import { DatePicker, Select } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { Button } from "@/components/ui/button";
import { AppLoader } from "@/components/ui/app-loader";
import {
  arrayToCsv,
  downloadCsv,
  salesPeriodToExportData,
  topItemsToExportData,
  staffPerformanceToExportData,
  discountsAuditToExportData,
  cancelsAuditToExportData,
} from "@/lib/data-export";

interface ReportsDashboardProps {
  userId: string;
  currency: string;
}

const PERIOD_OPTIONS: Array<{ value: SalesPeriod; label: string }> = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

export function ReportsDashboard({ userId, currency }: ReportsDashboardProps) {
  const { selectedLocationId, selectedLocation, locations } =
    useLocationContext();
  const defaults = defaultReportRange();
  const [fromDate, setFromDate] = useState<string | null>(null);
  const [toDate, setToDate] = useState<string | null>(null);
  const [period, setPeriod] = useState<SalesPeriod>("daily");
  const [report, setReport] = useState<ReportBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const refresh = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (locations.length > 0 && !selectedLocationId) return;

      if (!opts?.silent) setLoading(true);
      try {
        const supabase = createClient();
        const bundle = await fetchReportBundle(supabase, userId, {
          locationId: selectedLocationId,
          fromDate,
          toDate,
          period,
        });
        setReport(bundle);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Could not load reports",
        );
      } finally {
        setLoading(false);
      }
    },
    [userId, selectedLocationId, fromDate, toDate, period, locations.length],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useRealtimeRefresh({
    userId,
    tables: ["orders", "order_items", "expenses"],
    onChange: () => void refresh({ silent: true }),
    enabled: Boolean(selectedLocationId),
  });

  async function handleExportComprehensive() {
    if (!report) return;
    setExporting(true);
    try {
      const salesData = salesPeriodToExportData(report.byPeriod, currency);
      const itemsData = topItemsToExportData(report.itemRanking, currency);
      const staffData = staffPerformanceToExportData(report.staffPerformance, currency);
      const discountsData = discountsAuditToExportData(report.discounts, currency);
      const cancelsData = cancelsAuditToExportData(report.voids, currency);

      // Create CSV content with multiple sheets
      let csvContent = "SALES REPORT - " + new Date().toLocaleDateString() + "\n";
      csvContent += `Period: ${period} | From: ${fromDate || "Start"} | To: ${toDate || "End"}\n`;
      csvContent += `Location: ${selectedLocation?.name || "All"}\n`;
      csvContent += "\n\n";

      // Sales by Period
      csvContent += "=== SALES BY PERIOD ===\n";
      csvContent += arrayToCsv(salesData) + "\n\n";

      // Top Items
      csvContent += "=== TOP ITEMS ===\n";
      csvContent += arrayToCsv(itemsData) + "\n\n";

      // Staff Performance
      if (staffData.length > 0) {
        csvContent += "=== STAFF PERFORMANCE ===\n";
        csvContent += arrayToCsv(staffData) + "\n\n";
      }

      // Discounts
      if (discountsData.length > 0) {
        csvContent += "=== DISCOUNTS AUDIT ===\n";
        csvContent += arrayToCsv(discountsData) + "\n\n";
      }

      // Cancels
      if (cancelsData.length > 0) {
        csvContent += "=== CANCELS AUDIT ===\n";
        csvContent += arrayToCsv(cancelsData) + "\n\n";
      }

      // Summary Statistics
      csvContent += "=== SUMMARY STATISTICS ===\n";
      csvContent += `Total Revenue,${report.revenue}\n`;
      csvContent += `Total Expenses,${report.expenseTotal}\n`;
      csvContent += `Net Profit,${report.netProfit}\n`;
      csvContent += `Paid Orders,${report.paidOrders}\n`;
      csvContent += `Cancelled Orders,${report.voidCount}\n`;
      csvContent += `Total Orders,${report.paidOrders + report.voidCount}\n`;
      csvContent += `Total Discounts,${report.discountTotal}\n`;
      csvContent += `Expense count,${report.expenseCount}\n`;
      csvContent += `Currency,${currency}\n`;

      if (report.expensesByCategory.length > 0) {
        csvContent += "\n=== EXPENSES BY CATEGORY ===\n";
        csvContent += "Category,Total,Count\n";
        for (const row of report.expensesByCategory) {
          csvContent += `${row.category},${row.total},${row.count}\n`;
        }
      }

      const timestamp = new Date().toISOString().split("T")[0];
      const filename = `report-comprehensive-${period}-${timestamp}.csv`;
      downloadCsv(filename, csvContent);
      toast.success("Report exported successfully");
    } catch (err) {
      toast.error("Failed to export report");
    } finally {
      setExporting(false);
    }
  }

  async function handleExportSalesByPeriod() {
    if (!report) return;
    setExporting(true);
    try {
      const data = salesPeriodToExportData(report.byPeriod, currency);
      const csv = arrayToCsv(data);
      const timestamp = new Date().toISOString().split("T")[0];
      const filename = `sales-${period}-${timestamp}.csv`;
      downloadCsv(filename, csv);
      toast.success("Sales data exported");
    } catch (err) {
      toast.error("Failed to export sales data");
    } finally {
      setExporting(false);
    }
  }

  async function handleExportTopItems() {
    if (!report) return;
    setExporting(true);
    try {
      const data = topItemsToExportData(report.itemRanking, currency);
      const csv = arrayToCsv(data);
      const timestamp = new Date().toISOString().split("T")[0];
      const filename = `top-items-${timestamp}.csv`;
      downloadCsv(filename, csv);
      toast.success("Top items exported");
    } catch (err) {
      toast.error("Failed to export items");
    } finally {
      setExporting(false);
    }
  }

  async function handleExportStaffPerformance() {
    if (!report || report.staffPerformance.length === 0) return;
    setExporting(true);
    try {
      const data = staffPerformanceToExportData(
        report.staffPerformance,
        currency
      );
      const csv = arrayToCsv(data);
      const timestamp = new Date().toISOString().split("T")[0];
      const filename = `staff-performance-${timestamp}.csv`;
      downloadCsv(filename, csv);
      toast.success("Staff performance exported");
    } catch (err) {
      toast.error("Failed to export staff data");
    } finally {
      setExporting(false);
    }
  }

  async function handleExportDiscounts() {
    if (!report || report.discounts.length === 0) return;
    setExporting(true);
    try {
      const data = discountsAuditToExportData(report.discounts, currency);
      const csv = arrayToCsv(data);
      const timestamp = new Date().toISOString().split("T")[0];
      const filename = `discounts-audit-${timestamp}.csv`;
      downloadCsv(filename, csv);
      toast.success("Discounts audit exported");
    } catch (err) {
      toast.error("Failed to export discounts");
    } finally {
      setExporting(false);
    }
  }

  async function handleExportCancels() {
    if (!report || report.voids.length === 0) return;
    setExporting(true);
    try {
      const data = cancelsAuditToExportData(report.voids, currency);
      const csv = arrayToCsv(data);
      const timestamp = new Date().toISOString().split("T")[0];
      const filename = `cancels-audit-${timestamp}.csv`;
      downloadCsv(filename, csv);
      toast.success("Cancels audit exported");
    } catch (err) {
      toast.error("Failed to export cancels");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Analytics for {selectedLocation?.name ?? "selected location"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DatePicker
            className="min-w-[150px]"
            value={fromDate ? dayjs(fromDate) : null}
            onChange={(value: Dayjs | null) =>
              setFromDate(value ? value.format("YYYY-MM-DD") : null)
            }
            placeholder="From date"
          />
          <DatePicker
            className="min-w-[150px]"
            value={toDate ? dayjs(toDate) : null}
            onChange={(value: Dayjs | null) =>
              setToDate(value ? value.format("YYYY-MM-DD") : null)
            }
            placeholder="To date"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setFromDate(null);
              setToDate(null);
            }}
            title="Clear All"
          >
            <X className="size-4" />
          </Button>
          {report && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExportComprehensive}
              disabled={exporting}
            >
              <Download className="size-4" />
              {exporting ? "Exporting..." : "Export All"}
            </Button>
          )}
        </div>
      </div>

      {loading && !report ? (
        <AppLoader fullPage />
      ) : report ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
            <StatCard
              label="Paid revenue"
              value={formatMoney(report.revenue, currency)}
              hint={`${report.paidOrders} paid orders`}
            />
            <StatCard
              label="Expenses"
              value={formatMoney(report.expenseTotal, currency)}
              hint={`${report.expenseCount} expense records`}
            />
            <StatCard
              label="Net profit"
              value={formatMoney(report.netProfit, currency)}
              hint="Revenue minus expenses"
            />
            <StatCard
              label="Total orders"
              value={String(report.paidOrders + report.voidCount)}
              hint={`${report.paidOrders} paid · ${report.voidCount} cancelled`}
            />
            <StatCard
              label="Discounts"
              value={formatMoney(report.discountTotal, currency)}
              hint={`${report.discounts.length} discounted orders`}
            />
            <StatCard
              label="Cancels"
              value={String(report.voidCount)}
              hint={formatMoney(report.voidTotal, currency)}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <section className="rounded-lg border border-border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-sm font-semibold">Sales</h2>
                <div className="flex gap-2">
                  <Select
                    className="min-w-[140px]"
                    value={period}
                    onChange={(value) => setPeriod(value as SalesPeriod)}
                    options={PERIOD_OPTIONS}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={handleExportSalesByPeriod}
                    disabled={exporting}
                  >
                    <Download className="size-4" />
                  </Button>
                </div>
              </div>
              <div className="mt-2">
                <SalesPeriodChart
                  points={report.byPeriod}
                  currency={currency}
                />
              </div>
            </section>

            <section className="rounded-lg border border-border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-sm font-semibold">Top items mix</h2>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={handleExportTopItems}
                  disabled={exporting}
                >
                  <Download className="size-4" />
                </Button>
              </div>
              <div className="mt-2">
                <TopItemsChart items={report.itemRanking} currency={currency} />
              </div>
            </section>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <section className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold">Top items</h2>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={handleExportTopItems}
                  disabled={exporting}
                >
                  <Download className="size-4" />
                </Button>
              </div>
              <ul className="mt-4 space-y-2">
                {report.itemRanking.length === 0 ? (
                  <li className="text-sm text-muted-foreground">
                    No item sales yet.
                  </li>
                ) : (
                  report.itemRanking.map((item, index) => (
                    <li
                      key={item.menu_item_id}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span>
                        {index + 1}. {item.name}{" "}
                        <span className="text-muted-foreground">
                          ×{item.quantity}
                        </span>
                      </span>
                      <span className="money text-xs">
                        {formatMoney(item.revenue, currency)}
                      </span>
                    </li>
                  ))
                )}
              </ul>
            </section>

            <section className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold">Staff performance</h2>
                {report.staffPerformance.length > 0 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={handleExportStaffPerformance}
                    disabled={exporting}
                  >
                    <Download className="size-4" />
                  </Button>
                )}
              </div>
              <ul className="mt-4 space-y-2">
                {report.staffPerformance.length === 0 ? (
                  <li className="text-sm text-muted-foreground">
                    No staff sales yet.
                  </li>
                ) : (
                  report.staffPerformance.map((staff) => (
                    <li
                      key={staff.auth_id}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <div>
                        <p className="font-medium">{staff.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {staff.orders} orders · avg{" "}
                          {formatMoney(staff.average_ticket, currency)}
                        </p>
                      </div>
                      <span className="money text-xs">
                        {formatMoney(staff.revenue, currency)}
                      </span>
                    </li>
                  ))
                )}
              </ul>
            </section>
          </div>

          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="text-sm font-semibold">Expenses by category</h2>
            <ul className="mt-4 space-y-2">
              {report.expensesByCategory.length === 0 ? (
                <li className="text-sm text-muted-foreground">
                  No expenses in this range.
                </li>
              ) : (
                report.expensesByCategory.map((row) => (
                  <li
                    key={row.category}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span>
                      {row.category}{" "}
                      <span className="text-muted-foreground">
                        · {row.count}
                      </span>
                    </span>
                    <span className="money text-xs">
                      {formatMoney(row.total, currency)}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </section>

          <div className="grid gap-4 xl:grid-cols-2">
            <section className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold">Discount audit</h2>
                {report.discounts.length > 0 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={handleExportDiscounts}
                    disabled={exporting}
                  >
                    <Download className="size-4" />
                  </Button>
                )}
              </div>
              <ul className="mt-4 space-y-2 text-sm">
                {report.discounts.length === 0 ? (
                  <li className="text-muted-foreground">
                    No discounts in range.
                  </li>
                ) : (
                  report.discounts.slice(0, 12).map((row) => (
                    <li key={row.id} className="flex justify-between gap-3">
                      <span className="text-muted-foreground">
                        {formatDate(row.created_at)}
                      </span>
                      <span className="money text-xs">
                        -{formatMoney(row.discount_total, currency)}
                      </span>
                    </li>
                  ))
                )}
              </ul>
            </section>

            <section className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold">Cancel audit</h2>
                {report.voids.length > 0 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={handleExportCancels}
                    disabled={exporting}
                  >
                    <Download className="size-4" />
                  </Button>
                )}
              </div>
              <ul className="mt-4 space-y-2 text-sm">
                {report.voids.length === 0 ? (
                  <li className="text-muted-foreground">
                    No cancels in range.
                  </li>
                ) : (
                  report.voids.slice(0, 12).map((row) => (
                    <li key={row.id} className="flex justify-between gap-3">
                      <span className="text-muted-foreground">
                        {formatDate(row.created_at)}
                        {row.opened_by_name ? ` · ${row.opened_by_name}` : ""}
                      </span>
                      <span className="money text-xs">
                        {formatMoney(row.grand_total, currency)}
                      </span>
                    </li>
                  ))
                )}
              </ul>
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
}