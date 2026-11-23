"use client"

import { useDeferredValue, useMemo, useState } from "react"
import { BookOpenCheck, CheckCircle2, Download, FileSpreadsheet, Scale, Search } from "lucide-react"
import {
    computeJournalEntries,
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

    const [searchInput, setSearchInput] = useState("")
    const deferredSearch = useDeferredValue(searchInput.trim().toLowerCase())
    const [movementFilter, setMovementFilter] = useState("all")
    const [accountFilter, setAccountFilter] = useState("all")
    const [pageIndex, setPageIndex] = useState(0)
    const [pageSize, setPageSize] = useState(10)

    const movementFilterItems = useMemo(
        () => [
            { value: "all", label: "All movement types" },
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
            { value: "all", label: "All GL accounts" },
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

    function handleExportTrialBalance() {
        downloadCsv("accounting-trial-balance.csv", [
            ["Account Code", "Account Name", "Type", "Normal Balance", "Debit", "Credit", "Net Balance", "Currency", "Source"],
            ...trialBalance.accounts.map((acc) => [
                acc.accountCode,
                acc.accountName,
                acc.accountType,
                acc.normalBalance,
                acc.debit,
                acc.credit,
                acc.netBalance,
                currency,
                acc.sourceNote,
            ]),
            ["TOTAL", "Trial Balance Totals", "", "", trialBalance.totalDebits, trialBalance.totalCredits, trialBalance.difference, currency, trialBalance.isBalanced ? "Balanced" : "Out of balance"],
        ])
    }

    function handleExportJournals() {
        downloadCsv("accounting-general-ledger-journals.csv", [
            [
                "Journal #",
                "Timestamp",
                "Movement Type",
                "Reference",
                "Item SKU",
                "Item Name",
                "Lot Number",
                "Location",
                "Qty Change",
                "UOM",
                "Unit Cost",
                "Debit Account",
                "Credit Account",
                "Amount",
                "Currency",
                "Authorized By",
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

    return (
        <div className="space-y-6">
            <AccountingKpiStrip
                cards={[
                    {
                        title: "Total Debits (Trial Balance)",
                        value: formatCurrency(trialBalance.totalDebits, currency),
                        badge: `${trialBalance.accounts.length} GL accounts`,
                        helper: "Sum of asset & expense debit balances across chart of accounts.",
                        icon: Scale,
                        color: "text-primary",
                        bg: "bg-primary/10",
                    },
                    {
                        title: "Total Credits (Trial Balance)",
                        value: formatCurrency(trialBalance.totalCredits, currency),
                        badge: trialBalance.isBalanced ? "Balanced" : "Variance",
                        helper: "Sum of liability, equity clearing & recognized revenue credits.",
                        icon: CheckCircle2,
                        color: "text-emerald-600 dark:text-emerald-400",
                        bg: "bg-emerald-500/10",
                    },
                    {
                        title: "Trial Balance Difference",
                        value: formatCurrency(trialBalance.difference, currency),
                        badge: trialBalance.isBalanced ? "Exact 0.00" : "Check entries",
                        helper: "Assets + Expenses equal Liabilities + Equity + Revenue.",
                        icon: BookOpenCheck,
                        color: "text-sky-600 dark:text-sky-400",
                        bg: "bg-sky-500/10",
                    },
                    {
                        title: "Double-Entry Journals",
                        value: String(journals.length),
                        badge: `${filteredJournals.length} matching`,
                        helper: "Costed stock events posted with debit & credit accounts.",
                        icon: FileSpreadsheet,
                        color: "text-amber-600 dark:text-amber-400",
                        bg: "bg-amber-500/10",
                    },
                ]}
            />

            <Card className="border shadow-xs">
                <CardHeader className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                        <CardTitle className="text-base font-semibold">
                            Chart of Accounts &amp; Trial Balance
                        </CardTitle>
                        <CardDescription className="text-xs">
                            Live summary general ledger across Inventory Assets, AP Clearing, Equity Clearing, Revenue, COGS, and Variances.
                        </CardDescription>
                    </div>
                    <Button type="button" size="sm" variant="outline" onClick={handleExportTrialBalance}>
                        <Download className="mr-1.5 size-4" />
                        Export Trial Balance
                    </Button>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow>
                                <TableHead className="w-24">Code</TableHead>
                                <TableHead>Account Title</TableHead>
                                <TableHead>Class</TableHead>
                                <TableHead className="hidden lg:table-cell">Operational Source</TableHead>
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
                                <TableCell colSpan={4} className="font-semibold">
                                    Trial Balance Totals ({trialBalance.isBalanced ? "In Balance" : "Out of Balance"})
                                </TableCell>
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
                        <div>
                            <CardTitle className="text-base font-semibold">
                                Double-Entry Journal &amp; Cost Ledger
                            </CardTitle>
                            <CardDescription className="text-xs">
                                Every inventory receipt, packing consumption, finished output, transfer, delivery COGS, adjustment, and scrap posting with paired debit/credit accounts.
                            </CardDescription>
                        </div>
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={handleExportJournals}
                            disabled={filteredJournals.length === 0}
                        >
                            <Download className="mr-1.5 size-4" />
                            Export Journals CSV
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
                                placeholder="Search journal, SKU, lot, account..."
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
                                placeholder="Movement type"
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
                                placeholder="GL Account"
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow>
                                <TableHead>Journal / Date</TableHead>
                                <TableHead>Event &amp; Reference</TableHead>
                                <TableHead>Item &amp; Lot</TableHead>
                                <TableHead>Debit Account</TableHead>
                                <TableHead>Credit Account</TableHead>
                                <TableHead className="text-right">Qty</TableHead>
                                <TableHead className="text-right">Debit / Credit ({currency})</TableHead>
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
                                            Lot {row.lotNumber} · {row.locationName}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="text-xs font-medium">
                                            {row.debitAccountCode} · {row.debitAccountName}
                                        </div>
                                        <div className="text-[11px] text-muted-foreground">Dr</div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="text-xs font-medium">
                                            {row.creditAccountCode} · {row.creditAccountName}
                                        </div>
                                        <div className="text-[11px] text-muted-foreground">Cr</div>
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
                                        No matching double-entry journal records found.
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
