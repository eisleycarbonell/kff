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
import { Check, Ellipsis, Pencil, Trash2 } from "lucide-react"

import { getRoleName, getUserName, type User } from "@/components/modules/users/user.schema"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
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

export const userTableFeatures = tableFeatures({
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

export type UserTableInstance = ReactTable<typeof userTableFeatures, User>

const helper = createColumnHelper<typeof userTableFeatures, User>()
const dateFormat = new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
})

type UserColumnActions = {
    onEdit: (user: User) => void
    onDelete: (users: User[]) => void
}

export function createUserColumns({ onEdit, onDelete }: UserColumnActions) {
    return helper.columns([
        helper.display({
            id: "select",
            enableHiding: false,
            header: ({ table }) => (
                <Checkbox
                    aria-label="Select all users on this page"
                    checked={table.getIsAllPageRowsSelected()}
                    indeterminate={
                        table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()
                    }
                    onCheckedChange={(checked) => table.toggleAllPageRowsSelected(checked)}
                />
            ),
            cell: ({ row }) => (
                <Checkbox
                    aria-label={`Select ${getUserName(row.original)}`}
                    checked={row.getIsSelected()}
                    onCheckedChange={(checked) => row.toggleSelected(checked)}
                />
            ),
        }),
        helper.accessor((user) => getUserName(user), {
            id: "name",
            header: "Name",
            enableHiding: false,
            sortFn: "text",
            filterFn: "includesString",
            cell: ({ row }) => (
                <div className="flex items-center gap-3 py-1">
                    <Avatar className="size-10">
                        <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
                            {row.original.firstName[0]}
                            {row.original.lastName[0]}
                        </AvatarFallback>
                    </Avatar>
                    <div>
                        <button
                            type="button"
                            className="rounded-sm text-left font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                            onClick={() => onEdit(row.original)}
                        >
                            {getUserName(row.original)}
                        </button>
                        {row.original.mobileNumber && (
                            <div className="mt-0.5 text-xs text-muted-foreground">
                                {row.original.mobileNumber}
                            </div>
                        )}
                    </div>
                </div>
            ),
        }),
        helper.accessor("email", {
            header: "Email",
            sortFn: "text",
            filterFn: "includesString",
            cell: ({ getValue }) => <span className="text-muted-foreground">{getValue()}</span>,
        }),
        helper.accessor((user) => getRoleName(user.roleId), {
            id: "role",
            header: "Role",
            sortFn: "text",
            filterFn: "equalsString",
            cell: ({ getValue }) => (
                <Badge variant="outline" className="bg-muted/40 px-2.5 py-1 font-normal">
                    {getValue()}
                </Badge>
            ),
        }),
        helper.accessor((user) => (user.isEmailVerified ? "Verified" : "Unverified"), {
            id: "verification",
            header: "Email status",
            sortFn: "text",
            filterFn: "equalsString",
            enableGlobalFilter: false,
            cell: ({ row }) =>
                row.original.isEmailVerified ? (
                    <Badge variant="secondary" className="gap-1.5 bg-primary/10 px-2.5 py-1 text-primary">
                        <Check className="size-3.5" />
                        Verified
                    </Badge>
                ) : (
                    <Badge variant="secondary" className="text-muted-foreground">
                        Unverified
                    </Badge>
                ),
        }),
        helper.accessor("lastLoginAt", {
            header: "Last sign in",
            sortFn: "text",
            sortUndefined: "last",
            enableGlobalFilter: false,
            cell: ({ getValue }) => (
                <span className="text-muted-foreground">
                    {getValue()
                        ? dateFormat.format(new Date(getValue()!))
                        : "Never signed in"}
                </span>
            ),
        }),
        helper.accessor("createdAt", {
            header: "Date added",
            sortFn: "text",
            enableGlobalFilter: false,
            cell: ({ getValue }) => (
                <span className="text-muted-foreground">
                    {dateFormat.format(new Date(getValue()))}
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
                                aria-label={`Actions for ${getUserName(row.original)}`}
                            />
                        }
                    >
                        <Ellipsis />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuGroup>
                            <DropdownMenuLabel>Manage user</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => onEdit(row.original)}>
                                <Pencil />
                                Edit user
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                variant="destructive"
                                onClick={() => onDelete([row.original])}
                            >
                                <Trash2 />
                                Delete user
                            </DropdownMenuItem>
                        </DropdownMenuGroup>
                    </DropdownMenuContent>
                </DropdownMenu>
            ),
        }),
    ])
}
