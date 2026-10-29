"use client"
import dynamic from "next/dynamic"
import Link from "next/link"
import { ClipboardPenLine, RefreshCw } from "lucide-react"
import { PageHeader } from "@/components/shared/page-header"
import { StockStatistics } from "@/components/modules/inventory-stocks/inventory-stock-statistics"
import { StockTable } from "@/components/modules/inventory-stocks/inventory-stock-table"
import { useInventoryStocks } from "@/hooks/modules/inventory-stocks/use-inventory-stocks"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
const StockAdjustmentForm = dynamic(() =>
    import("@/components/modules/inventory-stocks/inventory-stock-form").then(
        (module) => module.StockAdjustmentForm,
    ),
)
export default function InventoryPage() {
    const inventory = useInventoryStocks()
    const missingSetup = inventory.options
        ? [
              !inventory.options.lots.length && "lots",
              !inventory.options.locations.length && "locations",
              !inventory.options.reasons.length && "inventory adjustment reasons",
          ]
              .filter(Boolean)
              .join(", ")
        : ""
    return (
        <>
            <title>Inventory Stocks</title>
            <meta
                name="description"
                content="Track on-hand, reserved, and available quantities by item, lot, and location."
            />
            <PageHeader
                title="Inventory Stocks"
                description="Track on-hand, reserved, and available stock by item, lot, and location."
                actions={
                    <div className="flex flex-wrap gap-3">
                        <Button
                            variant="outline"
                            className="h-10"
                            onClick={inventory.retry}
                            disabled={inventory.isFetching}
                        >
                            <RefreshCw data-icon="inline-start" />
                            {inventory.isFetching ? "Refreshing..." : "Refresh"}
                        </Button>
                        {inventory.canManage && (
                            <Button
                                className="h-10"
                                onClick={() => inventory.openAdjustment()}
                                disabled={!inventory.canAdjust}
                            >
                                <ClipboardPenLine data-icon="inline-start" />
                                Record adjustment
                            </Button>
                        )}
                    </div>
                }
            />
            {inventory.loadStatus === "signed-out" && (
                <Alert>
                    <AlertTitle>Sign in to view inventory stocks</AlertTitle>
                    <AlertDescription>
                        <Button className="mt-2" render={<Link href="/" />} nativeButton={false}>
                            Sign in
                        </Button>
                    </AlertDescription>
                </Alert>
            )}
            {inventory.loadStatus === "loading" && (
                <div
                    className="flex flex-col gap-4"
                    aria-busy="true"
                    aria-label="Loading inventory stocks"
                >
                    <div className="grid gap-4 sm:grid-cols-3">
                        {[0, 1, 2].map((index) => (
                            <Skeleton key={index} className="h-40 rounded-xl" />
                        ))}
                    </div>
                    <Skeleton className="h-96 rounded-xl" />
                </div>
            )}
            {inventory.loadError && inventory.loadStatus !== "signed-out" && (
                <Alert variant="destructive">
                    <AlertTitle>Unable to refresh stock data</AlertTitle>
                    <AlertDescription>
                        <p>{inventory.loadError.message}</p>
                        <Button
                            variant="outline"
                            className="mt-3"
                            onClick={inventory.retry}
                            disabled={inventory.isFetching}
                        >
                            Retry loading
                        </Button>
                    </AlertDescription>
                </Alert>
            )}
            {inventory.loadStatus === "ready" && (
                <>
                    {!inventory.canManage && (
                        <Alert>
                            <AlertTitle>View-only stock access</AlertTitle>
                            <AlertDescription>
                                Your role can view and export stock. Inventory managers can record
                                adjustments.
                            </AlertDescription>
                        </Alert>
                    )}
                    {missingSetup && (
                        <Alert>
                            <AlertTitle>Adjustment setup required</AlertTitle>
                            <AlertDescription>
                                Configure {missingSetup} before recording a stock adjustment.
                            </AlertDescription>
                        </Alert>
                    )}
                    <StockStatistics stocks={inventory.stocks} />
                    <StockTable
                        stocks={inventory.stocks}
                        canManage={inventory.canAdjust}
                        onAdjust={inventory.openAdjustment}
                        onRecord={() => inventory.openAdjustment()}
                    />
                </>
            )}
            {inventory.formRequested && inventory.options && (
                <StockAdjustmentForm
                    open={inventory.formOpen && inventory.canManage}
                    onOpenChange={inventory.setFormOpen}
                    stock={inventory.selectedStock}
                    stocks={inventory.stocks}
                    options={inventory.options}
                    isSaving={inventory.isSaving}
                    saveError={inventory.saveError}
                    onSave={inventory.handleSave}
                />
            )}
        </>
    )
}
