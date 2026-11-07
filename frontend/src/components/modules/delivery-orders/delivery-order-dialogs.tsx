"use client"

import { useState } from "react"
import Link from "next/link"
import {
    formatDeliveryQuantity,
    type DeliveryOrder,
    type DeliveryOrderOptions,
} from "@/components/modules/delivery-orders/delivery-order.schema"
import type { DeliveryOrderAction } from "@/hooks/modules/delivery-orders/use-delivery-orders"
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
import { Field, FieldLabel } from "@/components/ui/field"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"

export function DeliveryOrderDetailDialog({
    open,
    onOpenChange,
    order,
    loading,
    error,
    retry,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    order?: DeliveryOrder
    loading: boolean
    error?: string
    retry: () => void
}) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle>
                        {order?.deliveryOrderNumber ?? "Delivery order details"}
                    </DialogTitle>
                    <DialogDescription>
                        Customer delivery, lot traceability and fulfillment status.
                    </DialogDescription>
                </DialogHeader>
                {loading && !order && <p role="status">Loading delivery order...</p>}
                {error && (
                    <Alert variant="destructive">
                        <AlertTitle>Unable to load delivery</AlertTitle>
                        <AlertDescription>
                            {error}
                            <Button variant="outline" onClick={retry}>
                                Retry
                            </Button>
                        </AlertDescription>
                    </Alert>
                )}
                {order && (
                    <div className="space-y-5">
                        <div className="flex flex-wrap items-center gap-3">
                            <Badge variant="outline">{order.status}</Badge>
                            <Link
                                href="/sales-orders"
                                className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                            >
                                {order.salesOrderNumber}
                            </Link>
                        </div>
                        <dl className="grid gap-4 text-sm sm:grid-cols-2">
                            {[
                                ["Customer", order.customerName],
                                ["Source", order.sourceLocationName],
                                ["Delivery date", order.deliveryDate],
                                ["Transit location", order.transitLocationName],
                                [
                                    "Dispatched",
                                    order.dispatchedAt
                                        ? new Date(order.dispatchedAt).toLocaleString()
                                        : null,
                                ],
                                [
                                    "Completed",
                                    order.completedAt
                                        ? new Date(order.completedAt).toLocaleString()
                                        : null,
                                ],
                            ]
                                .filter(([, value]) => value !== null)
                                .map(([label, value]) => (
                                    <div key={label}>
                                        <dt className="text-muted-foreground">{label}</dt>
                                        <dd className="mt-1 font-medium">{value}</dd>
                                    </div>
                                ))}
                        </dl>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Product</TableHead>
                                    <TableHead>Lot</TableHead>
                                    <TableHead className="text-right">Quantity</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {order.lines.map((line) => (
                                    <TableRow key={line.deliveryOrderLineId}>
                                        <TableCell>
                                            <span className="font-medium">{line.itemName}</span>
                                            <p className="text-xs text-muted-foreground">
                                                {line.itemSku}
                                            </p>
                                        </TableCell>
                                        <TableCell>{line.lotNumber}</TableCell>
                                        <TableCell className="text-right tabular-nums">
                                            {formatDeliveryQuantity(line.qtyDelivered)}{" "}
                                            {line.uomName}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        {order.notes && (
                            <div className="text-sm">
                                <p className="text-muted-foreground">Notes</p>
                                <p className="mt-1 whitespace-pre-wrap">{order.notes}</p>
                            </div>
                        )}
                        <p className="text-xs text-muted-foreground">
                            Created {new Date(order.createdAt).toLocaleString()} · Updated{" "}
                            {new Date(order.updatedAt).toLocaleString()}
                        </p>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
type ActionProps = {
    selection: { order: DeliveryOrder; action: DeliveryOrderAction } | null
    onClose: () => void
    options?: DeliveryOrderOptions
    optionsLoading: boolean
    optionsError?: string
    retryOptions: () => void
    pending: boolean
    error?: string
    onConfirm: (input?: { transitLocationId: number } | Record<string, never>) => Promise<boolean>
}
function ActionContent({
    selection,
    onClose,
    options,
    optionsLoading,
    optionsError,
    retryOptions,
    pending,
    error,
    onConfirm,
}: ActionProps & { selection: NonNullable<ActionProps["selection"]> }) {
    const [transitLocationId, setTransitLocationId] = useState<number | null>(null)
    const { order, action } = selection
    const locations =
        options?.locations
            .filter(
                (row) =>
                    row.isActive &&
                    row.locationType === "In Transit" &&
                    row.locationId !== order.sourceLocationId,
            )
            .map((row) => ({ value: row.locationId, label: row.name })) ?? []
    const title =
        action === "dispatch"
            ? "Dispatch delivery"
            : action === "complete"
              ? "Confirm customer receipt"
              : "Cancel delivery order"
    return (
        <DialogContent showCloseButton={!pending}>
            <DialogHeader>
                <DialogTitle>{title}?</DialogTitle>
                <DialogDescription>
                    {action === "dispatch"
                        ? `${order.deliveryOrderNumber} will move its allocated lot quantities from ${order.sourceLocationName} to In Transit.`
                        : action === "complete"
                          ? `${order.deliveryOrderNumber} will be marked delivered to ${order.customerName}. Its stock will leave company inventory and the sales order fulfillment will be updated.`
                          : `${order.deliveryOrderNumber} will be cancelled and its sales order quantity allocation released.`}
                </DialogDescription>
            </DialogHeader>
            {action === "dispatch" && (
                <>
                    {optionsError && (
                        <Alert variant="destructive">
                            <AlertTitle>Unable to load transit locations</AlertTitle>
                            <AlertDescription>
                                {optionsError}
                                <Button variant="outline" onClick={retryOptions}>
                                    Retry
                                </Button>
                            </AlertDescription>
                        </Alert>
                    )}
                    {optionsLoading && !options ? (
                        <p role="status">Loading transit locations...</p>
                    ) : (
                        <Field>
                            <FieldLabel htmlFor="delivery-transit-location">
                                In Transit location
                            </FieldLabel>
                            <Select
                                items={locations}
                                value={transitLocationId}
                                onValueChange={setTransitLocationId}
                                disabled={pending}
                            >
                                <SelectTrigger id="delivery-transit-location" className="w-full">
                                    <SelectValue placeholder="Select transit location" />
                                </SelectTrigger>
                                <SelectContent>
                                    {locations.map((item) => (
                                        <SelectItem key={item.value} value={item.value}>
                                            {item.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {!locations.length && (
                                <p className="text-sm text-muted-foreground">
                                    Configure an active In Transit location before dispatch.
                                </p>
                            )}
                        </Field>
                    )}
                </>
            )}
            {error && (
                <Alert variant="destructive">
                    <AlertTitle>Unable to update delivery</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}
            <DialogFooter>
                <Button variant="outline" onClick={onClose} disabled={pending}>
                    Keep open
                </Button>
                <Button
                    variant={action === "cancel" ? "destructive" : "default"}
                    disabled={
                        pending ||
                        (action === "dispatch" &&
                            (!transitLocationId ||
                                !locations.some((row) => row.value === transitLocationId) ||
                                Boolean(optionsError)))
                    }
                    onClick={() =>
                        void onConfirm(
                            action === "dispatch" ? { transitLocationId: transitLocationId! } : {},
                        )
                    }
                >
                    {pending ? "Updating..." : title}
                </Button>
            </DialogFooter>
        </DialogContent>
    )
}
export function DeliveryOrderActionDialog(props: ActionProps) {
    return (
        <Dialog
            open={props.selection !== null}
            onOpenChange={(next) => {
                if (!next && !props.pending) props.onClose()
            }}
        >
            {props.selection && (
                <ActionContent
                    key={`${props.selection.order.deliveryOrderId}-${props.selection.action}`}
                    {...props}
                    selection={props.selection}
                />
            )}
        </Dialog>
    )
}
