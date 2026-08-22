"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Plus, Wallet, Download } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  addCashMovement,
  closeCashSession,
  fetchCashDrawerPage,
  openCashSession,
} from "@/lib/cash-drawer/catalog";
import { CashMovementType, CashSessionStatus } from "@/types/enums";
import type {
  CashDrawerPageData,
  CashSessionHistoryRow,
} from "@/types/interfaces";
import type {
  CashMovementInput,
  CloseDrawerInput,
  OpenDrawerInput,
} from "@/lib/validations/cash-drawer";
import { useLocationContext } from "@/components/dashboard/location-provider";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { useTablePagination } from "@/hooks/use-table-pagination";
import { cn, formatDateTime, formatMoney } from "@/lib/utils";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import { AppLoader } from "@/components/ui/app-loader";
import { TablePagination } from "@/components/ui/table-pagination";
import { OpenDrawerDialog } from "@/components/cash-drawer/open-drawer-dialog";
import { CloseDrawerDialog } from "@/components/cash-drawer/close-drawer-dialog";
import { AddCashMovementDialog } from "@/components/cash-drawer/add-cash-movement-dialog";
import { useRouter } from "next/navigation";
import { staffDetailPath } from "@/lib/routes";
import {
  arrayToCsv,
  downloadCsv,
  cashSessionsToExportData,
  cashMovementsToExportData,
} from "@/lib/data-export";

interface CashDrawerManagerProps {
  userId: string;
  authId: string;
  currency: string;
}

function varianceClass(value: number | null) {
  if (value == null) return "text-muted-foreground";
  if (value === 0) return "text-emerald-400";
  if (value > 0) return "text-amber-400";
  return "text-destructive";
}

function StatusBadge({ status }: { status: string }) {
  const open = status === CashSessionStatus.OPEN;
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2 py-0.5 text-xs font-medium capitalize",
        open
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-border text-muted-foreground",
      )}
    >
      {status}
    </span>
  );
}

