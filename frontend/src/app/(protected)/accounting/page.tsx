"use client"

import dynamic from "next/dynamic"

import { AccountingGuideCard } from "@/components/modules/accounting/accounting-guide-card"
import { AccountingPnlCard } from "@/components/modules/accounting/accounting-pnl-card"
import { AccountingShell } from "@/components/modules/accounting/accounting-shell"
import { AccountingStatistics } from "@/components/modules/accounting/accounting-statistics"
import { Skeleton } from "@/components/ui/skeleton"

const AccountingCharts = dynamic(
    () =>
        import("@/components/modules/accounting/accounting-charts").then(
            (mod) => mod.AccountingCharts,
        ),
    {
        ssr: false,
        loading: () => (
            <div className="grid gap-6 lg:grid-cols-2">
                <Skeleton className="h-80 rounded-xl" />
                <Skeleton className="h-80 rounded-xl" />
            </div>
        ),
    },
)

export default function AccountingPage() {
    return (
        <>
            <title>Accounting Overview &amp; P&amp;L</title>
            <meta
                name="description"
                content="Financial overview, Profit & Loss income statement, inventory valuation, and cost flows."
            />
            <AccountingShell
                title="Accounting Overview & P&L"
                description="Review financial KPIs, period Profit & Loss income statement, working capital, and inventory cost flows."
            >
                {(overview) => (
                    <>
                        <AccountingGuideCard />
                        <AccountingStatistics summary={overview.summary} />
                        <AccountingPnlCard overview={overview} />
                        <AccountingCharts overview={overview} />
                    </>
                )}
            </AccountingShell>
        </>
    )
}
