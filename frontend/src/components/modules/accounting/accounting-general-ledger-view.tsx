"use client"

import { useDeferredValue, useMemo, useState } from "react"
import {
    BookOpenCheck,
    CheckCircle2,
    Download,
    FileSpreadsheet,
    Receipt,
    Scale,
    Search,
    Users,
    Wallet,
} from "lucide-react"
import {
    computeCustomerReceivables,
    computeIncomeStatement,
    computeJournalEntries,
    computeSimpleAccountingSummary,
    computeSupplierPayables,
    computeTrialBalance,
} from "@/components/modules/accounting/accounting-engine"
import {
    AccountingKpiStrip,
    AccountingPagination,
} from "@/components/modules/accounting/accounting-pagination"
import {
    formatCurrency,
    formatDate,
    formatQuantity,
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
    TableFooter,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { downloadCsv } from "@/lib/csv"

const MOVEMENT_TYPES = [
    "Receive",
    "Consume",
    "Produce",
    "Sale",
    "Transfer",
    "Adjustment",
    "Scrap",
] as const

function accountTypeVariant(type: string) {
    if (type === "Asset" || type === "Revenue") return "secondary" as const
    if (type === "Liability" || type === "Equity") return "outline" as const
    return "default" as const
}

export function AccountingGeneralLedgerView({ overview }: { overview: AccountingOverview }) {
    const currency = overview.currencyCode
    const trialBalance = useMemo(() => computeTrialBalance(overview), [overview])
    const journals = useMemo(() => computeJournalEntries(overview), [overview])
    const pnl = useMemo(() => computeIncomeStatement(overview), [overview])
    const simple = useMemo(() => computeSimpleAccountingSummary(overview), [overview])
    const customers = useMemo(
        () => computeCustomerReceivables(overview.salesCosting),
        [overview.salesCosting],
    )
    const suppliers = useMemo(
        () => computeSupplierPayables(overview.purchasingCosting),
        [overview.purchasingCosting],
    )

    const [searchInput, setSearchInput] = useState("")
    const deferredSearch = useDeferredValue(searchInput.trim().toLowerCase())
    const [movementFilter, setMovementFilter] = useState("all")
    const [accountFilter, setAccountFilter] = useState("all")
    const [pageIndex, setPageIndex] = useState(0)
    const [pageSize, setPageSize] = useState(10)

    const movementFilterItems = useMemo(
        () => [
            { value: "all", label: "All activity types" },
            ...MOVEMENT_TYPES.map((type) => ({ value: type, label: type })),
        ],
        [],
    )

    const accountFilterItems = useMemo(() => {
        const map = new Map<string, string>()
        for (const entry of journals) {
            map.set(entry.debitAccountCode, `${entry.debitAccountCode} · ${entry.debitAccountName}`)
            map.set(entry.creditAccountCode, `${entry.creditAccountCode} · ${entry.creditAccountName}`)
        }
        return [
            { value: "all", label: "All accounts" },
            ...[...map.entries()]
                .sort((a, b) => a[0].localeCompare(b[0]))
                .map(([value, label]) => ({ value, label })),
        ]
    }, [journals])

    const filteredJournals = useMemo(() => {
        return journals.filter((row) => {
            if (movementFilter !== "all" && row.transactionType !== movementFilter) return false
            if (
                accountFilter !== "all" &&
                row.debitAccountCode !== accountFilter &&
                row.creditAccountCode !== accountFilter
            ) {
                return false
            }
            if (!deferredSearch) return true
            return (
                row.journalNumber.toLowerCase().includes(deferredSearch) ||
                row.itemSku.toLowerCase().includes(deferredSearch) ||
                row.itemName.toLowerCase().includes(deferredSearch) ||
                row.lotNumber.toLowerCase().includes(deferredSearch) ||
                row.locationName.toLowerCase().includes(deferredSearch) ||
                row.debitAccountName.toLowerCase().includes(deferredSearch) ||
                row.creditAccountName.toLowerCase().includes(deferredSearch) ||
                (row.referenceId ?? "").toLowerCase().includes(deferredSearch) ||
                row.authorizedByName.toLowerCase().includes(deferredSearch)
            )
        })
    }, [journals, movementFilter, accountFilter, deferredSearch])

    const safePageIndex = Math.min(pageIndex, Math.max(0, Math.ceil(filteredJournals.length / pageSize) - 1))
    const sliceStart = safePageIndex * pageSize
    const sliceEnd = sliceStart + pageSize

    function handleExportPnl() {
        downloadCsv("report-profit-and-loss.csv", [
            ["Line Item", "Amount", "Currency"],
            ["Total Sales (Completed Deliveries)", simple.totalSales, currency],
            ["Less: Cost of Products Sold", `-${simple.costOfGoodsSold}`, currency],
            ["Gross Profit", pnl.grossProfit, currency],
            ["Less: Damaged & Scrap Stock", `-${simple.scrapLoss}`, currency],
            ["Stock Count Adjustments", simple.adjustmentNet, currency],
            ["Total Operating Expenses", simple.totalExpenses, currency],
            ["Net Profit", simple.netProfit, currency],
            ["Pending Orders (Not Yet Delivered)", simple.pendingSales, currency],
        ])
    }

    function handleExportSalesCustomers() {
        downloadCsv("report-sales-and-customers.csv", [
            [
                "Customer",
                "Orders",
                "Total Ordered",
                "Billed Sales",
                "Pending Delivery",
                "Product Cost",
                "Profit",
                "Margin %",
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
                currency,
            ]),
        ])
    }

    function handleExportExpensesBills() {
        downloadCsv("report-expenses-and-supplier-bills.csv", [
            [
                "Supplier",
                "Orders",
                "Total Ordered",
                "Received Bills",
                "Still Open",
                "Received %",
                "Currency",
            ],
            ...suppliers.map((sup) => [
                sup.supplierName,
                String(sup.poCount),
                sup.totalCommitted,
                sup.receivedPayable,
                sup.outstandingCommitment,
                sup.receivedPercent ?? "",
                currency,
            ]),
        ])
    }

    function handleExportVatSummary() {
        downloadCsv("report-vat-tax-summary.csv", [
            ["Tax Line Item", "Amount", "Currency"],
            ["VAT Collected from Sales (Output VAT)", overview.summary.totalOutputVat ?? "0.0000", currency],
            ["VAT Paid on Purchases (Input VAT)", overview.summary.totalInputVat ?? "0.0000", currency],
            ["Net VAT to Pay / Carryover", overview.summary.netVatPayable ?? "0.0000", currency],
        ])
    }

    function handleExportTrialBalance() {
        downloadCsv("report-account-summary.csv", [
            ["Account Code", "Account Name", "Type", "Debit", "Credit", "Net Balance", "Currency", "Source"],
            ...trialBalance.accounts.map((acc) => [
                acc.accountCode,
                acc.accountName,
                acc.accountType,
                acc.debit,
                acc.credit,
                acc.netBalance,
                currency,
                acc.sourceNote,
            ]),
            ["TOTAL", "Account Summary Totals", "", trialBalance.totalDebits, trialBalance.totalCredits, trialBalance.difference, currency, trialBalance.isBalanced ? "Balanced" : "Out of balance"],
        ])
    }

    function handleExportJournals() {
        downloadCsv("report-transaction-history.csv", [
            [
                "Entry #",
                "Timestamp",
                "Activity",
                "Reference",
                "Item SKU",
                "Item Name",
                "Batch / Lot",
                "Location",
                "Qty Change",
                "UOM",
                "Unit Cost",
                "Debit Account",
                "Credit Account",
                "Amount",
                "Currency",
                "Recorded By",
            ],
            ...filteredJournals.map((row) => [
                row.journalNumber,
                row.createdAt,
                row.transactionType,
                row.referenceId ?? "",
                row.itemSku,
                row.itemName,
                row.lotNumber,
                row.locationName,
                row.qtyChange,
                row.primaryUomName,
                row.effectiveUnitCost,
                `${row.debitAccountCode} ${row.debitAccountName}`,
                `${row.creditAccountCode} ${row.creditAccountName}`,
                row.amount,
                currency,
                row.authorizedByName,
            ]),
        ])
    }

    const quickReports = [
        {
            title: "Profit & Loss Report",
            description: "Sales, product costs, scrap losses, and Net Profit.",
            icon: FileSpreadsheet,
            onDownload: handleExportPnl,
        },
        {
            title: "Sales & Customers",
            description: `${customers.length} customer(s), billed orders, and margin.`,
            icon: Users,
            onDownload: handleExportSalesCustomers,
        },
        {
            title: "Expenses & Supplier Bills",
            description: `${suppliers.length} supplier(s), received bills, and open orders.`,
            icon: Wallet,
            onDownload: handleExportExpensesBills,
        },
        {
            title: "Tax / VAT Summary",
            description: "Sales Output VAT, Purchase Input VAT, and Net VAT due.",
            icon: Receipt,
            onDownload: handleExportVatSummary,
        },
        {
            title: "Account Summary",
            description: `${trialBalance.accounts.length} balanced asset, bill, sales & cost accounts.`,
            icon: Scale,
            onDownload: handleExportTrialBalance,
        },
        {
            title: "Full Transaction History",
            description: `${filteredJournals.length} costed stock & financial entries.`,
            icon: BookOpenCheck,
            onDownload: handleExportJournals,
        },
    ] as const

    return (
        <div className="space-y-6">
            <Card className="border shadow-xs">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold">
                        Quick Financial Reports (CSV Export)
                    </CardTitle>
                    <CardDescription className="text-xs">
                        Download ready-to-share spreadsheets for the active date range.
                    </CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-3 @lg/main:grid-cols-2 @5xl/main:grid-cols-3">
                    {quickReports.map((rep) => {
                        const Icon = rep.icon
                        return (
                            <div
                                key={rep.title}
                                className="flex flex-col justify-between gap-3 rounded-lg border bg-muted/20 p-3 text-xs"
                            >
                                <div className="flex items-start gap-2.5">
                                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                        <Icon className="size-4" />
                                    </div>
                                    <div className="min-w-0 space-y-0.5">
                                        <p className="font-semibold text-foreground">{rep.title}</p>
                                        <p className="text-muted-foreground">{rep.description}</p>
                                    </div>
                                </div>
                                <Button
                                    type="button"
                                    size="xs"
                                    variant="outline"
                                    className="self-start"
                                    onClick={rep.onDownload}
                                >
                                    <Download className="mr-1.5 size-3.5" />
                                    Download CSV
                                </Button>
                            </div>
                        )
                    })}
                </CardContent>
            </Card>

            <AccountingKpiStrip
                cards={[
                    {
                        title: "Total Debits",
                        value: formatCurrency(trialBalance.totalDebits, currency),
                        badge: `${trialBalance.accounts.length} accounts`,
                        helper: "Assets, tax credits, and costs recorded across the books.",
                        icon: Scale,
                        color: "text-primary",
                        bg: "bg-primary/10",
                    },
                    {
                        title: "Total Credits",
                        value: formatCurrency(trialBalance.totalCredits, currency),
                        badge: trialBalance.isBalanced ? "Books Balanced" : "Check Totals",
                        helper: "Supplier bills, tax due, equity clearing, and sales revenue.",
                        icon: CheckCircle2,
                        color: "text-emerald-600 dark:text-emerald-400",
                        bg: "bg-emerald-500/10",
                    },
                    {
                        title: "Balance Check",
                        value: formatCurrency(trialBalance.difference, currency),
                        badge: trialBalance.isBalanced ? "Exact 0.00" : "Variance",
                        helper: "Difference between total debits and credits (should be 0.00).",
                        icon: BookOpenCheck,
                        color: "text-sky-600 dark:text-sky-400",
                        bg: "bg-sky-500/10",
                    },
                    {
                        title: "Transaction Entries",
                        value: String(journals.length),
                        badge: `${filteredJournals.length} shown`,
                        helper: "Stock & cost events automatically posted to the ledger.",
                        icon: FileSpreadsheet,
                        color: "text-amber-600 dark:text-amber-400",
                        bg: "bg-amber-500/10",
                    },
                ]}
            />

            <Card className="border shadow-xs">
                <CardHeader className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 space-y-1">
                        <CardTitle className="text-base font-semibold">
                            Account Summary (Trial Balance)
                        </CardTitle>
                        <CardDescription className="text-xs">
                            Complete summary across stock value, customer receivables, supplier bills, sales, and costs.
                        </CardDescription>
                    </div>
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="shrink-0 self-start sm:self-auto"
                        onClick={handleExportTrialBalance}
                    >
                        <Download className="mr-1.5 size-4" />
                        Export Account Summary
                    </Button>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow>
                                <TableHead className="w-24">Code</TableHead>
                                <TableHead>Account</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead className="hidden lg:table-cell">What It Tracks</TableHead>
                                <TableHead className="text-right">Debit ({currency})</TableHead>
                                <TableHead className="text-right">Credit ({currency})</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {trialBalance.accounts.map((acc) => (
                                <TableRow key={acc.accountCode}>
                                    <TableCell className="font-mono text-xs font-semibold">
                                        {acc.accountCode}
                                    </TableCell>
                                    <TableCell className="font-medium">{acc.accountName}</TableCell>
                                    <TableCell>
                                        <Badge variant={accountTypeVariant(acc.accountType)}>
                                            {acc.accountType}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="hidden text-xs text-muted-foreground lg:table-cell">
                                        {acc.sourceNote}
                                    </TableCell>
                                    <TableCell className="text-right font-mono tabular-nums">
                                        {Number(acc.debit) > 0 ? formatCurrency(acc.debit, currency) : "—"}
                                    </TableCell>
                                    <TableCell className="text-right font-mono tabular-nums">
                                        {Number(acc.credit) > 0 ? formatCurrency(acc.credit, currency) : "—"}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                        <TableFooter>
                            <TableRow>
                                <TableCell colSpan={3} className="font-semibold">
                                    Totals ({trialBalance.isBalanced ? "Books Balanced" : "Check Entries"})
                                </TableCell>
                                <TableCell className="hidden lg:table-cell" />
                                <TableCell className="text-right font-mono font-bold tabular-nums">
                                    {formatCurrency(trialBalance.totalDebits, currency)}
                                </TableCell>
                                <TableCell className="text-right font-mono font-bold tabular-nums">
                                    {formatCurrency(trialBalance.totalCredits, currency)}
                                </TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>
                </CardContent>
            </Card>

            <Card className="border shadow-xs">
                <CardHeader className="gap-3 border-b pb-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                            <CardTitle className="text-base font-semibold">
                                Cost &amp; Transaction History
                            </CardTitle>
                            <CardDescription className="text-xs">
                                Every stock receipt, packing run, customer delivery, adjustment, and scrap event with cost impact.
                            </CardDescription>
                        </div>
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="shrink-0 self-start sm:self-auto"
                            onClick={handleExportJournals}
                            disabled={filteredJournals.length === 0}
                        >
                            <Download className="mr-1.5 size-4" />
                            Export History CSV
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
                                placeholder="Search entry, SKU, batch, account..."
                                className="h-8 pl-8 text-xs"
                            />
                        </div>
                        <div className="w-full sm:w-44">
                            <ComboboxSelect
                                items={movementFilterItems}
                                value={movementFilter}
                                onValueChange={(v) => {
                                    setMovementFilter(v ?? "all")
                                    setPageIndex(0)
                                }}
                                placeholder="Activity type"
                                className="w-full"
                            />
                        </div>
                        <div className="w-full sm:w-60">
                            <ComboboxSelect
                                items={accountFilterItems}
                                value={accountFilter}
                                onValueChange={(v) => {
                                    setAccountFilter(v ?? "all")
                                    setPageIndex(0)
                                }}
                                placeholder="Account"
                                className="w-full"
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow>
                                <TableHead>Entry / Date</TableHead>
                                <TableHead>Activity &amp; Reference</TableHead>
                                <TableHead>Product &amp; Batch</TableHead>
                                <TableHead>Debit Account</TableHead>
                                <TableHead>Credit Account</TableHead>
                                <TableHead className="text-right">Qty</TableHead>
                                <TableHead className="text-right">Amount ({currency})</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredJournals.slice(sliceStart, sliceEnd).map((row) => (
                                <TableRow key={row.transactionId}>
                                    <TableCell>
                                        <div className="font-mono text-xs font-semibold">
                                            {row.journalNumber}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            {formatDate(row.createdAt)}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline">{row.transactionType}</Badge>
                                        <div className="mt-0.5 text-xs text-muted-foreground">
                                            {row.referenceId ?? row.memo}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="font-medium">
                                            {row.itemSku} — {row.itemName}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            Batch {row.lotNumber} · {row.locationName}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="text-xs font-medium">
                                            {row.debitAccountCode} · {row.debitAccountName}
                                        </div>
                                        <div className="text-[11px] text-muted-foreground">Debit</div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="text-xs font-medium">
                                            {row.creditAccountCode} · {row.creditAccountName}
                                        </div>
                                        <div className="text-[11px] text-muted-foreground">Credit</div>
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">
                                        {formatQuantity(row.qtyChange)} {row.primaryUomName}
                                    </TableCell>
                                    <TableCell className="text-right font-mono font-semibold tabular-nums">
                                        <div>{formatCurrency(row.amount, currency)}</div>
                                        <div className="text-[11px] font-normal text-muted-foreground">
                                            @ {formatCurrency(row.effectiveUnitCost, currency)}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {filteredJournals.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                                        No matching transaction entries found.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                    <AccountingPagination
                        totalRows={filteredJournals.length}
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
