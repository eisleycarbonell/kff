"use client"

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
    Subscribe,
} from "@tanstack/react-table"
import { Ellipsis, Eye, Pencil, Truck, PackageCheck, X } from "lucide-react"
import type { DeliveryOrder } from "@/components/modules/delivery-orders/delivery-order.schema"
import type { DeliveryOrderAction } from "@/hooks/modules/delivery-orders/use-delivery-orders"
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

export const deliveryOrderTableFeatures = tableFeatures({
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
const helper = createColumnHelper<typeof deliveryOrderTableFeatures, DeliveryOrder>()
export const deliveryOrderColumnLabels: Record<string, string> = {
    deliveryOrderNumber: "Delivery",
    salesOrderNumber: "Sales order",
    customerName: "Customer",
    sourceLocationName: "Source",
    status: "Status",
    deliveryDate: "Delivery date",
    lotCount: "Lots",
    notes: "Notes",
}
export type DeliveryOrderTableActions = {
    onView: (id: number) => void
    onEdit: (order: DeliveryOrder) => void
    onAction: (order: DeliveryOrder, action: DeliveryOrderAction) => void
    canManage: boolean
    busy: boolean
}
export function createDeliveryOrderColumns({
    onView,
    onEdit,
    onAction,
    canManage,
    busy,
}: DeliveryOrderTableActions) {
    return helper.columns([
        helper.display({
            id: "select",
            enableHiding: false,
            header: ({ table }) => (
                <Subscribe source={table.atoms.rowSelection}>
                    {() => (
                        <Checkbox
                            aria-label="Select all deliveries on this page"
                            checked={table.getIsAllPageRowsSelected()}
                            indeterminate={
                                table.getIsSomePageRowsSelected() &&
                                !table.getIsAllPageRowsSelected()
                            }
                            onCheckedChange={(checked) => table.toggleAllPageRowsSelected(checked)}
                        />
                    )}
                </Subscribe>
            ),
            cell: ({ row, table }) => (
                <Subscribe
                    source={table.atoms.rowSelection}
                    selector={(selection) => selection[row.id]}
                >
                    {(selected) => (
                        <Checkbox
                            aria-label={`Select ${row.original.deliveryOrderNumber}`}
                            checked={Boolean(selected)}
                            onCheckedChange={(checked) => row.toggleSelected(checked)}
                        />
                    )}
                </Subscribe>
            ),
        }),
        helper.accessor("deliveryOrderNumber", {
            header: "Delivery",
            sortFn: "text",
            enableHiding: false,
            cell: ({ row }) => (
                <button
                    type="button"
                    className="rounded-sm font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => onView(row.original.deliveryOrderId)}
                >
                    {row.original.deliveryOrderNumber}
                </button>
            ),
        }),
        helper.accessor("salesOrderNumber", { header: "Sales order", sortFn: "text" }),
        helper.accessor("customerName", { header: "Customer", sortFn: "text" }),
        helper.accessor("sourceLocationName", { header: "Source", sortFn: "text" }),
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
                            : getValue() === "In Transit"
                              ? "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300"
                              : ""
                    }
                >
                    {getValue()}
                </Badge>
            ),
        }),
        helper.accessor("deliveryDate", {
            header: "Delivery date",
            sortFn: "text",
            enableGlobalFilter: false,
            cell: ({ getValue }) => <time dateTime={getValue()}>{getValue()}</time>,
        }),
        helper.accessor((order) => order.lines.length, {
            id: "lotCount",
            header: "Lots",
            enableGlobalFilter: false,
            sortFn: (a, b) => a.original.lines.length - b.original.lines.length,
        }),
        helper.accessor("notes", {
            header: "Notes",
            sortFn: "text",
            cell: ({ getValue }) => (
                <span className="block max-w-56 truncate" title={getValue() ?? undefined}>
                    {getValue()}
                </span>
            ),
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
                                    aria-label={`Actions for ${order.deliveryOrderNumber}`}
                                />
                            }
                        >
                            <Ellipsis />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuGroup>
                                <DropdownMenuLabel>Delivery order</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => onView(order.deliveryOrderId)}>
                                    <Eye />
                                    View details
                                </DropdownMenuItem>
                                {canManage && order.status === "Draft" && (
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
                                            onClick={() => onAction(order, "dispatch")}
                                        >
                                            <Truck />
                                            Dispatch
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                            variant="destructive"
                                            disabled={busy}
                                            onClick={() => onAction(order, "cancel")}
                                        >
                                            <X />
                                            Cancel delivery
                                        </DropdownMenuItem>
                                    </>
                                )}
                                {canManage && order.status === "In Transit" && (
                                    <DropdownMenuItem
                                        disabled={busy}
                                        onClick={() => onAction(order, "complete")}
                                    >
                                        <PackageCheck />
                                        Confirm customer receipt
                                    </DropdownMenuItem>
                                )}
                            </DropdownMenuGroup>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )
            },
        }),
    ])
}
