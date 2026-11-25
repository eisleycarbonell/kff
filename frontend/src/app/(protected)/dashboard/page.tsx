"use client"

import dynamic from "next/dynamic"
import Link from "next/link"

import { DashboardOverviewCards } from "@/components/modules/dashboard/dashboard-overview-cards"
import { PageHeader } from "@/components/shared/page-header"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useDashboard } from "@/hooks/modules/dashboard/use-dashboard"

const DashboardCharts = dynamic(
    () =>
        import("@/components/modules/dashboard/dashboard-charts").then(
            (mod) => mod.DashboardCharts,
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

export default function DashboardPage() {
    const {
        summary,
        stockByType,
        stockByLocation,
        activePackingOrders,
        pendingPurchaseOrders,
        recentActivity,
        loadStatus,
        loadError,
        isFetching,
        retry,
    } = useDashboard()

    return (
        <div className="min-w-0 space-y-4 sm:space-y-5">
            <title>Dashboard - Spice Trading & Packing System</title>
            <meta
                name="description"
                content="Simple overview of inventory value, open orders, deliveries, alerts, and visual analytics."
            />

            <PageHeader
                title="Dashboard"
                description="Clean overview of stock value, active orders, logistics, alerts, and visual charts."
            />

            {loadStatus === "signed-out" && (
                <Alert>
                    <AlertTitle>Sign in to view operations</AlertTitle>
                    <AlertDescription className="mt-2">
                        <Button render={<Link href="/" />} nativeButton={false}>
                            Sign in
                        </Button>
                    </AlertDescription>
                </Alert>
            )}

            {loadStatus === "error" && (
                <Alert variant="destructive">
                    <AlertTitle>Unable to load dashboard metrics</AlertTitle>
                    <AlertDescription className="mt-2 flex flex-wrap items-center justify-between gap-2">
                        <span>{loadError?.message ?? "An unexpected error occurred."}</span>
                        <Button variant="outline" size="sm" onClick={retry} disabled={isFetching}>
                            Retry
                        </Button>
                    </AlertDescription>
                </Alert>
            )}

            {loadStatus === "loading" && (
                <div className="space-y-4" aria-busy="true" aria-label="Loading dashboard metrics">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 @5xl/main:grid-cols-4">
                        {[0, 1, 2, 3].map((index) => (
                            <Skeleton key={index} className="h-28 rounded-xl" />
                        ))}
                    </div>
                    <div className="grid gap-4 sm:gap-5 @4xl/main:grid-cols-2">
                        <Skeleton className="h-80 rounded-xl" />
                        <Skeleton className="h-80 rounded-xl" />
                        <Skeleton className="h-80 rounded-xl" />
                        <Skeleton className="h-80 rounded-xl" />
                    </div>
                </div>
            )}

            {loadStatus === "ready" && (
                <div className="min-w-0 space-y-4 sm:space-y-5">
                    <DashboardOverviewCards summary={summary} />

                    <DashboardCharts
                        summary={summary}
                        stockByType={stockByType}
                        stockByLocation={stockByLocation}
                        activePackingOrders={activePackingOrders}
                        pendingPurchaseOrders={pendingPurchaseOrders}
                        recentActivity={recentActivity}
                    />
                </div>
            )}
        </div>
    )
}
