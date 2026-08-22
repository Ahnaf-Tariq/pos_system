/**
 * Utility functions for exporting data to CSV format
 * Fixed with UTF-8 BOM to prevent Excel format warnings
 */

export function arrayToCsv(data: Array<Record<string, any>>): string {
    if (data.length === 0) return "";

    const headers = Object.keys(data[0]);
    const csvHeaders = headers.map(escapeCSVField).join(",");

    const csvRows = data.map((row) =>
        headers.map((header) => escapeCSVField(row[header])).join(",")
    );

    return [csvHeaders, ...csvRows].join("\n");
}

export function escapeCSVField(field: any): string {
    if (field === null || field === undefined) return "";

    const stringField = String(field);

    // Escape double quotes and wrap in quotes if contains comma, newline, or quotes
    if (stringField.includes(",") || stringField.includes("\n") || stringField.includes('"')) {
        return `"${stringField.replace(/"/g, '""')}"`;
    }

    return stringField;
}

export function downloadCsv(filename: string, csvContent: string) {
    // Add UTF-8 BOM to prevent Excel format warnings
    // BOM: \uFEFF (this tells Excel the file is UTF-8)
    const csvWithBOM = "\uFEFF" + csvContent;

    const blob = new Blob([csvWithBOM], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);

    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Clean up
    setTimeout(() => {
        URL.revokeObjectURL(url);
    }, 100);
}

// Orders export
export function ordersToExportData(orders: any[], currency: string) {
    return orders.map((order) => ({
        ID: order.id,
        "Date Time": order.created_at,
        Type: order.order_type.replace(/_/g, " "),
        Table: order.table_label || "—",
        Staff: order.opened_by_name || "—",
        Status: order.status,
        "Total Amount": order.grand_total,
        Currency: currency,
    }));
}

// Staff export
export function staffToExportData(staff: any[], currency: string) {
    return staff.map((member) => ({
        ID: member.id,
        Name: member.full_name || "Unnamed",
        Email: member.email || "—",
        Phone: member.phone || "—",
        Role: member.role,
        Location: member.location_name || "All locations",
        Salary: member.role === "owner" ? "—" : member.salary || 0,
        Currency: currency,
        Status: member.is_active ? "Active" : "Inactive",
        "Date Created": member.created_at,
    }));
}

// Reports - Sales by period export
export function salesPeriodToExportData(periods: any[], currency: string) {
    return periods.map((period) => ({
        Period: period.label,
        Orders: period.orders,
        Revenue: period.total,
        Currency: currency,
    }));
}

// Reports - Top items export
export function topItemsToExportData(items: any[], currency: string) {
    return items.map((item, index) => ({
        Rank: index + 1,
        "Item Name": item.name,
        Quantity: item.quantity,
        Revenue: item.revenue,
        Currency: currency,
    }));
}

// Reports - Staff performance export
export function staffPerformanceToExportData(
    staffPerf: any[],
    currency: string
) {
    return staffPerf.map((staff) => ({
        Name: staff.name,
        Orders: staff.orders,
        "Average Ticket": staff.average_ticket,
        Revenue: staff.revenue,
        Currency: currency,
    }));
}

// Reports - Discounts audit export
export function discountsAuditToExportData(discounts: any[], currency: string) {
    return discounts.map((discount) => ({
        ID: discount.id,
        Date: discount.created_at,
        "Discount Amount": discount.discount_total,
        Currency: currency,
    }));
}

// Reports - Cancels audit export
export function cancelsAuditToExportData(cancels: any[], currency: string) {
    return cancels.map((cancel) => ({
        ID: cancel.id,
        Date: cancel.created_at,
        Staff: cancel.opened_by_name || "—",
        "Cancel Amount": cancel.grand_total,
        Currency: currency,
    }));
}

// Cash Drawer - Sessions export
export function cashSessionsToExportData(sessions: any[], currency: string) {
    return sessions.map((session) => ({
        ID: session.id,
        "Opened At": session.opened_at,
        "Opened By": session.opened_by_name,
        "Closed At": session.closed_at || "—",
        "Closed By": session.closed_by_name || "—",
        "Opening Balance": session.opening_balance,
        "POS Sales": session.cash_sales,
        "Cash In": session.cash_in_total,
        "Cash Out": session.cash_out_total,
        "Expected In Drawer": session.expected_in_drawer,
        "Actual Counted": session.closing_balance_actual || "—",
        Variance: session.variance || "—",
        Status: session.status,
        Currency: currency,
    }));
}

// Cash Drawer - Movements export
export function cashMovementsToExportData(movements: any[], currency: string) {
    return movements.map((movement) => ({
        ID: movement.id,
        "Date Time": movement.created_at,
        Type: movement.type === "cash_in" ? "Cash In" : "Cash Out",
        Amount: movement.amount,
        Reason: movement.reason || "—",
        Currency: currency,
    }));
}