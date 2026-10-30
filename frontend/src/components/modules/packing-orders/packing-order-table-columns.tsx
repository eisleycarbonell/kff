"use client"

import Link from "next/link"
import {
    columnFilteringFeature,
    columnVisibilityFeature,
    createColumnHelper,
    createFilteredRowModel,
    createPaginatedRowModel,
    createSortedRowModel,
    filterFn_equalsString,
    filterFn_includesString,
    globalFilteringFeature,
    rowPaginationFeature,
    rowSelectionFeature,
    rowSortingFeature,
    sortFn_text,
    tableFeatures,
} from "@tanstack/react-table"
import { CalendarCheck, Ellipsis, Eye, PackageCheck, Pencil, Play, X } from "lucide-react"
import {
    comparePackingDecimals,
    formatPackingDecimal,
    reservationStatus,
    type PackingOrder,
    type Reservation,
} from "@/components/modules/packing-orders/packing-order.schema"
import type { PackingAction } from "@/hooks/modules/packing-orders/use-packing-orders"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export const features = tableFeatures({
    columnFilteringFeature,
    globalFilteringFeature,
    filteredRowModel: createFilteredRowModel(),
    filterFns: { includesString: filterFn_includesString, equalsString: filterFn_equalsString },
    rowSortingFeature,
    sortedRowModel: createSortedRowModel(),
    sortFns: { text: sortFn_text },
    rowPaginationFeature,
    paginatedRowModel: createPaginatedRowModel(),
    rowSelectionFeature,
    columnVisibilityFeature,
})
const helper = createColumnHelper<typeof features, PackingOrder>()
const reservationHelper = createColumnHelper<typeof features, Reservation>()
export type Actions = {
    onView: (id: number) => void
    onEdit: (order: PackingOrder) => void
    onAction: (order: PackingOrder, action: PackingAction) => void
    canManage: boolean
    busy: boolean
}
export const labels: Record<string, string> = {
    packingOrderNumber: "Order",
    product: "Product",
    status: "Status",
    targetQty: "Target",
    actualQty: "Actual",
    source: "Source",
    destination: "Destination",
    scheduledDate: "Scheduled",
    createdAt: "Created",
    order: "Order",
    item: "Material",
    lot: "Lot",
    location: "Location",
    qtyReserved: "Reserved",
    qtyConsumed: "Consumed",
    qtyOutstanding: "Outstanding",
    expirationDate: "Expiration",
}
export function orderColumns({ onView, onEdit, onAction, canManage, busy }: Actions) {
    return helper.columns([
        helper.display({
            id: "select",
            enableHiding: false,
            header: ({ table }) => (
                <Checkbox
                    aria-label="Select all orders on page"
                    checked={table.getIsAllPageRowsSelected()}
                    indeterminate={
                        table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()
                    }
                    onCheckedChange={(checked) => table.toggleAllPageRowsSelected(checked)}
                />
            ),
            cell: ({ row }) => (
                <Checkbox
                    aria-label={`Select ${row.original.packingOrderNumber}`}
                    checked={row.getIsSelected()}
                    onCheckedChange={(checked) => row.toggleSelected(checked)}
                />
            ),
        }),
        helper.accessor("packingOrderNumber", {
            header: "Order",
            sortFn: "text",
            enableHiding: false,
            cell: ({ row }) => (
                <button
                    className="font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => onView(row.original.packingOrderId)}
                >
                    {row.original.packingOrderNumber}
                </button>
            ),
        }),
        helper.accessor((row) => `${row.itemName} ${row.itemSku}`, {
            id: "product",
            header: "Product",
            sortFn: "text",
            cell: ({ row }) => (
                <div>
                    {row.original.itemName}
                    <p className="text-xs text-muted-foreground">{row.original.itemSku}</p>
                </div>
            ),
        }),
        helper.accessor("status", {
            header: "Status",
            sortFn: "text",
            filterFn: "equalsString",
            cell: ({ getValue }) => (
                <Badge
                    variant="outline"
                    className={
                        getValue() === "Completed"
                            ? "border-primary/20 bg-primary/10 text-primary"
                            : ""
                    }
                >
                    {getValue()}
                </Badge>
            ),
        }),
        helper.accessor("targetQty", {
            header: "Target",
            sortFn: (a, b) => comparePackingDecimals(a.original.targetQty, b.original.targetQty),
            enableGlobalFilter: false,
            cell: ({ row }) => (
                <span className="tabular-nums">
                    {formatPackingDecimal(row.original.targetQty)}{" "}
                    <span className="text-xs text-muted-foreground">
                        {row.original.primaryUomName}
                    </span>
                </span>
            ),
        }),
        helper.accessor("actualQty", {
            header: "Actual",
            sortFn: (a, b) => comparePackingDecimals(a.original.actualQty, b.original.actualQty),
            enableGlobalFilter: false,
            cell: ({ row }) => (
                <span className="tabular-nums">
                    {formatPackingDecimal(row.original.actualQty)} {row.original.primaryUomName}
                </span>
            ),
        }),
        helper.accessor((row) => `${row.sourceLocationCode} · ${row.sourceLocationName}`, {
            id: "source",
            header: "Source",
            sortFn: "text",
        }),
        helper.accessor(
            (row) => `${row.destinationLocationCode} · ${row.destinationLocationName}`,
            { id: "destination", header: "Destination", sortFn: "text" },
        ),
        helper.accessor("scheduledDate", {
            header: "Scheduled",
            sortFn: "text",
            enableGlobalFilter: false,
            cell: ({ getValue }) => getValue() ?? "Unscheduled",
        }),
        helper.accessor("createdAt", {
            header: "Created",
            sortFn: "text",
            enableGlobalFilter: false,
            cell: ({ getValue }) => getValue().slice(0, 10),
        }),
        helper.display({
            id: "actions",
            enableHiding: false,
            header: () => <span className="sr-only">Actions</span>,
            cell: ({ row }) => {
                const order = row.original
                return (
                    <DropdownMenu>
                        <DropdownMenuTrigger
                            render={
                                <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    aria-label={`Actions for ${order.packingOrderNumber}`}
                                />
                            }
                        >
                            <Ellipsis />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuGroup>
                                <DropdownMenuLabel>Packing order</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => onView(order.packingOrderId)}>
                                    <Eye />
                                    View details
                                </DropdownMenuItem>
                                {canManage && (
                                    <>
                                        {order.status === "Draft" && (
                                            <>
                                                <DropdownMenuItem
                                                    disabled={busy}
                                                    onClick={() => onEdit(order)}
                                                >
                                                    <Pencil />
                                                    Edit draft
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    disabled={busy}
                                                    onClick={() => onAction(order, "plan")}
                                                >
                                                    <CalendarCheck />
                                                    Plan and reserve
                                                </DropdownMenuItem>
                                            </>
                                        )}
                                        {order.status === "Planned" && (
                                            <DropdownMenuItem
                                                disabled={busy}
                                                onClick={() => onAction(order, "start")}
                                            >
                                                <Play />
                                                Start packing
                                            </DropdownMenuItem>
                                        )}
                                        {order.status === "In Progress" && (
                                            <DropdownMenuItem
                                                disabled={busy}
                                                onClick={() => onAction(order, "complete")}
                                            >
                                                <PackageCheck />
                                                Complete packing
                                            </DropdownMenuItem>
                                        )}
                                        {!["Completed", "Cancelled"].includes(order.status) && (
                                            <>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    variant="destructive"
                                                    disabled={busy}
                                                    onClick={() => onAction(order, "cancel")}
                                                >
                                                    <X />
                                                    Cancel order
                                                </DropdownMenuItem>
                                            </>
                                        )}
                                    </>
                                )}
                            </DropdownMenuGroup>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )
            },
        }),
    ])
}
export function reservationColumns(onView: (id: number) => void) {
    return reservationHelper.columns([
        reservationHelper.display({
            id: "select",
            enableHiding: false,
            header: ({ table }) => (
                <Checkbox
                    aria-label="Select all reservations on page"
                    checked={table.getIsAllPageRowsSelected()}
                    indeterminate={
                        table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()
                    }
                    onCheckedChange={(checked) => table.toggleAllPageRowsSelected(checked)}
                />
            ),
            cell: ({ row }) => (
                <Checkbox
                    aria-label={`Select reservation ${row.original.reservationId}`}
                    checked={row.getIsSelected()}
                    onCheckedChange={(checked) => row.toggleSelected(checked)}
                />
            ),
        }),
        reservationHelper.accessor("packingOrderNumber", {
            id: "order",
            header: "Order",
            sortFn: "text",
            cell: ({ row }) => (
                <button
                    className="font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => onView(row.original.packingOrderId)}
                >
                    {row.original.packingOrderNumber}
                </button>
            ),
        }),
        reservationHelper.accessor((row) => `${row.itemName} ${row.itemSku}`, {
            id: "item",
            header: "Material",
            sortFn: "text",
            cell: ({ row }) => (
                <div>
                    {row.original.itemName}
                    <p className="text-xs text-muted-foreground">{row.original.itemSku}</p>
                </div>
            ),
        }),
        reservationHelper.accessor("lotNumber", {
            id: "lot",
            header: "Lot",
            sortFn: "text",
            cell: ({ row }) => (
                <Link
                    href="/lots"
                    className="underline-offset-4 hover:underline"
                    title="Open lots and batches"
                >
                    {row.original.lotNumber}
                </Link>
            ),
        }),
        reservationHelper.accessor((row) => `${row.locationCode} · ${row.locationName}`, {
            id: "location",
            header: "Location",
            sortFn: "text",
        }),
        reservationHelper.accessor(reservationStatus, {
            id: "status",
            header: "Status",
            filterFn: "equalsString",
            sortFn: "text",
            cell: ({ row }) => (
                <div>
                    <Badge variant="outline">{reservationStatus(row.original)}</Badge>
                    <p className="mt-1 text-xs text-muted-foreground">{row.original.orderStatus}</p>
                </div>
            ),
        }),
        ...(["qtyReserved", "qtyConsumed", "qtyOutstanding"] as const).map((key) =>
            reservationHelper.accessor(key, {
                header: labels[key],
                sortFn: (a, b) => comparePackingDecimals(a.original[key], b.original[key]),
                enableGlobalFilter: false,
                cell: ({ row }) => (
                    <span className="tabular-nums">
                        {formatPackingDecimal(row.original[key])}{" "}
                        <span className="text-xs text-muted-foreground">
                            {row.original.primaryUomName}
                        </span>
                    </span>
                ),
            }),
        ),
        reservationHelper.accessor("expirationDate", {
            header: "Expiration",
            sortFn: "text",
            enableGlobalFilter: false,
            cell: ({ getValue }) => getValue() ?? "No expiration",
        }),
    ])
}
