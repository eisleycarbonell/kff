"use client"

import { useDeferredValue, useMemo, useState } from "react"
import { Building2, Clock, Download, PackageCheck, Search, ShoppingCart } from "lucide-react"
import { computeSupplierPayables } from "@/components/modules/accounting/accounting-engine"
import {
    AccountingKpiStrip,
    AccountingPagination,
} from "@/components/modules/accounting/accounting-pagination"
import {
    formatCurrency,
    formatDate,
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

const PO_STATUSES = ["Draft", "Sent", "Partially Received", "Completed", "Cancelled"] as const

export function AccountingPayablesView({ overview }: { overview: AccountingOverview }) {
    const currency = overview.currencyCode
    const s = overview.summary
    const suppliers = useMemo(
        () => computeSupplierPayables(overview.purchasingCosting),
        [overview.purchasingCosting],
    )

    const [searchInput, setSearchInput] = useState("")
    const deferredSearch = useDeferredValue(searchInput.trim().toLowerCase())
    const [statusFilter, setStatusFilter] = useState("all")
    const [pageIndex, setPageIndex] = useState(0)
    const [pageSize, setPageSize] = useState(10)

    const statusItems = useMemo(
        () => [
            { value: "all", label: "All PO statuses" },
            ...PO_STATUSES.map((st) => ({ value: st, label: st })),
        ],
        [],
    )

    const filteredPos = useMemo(() => {
        return overview.purchasingCosting.filter((row) => {
            if (statusFilter !== "all" && row.status !== statusFilter) return false
            if (!deferredSearch) return true
            return (
                row.poNumber.toLowerCase().includes(deferredSearch) ||
                row.supplierName.toLowerCase().includes(deferredSearch) ||
                row.status.toLowerCase().includes(deferredSearch)
            )
        })
    }, [overview.purchasingCosting, statusFilter, deferredSearch])

    const safePageIndex = Math.min(pageIndex, Math.max(0, Math.ceil(filteredPos.length / pageSize) - 1))
    const sliceStart = safePageIndex * pageSize
    const sliceEnd = sliceStart + pageSize

    function handleExportSuppliers() {
        downloadCsv("accounting-supplier-payables-summary.csv", [
            [
                "Supplier",
                "Active POs",
                "Order Lines",
                "Total Committed",
                "Received AP (GRNI)",
                "Open Commitment",
                "Received %",
                "Currency",
            ],
            ...suppliers.map((sup) => [
                sup.supplierName,
                String(sup.poCount),
                String(sup.lineCount),
                sup.totalCommitted,
                sup.receivedPayable,
                sup.outstandingCommitment,
                sup.receivedPercent ?? "",
                currency,
            ]),
        ])
    }

    function handleExportPos() {
        downloadCsv("accounting-po-commitments.csv", [
            [
                "PO Number",
                "Supplier",
                "Status",
                "Order Date",
                "Expected Delivery",
                "Lines",
                "Ordered Total",
                "Received Value",
                "Remaining Commitment",
                "Currency",
            ],
            ...filteredPos.map((row) => [
                row.poNumber,
                row.supplierName,
                row.status,
                row.orderDate,
                row.expectedDeliveryDate ?? "",
                String(row.lineCount),
                row.totalAmount,
                row.receivedAmount,
                row.outstandingAmount,
                currency,
            ]),
        ])
    }

    return (
        <div className="space-y-6">
            <AccountingKpiStrip
                cards={[
                    {
                        title: "Total PO Commitments",
                        value: formatCurrency(s.purchaseCommittedValue, currency),
                        badge: `${overview.purchasingCosting.length} POs in period`,
                        helper: "Total agreed purchase order value across non-cancelled orders.",
                        icon: ShoppingCart,
                        color: "text-sky-600 dark:text-sky-400",
                        bg: "bg-sky-500/10",
                    },
                    {
                        title: "Accrued AP — Goods Received",
                        value: formatCurrency(s.purchaseReceivedValue, currency),
                        badge: "Account 2100 GRNI",
                        helper:
                            s.totalInputVat && Number.parseFloat(s.totalInputVat) > 0
                                ? `Net received ${formatCurrency(s.purchaseReceivedNetValue ?? s.purchaseReceivedValue, currency)} + Input VAT ${formatCurrency(s.totalInputVat, currency)} (Acct 1150).`
                                : "Inventory value already received from suppliers awaiting settlement.",
                        icon: PackageCheck,
                        color: "text-emerald-600 dark:text-emerald-400",
                        bg: "bg-emerald-500/10",
                    },
                    {
                        title: "Open Remaining Commitment",
                        value: formatCurrency(s.purchaseOutstandingValue, currency),
                        badge: "Future delivery",
                        helper: "Ordered amount on open supplier POs not yet received into stock.",
                        icon: Clock,
                        color: "text-amber-600 dark:text-amber-400",
                        bg: "bg-amber-500/10",
                    },
                    {
                        title: "Active Vendor Accounts",
                        value: String(suppliers.length),
                        badge: "Supplier AP",
                        helper: "Suppliers with committed or received purchase balances in period.",
                        icon: Building2,
                        color: "text-primary",
                        bg: "bg-primary/10",
                    },
                ]}
            />

            <Card className="border shadow-xs">
                <CardHeader className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <CardTitle className="text-base font-semibold">
                            Supplier AP &amp; Purchasing Commitment Summary
                        </CardTitle>
                        <CardDescription className="text-xs">
                            Vendor-level breakdown of Goods Received Not Invoiced (GRNI) liabilities vs remaining open order commitments.
                        </CardDescription>
                    </div>
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={handleExportSuppliers}
                        disabled={suppliers.length === 0}
                    >
                        <Download className="mr-1.5 size-4" />
                        Export Supplier CSV
                    </Button>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow>
                                <TableHead>Supplier</TableHead>
                                <TableHead className="text-right">PO Count</TableHead>
                                <TableHead className="text-right">Lines</TableHead>
                                <TableHead className="text-right">Total Committed</TableHead>
                                <TableHead className="text-right">Received AP (GRNI)</TableHead>
                                <TableHead className="text-right">Open Commitment</TableHead>
                                <TableHead className="text-right">Received %</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {suppliers.map((sup) => (
                                <TableRow key={sup.supplierName}>
                                    <TableCell className="font-medium">{sup.supplierName}</TableCell>
                                    <TableCell className="text-right tabular-nums">{sup.poCount}</TableCell>
                                    <TableCell className="text-right tabular-nums">{sup.lineCount}</TableCell>
                                    <TableCell className="text-right tabular-nums">
                                        {formatCurrency(sup.totalCommitted, currency)}
                                    </TableCell>
                                    <TableCell className="text-right font-medium tabular-nums">
                                        {formatCurrency(sup.receivedPayable, currency)}
                                    </TableCell>
                                    <TableCell className="text-right font-semibold tabular-nums">
                                        {formatCurrency(sup.outstandingCommitment, currency)}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums text-muted-foreground">
                                        {sup.receivedPercent !== null ? `${sup.receivedPercent}%` : "—"}
                                    </TableCell>
                                </TableRow>
                            ))}
                            {suppliers.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                                        No active supplier commitments found in this period.
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
                                Purchase Order Commitment Subledger
                            </CardTitle>
                            <CardDescription className="text-xs">
                                Individual purchase order receipts and open liabilities awaiting arrival.
                            </CardDescription>
                        </div>
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={handleExportPos}
                            disabled={filteredPos.length === 0}
                        >
                            <Download className="mr-1.5 size-4" />
                            Export PO CSV
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
                                placeholder="Search PO #, supplier..."
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
                                placeholder="PO status"
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow>
                                <TableHead>PO Number</TableHead>
                                <TableHead>Supplier</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Expected Delivery</TableHead>
                                <TableHead className="text-right">Ordered Total</TableHead>
                                <TableHead className="text-right">Received Value</TableHead>
                                <TableHead className="text-right">Remaining</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredPos.slice(sliceStart, sliceEnd).map((row) => (
                                <TableRow key={row.poId}>
                                    <TableCell>
                                        <div className="font-medium">{row.poNumber}</div>
                                        <div className="text-xs text-muted-foreground">
                                            {formatDate(row.orderDate)} · {row.lineCount} lines
                                        </div>
                                    </TableCell>
                                    <TableCell className="font-medium">{row.supplierName}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline">{row.status}</Badge>
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground">
                                        {row.expectedDeliveryDate ?? "Not scheduled"}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">
                                        {formatCurrency(row.totalAmount, currency)}
                                    </TableCell>
                                    <TableCell className="text-right font-medium tabular-nums">
                                        {formatCurrency(row.receivedAmount, currency)}
                                    </TableCell>
                                    <TableCell className="text-right font-semibold tabular-nums">
                                        {formatCurrency(row.outstandingAmount, currency)}
                                    </TableCell>
                                </TableRow>
                            ))}
                            {filteredPos.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                                        No matching purchase order commitments found.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                    <AccountingPagination
                        totalRows={filteredPos.length}
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
