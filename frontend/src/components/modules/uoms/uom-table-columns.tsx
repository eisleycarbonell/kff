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
import { Trash2, Ellipsis, Pencil } from "lucide-react"
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
import { factorUnits, formatFactor, type Uom } from "@/components/modules/uoms/uom.schema"

export const uomTableFeatures = tableFeatures({
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
export type UomTableInstance = ReactTable<typeof uomTableFeatures, Uom>
const helper = createColumnHelper<typeof uomTableFeatures, Uom>()
const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" })

type Actions = { onEdit: (unit: Uom) => void; onDelete: (unit: Uom) => void; canManage: boolean }
export function createUomColumns({ onEdit, onDelete, canManage }: Actions) {
    return helper.columns([
        helper.display({
            id: "select",
            enableHiding: false,
            header: ({ table }) => (
                <Checkbox
                    aria-label="Select all units on this page"
                    checked={table.getIsAllPageRowsSelected()}
                    indeterminate={
                        table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()
                    }
                    onCheckedChange={(checked) => table.toggleAllPageRowsSelected(checked)}
                />
            ),
            cell: ({ row }) => (
                <Checkbox
                    aria-label={"Select " + row.original.name}
                    checked={row.getIsSelected()}
                    onCheckedChange={(checked) => row.toggleSelected(checked)}
                />
            ),
        }),
        helper.accessor("name", {
            header: "Unit",
            enableHiding: false,
            sortFn: "text",
            filterFn: "includesString",
            cell: ({ row }) =>
                canManage ? (
                    <button
                        type="button"
                        className="rounded-sm text-left font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={() => onEdit(row.original)}
                    >
                        {row.original.name}
                    </button>
                ) : (
                    <span className="font-medium">{row.original.name}</span>
                ),
        }),
        helper.accessor("uomClassName", {
            header: "Class",
            sortFn: "text",
            filterFn: (row, _columnId, value) => String(row.original.uomClassId) === value,
        }),
        helper.accessor("factorToBase", {
            header: "Factor to base",
            enableGlobalFilter: false,
            sortFn: (a, b, columnId) => {
                const left = factorUnits(a.getValue<string>(columnId)),
                    right = factorUnits(b.getValue<string>(columnId))
                return left < right ? -1 : left > right ? 1 : 0
            },
            cell: (context) => (
                <span className="tabular-nums">{formatFactor(context.getValue())}</span>
            ),
        }),
        helper.accessor((unit) => (unit.isBase ? "Base unit" : "Conversion"), {
            id: "kind",
            header: "Kind",
            sortFn: "text",
            filterFn: "equalsString",
            enableGlobalFilter: false,
            cell: ({ row }) => (
                <Badge variant={row.original.isBase ? "secondary" : "outline"}>
                    {row.original.isBase ? "Base unit" : "Conversion"}
                </Badge>
            ),
        }),
        helper.accessor((unit) => (unit.isInUse ? "In use" : "Unused"), {
            id: "usage",
            header: "Usage",
            sortFn: "text",
            filterFn: "equalsString",
            enableGlobalFilter: false,
            cell: ({ row }) => (
                <div className="flex flex-col gap-1">
                    <span>{row.original.isInUse ? "In use" : "Unused"}</span>
                    {row.original.isClassAnchor && (
                        <span className="text-xs text-muted-foreground">Class base is locked</span>
                    )}
                </div>
            ),
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
                                    aria-label={"Actions for " + row.original.name}
                                />
                            }
                        >
                            <Ellipsis />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuGroup>
                                <DropdownMenuLabel>Manage unit</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => onEdit(row.original)}>
                                    <Pencil />
                                    Edit unit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    disabled={row.original.isInUse || row.original.isClassAnchor}
                                    onClick={() => onDelete(row.original)}
                                >
                                    <Trash2 />
                                    Delete unused unit
                                </DropdownMenuItem>
                            </DropdownMenuGroup>
                        </DropdownMenuContent>
                    </DropdownMenu>
                ) : null,
        }),
    ])
}
