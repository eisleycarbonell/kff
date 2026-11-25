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
            code: "SALES",
            label: "Total Sales (Completed Deliveries)",
            note: "Income earned from customer orders already delivered",
            amount: formatCurrency(pnl.recognizedRevenue, currency),
            rawAmount: pnl.recognizedRevenue,
            emphasis: "strong",
        },
        {
            code: "COGS",
            label: "Less: Cost of Products Sold",
            note: "Actual batch cost of finished spices delivered",
            amount: `(${formatCurrency(pnl.deliveredCogs, currency)})`,
            rawAmount: `-${pnl.deliveredCogs}`,
            emphasis: "normal",
        },
        {
            code: "GP",
            label: "Gross Profit",
            note:
                pnl.grossMarginPercent !== null
                    ? `${pnl.grossMarginPercent}% profit before scrap & adjustments`
                    : "No completed sales yet",
            amount: formatCurrency(pnl.grossProfit, currency),
            rawAmount: pnl.grossProfit,
            emphasis: "subtotal",
        },
        {
            code: "SCRAP",
            label: "Less: Damaged & Scrap Stock",
            note: "Value of expired, spoiled, or disposed inventory",
            amount: `(${formatCurrency(pnl.scrapLoss, currency)})`,
            rawAmount: `-${pnl.scrapLoss}`,
            emphasis: "normal",
        },
        {
            code: "ADJ",
            label: "Stock Count Adjustments",
            note: "Difference found during physical inventory counts",
            amount: formatSignedCurrency(pnl.adjustmentVarianceNet, currency),
            rawAmount: pnl.adjustmentVarianceNet,
            emphasis: "normal",
        },
        {
            code: "PROFIT",
            label: "Net Profit",
            note:
                pnl.netOperatingMarginPercent !== null
                    ? `${pnl.netOperatingMarginPercent}% net profit margin`
                    : "Total sales minus total expenses",
            amount: formatCurrency(pnl.netOperatingIncome, currency),
            rawAmount: pnl.netOperatingIncome,
            emphasis: "total",
        },
        {
            code: "OPEN",
            label: "Reference: Pending Orders (Not Yet Delivered)",
            note: `Total ordered ${formatCurrency(pnl.bookedSales, currency)} still waiting for delivery`,
            amount: formatCurrency(pnl.unfulfilledBacklog, currency),
            rawAmount: pnl.unfulfilledBacklog,
            emphasis: "muted",
        },
    ] as const

    function handleExportStatement() {
        downloadCsv("profit-and-loss-summary.csv", [
            ["Category", "Line Item", "Amount", "Currency", "Notes"],
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
                <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <FileSpreadsheet className="size-4 shrink-0 text-primary" />
                        <CardTitle className="text-base font-semibold">
                            Profit &amp; Loss Summary
                        </CardTitle>
                        <Badge variant="secondary" className="text-[10px]">
                            Period Summary
                        </Badge>
                    </div>
                    <CardDescription className="text-xs">
                        Shows how Total Sales minus product costs and stock losses equals your Net Profit.
                    </CardDescription>
                </div>
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="shrink-0 self-start sm:self-auto"
                    onClick={handleExportStatement}
                >
                    <Download className="mr-1.5 size-4" />
                    Export Profit &amp; Loss CSV
                </Button>
            </CardHeader>
            <CardContent className="p-0">
                <Table>
                    <TableHeader className="bg-muted/50">
                        <TableRow>
                            <TableHead>Item</TableHead>
                            <TableHead className="hidden md:table-cell">How It Is Calculated</TableHead>
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
                    <div className="grid grid-cols-1 gap-2 border-t bg-muted/20 p-3 text-xs sm:p-4 @2xl/main:grid-cols-3">
                        <div className="rounded-md border bg-background px-3 py-2">
                            <span className="text-muted-foreground">VAT Collected from Sales</span>
                            <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums">
                                {formatCurrency(overview.summary.totalOutputVat ?? "0", currency)}
                            </p>
                        </div>
                        <div className="rounded-md border bg-background px-3 py-2">
                            <span className="text-muted-foreground">VAT Paid on Purchases</span>
                            <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums">
                                {formatCurrency(overview.summary.totalInputVat ?? "0", currency)}
                            </p>
                        </div>
                        <div className="rounded-md border bg-background px-3 py-2">
                            <span className="text-muted-foreground">
                                Net VAT {Number.parseFloat(overview.summary.netVatPayable ?? "0") >= 0 ? "to Pay" : "Credit Remaining"}
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
