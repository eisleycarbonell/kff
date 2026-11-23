"use client"

import { Download, FileSpreadsheet } from "lucide-react"
import { computeIncomeStatement } from "@/components/modules/accounting/accounting-engine"
import {
    formatCurrency,
    formatSignedCurrency,
    type AccountingOverview,
} from "@/components/modules/accounting/accounting.schema"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { downloadCsv } from "@/lib/csv"

export function AccountingPnlCard({ overview }: { overview: AccountingOverview }) {
    const currency = overview.currencyCode
    const pnl = computeIncomeStatement(overview)

    const statementLines = [
        {
            code: "4000",
            label: "Booked Sales Orders (Order Intake)",
            note: "Total value of non-cancelled Sales Orders in period",
            amount: formatCurrency(pnl.bookedSales, currency),
            rawAmount: pnl.bookedSales,
            emphasis: "muted",
        },
        {
            code: "4050",
            label: "Less: Undelivered Sales Backlog",
            note: "Confirmed or pending deliveries not yet shipped/completed",
            amount: `(${formatCurrency(pnl.unfulfilledBacklog, currency)})`,
            rawAmount: `-${pnl.unfulfilledBacklog}`,
            emphasis: "muted",
        },
        {
            code: "4100",
            label: "Recognized Sales Revenue (Completed Deliveries)",
            note: "Earned revenue from completed customer deliveries",
            amount: formatCurrency(pnl.recognizedRevenue, currency),
            rawAmount: pnl.recognizedRevenue,
            emphasis: "strong",
        },
        {
            code: "5100",
            label: "Less: Cost of Goods Sold (Batch COGS)",
            note: "Exact lot unit cost of finished goods shipped",
            amount: `(${formatCurrency(pnl.deliveredCogs, currency)})`,
            rawAmount: `-${pnl.deliveredCogs}`,
            emphasis: "normal",
        },
        {
            code: "GP",
            label: "Gross Profit",
            note:
                pnl.grossMarginPercent !== null
                    ? `${pnl.grossMarginPercent}% Gross Margin`
                    : "No recognized sales yet",
            amount: formatCurrency(pnl.grossProfit, currency),
            rawAmount: pnl.grossProfit,
            emphasis: "subtotal",
        },
        {
            code: "6100",
            label: "Less: Inventory Shrinkage & Scrap Loss",
            note: "Approved scrap & disposal write-offs at effective batch cost",
            amount: `(${formatCurrency(pnl.scrapLoss, currency)})`,
            rawAmount: `-${pnl.scrapLoss}`,
            emphasis: "normal",
        },
        {
            code: "6150",
            label: "Add / (Less): Physical Count Adjustment Variance",
            note: "Net stock value change from physical cycle count corrections",
            amount: formatSignedCurrency(pnl.adjustmentVarianceNet, currency),
            rawAmount: pnl.adjustmentVarianceNet,
            emphasis: "normal",
        },
        {
            code: "NOI",
            label: "Net Operating Contribution",
            note:
                pnl.netOperatingMarginPercent !== null
                    ? `${pnl.netOperatingMarginPercent}% Net Operating Margin`
                    : "Gross profit less inventory losses",
            amount: formatCurrency(pnl.netOperatingIncome, currency),
            rawAmount: pnl.netOperatingIncome,
            emphasis: "total",
        },
    ] as const

    function handleExportStatement() {
        downloadCsv("accounting-income-statement-pnl.csv", [
            ["Account", "Line Item", "Amount", "Currency", "Notes"],
            ...statementLines.map((line) => [
                line.code,
                line.label,
                line.rawAmount,
                currency,
                line.note,
            ]),
        ])
    }

    return (
        <Card className="border shadow-xs">
            <CardHeader className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <FileSpreadsheet className="size-4 text-primary" />
                        <CardTitle className="text-base font-semibold">
                            Income Statement (P&amp;L) &amp; Inventory Contribution
                        </CardTitle>
                        <Badge variant="secondary" className="text-[10px]">
                            Period Financial Statement
                        </Badge>
                    </div>
                    <CardDescription className="text-xs">
                        Reconciles delivered sales revenue, batch COGS, scrap losses, and count adjustments into Net Operating Contribution.
                    </CardDescription>
                </div>
                <Button type="button" size="sm" variant="outline" onClick={handleExportStatement}>
                    <Download className="mr-1.5 size-4" />
                    Export P&amp;L CSV
                </Button>
            </CardHeader>
            <CardContent className="p-0">
                <Table>
                    <TableHeader className="bg-muted/50">
                        <TableRow>
                            <TableHead className="w-24">Code</TableHead>
                            <TableHead>Statement Line Item</TableHead>
                            <TableHead className="hidden md:table-cell">Basis / Notes</TableHead>
                            <TableHead className="text-right">Amount ({currency})</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {statementLines.map((line) => {
                            const rowClass =
                                line.emphasis === "total"
                                    ? "bg-primary/5 font-semibold"
                                    : line.emphasis === "subtotal"
                                      ? "bg-muted/40 font-semibold"
                                      : line.emphasis === "strong"
                                        ? "font-medium"
                                        : ""
                            return (
                                <TableRow key={line.code} className={rowClass}>
                                    <TableCell className="font-mono text-xs text-muted-foreground">
                                        {line.code}
                                    </TableCell>
                                    <TableCell
                                        className={
                                            line.emphasis === "muted"
                                                ? "text-muted-foreground"
                                                : "text-foreground"
                                        }
                                    >
                                        {line.label}
                                    </TableCell>
                                    <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
                                        {line.note}
                                    </TableCell>
                                    <TableCell className="text-right font-mono tabular-nums">
                                        {line.amount}
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                </Table>
                {(overview.summary.totalOutputVat || overview.summary.totalInputVat) && (
                    <div className="grid grid-cols-1 gap-2 border-t bg-muted/20 p-4 text-xs sm:grid-cols-3">
                        <div className="rounded-md border bg-background px-3 py-2">
                            <span className="text-muted-foreground">Output VAT Payable (2200)</span>
                            <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums">
                                {formatCurrency(overview.summary.totalOutputVat ?? "0", currency)}
                            </p>
                        </div>
                        <div className="rounded-md border bg-background px-3 py-2">
                            <span className="text-muted-foreground">Input VAT Creditable (1150)</span>
                            <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums">
                                {formatCurrency(overview.summary.totalInputVat ?? "0", currency)}
                            </p>
                        </div>
                        <div className="rounded-md border bg-background px-3 py-2">
                            <span className="text-muted-foreground">
                                Net VAT {Number.parseFloat(overview.summary.netVatPayable ?? "0") >= 0 ? "Payable" : "Carryover Credit"}
                            </span>
                            <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums">
                                {formatCurrency(overview.summary.netVatPayable ?? "0", currency)}
                            </p>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
