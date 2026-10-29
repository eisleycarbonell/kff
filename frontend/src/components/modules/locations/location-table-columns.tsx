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
import { type Location } from "@/components/modules/locations/location.schema"

export const locationTableFeatures = tableFeatures({
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
export type LocationTableInstance = ReactTable<typeof locationTableFeatures, Location>
const helper = createColumnHelper<typeof locationTableFeatures, Location>()
const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" })

type Actions = {
    onEdit: (location: Location) => void
    onDeactivate: (locations: Location[]) => void
    canManage: boolean
}
export function createLocationColumns({ onEdit, onDeactivate, canManage }: Actions) {
    return helper.columns([
        helper.display({
            id: "select",
            enableHiding: false,
            header: ({ table }) => (
                <Checkbox
                    aria-label="Select all locations on this page"
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
            header: "Location",
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
                    <span className="text-xs text-muted-foreground">{row.original.code}</span>
                </div>
            ),
        }),
        helper.accessor("code", { header: "Code", sortFn: "text", filterFn: "includesString" }),
        helper.accessor("locationType", {
            header: "Type",
            sortFn: "text",
            filterFn: "equalsString",
            cell: (context) => <Badge variant="outline">{context.getValue()}</Badge>,
        }),
        helper.accessor((location) => (location.isActive ? "Active" : "Inactive"), {
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
        helper.accessor(
            (location) =>
                location.hasOperationalActivity
                    ? "Stock or open work"
                    : location.isInUse
                      ? "History only"
                      : "Unused",
            {
                id: "usage",
                header: "Activity",
                sortFn: "text",
                filterFn: "equalsString",
                enableGlobalFilter: false,
                cell: (context) => (
                    <span className="text-muted-foreground">{context.getValue()}</span>
                ),
            },
        ),
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
                                <DropdownMenuLabel>Manage location</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => onEdit(row.original)}>
                                    <Pencil />
                                    Edit location
                                </DropdownMenuItem>
                                {row.original.isActive && (
                                    <DropdownMenuItem
                                        disabled={row.original.hasOperationalActivity}
                                        onClick={() => onDeactivate([row.original])}
                                    >
                                        <Archive />
                                        Deactivate location
                                    </DropdownMenuItem>
                                )}
                            </DropdownMenuGroup>
                        </DropdownMenuContent>
                    </DropdownMenu>
                ) : null,
        }),
    ])
}
