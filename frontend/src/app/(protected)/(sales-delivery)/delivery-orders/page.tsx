"use client"

import dynamic from "next/dynamic"
import Link from "next/link"
import { Plus } from "lucide-react"
import { DeliveryOrderStatistics } from "@/components/modules/delivery-orders/delivery-order-statistics"
import { DeliveryOrderTable } from "@/components/modules/delivery-orders/delivery-order-table"
import {
    DeliveryOrderActionDialog,
    DeliveryOrderDetailDialog,
} from "@/components/modules/delivery-orders/delivery-order-dialogs"
import { PageHeader } from "@/components/shared/page-header"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useDeliveryOrders } from "@/hooks/modules/delivery-orders/use-delivery-orders"

const DeliveryOrderForm = dynamic(() =>
    import("@/components/modules/delivery-orders/delivery-order-form").then(
        (module) => module.DeliveryOrderForm,
    ),
)

export default function DeliveryOrdersPage() {
    const feature = useDeliveryOrders()
    return (
        <>
            <title>Delivery Orders</title>
            <meta
                name="description"
                content="Allocate, dispatch and confirm customer deliveries."
            />
            <PageHeader
                title="Delivery Orders"
                description="Allocate finished-product lots, dispatch shipments and confirm customer receipt."
                actions={
                    feature.canManage && (
                        <Button
                            className="h-10 gap-2 px-4"
                            onClick={feature.openAdd}
                            disabled={feature.loadStatus !== "ready"}
                        >
                            <Plus />
                            Create delivery order
                        </Button>
                    )
                }
            />
            {feature.loadStatus === "signed-out" && (
                <Alert>
                    <AlertTitle>Sign in to view delivery orders</AlertTitle>
                    <AlertDescription>
                        <Button render={<Link href="/" />} nativeButton={false}>
                            Sign in
                        </Button>
                    </AlertDescription>
                </Alert>
            )}
            {feature.loadError && (
                <Alert variant="destructive">
                    <AlertTitle>
                        {feature.loadStatus === "ready"
                            ? "Unable to refresh delivery orders"
                            : "Unable to load delivery orders"}
                    </AlertTitle>
                    <AlertDescription>
                        {feature.loadError.message}
                        {feature.loadStatus === "ready" && (
                            <p>Showing the last loaded delivery orders.</p>
                        )}
                        <Button
                            variant="outline"
                            onClick={feature.retry}
                            disabled={feature.isFetching}
                        >
                            {feature.isFetching ? "Retrying..." : "Retry loading delivery orders"}
                        </Button>
                    </AlertDescription>
                </Alert>
            )}
            {feature.loadStatus === "loading" && (
                <div className="space-y-4" aria-busy="true" aria-label="Loading delivery orders">
                    <div className="grid gap-4 sm:grid-cols-3">
                        {[0, 1, 2].map((index) => (
                            <Skeleton key={index} className="h-28 rounded-xl" />
                        ))}
                    </div>
                    <Skeleton className="h-96 rounded-xl" />
                </div>
            )}
            {feature.loadStatus === "ready" && (
                <>
                    {!feature.canManage && (
                        <Alert>
                            <AlertTitle>View access</AlertTitle>
                            <AlertDescription>
                                You can view and export delivery orders. Transfer managers can
                                create and dispatch deliveries.
                            </AlertDescription>
                        </Alert>
                    )}
                    <DeliveryOrderStatistics orders={feature.orders} />
                    <DeliveryOrderTable
                        orders={feature.orders}
                        onAdd={feature.openAdd}
                        onView={feature.setDetailId}
                        onEdit={feature.openEdit}
                        onAction={feature.openAction}
                        canManage={feature.canManage}
                        busy={feature.isOpeningEdit || feature.isSaving || feature.isActing}
                    />
                </>
            )}
            {feature.formRequested && (
                <DeliveryOrderForm
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
            <DeliveryOrderDetailDialog
                open={feature.detailId !== null}
                onOpenChange={(open) => {
                    if (!open) feature.setDetailId(null)
                }}
                order={feature.detail}
                loading={feature.detailLoading}
                error={feature.detailError}
                retry={feature.retryDetail}
            />
            <DeliveryOrderActionDialog
                selection={feature.canManage ? feature.actionSelection : null}
                onClose={() => feature.setActionSelection(null)}
                options={feature.options}
                optionsLoading={feature.optionsLoading}
                optionsError={feature.optionsError}
                retryOptions={feature.retryOptions}
                pending={feature.isActing}
                error={feature.actionError}
                onConfirm={feature.handleAction}
            />
        </>
    )
}
