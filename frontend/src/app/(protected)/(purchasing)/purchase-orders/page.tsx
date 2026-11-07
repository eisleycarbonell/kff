"use client"

import dynamic from "next/dynamic"
import Link from "next/link"
import { useCallback, useState } from "react"
import { Plus, Send, XCircle } from "lucide-react"

import type { PurchaseOrder } from "@/components/modules/purchase-orders/purchase-order.schema"
import { PurchaseOrderStatistics } from "@/components/modules/purchase-orders/purchase-order-statistics"
import { PurchaseOrderTable } from "@/components/modules/purchase-orders/purchase-order-table"
import { PageHeader } from "@/components/shared/page-header"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { usePurchaseOrders } from "@/hooks/modules/purchase-orders/use-purchase-orders"

const PurchaseOrderForm = dynamic(() =>
    import("@/components/modules/purchase-orders/purchase-order-form").then(
        (module) => module.PurchaseOrderForm,
    ),
)
const PurchaseOrderDetailDialog = dynamic(() =>
    import("@/components/modules/purchase-orders/purchase-order-detail-dialog").then(
        (module) => module.PurchaseOrderDetailDialog,
    ),
)

export default function PurchaseOrdersPage() {
    const {
        orders,
        canManage,
        loadStatus,
        loadError,
        isFetching,
        retry,
        formOpen,
        setFormOpen,
        formRequested,
        editingOrder,
        openAdd,
        openEdit,
        options,
        optionsReady,
        optionsError,
        isOptionsLoading,
        retryOptions,
        handleSave,
        isSaving,
        saveError,
        transitionTarget,
        setTransitionTarget,
        openSend,
        openCancel,
        handleTransition,
        isTransitioning,
        transitionError,
    } = usePurchaseOrders()
    const [viewingOrder, setViewingOrder] = useState<PurchaseOrder | null>(null)
    const [detailOpen, setDetailOpen] = useState(false)
    const isBusy = isSaving || isTransitioning
    const openDetail = useCallback((order: PurchaseOrder) => {
        setViewingOrder(order)
        setDetailOpen(true)
    }, [])
    const editOrder = useCallback(
        (order: PurchaseOrder) => {
            setDetailOpen(false)
            openEdit(order)
        },
        [openEdit],
    )
    const isSending = transitionTarget?.action === "send"
    const transitionNumber = transitionTarget?.order.poNumber ?? "purchase order"

    return (
        <>
            <title>Purchase Orders</title>
            <meta
                name="description"
                content="Create supplier purchase orders and track receiving progress."
            />
            <PageHeader
                title="Purchase Orders"
                description="Plan supplier purchases and track ordered, received, and remaining quantities."
                actions={
                    canManage && (
                        <Button className="h-10 gap-2 px-4" onClick={openAdd} disabled={isBusy}>
                            <Plus />
                            Create purchase order
                        </Button>
                    )
                }
            />
            {loadStatus === "signed-out" && (
                <Alert>
                    <AlertTitle>Sign in to view purchase orders</AlertTitle>
                    <AlertDescription>
                        <Button className="mt-2" render={<Link href="/" />} nativeButton={false}>
                            Sign in
                        </Button>
                    </AlertDescription>
                </Alert>
            )}
            {(loadStatus === "error" || (loadStatus === "ready" && loadError)) && (
                <Alert variant="destructive">
                    <AlertTitle>Unable to load purchase orders</AlertTitle>
                    <AlertDescription>
                        {loadError?.message ?? "Purchase order records could not be loaded."}
                        <Button
                            variant="outline"
                            className="mt-2"
                            disabled={isFetching}
                            onClick={retry}
                        >
                            {isFetching ? "Retrying..." : "Retry loading orders"}
                        </Button>
                    </AlertDescription>
                </Alert>
            )}
            {loadStatus === "loading" && (
                <div className="space-y-4" aria-label="Loading purchase orders" aria-busy="true">
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        {[0, 1, 2, 3].map((index) => (
                            <Skeleton key={index} className="h-28 rounded-xl" />
                        ))}
                    </div>
                    <Skeleton className="h-96 rounded-xl" />
                </div>
            )}
            {loadStatus === "ready" && (
                <>
                    {!canManage && (
                        <Alert>
                            <AlertTitle>Read-only access</AlertTitle>
                            <AlertDescription>
                                You can view purchase orders, receiving progress, and exports.
                                Purchasing managers can prepare and update orders.
                            </AlertDescription>
                        </Alert>
                    )}
                    <PurchaseOrderStatistics orders={orders} />
                    <PurchaseOrderTable
                        orders={orders}
                        canManage={canManage}
                        isBusy={isBusy}
                        onAdd={openAdd}
                        onView={openDetail}
                        onEdit={editOrder}
                        onSend={openSend}
                        onCancel={openCancel}
                    />
                </>
            )}
            {formRequested && (
                <PurchaseOrderForm
                    open={formOpen && canManage}
                    onOpenChange={setFormOpen}
                    order={editingOrder}
                    orders={orders}
                    options={options}
                    optionsReady={optionsReady}
                    optionsError={optionsError}
                    isOptionsLoading={isOptionsLoading}
                    retryOptions={retryOptions}
                    onSave={handleSave}
                    isSaving={isSaving}
                    saveError={saveError}
                />
            )}
            {viewingOrder && (
                <PurchaseOrderDetailDialog
                    key={viewingOrder.poId}
                    open={detailOpen}
                    onOpenChange={setDetailOpen}
                    order={viewingOrder}
                    canManage={canManage}
                    isBusy={isBusy}
                    onEdit={editOrder}
                    onSend={openSend}
                    onCancel={openCancel}
                />
            )}
            <AlertDialog
                open={canManage && transitionTarget !== null}
                onOpenChange={(value) => {
                    if (!value && !isTransitioning) setTransitionTarget(null)
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="break-words">
                            {isSending ? "Mark as sent" : "Cancel order"}: {transitionNumber}?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {isSending
                                ? "Confirm this purchase order has been sent to the supplier. Its supplier and order lines will then be locked for receiving."
                                : "This unreceived purchase order will be closed as Cancelled. Cancelled orders cannot be edited, and their records remain available for reference."}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    {transitionError && (
                        <Alert variant="destructive">
                            <AlertDescription>{transitionError}</AlertDescription>
                        </Alert>
                    )}
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isTransitioning}>Back</AlertDialogCancel>
                        <AlertDialogAction
                            variant={isSending ? "default" : "destructive"}
                            disabled={isTransitioning}
                            onClick={handleTransition}
                        >
                            {isSending ? <Send /> : <XCircle />}
                            {isTransitioning
                                ? "Updating..."
                                : isSending
                                  ? "Mark as sent"
                                  : "Cancel order"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
