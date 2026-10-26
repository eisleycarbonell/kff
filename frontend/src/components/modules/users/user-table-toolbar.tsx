import { Download, Plus, Search, Settings2, Trash2, X } from "lucide-react"

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
    onAdd: () => void
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
    onAdd,
    onDelete,
}: UserTableToolbarProps) {
    const filteredRows = table.getFilteredRowModel().rows
    const selectedRows = table.getFilteredSelectedRowModel().rows

    return (
        <div className="flex flex-col gap-4 p-4">
            <div className="flex flex-wrap items-end justify-end gap-3">
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
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
                    <Button onClick={onAdd}>
                        <Plus />
                        Add user
                    </Button>
                </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-full sm:max-w-72">
                    <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        aria-label="Search users"
                        placeholder="Search name, email, or role..."
                        value={table.state.globalFilter ?? ""}
                        onChange={(event) => {
                            table.setGlobalFilter(event.target.value)
                            table.resetRowSelection()
                            table.setPageIndex(0)
                        }}
                        className="pl-8"
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
                        className="min-w-36"
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
                        className="min-w-40"
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
                        onClick={onClearFilters}
                    >
                        <X />
                        Reset
                    </Button>
                )}
                <DropdownMenu>
                    <DropdownMenuTrigger
                        render={
                            <Button
                                variant="outline"
                                className="sm:ml-auto"
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
            {selectedRows.length > 0 && (
                <div className="flex flex-wrap items-center gap-3 rounded-lg bg-muted/60 px-3 py-2 text-sm">
                    <span className="font-medium">
                        {selectedRows.length} user
                        {selectedRows.length === 1 ? "" : "s"} selected
                    </span>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => table.resetRowSelection()}
                    >
                        Clear selection
                    </Button>
                    <Button
                        variant="destructive"
                        size="sm"
                        className="ml-auto"
                        onClick={() => onDelete(selectedRows.map((row) => row.original))}
                    >
                        <Trash2 />
                        Delete selected
                    </Button>
                </div>
            )}
        </div>
    )
}
