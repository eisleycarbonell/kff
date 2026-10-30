"use client"

import dynamic from "next/dynamic"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useMemo } from "react"
import { Plus, Truck } from "lucide-react"
import { PageHeader } from "@/components/shared/page-header"
import { TransferStatistics } from "@/components/modules/transfers/transfer-statistics"
import { TransferTable } from "@/components/modules/transfers/transfer-table"
import { TransferDetailDialog } from "@/components/modules/transfers/transfer-detail"
import { TransferActionDialog } from "@/components/modules/transfers/transfer-action-dialog"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useTransfers } from "@/hooks/modules/transfers/use-transfers"

const TransferForm = dynamic(() =>
    import("@/components/modules/transfers/transfer-form").then((module) => module.TransferForm),
)

export default function TransfersPage() {
    const feature = useTransfers()
    const inTransitOnly = usePathname().replace(/\/+$/, "") === "/transfers/in-transit"
    const transfers = useMemo(
        () =>
            inTransitOnly
                ? feature.transfers.filter((transfer) => transfer.status === "In Transit")
                : feature.transfers,
        [inTransitOnly, feature.transfers],
    )
    const busy = feature.isSaving || feature.isActing || feature.isOpeningEdit
    return (
        <>
            <title>{inTransitOnly ? "In Transit Inventory" : "Stock Transfers"}</title>
            <meta
                name="description"
                content="Dispatch finished-product lots through In Transit and confirm destination receipts."
            />
            <PageHeader
                title={inTransitOnly ? "In Transit" : "Stock Transfers"}
                description={
                    inTransitOnly
                        ? "Track dispatched goods awaiting destination receipt."
                        : "Transfer finished goods from warehouses to branches, stores and other warehouses."
                }
                actions={
                    <>
                        <Button
                            variant="outline"
                            className="h-10"
                            render={
                                <Link
                                    href={inTransitOnly ? "/transfers" : "/transfers/in-transit"}
                                />
                            }
                            nativeButton={false}
                        >
                            {inTransitOnly ? "All transfers" : "View In Transit"}
                        </Button>
                        {feature.canManage && (
                            <Button
                                className="h-10 gap-2 px-4"
                                disabled={busy}
                                onClick={feature.openAdd}
                            >
                                <Plus />
                                Create transfer
                            </Button>
                        )}
                    </>
                }
            />
            {feature.loadStatus === "signed-out" && (
                <Alert>
                    <AlertTitle>Sign in to view stock transfers</AlertTitle>
                    <AlertDescription>
                        <Button className="mt-2" render={<Link href="/" />} nativeButton={false}>
                            Sign in
                        </Button>
                    </AlertDescription>
                </Alert>
            )}
            {feature.loadError && feature.loadStatus !== "signed-out" && (
                <Alert variant="destructive">
                    <AlertTitle>Unable to refresh stock transfers</AlertTitle>
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
                <div className="space-y-4" aria-busy="true" aria-label="Loading stock transfers">
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        {[0, 1, 2, 3].map((row) => (
                            <Skeleton key={row} className="h-28 rounded-xl" />
                        ))}
                    </div>
                    <Skeleton className="h-96 rounded-xl" />
                </div>
            )}
            {feature.loadStatus === "ready" && (
                <>
                    {inTransitOnly ? (
                        <Card className="border py-5 ring-0">
                            <CardContent className="flex items-start gap-4">
                                <Truck
                                    className="mt-1 size-6 shrink-0 text-primary"
                                    aria-hidden="true"
                                />
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">
                                        Transfers awaiting receipt
                                    </p>
                                    <p className="mt-2 text-3xl font-semibold tabular-nums">
                                        {transfers.length}
                                    </p>
                                    <p className="mt-1 text-sm text-muted-foreground">
                                        Across{" "}
                                        {
                                            new Set(
                                                transfers.map(
                                                    (transfer) => transfer.destinationLocationId,
                                                ),
                                            ).size
                                        }{" "}
                                        destinations. Outstanding goods remain in company inventory.
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    ) : (
                        <TransferStatistics transfers={transfers} />
                    )}
                    <TransferTable
                        key={inTransitOnly ? "in-transit" : "all"}
                        inTransitOnly={inTransitOnly}
                        transfers={transfers}
                        canManage={feature.canManage}
                        busy={busy}
                        onAdd={feature.openAdd}
                        onView={feature.setDetailId}
                        onEdit={feature.openEdit}
                        onAction={feature.openAction}
                    />
                </>
            )}
            {feature.formRequested && (
                <TransferForm
                    open={feature.formOpen && feature.canManage}
                    onOpenChange={feature.setFormOpen}
                    transfer={feature.editingTransfer}
                    options={feature.options}
                    isOptionsLoading={feature.optionsLoading}
                    optionsError={feature.optionsError}
                    onRetryOptions={feature.retryOptions}
                    onSubmit={feature.handleSave}
                    isSubmitting={feature.isSaving}
                    saveError={feature.saveError}
                />
            )}
            <TransferDetailDialog
                open={feature.detailId !== null}
                onOpenChange={(open) => {
                    if (!open) feature.setDetailId(null)
                }}
                transfer={feature.detail}
                isLoading={feature.detailLoading}
                error={feature.detailError}
                onRetry={feature.retryDetail}
            />
            <TransferActionDialog
                action={feature.canManage ? (feature.actionSelection?.action ?? null) : null}
                transfer={feature.actionDetail}
                isLoading={feature.actionLoading}
                loadError={feature.actionLoadError}
                onRetry={feature.retryActionDetail}
                options={feature.options}
                optionsLoading={feature.optionsLoading}
                optionsError={feature.optionsError}
                onRetryOptions={feature.retryOptions}
                isSubmitting={feature.isActing}
                error={feature.actionError}
                onOpenChange={(open) => {
                    if (!open && !feature.isActing) feature.setActionSelection(null)
                }}
                onSubmit={feature.handleAction}
            />
        </>
    )
}
