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
    type ReactTable,
} from "@tanstack/react-table"
import { Check, Ellipsis, Eye, Pencil, X } from "lucide-react"
import {
    compareSalesDecimals,
    formatSalesDecimal,
    type SalesOrder,
} from "@/components/modules/sales-orders/sales-order.schema"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export const salesOrderTableFeatures = tableFeatures({
    columnFilteringFeature,
    globalFilteringFeature,
    filteredRowModel: createFilteredRowModel(),
    filterFns: {
        includesString: filterFn_includesString,
        equalsString: filterFn_equalsString,
    },
    rowSortingFeature,
    sortedRowModel: createSortedRowModel(),
    sortFns: { text: sortFn_text },
    rowPaginationFeature,
    paginatedRowModel: createPaginatedRowModel(),
    rowSelectionFeature,
    columnVisibilityFeature,
})
export type SalesOrderTableInstance = ReactTable<typeof salesOrderTableFeatures, SalesOrder>
const helper = createColumnHelper<typeof salesOrderTableFeatures, SalesOrder>()
export function SalesOrderStatus({ status }: { status: SalesOrder["status"] }) {
    return (
        <Badge
            variant={status === "Completed" ? "secondary" : "outline"}
            className={
                status === "Completed"
                    ? "bg-primary/10 text-primary"
                    : status === "Cancelled"
                      ? "text-muted-foreground"
                      : ""
            }
        >
            {status}
        </Badge>
    )
}
export type SalesOrderActions = {
    canManage: boolean
    onView: (order: SalesOrder) => void
    onEdit: (order: SalesOrder) => void
    onAction: (order: SalesOrder, action: "confirm" | "cancel") => void
}
export function createSalesOrderColumns({
    canManage,
    onView,
    onEdit,
    onAction,
}: SalesOrderActions) {
    return helper.columns([
        helper.display({
            id: "select",
            enableHiding: false,
            header: ({ table }) => (
                <Checkbox
                    aria-label="Select all orders on this page"
                    checked={table.getIsAllPageRowsSelected()}
                    indeterminate={
                        table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()
                    }
                    onCheckedChange={(checked) => table.toggleAllPageRowsSelected(checked)}
                />
            ),
            cell: ({ row }) => (
                <Checkbox
                    aria-label={`Select ${row.original.salesOrderNumber}`}
                    checked={row.getIsSelected()}
                    onCheckedChange={(checked) => row.toggleSelected(checked)}
                />
            ),
        }),
        helper.accessor("salesOrderNumber", {
            header: "Order number",
            enableHiding: false,
            sortFn: "text",
            cell: ({ row }) => (
                <button
                    className="rounded-sm text-left font-medium underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                    onClick={() => onView(row.original)}
                >
                    {row.original.salesOrderNumber}
                </button>
            ),
        }),
        helper.accessor("customerName", {
            header: "Customer",
            sortFn: "text",
            cell: ({ getValue }) => <span>{getValue()}</span>,
        }),
        helper.accessor("status", {
            header: "Status",
            sortFn: "text",
            filterFn: "equalsString",
            cell: ({ getValue }) => <SalesOrderStatus status={getValue()} />,
        }),
        helper.accessor("orderDate", {
            header: "Order date",
            sortFn: "text",
            enableGlobalFilter: false,
        }),
        helper.accessor("requestedDeliveryDate", {
            header: "Requested delivery",
            sortFn: "text",
            enableGlobalFilter: false,
            cell: ({ getValue }) => getValue() ?? "Not scheduled",
        }),
        helper.accessor("totalAmount", {
            header: "Order total",
            enableGlobalFilter: false,
            sortFn: (a, b) => compareSalesDecimals(a.original.totalAmount, b.original.totalAmount),
            cell: ({ getValue }) => (
                <span className="tabular-nums">{formatSalesDecimal(getValue())}</span>
            ),
        }),
        helper.display({
            id: "actions",
            enableHiding: false,
            header: () => <span className="sr-only">Actions</span>,
            cell: ({ row }) => {
                const order = row.original
                const draft = order.status === "Draft"
                const cancellable =
                    (draft || order.status === "Confirmed") &&
                    order.lines.every(
                        (line) =>
                            compareSalesDecimals(line.qtyDelivered, "0") === 0 &&
                            compareSalesDecimals(line.qtyAllocated, "0") === 0,
                    )
                return (
                    <DropdownMenu>
                        <DropdownMenuTrigger
                            render={
                                <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    aria-label={`Actions for ${order.salesOrderNumber}`}
                                />
                            }
                        >
                            <Ellipsis />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuGroup>
                                <DropdownMenuLabel>Sales order</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => onView(order)}>
                                    <Eye />
                                    View details
                                </DropdownMenuItem>
                                {canManage && draft && (
                                    <>
                                        <DropdownMenuItem onClick={() => onEdit(order)}>
                                            <Pencil />
                                            Edit draft
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            onClick={() => onAction(order, "confirm")}
                                        >
                                            <Check />
                                            Confirm order
                                        </DropdownMenuItem>
                                    </>
                                )}
                                {canManage && cancellable && (
                                    <DropdownMenuItem
                                        variant="destructive"
                                        onClick={() => onAction(order, "cancel")}
                                    >
                                        <X />
                                        Cancel order
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
