"use client"

import { useDeferredValue, useMemo, useState } from "react"
import { Coins, Download, Eye, Receipt, Search, TrendingUp, Users } from "lucide-react"
import {
    computeCustomerReceivables,
    computeIncomeStatement,
} from "@/components/modules/accounting/accounting-engine"
import { AccountingInvoiceDialog } from "@/components/modules/accounting/accounting-invoice-dialog"
import {
    AccountingKpiStrip,
    AccountingPagination,
} from "@/components/modules/accounting/accounting-pagination"
import {
    formatCurrency,
    type AccountingOverview,
    type AccountingSalesCosting,
} from "@/components/modules/accounting/accounting.schema"
import { ComboboxSelect } from "@/components/shared/combobox-select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { downloadCsv } from "@/lib/csv"

const SALES_STATUSES = [
    "Draft",
    "Confirmed",
    "Partially Delivered",
    "Completed",
    "Cancelled",
] as const

function billingStatusBadge(status: string): {
    label: string
    variant: "default" | "secondary" | "outline"
} {
    if (status === "Completed") return { label: "Billed", variant: "default" }
    if (status === "Partially Delivered") {
        return { label: "Partially Billed", variant: "secondary" }
    }
    if (status === "Cancelled") return { label: "Cancelled", variant: "outline" }
    return { label: "Pending Delivery", variant: "outline" }
}

