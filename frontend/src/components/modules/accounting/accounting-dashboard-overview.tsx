"use client"

import { useMemo } from "react"
import Link from "next/link"
import {
    AlertCircle,
    ArrowUpRight,
    Boxes,
    CheckCircle2,
    Factory,
    FileSpreadsheet,
    Landmark,
    Receipt,
    Wallet,
} from "lucide-react"
import {
    computeSimpleAccountingSummary,
    computeTrialBalance,
} from "@/components/modules/accounting/accounting-engine"
import {
    formatCurrency,
    type AccountingFilters,
    type AccountingOverview,
} from "@/components/modules/accounting/accounting.schema"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { useCompanySettings } from "@/hooks/modules/company-settings/use-company-settings"
import { useSession } from "@/hooks/use-session"

export function AccountingDashboardOverview({
    overview,
    filters,
}: {
    overview: AccountingOverview
    filters: AccountingFilters
}) {
    const session = useSession()
    const company = useCompanySettings()
    const currency = overview.currencyCode

    const trialBalance = useMemo(() => computeTrialBalance(overview), [overview])
    const simple = useMemo(() => computeSimpleAccountingSummary(overview), [overview])

    const periodLabel =
        filters.fromDate || filters.toDate
            ? `Showing records from ${filters.fromDate || "the start"} to ${filters.toDate || "today"}`
            : "Showing all-time sales, expenses, bills, and current stock value"

    const quickModules = [
        {
            title: "Sales & Invoices",
            href: "/accounting/receivables-margins",
            metric: formatCurrency(simple.totalSales, currency),
            detail: `${simple.activeCustomersCount} customer(s) · ${simple.invoicedOrdersCount} billed`,
            icon: Receipt,
            accent: "text-teal-600 dark:text-teal-400",
            badgeBg: "bg-teal-500/10",
        },
        {
            title: "Expenses & Bills",
            href: "/accounting/payables",
            metric: formatCurrency(simple.totalExpenses, currency),
            detail: `${simple.activeSuppliersCount} supplier(s) · ${formatCurrency(simple.totalSupplierBills, currency)} bills`,
            icon: Wallet,
            accent: "text-indigo-600 dark:text-indigo-400",
            badgeBg: "bg-indigo-500/10",
        },
        {
            title: "Financial Reports",
            href: "/accounting/general-ledger",
            metric: `${overview.costLedger.length.toLocaleString()} entries`,
            detail: trialBalance.isBalanced
                ? "Ready for CSV export · Balanced"
                : "Review account totals",
            icon: FileSpreadsheet,
            accent: "text-emerald-600 dark:text-emerald-400",
            badgeBg: "bg-emerald-500/10",
        },
        {
            title: "Stock Value",
            href: "/accounting/valuation",
            metric: formatCurrency(overview.summary.totalInventoryAssetValue, currency),
            detail: `${overview.lotCosting.length.toLocaleString()} batches on hand`,
            icon: Boxes,
            accent: "text-sky-600 dark:text-sky-400",
            badgeBg: "bg-sky-500/10",
        },
        {
            title: "Production Costs",
            href: "/accounting/production-costing",
            metric: formatCurrency(overview.summary.totalProductionCost, currency),
            detail: `${overview.packingCosting.length.toLocaleString()} packing runs`,
            icon: Factory,
            accent: "text-amber-600 dark:text-amber-400",
            badgeBg: "bg-amber-500/10",
        },
    ] as const

    const greetingName = session.data?.firstName?.trim() || "Accountant"
    const companyName = company.settings?.companyName ?? "Kusina Filipino Food"

    return (
        <section className="space-y-3.5" aria-label="Accounting portal overview">
            <Card className="border-emerald-500/25 bg-gradient-to-br from-emerald-500/10 via-card to-card py-0 shadow-xs">
                <CardContent className="flex flex-col gap-3 p-4 @3xl/main:flex-row @3xl/main:items-center @3xl/main:justify-between">
                    <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                            <span className="inline-flex items-center gap-1.5">
                                <Landmark className="size-3.5 shrink-0" />
                                <span>Accounting Portal</span>
                            </span>
                            <span aria-hidden="true" className="text-muted-foreground">
                                /
                            </span>
                            <span className="truncate text-muted-foreground">{companyName}</span>
                        </div>
                        <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
                            Welcome back, {greetingName}
                        </h2>
                        <p className="text-xs text-muted-foreground">{periodLabel}</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <Badge
                            variant="outline"
                            className={
                                trialBalance.isBalanced
                                    ? "gap-1.5 border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                    : "gap-1.5 border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                            }
                        >
                            {trialBalance.isBalanced ? (
                                <CheckCircle2 className="size-3.5 shrink-0" />
                            ) : (
                                <AlertCircle className="size-3.5 shrink-0" />
                            )}
                            <span>
                                {trialBalance.isBalanced ? "Books Balanced" : "Check Account Totals"}
                            </span>
                        </Badge>
                        <Badge variant="secondary" className="tabular-nums">
                            Currency: {currency}
                        </Badge>
                        {overview.summary.netVatPayable && (
                            <Badge variant="secondary" className="tabular-nums">
                                Net VAT to Pay:{" "}
                                {formatCurrency(overview.summary.netVatPayable, currency)}
                            </Badge>
                        )}
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-3 @lg/main:grid-cols-2 @5xl/main:grid-cols-5">
                {quickModules.map((mod) => {
                    const Icon = mod.icon
                    return (
                        <Link
                            key={mod.href}
                            href={mod.href}
                            className="group block min-w-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            <Card className="h-full border py-0 shadow-xs transition-colors group-hover:border-emerald-500/50 group-hover:bg-accent/30">
                                <CardContent className="flex h-full flex-col justify-between gap-2.5 p-3.5">
                                    <div className="flex items-start justify-between gap-2">
                                        <div
                                            className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${mod.badgeBg}`}
                                        >
                                            <Icon className={`size-4 ${mod.accent}`} />
                                        </div>
                                        <ArrowUpRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground" />
                                    </div>
                                    <div className="min-w-0 space-y-0.5">
                                        <p className="truncate text-xs font-medium text-muted-foreground">
                                            {mod.title}
                                        </p>
                                        <p className="break-words text-base font-bold tracking-tight text-foreground tabular-nums">
                                            {mod.metric}
                                        </p>
                                        <p className="truncate text-[11px] text-muted-foreground">
                                            {mod.detail}
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>
                        </Link>
                    )
                })}
            </div>
        </section>
    )
}
