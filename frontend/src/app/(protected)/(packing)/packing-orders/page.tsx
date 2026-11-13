"use client"

import dynamic from "next/dynamic"
import Link from "next/link"
import { Plus } from "lucide-react"
import { PageHeader } from "@/components/shared/page-header"
import { PackingOrderStatistics } from "@/components/modules/packing-orders/packing-order-statistics"
import { PackingOrderTable } from "@/components/modules/packing-orders/packing-order-table"
import { PackingOrderDetail } from "@/components/modules/packing-orders/packing-order-detail"
import { PackingOrderActionDialog } from "@/components/modules/packing-orders/packing-order-action-dialog"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { usePackingOrders } from "@/hooks/modules/packing-orders/use-packing-orders"

const PackingOrderForm = dynamic(() =>
    import("@/components/modules/packing-orders/packing-order-form").then(
        (module) => module.PackingOrderForm,
    ),
)

export default function PackingOrdersPage() {
    const feature = usePackingOrders()
    return (
        <>
            <title>Packing Orders</title>
            <meta
                name="description"
                content="Plan packing, reserve materials and record finished goods."
            />
            <PageHeader
                title="Packing Orders"
                description="Plan production, protect required materials and record finished goods."
                actions={
                    feature.canManage && (
                        <Button
                            className="h-10 gap-2 px-4"
                            onClick={feature.openAdd}
                            disabled={feature.isSaving || feature.isActing}
                        >
                            <Plus />
                            Create packing order
                        </Button>
                    )
                }
            />
            {feature.loadStatus === "signed-out" && (
                <Alert>
                    <AlertTitle>Sign in to view packing orders</AlertTitle>
                    <AlertDescription>
                        <Button className="mt-2" render={<Link href="/" />} nativeButton={false}>
                            Sign in
                        </Button>
                    </AlertDescription>
                </Alert>
            )}
            {feature.loadError && feature.loadStatus !== "signed-out" && (
                <Alert variant="destructive">
                    <AlertTitle>Unable to refresh packing orders</AlertTitle>
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
                <div className="space-y-4" aria-busy="true" aria-label="Loading packing orders">
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
                    <PackingOrderStatistics orders={feature.orders} />
                    <PackingOrderTable
                        orders={feature.orders}
                        canManage={feature.canManage}
                        onAdd={feature.openAdd}
                        onEdit={feature.openEdit}
                        onView={feature.setDetailId}
                        onAction={feature.openAction}
                        busy={feature.isActing || feature.isSaving}
                    />
                </>
            )}
            {feature.formRequested && (
                <PackingOrderForm
                    open={feature.formOpen && feature.canManage}
                    onOpenChange={feature.setFormOpen}
                    order={feature.editingOrder}
                    options={feature.options}
                    optionsLoading={feature.optionsLoading}
                    optionsError={feature.optionsError}
                    retryOptions={feature.retryOptions}
                    onSave={feature.handleSave}
                    isSaving={feature.isSaving}
                    saveError={feature.saveError}
                />
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
                canManage={feature.canManage}
                busy={feature.isActing || feature.isSaving}
                onEdit={feature.openEdit}
                onAction={feature.openAction}
            />
            <PackingOrderActionDialog
                selection={feature.canManage ? feature.actionOrder : null}
                onClose={() => feature.setActionOrder(null)}
                onConfirm={feature.handleAction}
                pending={feature.isActing}
                error={feature.actionError}
            />
        </>
    )
}
