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
    return (
        <>
            <title>Inventory Stock</title>
            <meta
                name="description"
                content="Track on-hand, reserved, and available quantities by item, lot, and location."
            />
            <PageHeader
                title="Inventory Stock"
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
                        <Button
                            className="mt-2"
                            render={<Link href="/" />}
                            nativeButton={false}
                        >
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
                                Your role can view and export stock. Inventory
                                managers can record adjustments.
                            </AlertDescription>
                        </Alert>
                    )}
                    <StockStatistics stocks={inventory.stocks} />
                    <details className="rounded-xl border bg-card p-5 text-sm">
                        <summary className="cursor-pointer rounded-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring">
                            Understand stock quantities and connected modules
                        </summary>
                        <div className="mt-4 space-y-4 text-muted-foreground">
                            <p>
                                <strong className="font-medium text-foreground">On hand</strong>{" "}
                                is the stock recorded at a location, including reserved goods.{" "}
                                <strong className="font-medium text-foreground">Reserved</strong>{" "}
                                is stock committed to packing or a dispatched customer delivery.{" "}
                                <strong className="font-medium text-foreground">Available</strong>{" "}
                                is on hand minus active reservations: 150 kg on hand minus
                                30 kg reserved leaves 120 kg available. Quality, expiry,
                                and location rules still apply before stock can be used.
                            </p>
                            <p>
                                Receiving adds purchased materials. Completing packing
                                consumes materials and adds finished goods. Transfers move
                                stock through In Transit; it remains company inventory
                                until a customer delivery is completed.
                            </p>
                            <dl className="grid gap-4 sm:grid-cols-2">
                                <div>
                                    <dt className="font-medium text-foreground">Inventory Stock</dt>
                                    <dd className="mt-1">Check current quantities for each item, lot, and location.</dd>
                                </div>
                                <div>
                                    <dt><Link href="/inventory/lots" className="font-medium text-foreground underline underline-offset-4">Lots / Batches</Link></dt>
                                    <dd className="mt-1">Trace stock to a purchase or packing order and inspect its locations.</dd>
                                </div>
                                <div>
                                    <dt><Link href="/inventory/transactions" className="font-medium text-foreground underline underline-offset-4">Stock Movements</Link></dt>
                                    <dd className="mt-1">See the history explaining every increase, decrease, and transfer.</dd>
                                </div>
                                <div>
                                    <dt><Link href="/inventory/adjustments" className="font-medium text-foreground underline underline-offset-4">Stock Adjustments</Link></dt>
                                    <dd className="mt-1">Correct a difference between recorded stock and the physical count, with a reason.</dd>
                                </div>
                                <div>
                                    <dt><Link href="/inventory/scrap" className="font-medium text-foreground underline underline-offset-4">Scrap &amp; Disposal</Link></dt>
                                    <dd className="mt-1">Record reviewed removal of damaged, expired, or unusable stock.</dd>
                                </div>
                            </dl>
                        </div>
                    </details>
                    <StockTable
                        stocks={inventory.stocks}
                        canManage={inventory.canAdjust}
                        onAdjust={inventory.openAdjustment}
                        onRecord={inventory.openRecord}
                    />
                </>
            )}
            {inventory.formRequested && (
                <StockAdjustmentForm
                    open={inventory.formOpen && inventory.canManage}
                    onOpenChange={inventory.setFormOpen}
                    stock={inventory.selectedStock}
                    stocks={inventory.stocks}
                    options={inventory.options}
                    optionsError={inventory.optionsError}
                    isLoadingOptions={inventory.isLoadingOptions}
                    onRetryOptions={inventory.retryOptions}
                    isSaving={inventory.isSaving}
                    saveError={inventory.saveError}
                    onSave={inventory.handleSave}
                />
            )}
        </>
    )
}
