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
import { Archive, Ellipsis, Pencil } from "lucide-react"
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
import { formatItemDecimal, type Item } from "@/components/modules/items/item.schema"

export const itemTableFeatures = tableFeatures({
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
export type ItemTableInstance = ReactTable<typeof itemTableFeatures, Item>
const helper = createColumnHelper<typeof itemTableFeatures, Item>()
const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" })
type Actions = {
    onEdit: (item: Item) => void
    onDeactivate: (items: Item[]) => void
    canManage: boolean
}

export function createItemColumns({ onEdit, onDeactivate, canManage }: Actions) {
    return helper.columns([
        helper.display({
            id: "select",
            enableHiding: false,
            header: ({ table }) => (
                <Checkbox
                    aria-label="Select all items on this page"
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
            header: "Item / Product",
            enableHiding: false,
            sortFn: "text",
            filterFn: "includesString",
            cell: ({ row }) => (
                <div className="flex flex-col gap-1 py-1">
                    {canManage ? (
                        <button
                            type="button"
                            className="rounded-sm text-left font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                            onClick={() => onEdit(row.original)}
                        >
                            {row.original.name}
                        </button>
                    ) : (
                        <span className="font-medium">{row.original.name}</span>
                    )}
                    <span className="text-xs text-muted-foreground">{row.original.sku}</span>
                </div>
            ),
        }),
        helper.accessor("sku", { header: "SKU", sortFn: "text", filterFn: "includesString" }),
        helper.accessor("itemType", {
            header: "Type",
            sortFn: "text",
            filterFn: "equalsString",
            cell: (context) => <Badge variant="outline">{context.getValue()}</Badge>,
        }),
        helper.accessor("primaryUomName", {
            header: "Primary UOM",
            sortFn: "text",
            cell: ({ row }) => (
                <div className="flex flex-col gap-1">
                    <span>{row.original.primaryUomName}</span>
                    <span className="text-xs text-muted-foreground">
                        {row.original.uomClassName}
                    </span>
                </div>
            ),
        }),
        helper.accessor("unitCost", {
            header: "Reference cost",
            sortFn: (a, b, columnId) =>
                Number(a.getValue<string>(columnId)) - Number(b.getValue<string>(columnId)),
            enableGlobalFilter: false,
            cell: (context) => (
                <span className="tabular-nums">{formatItemDecimal(context.getValue())}</span>
            ),
        }),
        helper.accessor((item) => (item.isActive ? "Active" : "Inactive"), {
            id: "status",
            header: "Status",
            sortFn: "text",
            filterFn: "equalsString",
            enableGlobalFilter: false,
            cell: ({ row }) => (
                <Badge variant={row.original.isActive ? "secondary" : "outline"}>
                    {row.original.isActive ? "Active" : "Inactive"}
                </Badge>
            ),
        }),
        helper.accessor((item) => (item.requiresQc ? "Required" : "Not required"), {
            id: "requiresQc",
            header: "Quality check",
            sortFn: "text",
            enableGlobalFilter: false,
        }),
        helper.accessor("netWeightG", {
            header: "Net weight (g)",
            enableGlobalFilter: false,
            cell: (context) =>
                context.getValue() === null ? (
                    <span className="text-muted-foreground">{"\u2014"}</span>
                ) : (
                    formatItemDecimal(context.getValue()!)
                ),
        }),
        helper.accessor("shelfLifeDays", {
            header: "Shelf life (days)",
            enableGlobalFilter: false,
            cell: (context) =>
                context.getValue() ?? <span className="text-muted-foreground">{"\u2014"}</span>,
        }),
        helper.accessor("createdAt", {
            header: "Date added",
            sortFn: "text",
            enableGlobalFilter: false,
            cell: (context) => dateFormat.format(new Date(context.getValue())),
        }),
        helper.display({
            id: "actions",
            enableHiding: false,
            header: () => <span className="sr-only">Actions</span>,
            cell: ({ row }) =>
                canManage ? (
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
                        <DropdownMenuContent align="end">
                            <DropdownMenuGroup>
                                <DropdownMenuLabel>Manage item</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => onEdit(row.original)}>
                                    <Pencil />
                                    Edit item
                                </DropdownMenuItem>
                                {row.original.isActive && (
                                    <DropdownMenuItem onClick={() => onDeactivate([row.original])}>
                                        <Archive />
                                        Deactivate item
                                    </DropdownMenuItem>
                                )}
                            </DropdownMenuGroup>
                        </DropdownMenuContent>
                    </DropdownMenu>
                ) : null,
        }),
    ])
}
