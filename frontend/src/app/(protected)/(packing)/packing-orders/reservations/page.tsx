"use client"

import Link from "next/link"
import { PageHeader } from "@/components/shared/page-header"
import { ReservationStatistics } from "@/components/modules/packing-orders/packing-order-statistics"
import { ReservationTable } from "@/components/modules/packing-orders/packing-order-table"
import { PackingOrderDetail } from "@/components/modules/packing-orders/packing-order-detail"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { usePackingOrders } from "@/hooks/modules/packing-orders/use-packing-orders"

export default function PackingReservationsPage() {
    const feature = usePackingOrders(true)
    return (
        <>
            <title>Material Reservations</title>
            <meta
                name="description"
                content="Track material reservations by packing order, lot and location."
            />
            <PageHeader
                title="Material Reservations"
                description="Track protected stock, consumed quantities and released reservations by lot."
                actions={
                    <Button
                        className="h-10"
                        variant="outline"
                        render={<Link href="/packing-orders" />}
                        nativeButton={false}
                    >
                        Packing orders
                    </Button>
                }
            />
            {feature.loadStatus === "signed-out" && (
                <Alert>
                    <AlertTitle>Sign in to view reservations</AlertTitle>
                    <AlertDescription>
                        <Button className="mt-2" render={<Link href="/" />} nativeButton={false}>
                            Sign in
                        </Button>
                    </AlertDescription>
                </Alert>
            )}
            {feature.loadError && feature.loadStatus !== "signed-out" && (
                <Alert variant="destructive">
                    <AlertTitle>Unable to refresh reservations</AlertTitle>
                    <AlertDescription>
                        {feature.loadError.message}
                        <Button
                            variant="outline"
                            className="mt-2"
                            disabled={feature.isFetching}
                            onClick={feature.retry}
                        >
                            Retry loading
                        </Button>
                    </AlertDescription>
                </Alert>
            )}
            {feature.loadStatus === "loading" && (
                <div className="space-y-4" aria-busy="true" aria-label="Loading reservations">
                    <div className="grid gap-4 sm:grid-cols-3">
                        {[0, 1, 2].map((row) => (
                            <Skeleton key={row} className="h-28 rounded-xl" />
                        ))}
                    </div>
                    <Skeleton className="h-96 rounded-xl" />
                </div>
            )}
            {feature.loadStatus === "ready" && (
                <>
                    <ReservationStatistics reservations={feature.reservations} />
                    <ReservationTable
                        reservations={feature.reservations}
                        onView={feature.setDetailId}
                    />
                </>
            )}
            <PackingOrderDetail
                open={feature.detailId !== null}
                onOpenChange={(open) => {
                    if (!open) feature.setDetailId(null)
                }}
                order={feature.detail}
                loading={feature.detailLoading}
                error={feature.detailError}
                retry={feature.retryDetail}
                canManage={false}
                busy={false}
                onEdit={feature.openEdit}
                onAction={feature.openAction}
            />
        </>
    )
}
