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
import { Ellipsis, Pencil, Power, PowerOff, UsersRound } from "lucide-react"

import type { Customer } from "@/components/modules/customers/customer.schema"
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

export const customerTableFeatures = tableFeatures({
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

export type CustomerTableInstance = ReactTable<typeof customerTableFeatures, Customer>

const helper = createColumnHelper<typeof customerTableFeatures, Customer>()
const dateFormat = new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
})

type CustomerColumnActions = {
    canManage: boolean
    isUpdating: boolean
    onEdit: (customer: Customer) => void
    onDeactivate: (customer: Customer) => void
    onActivate: (customer: Customer) => Promise<boolean>
}

export function createCustomerColumns({
    canManage,
    isUpdating,
    onEdit,
    onDeactivate,
    onActivate,
}: CustomerColumnActions) {
    return helper.columns([
        helper.display({
            id: "select",
            enableHiding: false,
            header: ({ table }) => (
                <Checkbox
                    aria-label="Select all customers on this page"
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
            header: "Customer",
            enableHiding: false,
            sortFn: "text",
            filterFn: "includesString",
            cell: ({ row }) => (
                <div className="flex items-center gap-3 py-1">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <UsersRound className="size-5" aria-hidden="true" />
                    </div>
                    {canManage ? (
                        <button
                            type="button"
                            disabled={isUpdating}
                            className="rounded-sm text-left font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
                            onClick={() => onEdit(row.original)}
                        >
                            {row.original.name}
                        </button>
                    ) : (
                        <span className="font-medium">{row.original.name}</span>
                    )}
                </div>
            ),
        }),
        helper.accessor((customer) => customer.contactName ?? "", {
            id: "contactName",
            header: "Contact person",
            sortFn: "text",
            filterFn: "includesString",
            enableGlobalFilter: true,
            cell: ({ cell }) => <span className="text-muted-foreground">{cell.getValue()}</span>,
        }),
        helper.accessor((customer) => customer.email ?? "", {
            id: "email",
            header: "Email",
            sortFn: "text",
            filterFn: "includesString",
            enableGlobalFilter: true,
            cell: ({ cell }) => cell.getValue() ? (
                <a
                    className="text-muted-foreground underline-offset-4 hover:underline"
                    href={`mailto:${cell.getValue()}`}
                >
                    {cell.getValue()}
                </a>
            ) : null,
        }),
        helper.accessor((customer) => customer.phone ?? "", {
            id: "phone",
            header: "Phone",
            sortFn: "text",
            filterFn: "includesString",
            enableGlobalFilter: true,
            cell: ({ cell }) => <span className="text-muted-foreground">{cell.getValue()}</span>,
        }),
        helper.accessor((customer) => customer.address ?? "", {
            id: "address",
            header: "Address",
            sortFn: "text",
            filterFn: "includesString",
            enableGlobalFilter: true,
            cell: ({ cell }) => (
                <span className="block max-w-72 whitespace-pre-wrap text-muted-foreground">
                    {cell.getValue()}
                </span>
            ),
        }),
        helper.accessor((customer) => customer.notes ?? "", {
            id: "notes",
            header: "Notes",
            enableSorting: false,
            enableGlobalFilter: false,
            cell: ({ cell }) => (
                <span className="block max-w-80 whitespace-pre-wrap text-muted-foreground">
                    {cell.getValue()}
                </span>
            ),
        }),
        helper.accessor((customer) => customer.isActive ? "Active" : "Inactive", {
            id: "status",
            header: "Status",
            sortFn: "text",
            filterFn: "equalsString",
            enableGlobalFilter: false,
            cell: ({ row, cell }) => (
                <Badge
                    variant="secondary"
                    className={row.original.isActive ? "bg-primary/10 text-primary" : "text-muted-foreground"}
                >
                    {cell.getValue()}
                </Badge>
            ),
        }),
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
        ...(canManage ? [helper.display({
            id: "actions",
            enableHiding: false,
            header: () => <span className="sr-only">Actions</span>,
            cell: ({ row }) => (
                <DropdownMenu>
                    <DropdownMenuTrigger
                        disabled={isUpdating}
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
                    <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuGroup>
                            <DropdownMenuLabel>Customer actions</DropdownMenuLabel>
                            <DropdownMenuItem disabled={isUpdating} onClick={() => onEdit(row.original)}>
                                <Pencil />
                                Edit customer
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {row.original.isActive ? (
                                <DropdownMenuItem disabled={isUpdating} onClick={() => onDeactivate(row.original)}>
                                    <PowerOff />
                                    Deactivate customer
                                </DropdownMenuItem>
                            ) : (
                                <DropdownMenuItem disabled={isUpdating} onClick={() => void onActivate(row.original)}>
                                    <Power />
                                    Reactivate customer
                                </DropdownMenuItem>
                            )}
                        </DropdownMenuGroup>
                    </DropdownMenuContent>
                </DropdownMenu>
            ),
        })] : []),
    ])
}
