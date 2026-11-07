"use client"

import dynamic from "next/dynamic"
import Link from "next/link"
import { ClipboardCheck } from "lucide-react"
import { PageHeader } from "@/components/shared/page-header"
import { StockStatistics } from "@/components/modules/inventory-stocks/inventory-stock-statistics"
import { StockTable } from "@/components/modules/inventory-stocks/inventory-stock-table"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useInventoryStocks } from "@/hooks/modules/inventory-stocks/use-inventory-stocks"

const StockAdjustmentForm = dynamic(() =>
    import("@/components/modules/inventory-stocks/inventory-stock-form").then(
        (module) => module.StockAdjustmentForm,
    ),
)

export default function StockCountsPage() {
    const stock = useInventoryStocks()
    return (
        <>
            <title>Stock Counts</title>
            <meta
                name="description"
                content="Record physical counts for existing lots and locations."
            />
            <PageHeader
                title="Stock Counts"
                description="Compare a physical count with the current lot and location balance. A difference posts a traceable adjustment."
                actions={
                    stock.canManage && (
                        <Button
                            className="h-10"
                            onClick={() => stock.openAdjustment()}
                            disabled={
                                !stock.canAdjust || stock.loadStatus !== "ready"
                            }
                        >
                            <ClipboardCheck />
                            Record count
                        </Button>
                    )
                }
            />
            {stock.loadStatus === "signed-out" && (
                <Alert>
                    <AlertTitle>Sign in to view stock counts</AlertTitle>
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
            {stock.loadError && stock.loadStatus !== "signed-out" && (
                <Alert variant="destructive">
                    <AlertTitle>Unable to load stock balances</AlertTitle>
                    <AlertDescription>
                        {stock.loadError.message}
                        <Button
                            variant="outline"
                            className="mt-2"
                            onClick={stock.retry}
                            disabled={stock.isFetching}
                        >
                            Retry loading
                        </Button>
                    </AlertDescription>
                </Alert>
            )}
            {stock.loadStatus === "loading" && (
                <Skeleton
                    className="h-96 rounded-xl"
                    aria-label="Loading stock counts"
                />
            )}
            {stock.loadStatus === "ready" && (
                <>
                    <StockStatistics stocks={stock.stocks} />
                    <StockTable
                        mode="count"
                        stocks={stock.stocks}
                        canManage={stock.canAdjust}
                        onRecord={() => stock.openAdjustment()}
                        onAdjust={stock.openAdjustment}
                    />
                </>
            )}
            {stock.formRequested && (
                <StockAdjustmentForm
                    mode="count"
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
