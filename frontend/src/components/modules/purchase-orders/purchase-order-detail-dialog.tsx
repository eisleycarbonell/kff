"use client"

import { Pencil, Send, XCircle } from "lucide-react"

import {
    formatPurchaseOrderDecimal,
    type PurchaseOrder,
} from "@/components/modules/purchase-orders/purchase-order.schema"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { usePurchaseOrderDetail } from "@/hooks/modules/purchase-orders/use-purchase-orders"

type Props = {
    open: boolean
    onOpenChange: (open: boolean) => void
    order: PurchaseOrder | null
    canManage: boolean
    isBusy: boolean
    onEdit: (order: PurchaseOrder) => void
    onSend: (order: PurchaseOrder) => void
    onCancel: (order: PurchaseOrder) => void
}

const dateFormat = new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
})

export function PurchaseOrderDetailDialog({
    open,
    onOpenChange,
    order,
    canManage,
    isBusy,
    onEdit,
    onSend,
    onCancel,
}: Props) {
    const detail = usePurchaseOrderDetail(open && order ? order.poId : null)
    const current = detail.order
    const canEdit = canManage && current?.status === "Draft" && !current.hasReceipts
    const canCancel =
        canManage &&
        current !== null &&
        (current.status === "Draft" || current.status === "Sent") &&
        !current.hasReceipts

    return (
        <Dialog
            open={open}
            onOpenChange={(value) => {
                if (!isBusy) onOpenChange(value)
            }}
        >
            {open && (
                <DialogContent
                    className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-5xl"
                    showCloseButton={!isBusy}
                >
                    <DialogHeader>
                        <DialogTitle className="break-words pr-6">
                            {current?.poNumber ?? order?.poNumber ?? "Purchase order"}
                        </DialogTitle>
                        <DialogDescription>
                            Review supplier purchases and receiving progress. Quantities use each
                            line&apos;s purchase unit.
                        </DialogDescription>
                    </DialogHeader>
                    {detail.loadStatus === "loading" && (
                        <div
                            className="space-y-3"
                            aria-busy="true"
                            aria-label="Loading purchase order details"
                        >
                            <Skeleton className="h-24 rounded-lg" />
                            <Skeleton className="h-64 rounded-lg" />
                        </div>
                    )}
                    {detail.loadError && (
                        <Alert variant="destructive">
                            <AlertTitle>Unable to load order details</AlertTitle>
                            <AlertDescription>
                                {detail.loadError.message}
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="mt-2"
                                    disabled={detail.isFetching || isBusy}
                                    onClick={detail.retry}
                                >
                                    {detail.isFetching ? "Retrying..." : "Retry"}
                                </Button>
                            </AlertDescription>
                        </Alert>
                    )}
                    {detail.loadStatus === "signed-out" && (
                        <Alert>
                            <AlertTitle>Sign in required</AlertTitle>
                            <AlertDescription>
                                Your session has ended. Sign in again to view this purchase order.
                            </AlertDescription>
                        </Alert>
                    )}
                    {current && (
                        <>
                            <dl className="grid gap-4 rounded-lg border bg-muted/15 p-4 sm:grid-cols-2 lg:grid-cols-4">
                                <div className="min-w-0">
                                    <dt className="text-xs font-medium text-muted-foreground">
                                        Supplier
                                    </dt>
                                    <dd className="mt-1 break-words font-medium">
                                        {current.supplierName}
                                    </dd>
                                    {!current.supplierIsActive && (
                                        <dd className="mt-1 text-xs text-muted-foreground">
                                            Inactive supplier
                                        </dd>
                                    )}
                                </div>
                                <div>
                                    <dt className="text-xs font-medium text-muted-foreground">
                                        Status
                                    </dt>
                                    <dd className="mt-1">
                                        <Badge
                                            variant="secondary"
                                            className={
                                                current.status === "Completed"
                                                    ? "bg-primary/10 text-primary"
                                                    : "text-muted-foreground"
                                            }
                                        >
                                            {current.status}
                                        </Badge>
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-xs font-medium text-muted-foreground">
                                        Order date
                                    </dt>
                                    <dd className="mt-1">
                                        {dateFormat.format(new Date(current.orderDate))}
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-xs font-medium text-muted-foreground">
                                        Expected delivery
                                    </dt>
                                    <dd className="mt-1">
                                        {current.expectedDeliveryDate
                                            ? dateFormat.format(
                                                  new Date(current.expectedDeliveryDate),
                                              )
                                            : "Not set"}
                                    </dd>
                                </div>
                            </dl>
                            <div className="overflow-hidden rounded-lg border">
                                <Table className="min-w-[820px]">
                                    <TableHeader className="bg-muted/50">
                                        <TableRow>
                                            <TableHead>Material</TableHead>
                                            <TableHead>Purchase unit</TableHead>
                                            <TableHead className="text-right">Ordered</TableHead>
                                            <TableHead className="text-right">Received</TableHead>
                                            <TableHead className="text-right">Remaining</TableHead>
                                            <TableHead className="text-right">Unit price</TableHead>
                                            <TableHead className="text-right">Line value</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {current.lines.map((line) => (
                                            <TableRow key={line.poLineId}>
                                                <TableCell>
                                                    <p className="font-medium">{line.itemName}</p>
                                                    <p className="mt-0.5 text-xs text-muted-foreground">
                                                        {line.itemSku}
                                                    </p>
                                                    {!line.itemIsActive && (
                                                        <Badge variant="outline" className="mt-1">
                                                            Item inactive
                                                        </Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell>{line.uomName}</TableCell>
                                                <TableCell className="text-right tabular-nums">
                                                    {formatPurchaseOrderDecimal(line.qtyOrdered)}
                                                </TableCell>
                                                <TableCell className="text-right tabular-nums">
                                                    {formatPurchaseOrderDecimal(line.qtyReceived)}
                                                </TableCell>
                                                <TableCell className="text-right tabular-nums">
                                                    {formatPurchaseOrderDecimal(line.qtyRemaining)}
                                                </TableCell>
                                                <TableCell className="text-right tabular-nums">
                                                    {formatPurchaseOrderDecimal(line.unitPrice)}
                                                </TableCell>
                                                <TableCell className="text-right font-medium tabular-nums">
                                                    {formatPurchaseOrderDecimal(line.lineTotal)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                            <dl className="grid gap-3 sm:grid-cols-3">
                                {[
                                    { label: "Order value", value: current.totalAmount },
                                    { label: "Received value", value: current.receivedAmount },
                                    {
                                        label: "Outstanding value",
                                        value: current.outstandingAmount,
                                    },
                                ].map(({ label, value }) => (
                                    <div key={label} className="min-w-0 rounded-lg border p-4">
                                        <dt className="text-sm text-muted-foreground">{label}</dt>
                                        <dd className="mt-1 break-words text-xl font-semibold tabular-nums">
                                            {formatPurchaseOrderDecimal(value)}
                                        </dd>
                                    </div>
                                ))}
                            </dl>
                            {current.notes && (
                                <section aria-label="Order notes">
                                    <h3 className="text-sm font-medium">Notes</h3>
                                    <p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">
                                        {current.notes}
                                    </p>
                                </section>
                            )}
                            <p className="text-sm text-muted-foreground">
                                {current.lines.length}{" "}
                                {current.lines.length === 1 ? "order line" : "order lines"}
                            </p>
                        </>
                    )}
                    <DialogFooter>
                        <div className="mr-auto flex flex-wrap gap-2">
                            {current && canEdit && (
                                <>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        disabled={isBusy}
                                        onClick={() => onEdit(current)}
                                    >
                                        <Pencil />
                                        Edit draft
                                    </Button>
                                    <Button
                                        type="button"
                                        disabled={isBusy}
                                        onClick={() => onSend(current)}
                                    >
                                        <Send />
                                        Mark as sent
                                    </Button>
                                </>
                            )}
                            {current && canCancel && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    disabled={isBusy}
                                    onClick={() => onCancel(current)}
                                >
                                    <XCircle />
                                    Cancel order
                                </Button>
                            )}
                        </div>
                        <Button
                            type="button"
                            variant="outline"
                            disabled={isBusy}
                            onClick={() => onOpenChange(false)}
                        >
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            )}
        </Dialog>
    )
}