export function CashDrawerManager({
  userId,
  authId,
  currency,
}: CashDrawerManagerProps) {
  const { selectedLocationId } = useLocationContext();
  const [data, setData] = useState<CashDrawerPageData>({
    openSession: null,
    movements: [],
    history: [],
  });
  const [loading, setLoading] = useState(true);
  const [openDrawerOpen, setOpenDrawerOpen] = useState(false);
  const [closeDrawerOpen, setCloseDrawerOpen] = useState(false);
  const [movementOpen, setMovementOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const refresh = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!selectedLocationId) {
        setData({ openSession: null, movements: [], history: [] });
        setLoading(false);
        return;
      }
      if (!opts?.silent) setLoading(true);
      try {
        const supabase = createClient();
        setData(
          await fetchCashDrawerPage(supabase, userId, selectedLocationId),
        );
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Could not load cash drawer";
        toast.error(message);
      } finally {
        setLoading(false);
      }
    },
    [userId, selectedLocationId],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useRealtimeRefresh({
    userId,
    tables: ["cash_sessions", "cash_movements", "orders"],
    onChange: () => void refresh({ silent: true }),
    enabled: Boolean(selectedLocationId),
  });

  const {
    pageItems: pagedHistory,
    page,
    setPage,
    totalPages,
    totalItems,
    from,
    to,
  } = useTablePagination(data.history);

  async function handleOpenDrawer(values: OpenDrawerInput) {
    if (!selectedLocationId) {
      toast.error("Select a location in the header first");
      return;
    }
    try {
      const supabase = createClient();
      await openCashSession(supabase, {
        userId,
        locationId: selectedLocationId,
        openedBy: authId,
        openingBalance: values.opening_balance,
      });
      toast.success("Drawer opened");
      setOpenDrawerOpen(false);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not open drawer");
    }
  }

  async function handleCloseDrawer(values: CloseDrawerInput) {
    const session = data.openSession;
    if (!session) return;
    try {
      const supabase = createClient();
      await closeCashSession(supabase, {
        userId,
        sessionId: session.id,
        closedBy: authId,
        expected: session.expected_in_drawer,
        actual: values.closing_balance_actual,
        notes: values.notes,
      });
      toast.success("Drawer closed");
      setCloseDrawerOpen(false);
      await refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not close drawer",
      );
    }
  }

  async function handleAddMovement(values: CashMovementInput) {
    const session = data.openSession;
    if (!session) return;
    try {
      const supabase = createClient();
      await addCashMovement(supabase, {
        userId,
        sessionId: session.id,
        type: values.type,
        amount: values.amount,
        reason: values.reason,
      });
      toast.success("Movement recorded");
      setMovementOpen(false);
      await refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not add movement",
      );
    }
  }

  async function handleExportSessions() {
    setExporting(true);
    try {
      const exportData = cashSessionsToExportData(data.history, currency);
      const csv = arrayToCsv(exportData);
      const timestamp = new Date().toISOString().split("T")[0];
      const filename = `cash-sessions-${timestamp}.csv`;
      downloadCsv(filename, csv);
      toast.success(`Exported ${data.history.length} sessions`);
    } catch (err) {
      toast.error("Failed to export sessions");
    } finally {
      setExporting(false);
    }
  }

  async function handleExportMovements() {
    setExporting(true);
    try {
      const exportData = cashMovementsToExportData(data.movements, currency);
      const csv = arrayToCsv(exportData);
      const timestamp = new Date().toISOString().split("T")[0];
      const filename = `cash-movements-${timestamp}.csv`;
      downloadCsv(filename, csv);
      toast.success(`Exported ${data.movements.length} movements`);
    } catch (err) {
      toast.error("Failed to export movements");
    } finally {
      setExporting(false);
    }
  }

  const openSession = data.openSession;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Cash drawer</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Open a session, track cash sales and movements, then close with a
          count.
        </p>
      </div>

      {!selectedLocationId ? (
        <p className="text-sm text-muted-foreground">
          Select a location in the header.
        </p>
      ) : loading ? (
        <AppLoader fullPage />
      ) : (
        <>
          {openSession ? (
            <OpenSessionPanel
              session={openSession}
              currency={currency}
              movements={data.movements}
              onClose={() => setCloseDrawerOpen(true)}
              onAddMovement={() => setMovementOpen(true)}
              onExportMovements={handleExportMovements}
              exporting={exporting}
            />
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-card px-4 py-4">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-md border border-primary/30 bg-primary/10 text-primary">
                  <Wallet className="size-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold tracking-tight">No open session</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    Count the cash in the drawer, then open a session for this
                    location.
                  </p>
                </div>
              </div>
              <Button
                type="button"
                onClick={() => setOpenDrawerOpen(true)}
              >
                Open drawer
              </Button>
            </div>
          )}

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold tracking-tight">
                Session history
              </h2>
              {data.history.length > 0 && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleExportSessions}
                  disabled={exporting}
                >
                  <Download className="size-4" />
                  {exporting ? "Exporting..." : "Export CSV"}
                </Button>
              )}
            </div>
            {data.history.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
                No sessions yet for this location.
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border border-border">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[960px] text-sm">
                    <thead className="bg-secondary/40 text-left text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 font-medium">Opened</th>
                        <th className="px-4 py-3 font-medium">Opened by</th>
                        <th className="px-4 py-3 font-medium">Closed</th>
                        <th className="px-4 py-3 font-medium">Closed by</th>
                        <th className="px-4 py-3 font-medium">
                          Opening balance
                        </th>
                        <th className="px-4 py-3 font-medium">POS sales</th>
                        <th className="px-4 py-3 font-medium">Expected</th>
                        <th className="px-4 py-3 font-medium">
                          Actual counted
                        </th>
                        <th className="px-4 py-3 font-medium">Variance</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedHistory.map((session) => (
                        <tr key={session.id} className="border-t border-border">
                          <td className="px-4 py-3 tabular-nums text-muted-foreground">
                            {formatDateTime(session.opened_at)}
                          </td>
                          <td className="px-4 py-3">
                            {session.opened_by_name}
                          </td>
                          <td className="px-4 py-3 tabular-nums text-muted-foreground">
                            {formatDateTime(session.closed_at)}
                          </td>
                          <td className="px-4 py-3">
                            {session.closed_by_name ?? "—"}
                          </td>
                          <td className="money px-4 py-3">
                            {formatMoney(session.opening_balance, currency)}
                          </td>
                          <td className="money px-4 py-3">
                            {formatMoney(session.cash_sales, currency)}
                          </td>
                          <td className="money px-4 py-3">
                            {formatMoney(session.expected_in_drawer, currency)}
                          </td>
                          <td className="money px-4 py-3">
                            {session.closing_balance_actual == null
                              ? "—"
                              : formatMoney(
                                session.closing_balance_actual,
                                currency,
                              )}
                          </td>
                          <td
                            className={cn(
                              "money px-4 py-3 font-medium",
                              varianceClass(session.variance),
                            )}
                          >
                            {session.variance == null
                              ? "—"
                              : formatMoney(session.variance, currency)}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={session.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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
          </div>
        </>
      )}

      <OpenDrawerDialog
        open={openDrawerOpen}
        onOpenChange={setOpenDrawerOpen}
        onSubmit={handleOpenDrawer}
      />
      {openSession ? (
        <CloseDrawerDialog
          open={closeDrawerOpen}
          onOpenChange={setCloseDrawerOpen}
          currency={currency}
          openingBalance={openSession.opening_balance}
          cashSales={openSession.cash_sales}
          cashIn={openSession.cash_in_total}
          cashOut={openSession.cash_out_total}
          expected={openSession.expected_in_drawer}
          onSubmit={handleCloseDrawer}
        />
      ) : null}
      <AddCashMovementDialog
        open={movementOpen}
        onOpenChange={setMovementOpen}
        onSubmit={handleAddMovement}
      />
    </div>
  );
}