export function AccountingReceivablesView({ overview }: { overview: AccountingOverview }) {
    const currency = overview.currencyCode
    const pnl = useMemo(() => computeIncomeStatement(overview), [overview])
    const customers = useMemo(
        () => computeCustomerReceivables(overview.salesCosting),
        [overview.salesCosting],
    )

    const [customerSearch, setCustomerSearch] = useState("")
    const deferredCustomerSearch = useDeferredValue(customerSearch.trim().toLowerCase())

    const [searchInput, setSearchInput] = useState("")
    const deferredSearch = useDeferredValue(searchInput.trim().toLowerCase())
    const [statusFilter, setStatusFilter] = useState("all")
    const [pageIndex, setPageIndex] = useState(0)
    const [pageSize, setPageSize] = useState(10)

    const [selectedInvoice, setSelectedInvoice] = useState<AccountingSalesCosting | null>(null)

    const statusItems = useMemo(
        () => [
            { value: "all", label: "All order statuses" },
            ...SALES_STATUSES.map((s) => ({ value: s, label: s })),
        ],
        [],
    )

    const filteredCustomers = useMemo(() => {
        if (!deferredCustomerSearch) return customers
        return customers.filter((row) =>
            row.customerName.toLowerCase().includes(deferredCustomerSearch),
        )
    }, [customers, deferredCustomerSearch])

    const filteredOrders = useMemo(() => {
        return overview.salesCosting.filter((row) => {
            if (statusFilter !== "all" && row.status !== statusFilter) return false
            if (!deferredSearch) return true
            return (
                row.salesOrderNumber.toLowerCase().includes(deferredSearch) ||
                (row.customerPoNumber ?? "").toLowerCase().includes(deferredSearch) ||
                row.customerName.toLowerCase().includes(deferredSearch) ||
                row.status.toLowerCase().includes(deferredSearch)
            )
        })
    }, [overview.salesCosting, statusFilter, deferredSearch])

    const safePageIndex = Math.min(
        pageIndex,
        Math.max(0, Math.ceil(filteredOrders.length / pageSize) - 1),
    )
    const sliceStart = safePageIndex * pageSize
    const sliceEnd = sliceStart + pageSize

    function handleExportCustomers() {
        downloadCsv("customers-sales-summary.csv", [
            [
                "Customer",
                "Orders",
                "Total Ordered",
                "Billed Sales",
                "Pending Delivery",
                "Product Cost",
                "Profit",
                "Margin %",
                "Completed Deliveries",
                "Total Deliveries",
                "Currency",
            ],
            ...filteredCustomers.map((c) => [
                c.customerName,
                String(c.orderCount),
                c.bookedRevenue,
                c.deliveredRevenue,
                c.backlogRevenue,
                c.deliveredCogs,
                c.grossProfit,
                c.grossMarginPercent ?? "",
                String(c.completedDeliveryCount),
                String(c.deliveryCount),
                currency,
            ]),
        ])
    }

    function handleExportOrders() {
        downloadCsv("customer-invoices-list.csv", [
            [
                "Invoice #",
                "Sales Order",
                "Customer PO",
                "Customer",
                "Order Status",
                "Billing Status",
                "Order Date",
                "Total Ordered",
                "Billed Sales",
                "Product Cost",
                "Profit",
                "Margin %",
                "Completed Deliveries",
                "Total Deliveries",
                "Currency",
            ],
            ...filteredOrders.map((row) => [
                `INV-${row.salesOrderNumber}`,
                row.salesOrderNumber,
                row.customerPoNumber ?? "",
                row.customerName,
                row.status,
                billingStatusBadge(row.status).label,
                row.orderDate,
                row.bookedRevenue,
                row.deliveredRevenue,
                row.deliveredCogs,
                row.grossProfit,
                row.grossMarginPercent ?? "",
                String(row.completedDeliveryCount),
                String(row.deliveryCount),
                currency,
            ]),
        ])
    }

    return (
        <div className="space-y-6">
            <AccountingKpiStrip
                cards={[
                    {
                        title: "Total Billed (Invoices)",
                        value: formatCurrency(
                            overview.summary.totalDeliveredBilling ?? pnl.recognizedRevenue,
                            currency,
                        ),
                        badge: `Ordered ${formatCurrency(overview.summary.totalBookedBilling ?? pnl.bookedSales, currency)}`,
                        helper:
                            overview.summary.totalOutputVat &&
                            Number.parseFloat(overview.summary.totalOutputVat) > 0
                                ? `Sales ${formatCurrency(pnl.recognizedRevenue, currency)} + VAT ${formatCurrency(overview.summary.totalOutputVat, currency)}.`
                                : "Customer deliveries completed and counted as billed.",
                        icon: Coins,
                        color: "text-teal-600 dark:text-teal-400",
                        bg: "bg-teal-500/10",
                    },
                    {
                        title: "Pending Orders",
                        value: formatCurrency(pnl.unfulfilledBacklog, currency),
                        badge: "Waiting for delivery",
                        helper: "Booked customer orders not yet delivered or billed.",
                        icon: Receipt,
                        color: "text-sky-600 dark:text-sky-400",
                        bg: "bg-sky-500/10",
                    },
                    {
                        title: "Cost of Products Sold",
                        value: formatCurrency(pnl.deliveredCogs, currency),
                        badge: "Batch product cost",
                        helper: "Actual spice, packaging, and label cost of delivered products.",
                        icon: TrendingUp,
                        color: "text-amber-600 dark:text-amber-400",
                        bg: "bg-amber-500/10",
                    },
                    {
                        title: "Sales Profit",
                        value: formatCurrency(pnl.grossProfit, currency),
                        badge:
                            pnl.grossMarginPercent !== null
                                ? `${pnl.grossMarginPercent}% margin`
                                : "No deliveries yet",
                        helper: `Across ${customers.length} active customer account(s).`,
                        icon: Users,
                        color: "text-primary",
                        bg: "bg-primary/10",
                    },
                ]}
            />

            <Card className="border shadow-xs">
                <CardHeader className="gap-3 border-b pb-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                            <CardTitle className="text-base font-semibold">
                                Customers Summary
                            </CardTitle>
                            <CardDescription className="text-xs">
                                See total orders, billed sales, pending deliveries, product cost, and profit for each customer.
                            </CardDescription>
                        </div>
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="shrink-0 self-start sm:self-auto"
                            onClick={handleExportCustomers}
                            disabled={filteredCustomers.length === 0}
                        >
                            <Download className="mr-1.5 size-4" />
                            Export Customers CSV
                        </Button>
                    </div>
                    <div className="relative w-full sm:w-64">
                        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            value={customerSearch}
                            onChange={(e) => setCustomerSearch(e.target.value)}
                            placeholder="Search customer name..."
                            className="h-8 pl-8 text-xs"
                        />
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow>
                                <TableHead>Customer</TableHead>
                                <TableHead className="text-right">Orders</TableHead>
                                <TableHead className="text-right">Total Ordered</TableHead>
                                <TableHead className="text-right">Billed</TableHead>
                                <TableHead className="text-right">Pending</TableHead>
                                <TableHead className="text-right">Product Cost</TableHead>
                                <TableHead className="text-right">Profit</TableHead>
                                <TableHead className="text-right">Margin %</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredCustomers.map((row) => (
                                <TableRow key={row.customerName}>
                                    <TableCell className="font-medium">{row.customerName}</TableCell>
                                    <TableCell className="text-right tabular-nums">
                                        {row.orderCount} ({row.completedDeliveryCount}/{row.deliveryCount} del.)
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">
                                        {formatCurrency(row.bookedRevenue, currency)}
                                    </TableCell>
                                    <TableCell className="text-right font-medium tabular-nums">
                                        {formatCurrency(row.deliveredRevenue, currency)}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums text-muted-foreground">
                                        {formatCurrency(row.backlogRevenue, currency)}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums text-muted-foreground">
                                        {formatCurrency(row.deliveredCogs, currency)}
                                    </TableCell>
                                    <TableCell className="text-right font-semibold tabular-nums">
                                        {formatCurrency(row.grossProfit, currency)}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">
                                        {row.grossMarginPercent !== null ? `${row.grossMarginPercent}%` : "—"}
                                    </TableCell>
                                </TableRow>
                            ))}
                            {filteredCustomers.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                                        No matching customer accounts found in this period.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Card className="border shadow-xs">
                <CardHeader className="gap-3 border-b pb-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                            <CardTitle className="text-base font-semibold">
                                Customer Invoices &amp; Sales Orders
                            </CardTitle>
                            <CardDescription className="text-xs">
                                View billing status, delivered totals, and printable invoice summaries per order.
                            </CardDescription>
                        </div>
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="shrink-0 self-start sm:self-auto"
                            onClick={handleExportOrders}
                            disabled={filteredOrders.length === 0}
                        >
                            <Download className="mr-1.5 size-4" />
                            Export Invoices CSV
                        </Button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="relative w-full sm:w-64">
                            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                value={searchInput}
                                onChange={(e) => {
                                    setSearchInput(e.target.value)
                                    setPageIndex(0)
                                }}
                                placeholder="Search invoice #, customer, PO..."
                                className="h-8 pl-8 text-xs"
                            />
                        </div>
                        <div className="w-full sm:w-48">
                            <ComboboxSelect
                                items={statusItems}
                                value={statusFilter}
                                onValueChange={(v) => {
                                    setStatusFilter(v ?? "all")
                                    setPageIndex(0)
                                }}
                                placeholder="Order status"
                                className="w-full"
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow>
                                <TableHead>Invoice / Order</TableHead>
                                <TableHead>Customer</TableHead>
                                <TableHead>Billing Status</TableHead>
                                <TableHead className="text-right">Total Ordered</TableHead>
                                <TableHead className="text-right">Billed</TableHead>
                                <TableHead className="text-right">Product Cost</TableHead>
                                <TableHead className="text-right">Profit</TableHead>
                                <TableHead className="text-right">Invoice</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredOrders.slice(sliceStart, sliceEnd).map((row) => {
                                const badge = billingStatusBadge(row.status)
                                return (
                                    <TableRow key={row.salesOrderId}>
                                        <TableCell>
                                            <div className="font-medium">
                                                INV-{row.salesOrderNumber}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                {row.orderDate}
                                                {row.customerPoNumber
                                                    ? ` · PO ${row.customerPoNumber}`
                                                    : ""}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="font-medium">{row.customerName}</div>
                                            <div className="text-xs text-muted-foreground">
                                                {row.completedDeliveryCount}/{row.deliveryCount} deliveries finished
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={badge.variant}>{badge.label}</Badge>
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums">
                                            {formatCurrency(row.bookedRevenue, currency)}
                                        </TableCell>
                                        <TableCell className="text-right font-medium tabular-nums">
                                            {formatCurrency(row.deliveredRevenue, currency)}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums text-muted-foreground">
                                            {formatCurrency(row.deliveredCogs, currency)}
                                        </TableCell>
                                        <TableCell className="text-right font-semibold tabular-nums">
                                            {formatCurrency(row.grossProfit, currency)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                type="button"
                                                size="xs"
                                                variant="outline"
                                                onClick={() => setSelectedInvoice(row)}
                                            >
                                                <Eye className="mr-1 size-3" />
                                                View
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                )
                            })}
                            {filteredOrders.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                                        No matching customer invoices found.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                    <AccountingPagination
                        totalRows={filteredOrders.length}
                        pageSize={pageSize}
                        pageIndex={safePageIndex}
                        onPageSizeChange={setPageSize}
                        onPageIndexChange={setPageIndex}
                    />
                </CardContent>
            </Card>

            <AccountingInvoiceDialog
                invoice={selectedInvoice}
                currencyCode={currency}
                open={selectedInvoice !== null}
                onOpenChange={(open) => {
                    if (!open) setSelectedInvoice(null)
                }}
            />
        </div>
    )
}
