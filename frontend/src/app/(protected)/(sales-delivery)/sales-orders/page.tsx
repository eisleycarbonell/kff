"use client"

import dynamic from "next/dynamic"
import Link from "next/link"
import { ClipboardList, Plus, Truck } from "lucide-react"
import { SalesMaterialPlanDialog } from "@/components/modules/sales-orders/sales-material-plan-dialog"
import { SalesOrderStatistics } from "@/components/modules/sales-orders/sales-order-statistics"
import { SalesOrderTable } from "@/components/modules/sales-orders/sales-order-table"
import { SalesOrderStatus } from "@/components/modules/sales-orders/sales-order-table-columns"
import { formatSalesDecimal } from "@/components/modules/sales-orders/sales-order.schema"
import { PageHeader } from "@/components/shared/page-header"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { useSalesOrders } from "@/hooks/modules/sales-orders/use-sales-orders"
const SalesOrderForm = dynamic(() =>
    import("@/components/modules/sales-orders/sales-order-form").then(
        (module) => module.SalesOrderForm,
    ),
)
export default function SalesOrdersPage() {
    const feature = useSalesOrders()
    const viewed = feature.viewingOrder
    return (
        <>
            <title>Sales Orders</title>
            <meta
                name="description"
                content="Manage customer sales orders and track delivered quantities."
            />
            <PageHeader
                title="Sales Orders"
                description="Record customer POs, check material shortages, then pack and deliver finished products."
                actions={
                    feature.canManage && (
                        <Button
                            className="h-10 gap-2 px-4"
                            onClick={feature.openAdd}
                            disabled={feature.loadStatus !== "ready"}
                        >
                            <Plus />
                            Create sales order
                        </Button>
                    )
                }
            />
            {feature.loadStatus === "signed-out" && (
                <Alert>
                    <AlertTitle>Sign in to view sales orders</AlertTitle>
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
                            ? "Unable to refresh sales orders"
                            : "Unable to load sales orders"}
                    </AlertTitle>
                    <AlertDescription>
                        <p>{feature.loadError.message}</p>
                        {feature.loadStatus === "ready" && (
                            <p>Showing the last loaded records.</p>
                        )}
                        <Button
                            variant="outline"
                            onClick={feature.retry}
                            disabled={feature.isFetching}
                        >
                            {feature.isFetching
                                ? "Retrying..."
                                : "Retry loading orders"}
                        </Button>
                    </AlertDescription>
                </Alert>
            )}
            {feature.loadStatus === "loading" && (
                <div
                    className="space-y-4"
                    aria-busy="true"
                    aria-label="Loading sales orders"
                >
                    <div className="grid gap-4 sm:grid-cols-3">
                        {[0, 1, 2].map((value) => (
                            <Skeleton key={value} className="h-28 rounded-xl" />
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
                                You can view and export orders. Inventory
                                managers can create and confirm sales orders.
                            </AlertDescription>
                        </Alert>
                    )}
                    <SalesOrderStatistics orders={feature.orders} />
                    <SalesOrderTable
                        orders={feature.orders}
                        canManage={feature.canManage}
                        onAdd={feature.openAdd}
                        onView={feature.openView}
                        onPlan={feature.openMaterialPlan}
                        onEdit={feature.openEdit}
                        onAction={feature.openAction}
                    />
                </>
            )}
            {feature.formRequested && (
                <SalesOrderForm
                    open={feature.formOpen && feature.canManage}
                    onOpenChange={feature.setFormOpen}
                    order={feature.editingOrder}
                    options={feature.options}
                    optionsReady={feature.optionsReady}
                    optionsError={feature.optionsError}
                    retryOptions={feature.retryOptions}
                    onSave={feature.handleSave}
                    isSaving={feature.isSaving}
                    saveError={feature.saveError}
                />
            )}
            <SalesMaterialPlanDialog
                open={feature.materialPlanOrderId !== null}
                onClose={feature.closeMaterialPlan}
                sourceLocationId={feature.planSourceLocationId}
                onSourceChange={feature.setPlanSourceLocationId}
                options={feature.options}
                optionsReady={feature.optionsReady}
                optionsError={feature.optionsError}
                retryOptions={feature.retryOptions}
                plan={feature.materialPlan}
                error={feature.materialPlanError}
                loading={feature.materialPlanLoading}
                refresh={feature.retryMaterialPlan}
            />
            <AlertDialog
                open={feature.canManage && feature.actionSelection !== null}
                onOpenChange={(open) => {
                    if (!open && !feature.isActionPending)
                        feature.setActionSelection(null)
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {feature.actionSelection?.action === "confirm"
                                ? "Confirm sales order?"
                                : "Cancel sales order?"}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {feature.actionSelection?.order.salesOrderNumber}:{" "}
                            {feature.actionSelection?.action === "confirm"
                                ? "The order becomes available for delivery planning. Confirmation does not reserve inventory; availability is checked at dispatch."
                                : "This order will be closed without changing inventory. Active deliveries must be cancelled first."}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    {feature.actionError && (
                        <p role="alert" className="text-sm text-destructive">
                            {feature.actionError}
                        </p>
                    )}
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={feature.isActionPending}>
                            Back
                        </AlertDialogCancel>
                        <Button
                            variant={
                                feature.actionSelection?.action === "cancel"
                                    ? "destructive"
                                    : "default"
                            }
                            disabled={feature.isActionPending}
                            onClick={feature.handleAction}
                        >
                            {feature.isActionPending
                                ? "Saving..."
                                : feature.actionSelection?.action === "confirm"
                                  ? "Confirm order"
                                  : "Cancel order"}
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <Dialog
                open={feature.viewingOrderId !== null}
                onOpenChange={(open) => {
                    if (!open) feature.setViewingOrderId(null)
                }}
            >
                <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-5xl">
                    <DialogHeader>
                        <DialogTitle>
                            {viewed?.salesOrderNumber ?? "Sales order details"}
                        </DialogTitle>
                        <DialogDescription>
                            {viewed?.customerName ??
                                "This order is no longer available in the current results."}
                        </DialogDescription>
                    </DialogHeader>
                    {viewed && (
                        <>
                            <dl className="grid gap-4 text-sm sm:grid-cols-3">
                                <div>
                                    <dt className="text-muted-foreground">
                                        Customer PO
                                    </dt>
                                    <dd className="mt-1">
                                        {viewed.customerPoNumber ??
                                            "Not provided"}
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-muted-foreground">
                                        Status
                                    </dt>
                                    <dd className="mt-1">
                                        <SalesOrderStatus
                                            status={viewed.status}
                                        />
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-muted-foreground">
                                        Order date
                                    </dt>
                                    <dd className="mt-1">{viewed.orderDate}</dd>
                                </div>
                                <div>
                                    <dt className="text-muted-foreground">
                                        Requested delivery
                                    </dt>
                                    <dd className="mt-1">
                                        {viewed.requestedDeliveryDate ??
                                            "Not scheduled"}
                                    </dd>
                                </div>
                            </dl>
                            {viewed.notes && (
                                <p className="whitespace-pre-wrap break-words text-sm">
                                    {viewed.notes}
                                </p>
                            )}
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Product</TableHead>
                                        <TableHead>Unit</TableHead>
                                        <TableHead>Ordered</TableHead>
                                        <TableHead>Delivered</TableHead>
                                        <TableHead>Remaining</TableHead>
                                        <TableHead>
                                            Allocated to deliveries
                                        </TableHead>
                                        <TableHead>Unit price</TableHead>
                                        <TableHead>Line total</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {viewed.lines.map((line) => (
                                        <TableRow key={line.salesOrderLineId}>
                                            <TableCell>
                                                <p className="font-medium">
                                                    {line.itemName}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {line.itemSku}
                                                </p>
                                            </TableCell>
                                            <TableCell>
                                                {line.uomName}
                                            </TableCell>
                                            {[
                                                line.qtyOrdered,
                                                line.qtyDelivered,
                                                line.qtyRemaining,
                                                line.qtyAllocated,
                                                line.unitPrice,
                                                line.lineTotal,
                                            ].map((value, index) => (
                                                <TableCell
                                                    key={index}
                                                    className="tabular-nums"
                                                >
                                                    {formatSalesDecimal(value)}
                                                </TableCell>
                                            ))}
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                            <p className="text-right font-medium tabular-nums">
                                Order total:{" "}
                                {formatSalesDecimal(viewed.totalAmount)}
                            </p>
                            <p className="text-sm text-muted-foreground">
                                Allocated quantities belong to draft or
                                in-transit delivery orders. Remaining quantities
                                decrease when customer delivery is completed.
                            </p>
                        </>
                    )}
                    <DialogFooter>
                        {viewed && viewed.status !== "Cancelled" && (
                            <Button
                                variant="outline"
                                onClick={() => {
                                    feature.setViewingOrderId(null)
                                    feature.openMaterialPlan(viewed)
                                }}
                            >
                                <ClipboardList />
                                Check material plan
                            </Button>
                        )}
                        <Button
                            variant="outline"
                            render={<Link href="/delivery-orders" />}
                            nativeButton={false}
                        >
                            <Truck />
                            Delivery orders
                        </Button>
                        <Button onClick={() => feature.setViewingOrderId(null)}>
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