function OpenSessionPanel({
  session,
  currency,
  movements,
  onClose,
  onAddMovement,
  onExportMovements,
  exporting,
}: {
  session: CashSessionHistoryRow;
  currency: string;
  movements: CashDrawerPageData["movements"];
  onClose: () => void;
  onAddMovement: () => void;
  onExportMovements: () => void;
  exporting: boolean;
}) {
  const router = useRouter();
  const netMovements = session.cash_in_total - session.cash_out_total;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-lg border border-border bg-card p-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <StatusBadge status={session.status} />
            <p className="font-medium">Active session</p>
          </div>
          <p className="text-sm text-muted-foreground">
            Opened {formatDateTime(session.opened_at)} by{" "}
            <span
              className={
                session.opened_by_staff_id
                  ? "cursor-pointer hover:underline"
                  : undefined
              }
              onClick={() => {
                if (!session.opened_by_staff_id) return;
                router.push(staffDetailPath(session.opened_by_staff_id));
              }}
            >
              {session.opened_by_name}
            </span>
          </p>
        </div>
        <Button type="button" variant="outline" onClick={onClose}>
          Close drawer
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Opening balance"
          value={formatMoney(session.opening_balance, currency)}
        />
        <StatCard
          label="POS sales"
          value={formatMoney(session.cash_sales, currency)}
          hint="Cash and card orders on this session, excluding cancelled"
        />
        <StatCard
          label="Cash in & out"
          value={formatMoney(netMovements, currency)}
          hint={`In ${formatMoney(session.cash_in_total, currency)} · Out ${formatMoney(session.cash_out_total, currency)}`}
        />
        <StatCard
          label="Expected in drawer"
          value={formatMoney(session.expected_in_drawer, currency)}
        />
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight">
            Cash movements
          </h2>
          <div className="flex gap-2">
            {movements.length > 0 && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={onExportMovements}
                disabled={exporting}
              >
                <Download className="size-4" />
                {exporting ? "Exporting..." : "Export"}
              </Button>
            )}
            <Button type="button" onClick={onAddMovement}>
              <Plus className="size-4" />
              Add movement
            </Button>
          </div>
        </div>
        {movements.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No cash in or cash out yet.
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-secondary/40 text-left text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Time</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Reason</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((movement) => (
                  <tr key={movement.id} className="border-t border-border">
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">
                      {formatDateTime(movement.created_at)}
                    </td>
                    <td className="px-4 py-3 capitalize">
                      {movement.type === CashMovementType.CASH_IN
                        ? "Cash in"
                        : "Cash out"}
                    </td>
                    <td className="money px-4 py-3">
                      {formatMoney(movement.amount, currency)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {movement.reason?.trim() || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}