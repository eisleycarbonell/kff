"use client"

import Link from "next/link"
import { PageHeader } from "@/components/shared/page-header"
import { InventoryMovementTable } from "@/components/modules/inventory-movements/inventory-movement-table"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useInventoryMovements } from "@/hooks/modules/inventory-movements/use-inventory-movements"

export default function StockMovementsPage() {
    const feature = useInventoryMovements()
    return (
        <>
            <title>Stock Movements</title>
            <meta
                name="description"
                content="Review the append-only inventory transaction ledger."
            />
            <PageHeader
                title="Stock Movements"
                description="Trace receiving, packing, transfers, scrap, and adjustments by item, lot, and location."
                actions={
                    <Button
                        variant="outline"
                        className="h-10"
                        onClick={feature.retry}
                        disabled={feature.isFetching}
                    >
                        Refresh
                    </Button>
                }
            />
            {feature.loadStatus === "signed-out" && (
                <Alert>
                    <AlertTitle>Sign in to view stock movements</AlertTitle>
                    <AlertDescription>
                        <Button className="mt-2" render={<Link href="/" />} nativeButton={false}>
                            Sign in
                        </Button>
                    </AlertDescription>
                </Alert>
            )}
            {feature.loadError && feature.loadStatus !== "signed-out" && (
                <Alert variant="destructive">
                    <AlertTitle>Unable to load stock movements</AlertTitle>
                    <AlertDescription>
                        {feature.loadError.message}
                        <Button
                            variant="outline"
                            className="mt-2"
                            onClick={feature.retry}
                            disabled={feature.isFetching}
                        >
                            Retry loading
                        </Button>
                    </AlertDescription>
                </Alert>
            )}
            {feature.loadStatus === "loading" && (
                <Skeleton className="h-96 rounded-xl" aria-label="Loading stock movements" />
            )}
            {feature.loadStatus === "ready" && (
                <InventoryMovementTable movements={feature.movements} />
            )}
        </>
    )
}
