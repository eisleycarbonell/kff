"use client"

import Link from "next/link"
import {
    formatPackingDecimal,
    reservationStatus,
    type PackingDetail,
    type PackingOrder,
} from "@/components/modules/packing-orders/packing-order.schema"
import type { PackingAction } from "@/hooks/modules/packing-orders/use-packing-orders"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"

type Props = {
    open: boolean
    onOpenChange: (open: boolean) => void
    order?: PackingDetail
    loading: boolean
    error?: string
    retry: () => void
    canManage: boolean
    busy: boolean
    onEdit: (order: PackingOrder) => void
    onAction: (order: PackingOrder, action: PackingAction) => void
}
export function PackingOrderDetail({
    open,
    onOpenChange,
    order,
    loading,
    error,
    retry,
    canManage,
    busy,
    onEdit,
    onAction,
}: Props) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-5xl">
                <DialogHeader>
                    <DialogTitle>
                        {order?.packingOrderNumber ?? "Packing order details"}
                    </DialogTitle>
                    <DialogDescription>
                        Review the material snapshot, lot reservations and finished output.
                    </DialogDescription>
                </DialogHeader>
                {error && (
                    <div role="alert" className="space-y-2">
                        <p className="text-sm text-destructive">{error}</p>
                        <Button variant="outline" onClick={retry}>
                            Retry details
                        </Button>
                    </div>
                )}
                {loading && !order ? (
                    <p role="status" className="py-8 text-center text-muted-foreground">
                        Loading packing order…
                    </p>
                ) : (
                    order && (
                        <div className="space-y-6">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <h3 className="font-semibold">{order.itemName}</h3>
                                    <p className="text-sm text-muted-foreground">{order.itemSku}</p>
                                </div>
                                <Badge variant="outline">{order.status}</Badge>
                            </div>
                            <dl className="grid gap-4 rounded-lg border bg-muted/20 p-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
                                {[
                                    [
                                        "Target",
                                        `${formatPackingDecimal(order.targetQty)} ${order.primaryUomName}`,
                                    ],
                                    [
                                        "Actual output",
                                        `${formatPackingDecimal(order.actualQty)} ${order.primaryUomName}`,
                                    ],
                                    ["Scheduled", order.scheduledDate ?? "Unscheduled"],
                                    [
                                        "Material source",
                                        `${order.sourceLocationCode} · ${order.sourceLocationName}`,
                                    ],
                                    [
                                        "Finished goods destination",
                                        `${order.destinationLocationCode} · ${order.destinationLocationName}`,
                                    ],
                                    ["Created", order.createdAt.slice(0, 10)],
                                ].map(([label, value]) => (
                                    <div key={label}>
                                        <dt className="text-muted-foreground">{label}</dt>
                                        <dd className="mt-1 font-medium">{value}</dd>
                                    </div>
                                ))}
                            </dl>
                            {order.notes && (
                                <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                                    {order.notes}
                                </p>
                            )}
                            {canManage && (
                                <div className="flex flex-wrap gap-2">
                                    {order.status === "Draft" && (
                                        <>
                                            <Button
                                                variant="outline"
                                                disabled={busy}
                                                onClick={() => {
                                                    onOpenChange(false)
                                                    onEdit(order)
                                                }}
                                            >
                                                Edit draft
                                            </Button>
                                            <Button
                                                disabled={busy}
                                                onClick={() => {
                                                    onOpenChange(false)
                                                    onAction(order, "plan")
                                                }}
                                            >
                                                Plan and reserve
                                            </Button>
                                        </>
                                    )}
                                    {order.status === "Planned" && (
                                        <Button
                                            disabled={busy}
                                            onClick={() => {
                                                onOpenChange(false)
                                                onAction(order, "start")
                                            }}
                                        >
                                            Start packing
                                        </Button>
                                    )}
                                    {order.status === "In Progress" && (
                                        <Button
                                            disabled={busy}
                                            onClick={() => {
                                                onOpenChange(false)
                                                onAction(order, "complete")
                                            }}
                                        >
                                            Complete packing
                                        </Button>
                                    )}
                                    {!["Completed", "Cancelled"].includes(order.status) && (
                                        <Button
                                            variant="outline"
                                            disabled={busy}
                                            onClick={() => {
                                                onOpenChange(false)
                                                onAction(order, "cancel")
                                            }}
                                        >
                                            Cancel order
                                        </Button>
                                    )}
                                </div>
                            )}
                            <section>
                                <h3 className="mb-1 font-medium">Material snapshot</h3>
                                <p className="mb-3 text-sm text-muted-foreground">
                                    Requirements copied when this order was created. Later formula
                                    changes do not alter these quantities.
                                </p>
                                <div className="overflow-hidden rounded-lg border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Material</TableHead>
                                                <TableHead>Required</TableHead>
                                                <TableHead>Reserved</TableHead>
                                                <TableHead>Consumed</TableHead>
                                                <TableHead>UOM</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {order.materials.map((row) => (
                                                <TableRow key={row.packingOrderMaterialId}>
                                                    <TableCell>
                                                        {row.itemName}
                                                        <p className="text-xs text-muted-foreground">
                                                            {row.itemSku}
                                                        </p>
                                                    </TableCell>
                                                    <TableCell className="tabular-nums">
                                                        {formatPackingDecimal(row.requiredQty)}
                                                    </TableCell>
                                                    <TableCell className="tabular-nums">
                                                        {formatPackingDecimal(row.qtyReserved)}
                                                    </TableCell>
                                                    <TableCell className="tabular-nums">
                                                        {formatPackingDecimal(row.consumedQty)}
                                                    </TableCell>
                                                    <TableCell>{row.uomName}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </section>
                            <section>
                                <h3 className="mb-3 font-medium">Lot reservations</h3>
                                {order.reservations.length ? (
                                    <div className="overflow-hidden rounded-lg border">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Material / lot</TableHead>
                                                    <TableHead>Location</TableHead>
                                                    <TableHead>Reserved</TableHead>
                                                    <TableHead>Consumed</TableHead>
                                                    <TableHead>Outstanding</TableHead>
                                                    <TableHead>Status</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {order.reservations.map((row) => (
                                                    <TableRow key={row.reservationId}>
                                                        <TableCell>
                                                            {row.itemName}
                                                            <p className="text-xs text-muted-foreground">
                                                                {row.lotNumber}
                                                                {row.expirationDate
                                                                    ? ` · expires ${row.expirationDate}`
                                                                    : ""}
                                                            </p>
                                                        </TableCell>
                                                        <TableCell>{row.locationCode}</TableCell>
                                                        <TableCell className="tabular-nums">
                                                            {formatPackingDecimal(row.qtyReserved)}{" "}
                                                            {row.primaryUomName}
                                                        </TableCell>
                                                        <TableCell className="tabular-nums">
                                                            {formatPackingDecimal(row.qtyConsumed)}{" "}
                                                            {row.primaryUomName}
                                                        </TableCell>
                                                        <TableCell className="tabular-nums">
                                                            {formatPackingDecimal(
                                                                row.qtyOutstanding,
                                                            )}{" "}
                                                            {row.primaryUomName}
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge variant="outline">
                                                                {reservationStatus(row)}
                                                            </Badge>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                ) : (
                                    <p className="rounded-lg border p-4 text-sm text-muted-foreground">
                                        Materials are reserved when a draft order is planned.
                                    </p>
                                )}
                            </section>
                            {order.finishedLots.length > 0 && (
                                <section>
                                    <h3 className="mb-3 font-medium">Finished product lots</h3>
                                    <div className="overflow-hidden rounded-lg border">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Lot</TableHead>
                                                    <TableHead>Quality status</TableHead>
                                                    <TableHead>Manufactured</TableHead>
                                                    <TableHead>Expiration</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {order.finishedLots.map((lot) => (
                                                    <TableRow key={lot.lotId}>
                                                        <TableCell>
                                                            <Link
                                                                href="/lots"
                                                                className="font-medium underline-offset-4 hover:underline"
                                                            >
                                                                {lot.lotNumber}
                                                            </Link>
                                                        </TableCell>
                                                        <TableCell>{lot.qcStatus}</TableCell>
                                                        <TableCell>
                                                            {lot.manufactureDate ?? "—"}
                                                        </TableCell>
                                                        <TableCell>
                                                            {lot.expirationDate ?? "—"}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </section>
                            )}
                        </div>
                    )
                )}
            </DialogContent>
        </Dialog>
    )
}
