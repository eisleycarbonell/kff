"use client"

import Link from "next/link"
import { RefreshCw } from "lucide-react"

import { DashboardActiveOrders } from "@/components/modules/dashboard/dashboard-active-orders"
import { DashboardAlerts } from "@/components/modules/dashboard/dashboard-alerts"
import { DashboardOverviewCards } from "@/components/modules/dashboard/dashboard-overview-cards"
import { DashboardQuickActions } from "@/components/modules/dashboard/dashboard-quick-actions"
import { DashboardRecentActivityCard } from "@/components/modules/dashboard/dashboard-recent-activity"
import { DashboardStockDistribution } from "@/components/modules/dashboard/dashboard-stock-distribution"
import { DashboardTransfersCard } from "@/components/modules/dashboard/dashboard-transfers-card"
import { PageHeader } from "@/components/shared/page-header"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useDashboard } from "@/hooks/modules/dashboard/use-dashboard"

export default function DashboardPage() {
    const {
        summary,
        stockByType,
        stockByLocation,
        activePackingOrders,
        pendingPurchaseOrders,
        activeTransfers,
        expiringLots,
        lowStockItems,
        recentActivity,
        loadStatus,
        loadError,
        isFetching,
        retry,
        refetch,
    } = useDashboard()

    return (
        <div className="space-y-6">
            <title>Dashboard - Spice Trading & Packing System</title>
            <meta
                name="description"
                content="High-level operational overview of inventory, packing orders, purchase orders, transfers, and stock alerts."
            />

            <PageHeader
                title="Dashboard"
                description="High-level operational overview of spice stock levels, active production runs, open procurement, and alerts."
                actions={
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-9 gap-2 text-xs font-medium"
                        onClick={() => void refetch()}
                        disabled={isFetching}
                    >
                        <RefreshCw className={`size-3.5 ${isFetching ? "animate-spin text-primary" : ""}`} />
                        {isFetching ? "Refreshing..." : "Refresh"}
                    </Button>
                }
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
                    <AlertDescription className="mt-2 flex items-center justify-between">
                        <span>{loadError?.message ?? "An unexpected error occurred."}</span>
                        <Button variant="outline" size="sm" onClick={retry} disabled={isFetching}>
                            Retry
                        </Button>
                    </AlertDescription>
                </Alert>
            )}

            {loadStatus === "loading" && (
                <div className="space-y-6" aria-busy="true" aria-label="Loading dashboard metrics">
                    <Skeleton className="h-16 w-full rounded-xl" />
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {[0, 1, 2, 3, 4, 5, 6, 7].map((index) => (
                            <Skeleton key={index} className="h-32 rounded-xl" />
                        ))}
                    </div>
                    <div className="grid gap-6 lg:grid-cols-2">
                        <Skeleton className="h-96 rounded-xl" />
                        <Skeleton className="h-96 rounded-xl" />
                    </div>
                    <div className="grid gap-6 lg:grid-cols-2">
                        <Skeleton className="h-80 rounded-xl" />
                        <Skeleton className="h-80 rounded-xl" />
                    </div>
                    <Skeleton className="h-64 rounded-xl" />
                </div>
            )}

            {loadStatus === "ready" && (
                <div className="space-y-6">
                    {/* Quick Operation Triggers */}
                    <DashboardQuickActions />

                    {/* Operational KPI Metric Cards */}
                    <DashboardOverviewCards summary={summary} />

                    {/* Mid Section: Stock Distribution & Active Orders */}
                    <div className="grid gap-6 lg:grid-cols-2">
                        <DashboardStockDistribution
                            stockByType={stockByType}
                            stockByLocation={stockByLocation}
                        />
                        <DashboardActiveOrders
                            packingOrders={activePackingOrders}
                            purchaseOrders={pendingPurchaseOrders}
                        />
                    </div>

                    {/* Lower Section: Inventory Alerts & In-Transit Transfers */}
                    <div className="grid gap-6 lg:grid-cols-2">
                        <DashboardAlerts
                            expiringLots={expiringLots}
                            lowStockItems={lowStockItems}
                        />
                        <DashboardTransfersCard transfers={activeTransfers} />
                    </div>

                    {/* Bottom: Real-Time Ledger Feed */}
                    <DashboardRecentActivityCard activity={recentActivity} />
                </div>
            )}
        </div>
    )
}