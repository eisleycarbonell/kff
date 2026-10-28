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
import { Ellipsis, Package, Pencil, Power, PowerOff, Truck } from "lucide-react"

import type { Supplier } from "@/components/modules/suppliers/supplier.schema"
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

export const supplierTableFeatures = tableFeatures({
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

export type SupplierTableInstance = ReactTable<typeof supplierTableFeatures, Supplier>
const helper = createColumnHelper<typeof supplierTableFeatures, Supplier>()
const dateFormat = new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
})

type Actions = {
    canManage: boolean
    isBusy: boolean
    onEdit: (supplier: Supplier) => void
    onViewItems: (supplier: Supplier) => void
    onDeactivate: (supplier: Supplier) => void
    onActivate: (supplier: Supplier) => void
}

export function createSupplierColumns({
    canManage,
    isBusy,
    onEdit,
    onViewItems,
    onDeactivate,
    onActivate,
}: Actions) {
    return helper.columns([
        helper.display({
            id: "select",
            enableHiding: false,
            header: ({ table }) => (
                <Checkbox
                    aria-label="Select all suppliers on this page"
                    checked={table.getIsAllPageRowsSelected()}
                    indeterminate={
                        table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()
                    }
                    onCheckedChange={(checked) => table.toggleAllPageRowsSelected(checked)}
                />
            ),
            cell: ({ row }) => (
                <Checkbox
                    aria-label={`Select ${row.original.name}`}
                    checked={row.getIsSelected()}
                    onCheckedChange={(checked) => row.toggleSelected(checked)}
                />
            ),
        }),
        helper.accessor("name", {
            header: "Supplier",
            enableHiding: false,
            sortFn: "text",
            filterFn: "includesString",
            cell: ({ row }) => (
                <div className="flex items-center gap-3 py-1">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Truck className="size-5" aria-hidden="true" />
                    </div>
                    <button
                        type="button"
                        className="rounded-sm text-left font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={() => onViewItems(row.original)}
                    >
                        {row.original.name}
                    </button>
                </div>
            ),
        }),
        helper.accessor("email", {
            header: "Email",
            sortFn: "text",
            filterFn: "includesString",
            cell: ({ cell }) =>
                cell.getValue() ? (
                    <a
                        className="text-muted-foreground underline-offset-4 hover:underline"
                        href={`mailto:${cell.getValue()}`}
                    >
                        {cell.getValue()}
                    </a>
                ) : (
                    <span className="text-muted-foreground">—</span>
                ),
        }),
        helper.accessor((supplier) => (supplier.isActive ? "Active" : "Inactive"), {
            id: "status",
            header: "Status",
            sortFn: "text",
            filterFn: "equalsString",
            enableGlobalFilter: false,
            cell: ({ row, cell }) => (
                <Badge
                    variant="secondary"
                    className={
                        row.original.isActive
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground"
                    }
                >
                    {cell.getValue()}
                </Badge>
            ),
        }),
        helper.accessor("itemCount", {
            header: "Linked items",
            enableGlobalFilter: false,
            sortFn: (left, right, columnId) =>
                left.getValue<number>(columnId) - right.getValue<number>(columnId),
            cell: ({ cell }) => <span className="tabular-nums">{cell.getValue()}</span>,
        }),
        helper.accessor("activeItemCount", {
            header: "Active offers",
            enableGlobalFilter: false,
            sortFn: (left, right, columnId) =>
                left.getValue<number>(columnId) - right.getValue<number>(columnId),
            cell: ({ cell }) => <span className="tabular-nums">{cell.getValue()}</span>,
        }),
        helper.accessor("preferredItemCount", {
            header: "Preferred offers",
            enableGlobalFilter: false,
            sortFn: (left, right, columnId) =>
                left.getValue<number>(columnId) - right.getValue<number>(columnId),
            cell: ({ cell }) => <span className="tabular-nums">{cell.getValue()}</span>,
        }),
        helper.accessor(
            (supplier) => (supplier.hasOpenPurchaseOrders ? "Open orders" : "No open orders"),
            {
                id: "orders",
                header: "Purchasing",
                sortFn: "text",
                enableGlobalFilter: false,
                cell: ({ row, cell }) =>
                    row.original.hasOpenPurchaseOrders ? (
                        <Badge variant="outline">{cell.getValue()}</Badge>
                    ) : (
                        <span className="text-muted-foreground">{cell.getValue()}</span>
                    ),
            },
        ),
        helper.accessor("createdAt", {
            header: "Date added",
            sortFn: "text",
            enableGlobalFilter: false,
            cell: ({ cell }) => (
                <span className="text-muted-foreground">
                    {dateFormat.format(new Date(cell.getValue()))}
                </span>
            ),
        }),
        helper.display({
            id: "actions",
            enableHiding: false,
            header: () => <span className="sr-only">Actions</span>,
            cell: ({ row }) => (
                <DropdownMenu>
                    <DropdownMenuTrigger
                        render={
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Actions for ${row.original.name}`}
                            />
                        }
                    >
                        <Ellipsis />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52">
                        <DropdownMenuGroup>
                            <DropdownMenuLabel>Supplier actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => onViewItems(row.original)}>
                                <Package />
                                View supplied items
                            </DropdownMenuItem>
                            {canManage && (
                                <>
                                    <DropdownMenuItem
                                        disabled={isBusy}
                                        onClick={() => onEdit(row.original)}
                                    >
                                        <Pencil />
                                        Edit supplier
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    {row.original.isActive ? (
                                        <DropdownMenuItem
                                            disabled={isBusy || row.original.hasOpenPurchaseOrders}
                                            onClick={() => onDeactivate(row.original)}
                                        >
                                            <PowerOff />
                                            {row.original.hasOpenPurchaseOrders
                                                ? "Open orders prevent deactivation"
                                                : "Deactivate supplier"}
                                        </DropdownMenuItem>
                                    ) : (
                                        <DropdownMenuItem
                                            disabled={isBusy}
                                            onClick={() => onActivate(row.original)}
                                        >
                                            <Power />
                                            Reactivate supplier
                                        </DropdownMenuItem>
                                    )}
                                </>
                            )}
                        </DropdownMenuGroup>
                    </DropdownMenuContent>
                </DropdownMenu>
            ),
        }),
    ])
}
