"use client"

import { useDeferredValue, useMemo, useState } from "react"
import { Coins, Download, Receipt, Search, TrendingUp, Users } from "lucide-react"
import {
    computeCustomerReceivables,
    computeIncomeStatement,
} from "@/components/modules/accounting/accounting-engine"
import {
    AccountingKpiStrip,
    AccountingPagination,
} from "@/components/modules/accounting/accounting-pagination"
import {
    formatCurrency,
    type AccountingOverview,
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

const SALES_STATUSES = ["Draft", "Confirmed", "Partially Delivered", "Completed", "Cancelled"] as const

export function AccountingReceivablesView({ overview }: { overview: AccountingOverview }) {
    const currency = overview.currencyCode
    const pnl = useMemo(() => computeIncomeStatement(overview), [overview])
    const customers = useMemo(
        () => computeCustomerReceivables(overview.salesCosting),
        [overview.salesCosting],
    )

    const [searchInput, setSearchInput] = useState("")
    const deferredSearch = useDeferredValue(searchInput.trim().toLowerCase())
    const [statusFilter, setStatusFilter] = useState("all")
    const [pageIndex, setPageIndex] = useState(0)
    const [pageSize, setPageSize] = useState(10)

    const statusItems = useMemo(
        () => [
            { value: "all", label: "All order statuses" },
            ...SALES_STATUSES.map((s) => ({ value: s, label: s })),
        ],
        [],
    )

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

    const safePageIndex = Math.min(pageIndex, Math.max(0, Math.ceil(filteredOrders.length / pageSize) - 1))
    const sliceStart = safePageIndex * pageSize
    const sliceEnd = sliceStart + pageSize

    function handleExportCustomers() {
        downloadCsv("accounting-customer-ar-margins.csv", [
            [
                "Customer",
                "Orders",
                "Booked Revenue",
                "Delivered Revenue",
                "Unfulfilled Backlog",
                "Delivered COGS",
                "Gross Profit",
                "Gross Margin %",
                "Completed Deliveries",
                "Total Deliveries",
                "Currency",
            ],
            ...customers.map((c) => [
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
        downloadCsv("accounting-sales-order-cogs.csv", [
            [
                "Sales Order",
                "Customer PO",
                "Customer",
                "Status",
                "Order Date",
                "Booked Revenue",
                "Delivered Revenue",
                "Delivered COGS",
                "Gross Profit",
                "Gross Margin %",
                "Completed Deliveries",
                "Total Deliveries",
                "Currency",
            ],
            ...filteredOrders.map((row) => [
                row.salesOrderNumber,
                row.customerPoNumber ?? "",
                row.customerName,
                row.status,
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
                        title: "Delivered Sales Billing (AR)",
                        value: formatCurrency(
                            overview.summary.totalDeliveredBilling ?? pnl.recognizedRevenue,
                            currency,
                        ),
                        badge: `Booked ${formatCurrency(overview.summary.totalBookedBilling ?? pnl.bookedSales, currency)}`,
                        helper:
                            overview.summary.totalOutputVat &&
                            Number.parseFloat(overview.summary.totalOutputVat) > 0
                                ? `Net sales ${formatCurrency(pnl.recognizedRevenue, currency)} + Output VAT ${formatCurrency(overview.summary.totalOutputVat, currency)} (Acct 2200).`
                                : "Completed customer deliveries recognized as receivable billing.",
                        icon: Coins,
                        color: "text-teal-600 dark:text-teal-400",
                        bg: "bg-teal-500/10",
                    },
                    {
                        title: "Undelivered Order Backlog",
                        value: formatCurrency(pnl.unfulfilledBacklog, currency),
                        badge: "Pending fulfillment",
                        helper: "Booked sales orders remaining open for delivery completion.",
                        icon: Receipt,
                        color: "text-sky-600 dark:text-sky-400",
                        bg: "bg-sky-500/10",
                    },
                    {
                        title: "Delivered Batch COGS",
                        value: formatCurrency(pnl.deliveredCogs, currency),
                        badge: "Account 5100",
                        helper: "Exact batch unit cost of finished spice lots shipped.",
                        icon: TrendingUp,
                        color: "text-amber-600 dark:text-amber-400",
                        bg: "bg-amber-500/10",
                    },
                    {
                        title: "Gross Profit & Customer Margin",
                        value: formatCurrency(pnl.grossProfit, currency),
                        badge:
                            pnl.grossMarginPercent !== null
                                ? `${pnl.grossMarginPercent}% margin`
                                : "No deliveries",
                        helper: `Across ${customers.length} active customer account(s).`,
                        icon: Users,
                        color: "text-primary",
                        bg: "bg-primary/10",
                    },
                ]}
            />

            <Card className="border shadow-xs">
                <CardHeader className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <CardTitle className="text-base font-semibold">
                            Customer Account Profitability &amp; Receivables Summary
                        </CardTitle>
                        <CardDescription className="text-xs">
                            Booked demand, completed delivery billing, undelivered backlog, COGS, and gross margin rolled up per customer.
                        </CardDescription>
                    </div>
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={handleExportCustomers}
                        disabled={customers.length === 0}
                    >
                        <Download className="mr-1.5 size-4" />
                        Export Customer CSV
                    </Button>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow>
                                <TableHead>Customer</TableHead>
                                <TableHead className="text-right">Orders</TableHead>
                                <TableHead className="text-right">Booked Revenue</TableHead>
                                <TableHead className="text-right">Delivered Billing</TableHead>
                                <TableHead className="text-right">Backlog</TableHead>
                                <TableHead className="text-right">Delivered COGS</TableHead>
                                <TableHead className="text-right">Gross Profit</TableHead>
                                <TableHead className="text-right">Margin %</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {customers.map((row) => (
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
                            {customers.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                                        No non-cancelled customer orders found in this period.
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
                        <div>
                            <CardTitle className="text-base font-semibold">
                                Sales Order Revenue &amp; Batch COGS Detail
                            </CardTitle>
                            <CardDescription className="text-xs">
                                Individual order billing progress matched against actual shipped batch costs.
                            </CardDescription>
                        </div>
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={handleExportOrders}
                            disabled={filteredOrders.length === 0}
                        >
                            <Download className="mr-1.5 size-4" />
                            Export Orders CSV
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
                                placeholder="Search sales #, customer, PO..."
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
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow>
                                <TableHead>Sales Order</TableHead>
                                <TableHead>Customer</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Booked Revenue</TableHead>
                                <TableHead className="text-right">Delivered Revenue</TableHead>
                                <TableHead className="text-right">Delivered COGS</TableHead>
                                <TableHead className="text-right">Gross Profit</TableHead>
                                <TableHead className="text-right">Margin</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredOrders.slice(sliceStart, sliceEnd).map((row) => (
                                <TableRow key={row.salesOrderId}>
                                    <TableCell>
                                        <div className="font-medium">{row.salesOrderNumber}</div>
                                        <div className="text-xs text-muted-foreground">
                                            {row.orderDate}
                                            {row.customerPoNumber ? ` · PO ${row.customerPoNumber}` : ""}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="font-medium">{row.customerName}</div>
                                        <div className="text-xs text-muted-foreground">
                                            {row.completedDeliveryCount}/{row.deliveryCount} deliveries completed
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline">{row.status}</Badge>
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
                                    <TableCell className="text-right tabular-nums">
                                        {row.grossMarginPercent !== null ? `${row.grossMarginPercent}%` : "—"}
                                    </TableCell>
                                </TableRow>
                            ))}
                            {filteredOrders.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                                        No matching sales order records found.
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
        </div>
    )
}
