"use client"

import dynamic from "next/dynamic"

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
            <div className="grid gap-4 sm:gap-5 @4xl/main:grid-cols-2 [&>*]:min-w-0">
                <Skeleton className="h-80 rounded-xl" />
                <Skeleton className="h-80 rounded-xl" />
                <Skeleton className="h-80 rounded-xl" />
                <Skeleton className="h-80 rounded-xl" />
            </div>
        ),
    },
)

export default function AccountingPage() {
    return (
        <>
            <title>Dashboard | Accounting Portal</title>
            <meta
                name="description"
                content="Clean financial overview with 4 headline KPIs and 4 interactive charts covering sales, expenses, profit, stock value, customers, and supplier bills."
            />
            <AccountingShell
                title="Accounting Dashboard"
                description="Clean financial overview of sales, expenses, net profit, stock value, customers, and supplier bills."
            >
                {(overview) => (
                    <>
                        <AccountingStatistics overview={overview} />
                        <AccountingCharts overview={overview} />
                    </>
                )}
            </AccountingShell>
        </>
    )
}
