"use client"

import {
    columnFilteringFeature,
    columnVisibilityFeature,
    createColumnHelper,
    createFilteredRowModel,
    createPaginatedRowModel,
    createSortedRowModel,
    filterFn_includesString,
    globalFilteringFeature,
    rowPaginationFeature,
    rowSelectionFeature,
    rowSortingFeature,
    sortFn_text,
    tableFeatures,
    type ReactTable,
} from "@tanstack/react-table"
import { Ellipsis, Pencil, Trash2 } from "lucide-react"
import { PERMISSIONS, type Role } from "@/components/modules/roles/role.schema"
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

export const roleTableFeatures = tableFeatures({
    columnFilteringFeature,
    globalFilteringFeature,
    filteredRowModel: createFilteredRowModel(),
    filterFns: { includesString: filterFn_includesString },
    rowSortingFeature,
    sortedRowModel: createSortedRowModel(),
    sortFns: { text: sortFn_text },
    rowPaginationFeature,
    paginatedRowModel: createPaginatedRowModel(),
    rowSelectionFeature,
    columnVisibilityFeature,
})
export type RoleTableInstance = ReactTable<typeof roleTableFeatures, Role>
const helper = createColumnHelper<typeof roleTableFeatures, Role>()
export function createRoleColumns(onEdit: (role: Role) => void, onDelete: (role: Role) => void) {
    return helper.columns([
        helper.display({
            id: "select",
            enableHiding: false,
            header: ({ table }) => (
                <Checkbox
                    aria-label="Select all roles on this page"
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
            header: "Role",
            enableHiding: false,
            sortFn: "text",
            cell: (context) => <span className="font-medium">{context.getValue()}</span>,
        }),
        helper.accessor("description", {
            header: "Description",
            enableGlobalFilter: true,
            cell: (context) => (
                <span className="block max-w-72 whitespace-normal text-muted-foreground">
                    {context.getValue()}
                </span>
            ),
        }),
        helper.accessor(
            (role) =>
                PERMISSIONS.filter(({ key }) => role.settings[key])
                    .map(({ label }) => label)
                    .join(", "),
            {
                id: "permissions",
                header: "Permissions",
                cell: ({ row }) => (
                    <div className="flex max-w-96 flex-wrap gap-1">
                        {PERMISSIONS.filter(({ key }) => row.original.settings[key]).map(
                            ({ key, label }) => (
                                <Badge key={key} variant="secondary">
                                    {label}
                                </Badge>
                            ),
                        )}
                        {!PERMISSIONS.some(({ key }) => row.original.settings[key]) && (
                            <Badge variant="outline">View only</Badge>
                        )}
                    </div>
                ),
            },
        ),
        helper.accessor("activeUserCount", {
            header: "Active users",
            enableGlobalFilter: false,
            sortFn: (a, b) => a.original.activeUserCount - b.original.activeUserCount,
        }),
        helper.accessor("userCount", {
            header: "All assigned users",
            enableGlobalFilter: false,
            sortFn: (a, b) => a.original.userCount - b.original.userCount,
        }),
        helper.accessor((role) => role.settings, {
            id: "permission",
            header: "Permission filter",
            enableHiding: false,
            enableGlobalFilter: false,
            filterFn: (row, _columnId, value) =>
                row.original.settings[value as keyof Role["settings"]] === true,
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
                    <DropdownMenuContent align="end">
                        <DropdownMenuGroup>
                            <DropdownMenuLabel>Role actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => onEdit(row.original)}>
                                <Pencil />
                                Edit role
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                disabled={row.original.userCount > 0}
                                onClick={() => onDelete(row.original)}
                            >
                                <Trash2 />
                                {row.original.userCount > 0 ? "Role is assigned" : "Delete role"}
                            </DropdownMenuItem>
                        </DropdownMenuGroup>
                    </DropdownMenuContent>
                </DropdownMenu>
            ),
        }),
    ])
}
