import { Download, Search, Settings2, Trash2, X } from "lucide-react"

import { USER_ROLES, getRoleName, type User } from "@/components/modules/users/user.schema"
import type { UserTableInstance } from "@/components/modules/users/user-table-columns"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

const roleItems = [
    { value: "all", label: "All roles" },
    ...USER_ROLES.map((role) => ({ value: role.name, label: role.name })),
]
const verificationItems = [
    { value: "all", label: "All email statuses" },
    { value: "Verified", label: "Verified" },
    { value: "Unverified", label: "Unverified" },
]
const columnLabels: Record<string, string> = {
    name: "Name",
    email: "Email",
    role: "Role",
    verification: "Email status",
    lastLoginAt: "Last sign in",
    createdAt: "Date added",
}

type UserTableToolbarProps = {
    table: UserTableInstance
    hasFilters: boolean
    onClearFilters: () => void
    onDelete: (users: User[]) => void
}

function exportUsers(users: User[]) {
    const escape = (value: string) =>
        `"${(/^[\s]*[=+\-@]/.test(value) ? "'" + value : value).replaceAll('"', '""')}"`
    const rows = [
        ["First name", "Last name", "Email", "Mobile number", "Role", "Email status", "Date added"],
        ...users.map((user) => [
            user.firstName,
            user.lastName,
            user.email,
            user.mobileNumber ?? "",
            getRoleName(user.roleId),
            user.isEmailVerified ? "Verified" : "Unverified",
            user.createdAt.slice(0, 10),
        ]),
    ]
    const url = URL.createObjectURL(
        new Blob(["\uFEFF" + rows.map((row) => row.map(escape).join(",")).join("\r\n")], {
            type: "text/csv;charset=utf-8;",
        }),
    )
    const link = document.createElement("a")
    link.href = url
    link.download = "kff-users.csv"
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function UserTableToolbar({
    table,
    hasFilters,
    onClearFilters,
    onDelete,
}: UserTableToolbarProps) {
    const filteredRows = table.getFilteredRowModel().rows
    const selectedRows = table.getFilteredSelectedRowModel().rows

    return (
        <div
            role="group"
            aria-label="User table controls"
            className="flex flex-wrap items-center gap-3 border-b p-4 sm:p-5"
        >
            <div className="relative w-full sm:w-56 lg:w-64 xl:w-72">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                    aria-label="Search users"
                    placeholder="Search users..."
                    value={table.state.globalFilter ?? ""}
                    onChange={(event) => {
                        table.setGlobalFilter(event.target.value)
                        table.resetRowSelection()
                        table.setPageIndex(0)
                    }}
                    className="h-10 bg-card pl-10"
                />
            </div>
            <Select
                items={roleItems}
                value={(table.getColumn("role")?.getFilterValue() as string) ?? "all"}
                onValueChange={(value) => {
                    table.getColumn("role")?.setFilterValue(value === "all" ? undefined : value)
                    table.resetRowSelection()
                    table.setPageIndex(0)
                }}
            >
                <SelectTrigger
                    aria-label="Filter by role"
                    className="min-w-36 bg-card data-[size=default]:h-10"
                >
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {roleItems.map((item) => (
                        <SelectItem
                            key={item.value}
                            value={item.value}
                        >
                            {item.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <Select
                items={verificationItems}
                value={(table.getColumn("verification")?.getFilterValue() as string) ?? "all"}
                onValueChange={(value) => {
                    table
                        .getColumn("verification")
                        ?.setFilterValue(value === "all" ? undefined : value)
                    table.resetRowSelection()
                    table.setPageIndex(0)
                }}
            >
                <SelectTrigger
                    aria-label="Filter by email status"
                    className="min-w-44 bg-card data-[size=default]:h-10"
                >
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {verificationItems.map((item) => (
                        <SelectItem
                            key={item.value}
                            value={item.value}
                        >
                            {item.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            {hasFilters && (
                <Button
                    variant="ghost"
                    className="h-10"
                    onClick={onClearFilters}
                >
                    <X />
                    Reset
                </Button>
            )}
            {selectedRows.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium text-primary" aria-live="polite">
                        {selectedRows.length} selected
                    </span>
                    <Button
                        variant="ghost"
                        className="h-10"
                        onClick={() => table.resetRowSelection()}
                    >
                        Clear selection
                    </Button>
                    <Button
                        variant="destructive"
                        className="h-10"
                        onClick={() => onDelete(selectedRows.map((row) => row.original))}
                    >
                        <Trash2 />
                        Delete selected
                    </Button>
                </div>
            )}
            <div className="flex flex-wrap items-center gap-3 sm:ml-auto">
                <Button
                    variant="outline"
                    className="h-10 gap-2 px-3"
                    onClick={() =>
                        exportUsers(
                            (selectedRows.length ? selectedRows : filteredRows).map(
                                (row) => row.original,
                            ),
                        )
                    }
                    disabled={!filteredRows.length}
                >
                    <Download />
                    {selectedRows.length ? "Export selected" : "Export CSV"}
                </Button>
                <DropdownMenu>
                    <DropdownMenuTrigger
                        render={
                            <Button
                                variant="outline"
                                className="h-10 gap-2 px-3"
                            />
                        }
                    >
                        <Settings2 />
                        Columns
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                        align="end"
                        className="w-44"
                    >
                        <DropdownMenuGroup>
                            <DropdownMenuLabel>Visible columns</DropdownMenuLabel>
                            {table
                                .getAllLeafColumns()
                                .filter((column) => column.getCanHide())
                                .map((column) => (
                                    <DropdownMenuCheckboxItem
                                        key={column.id}
                                        checked={column.getIsVisible()}
                                        onCheckedChange={(checked) =>
                                            column.toggleVisibility(checked)
                                        }
                                        closeOnClick={false}
                                    >
                                        {columnLabels[column.id] ?? column.id}
                                    </DropdownMenuCheckboxItem>
                                ))}
                        </DropdownMenuGroup>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    )
}
