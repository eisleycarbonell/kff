"use client"

import dynamic from "next/dynamic"
import Link from "next/link"
import { ClipboardPenLine } from "lucide-react"
import { PageHeader } from "@/components/shared/page-header"
import { InventoryMovementTable } from "@/components/modules/inventory-movements/inventory-movement-table"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useInventoryMovements } from "@/hooks/modules/inventory-movements/use-inventory-movements"
import { useInventoryStocks } from "@/hooks/modules/inventory-stocks/use-inventory-stocks"

const StockAdjustmentForm = dynamic(() =>
    import("@/components/modules/inventory-stocks/inventory-stock-form").then(
        (module) => module.StockAdjustmentForm,
    ),
)

export default function StockAdjustmentsPage() {
    const history = useInventoryMovements("Adjustment")
    const stock = useInventoryStocks()
    return (
        <>
            <title>Stock Adjustments</title>
            <meta
                name="description"
                content="Review and record counted stock corrections."
            />
            <PageHeader
                title="Stock Adjustments"
                description="Review corrections to lot and location balances with reasons and audit history."
                actions={
                    stock.canManage && (
                        <Button
                            className="h-10"
                            onClick={() => stock.openAdjustment()}
                            disabled={
                                !stock.canAdjust || stock.loadStatus !== "ready"
                            }
                        >
                            <ClipboardPenLine />
                            Record adjustment
                        </Button>
                    )
                }
            />
            {history.loadStatus === "signed-out" && (
                <Alert>
                    <AlertTitle>Sign in to view stock adjustments</AlertTitle>
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
            {history.loadError && history.loadStatus !== "signed-out" && (
                <Alert variant="destructive">
                    <AlertTitle>Unable to load adjustment history</AlertTitle>
                    <AlertDescription>
                        {history.loadError.message}
                        <Button
                            variant="outline"
                            className="mt-2"
                            onClick={history.retry}
                            disabled={history.isFetching}
                        >
                            Retry loading
                        </Button>
                    </AlertDescription>
                </Alert>
            )}
            {stock.canManage &&
                stock.loadError &&
                stock.loadStatus !== "signed-out" && (
                    <Alert variant="destructive">
                        <AlertTitle>
                            Unable to prepare a new adjustment
                        </AlertTitle>
                        <AlertDescription>
                            {stock.loadError.message}
                            <Button
                                variant="outline"
                                className="mt-2"
                                onClick={stock.retry}
                                disabled={stock.isFetching}
                            >
                                Retry stock data
                            </Button>
                        </AlertDescription>
                    </Alert>
                )}
            {history.loadStatus === "loading" && (
                <Skeleton
                    className="h-96 rounded-xl"
                    aria-label="Loading stock adjustments"
                />
            )}
            {history.loadStatus === "ready" && (
                <InventoryMovementTable
                    movements={history.movements}
                    adjustmentsOnly
                />
            )}
            {stock.formRequested && (
                <StockAdjustmentForm
                    open={stock.formOpen && stock.canManage}
                    onOpenChange={stock.setFormOpen}
                    stock={stock.selectedStock}
                    stocks={stock.stocks}
                    options={stock.options}
                    optionsError={stock.optionsError}
                    isLoadingOptions={stock.isLoadingOptions}
                    onRetryOptions={stock.retryOptions}
                    isSaving={stock.isSaving}
                    saveError={stock.saveError}
                    onSave={stock.handleSave}
                />
            )}
        </>
    )
}
