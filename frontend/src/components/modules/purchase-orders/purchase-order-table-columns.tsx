"use client"

import {
    columnFilteringFeature,
    columnVisibilityFeature,
    createColumnHelper,
    createFilteredRowModel,
    createPaginatedRowModel,
    createSortedRowModel,
    filterFn_equals,
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
import { Ellipsis, Eye, Pencil, Send, XCircle } from "lucide-react"

import {
    comparePurchaseOrderDecimals,
    formatPurchaseOrderDecimal,
    type PurchaseOrder,
} from "@/components/modules/purchase-orders/purchase-order.schema"
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

export const purchaseOrderTableFeatures = tableFeatures({
    columnFilteringFeature,
    globalFilteringFeature,
    filteredRowModel: createFilteredRowModel(),
    filterFns: {
        includesString: filterFn_includesString,
        equalsString: filterFn_equalsString,
        equals: filterFn_equals,
    },
    rowSortingFeature,
    sortedRowModel: createSortedRowModel(),
    sortFns: { text: sortFn_text },
    rowPaginationFeature,
    paginatedRowModel: createPaginatedRowModel(),
    rowSelectionFeature,
    columnVisibilityFeature,
})
export type PurchaseOrderTableInstance = ReactTable<
    typeof purchaseOrderTableFeatures,
    PurchaseOrder
>
const helper = createColumnHelper<typeof purchaseOrderTableFeatures, PurchaseOrder>()
const dateFormat = new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
})

type Actions = {
    canManage: boolean
    isBusy: boolean
    onView: (order: PurchaseOrder) => void
    onEdit: (order: PurchaseOrder) => void
    onSend: (order: PurchaseOrder) => void
    onCancel: (order: PurchaseOrder) => void
}

export function createPurchaseOrderColumns({
    canManage,
    isBusy,
    onView,
    onEdit,
    onSend,
    onCancel,
}: Actions) {
    return helper.columns([
        helper.display({
            id: "select",
            enableHiding: false,
            header: ({ table }) => (
                <Checkbox
                    aria-label="Select all purchase orders on this page"
                    checked={table.getIsAllPageRowsSelected()}
                    indeterminate={
                        table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()
                    }
                    onCheckedChange={(checked) => table.toggleAllPageRowsSelected(checked)}
                />
            ),
            cell: ({ row }) => (
                <Checkbox
                    aria-label={`Select ${row.original.poNumber}`}
                    checked={row.getIsSelected()}
                    onCheckedChange={(checked) => row.toggleSelected(checked)}
                />
            ),
        }),
        helper.accessor("poNumber", {
            header: "PO number",
            enableHiding: false,
            sortFn: "text",
            filterFn: "includesString",
            cell: ({ row }) => (
                <button
                    type="button"
                    className="rounded-sm text-left font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => onView(row.original)}
                >
                    {row.original.poNumber}
                </button>
            ),
        }),
        helper.accessor("supplierName", {
            header: "Supplier",
            sortFn: "text",
            filterFn: "equals",
            cell: ({ row }) => (
                <div>
                    <p>{row.original.supplierName}</p>
                    {!row.original.supplierIsActive && (
                        <p className="mt-0.5 text-xs text-muted-foreground">Inactive supplier</p>
                    )}
                </div>
            ),
        }),
        helper.accessor("status", {
            header: "Status",
            sortFn: "text",
            filterFn: "equalsString",
            enableGlobalFilter: false,
            cell: ({ cell }) => (
                <Badge
                    variant="secondary"
                    className={
                        cell.getValue() === "Completed"
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground"
                    }
                >
                    {cell.getValue()}
                </Badge>
            ),
        }),
        helper.accessor("orderDate", {
            header: "Order date",
            sortFn: "text",
            enableGlobalFilter: false,
            cell: ({ cell }) => (
                <span className="text-muted-foreground">
                    {dateFormat.format(new Date(cell.getValue()))}
                </span>
            ),
        }),
        helper.accessor("expectedDeliveryDate", {
            header: "Expected delivery",
            sortFn: "text",
            enableGlobalFilter: false,
            cell: ({ cell }) => (
                <span className="text-muted-foreground">
                    {cell.getValue() ? dateFormat.format(new Date(cell.getValue()!)) : "Not set"}
                </span>
            ),
        }),
        helper.accessor("lineCount", {
            header: "Lines",
            enableGlobalFilter: false,
            sortFn: (left, right, columnId) =>
                left.getValue<number>(columnId) - right.getValue<number>(columnId),
            cell: ({ cell }) => <span className="tabular-nums">{cell.getValue()}</span>,
        }),
        helper.accessor("totalAmount", {
            header: "Order value",
            enableGlobalFilter: false,
            sortFn: (left, right, columnId) =>
                comparePurchaseOrderDecimals(
                    left.getValue<string>(columnId),
                    right.getValue<string>(columnId),
                ),
            cell: ({ cell }) => (
                <span className="font-medium tabular-nums">
                    {formatPurchaseOrderDecimal(cell.getValue())}
                </span>
            ),
        }),
        helper.accessor("outstandingAmount", {
            header: "Outstanding value",
            enableGlobalFilter: false,
            sortFn: (left, right, columnId) =>
                comparePurchaseOrderDecimals(
                    left.getValue<string>(columnId),
                    right.getValue<string>(columnId),
                ),
            cell: ({ cell }) => (
                <span className="tabular-nums">{formatPurchaseOrderDecimal(cell.getValue())}</span>
            ),
        }),
        helper.display({
            id: "actions",
            enableHiding: false,
            header: () => <span className="sr-only">Actions</span>,
            cell: ({ row }) => {
                const order = row.original
                const draft = order.status === "Draft" && !order.hasReceipts
                const cancellable =
                    (order.status === "Draft" || order.status === "Sent") && !order.hasReceipts
                return (
                    <DropdownMenu>
                        <DropdownMenuTrigger
                            render={
                                <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    aria-label={`Actions for ${order.poNumber}`}
                                />
                            }
                        >
                            <Ellipsis />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuGroup>
                                <DropdownMenuLabel>Purchase order</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => onView(order)}>
                                    <Eye />
                                    View order
                                </DropdownMenuItem>
                                {canManage && (draft || cancellable) && (
                                    <>
                                        <DropdownMenuSeparator />
                                        {draft && (
                                            <>
                                                <DropdownMenuItem
                                                    disabled={isBusy}
                                                    onClick={() => onEdit(order)}
                                                >
                                                    <Pencil />
                                                    Edit draft
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    disabled={isBusy}
                                                    onClick={() => onSend(order)}
                                                >
                                                    <Send />
                                                    Mark as sent
                                                </DropdownMenuItem>
                                            </>
                                        )}
                                        {cancellable && (
                                            <DropdownMenuItem
                                                disabled={isBusy}
                                                onClick={() => onCancel(order)}
                                            >
                                                <XCircle />
                                                Cancel order
                                            </DropdownMenuItem>
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
