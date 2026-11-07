import { Download, Search, Settings2, X } from "lucide-react"
import { PERMISSIONS, type Role } from "@/components/modules/roles/role.schema"
import type { RoleTableInstance } from "@/components/modules/roles/role-table-columns"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const permissionItems = [
    { value: "all", label: "All permissions" },
    ...PERMISSIONS.map(({ key, label }) => ({ value: key, label })),
]
const columnLabels: Record<string, string> = {
    description: "Description",
    permissions: "Permissions",
    activeUserCount: "Active users",
    userCount: "All assigned users",
}
function exportRoles(roles: Role[]) {
    const escape = (value: string) =>
        `"${(/^[\s]*[=+\-@]/.test(value) ? "'" + value : value).replaceAll('"', '""')}"`
    const rows = [
        [
            "Role",
            "Description",
            "Active users",
            "All assigned users",
            ...PERMISSIONS.map(({ label }) => label),
        ],
        ...roles.map((role) => [
            role.name,
            role.description ?? "",
            String(role.activeUserCount),
            String(role.userCount),
            ...PERMISSIONS.map(({ key }) => (role.settings[key] ? "Yes" : "No")),
        ]),
    ]
    const url = URL.createObjectURL(
        new Blob(["\uFEFF" + rows.map((row) => row.map(escape).join(",")).join("\r\n")], {
            type: "text/csv;charset=utf-8;",
        }),
    )
    const link = document.createElement("a")
    link.href = url
    link.download = "kff-roles.csv"
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export function RoleTableToolbar({
    table,
    hasFilters,
    onReset,
}: {
    table: RoleTableInstance
    hasFilters: boolean
    onReset: () => void
}) {
    const filtered = table.getFilteredRowModel().rows
    const selected = table.getFilteredSelectedRowModel().rows
    return (
        <div
            className="flex flex-wrap items-center gap-3 border-b p-4 sm:p-5"
            role="group"
            aria-label="Role table controls"
        >
            <div className="relative w-full sm:w-64">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                    className="h-10 pl-10"
                    aria-label="Search roles"
                    placeholder="Search roles..."
                    value={table.state.globalFilter ?? ""}
                    onChange={(event) => {
                        table.setGlobalFilter(event.target.value)
                        table.resetRowSelection()
                        table.setPageIndex(0)
                    }}
                />
            </div>
            <Select
                items={permissionItems}
                value={(table.getColumn("permission")?.getFilterValue() as string) ?? "all"}
                onValueChange={(value) => {
                    table
                        .getColumn("permission")
                        ?.setFilterValue(value === "all" ? undefined : value)
                    table.resetRowSelection()
                    table.setPageIndex(0)
                }}
            >
                <SelectTrigger
                    className="min-w-44 data-[size=default]:h-10"
                    aria-label="Filter by permission"
                >
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {permissionItems.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                            {item.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            {hasFilters && (
                <Button variant="ghost" className="h-10" onClick={onReset}>
                    <X />
                    Reset
                </Button>
            )}
            {selected.length > 0 && (
                <Button variant="ghost" className="h-10" onClick={() => table.resetRowSelection()}>
                    {selected.length} selected / Clear
                </Button>
            )}
            <div className="flex flex-wrap gap-3 sm:ml-auto">
                <Button
                    variant="outline"
                    className="h-10"
                    disabled={!filtered.length}
                    onClick={() =>
                        exportRoles(
                            (selected.length ? selected : filtered).map((row) => row.original),
                        )
                    }
                >
                    <Download />
                    {selected.length ? "Export selected" : "Export CSV"}
                </Button>
                <DropdownMenu>
                    <DropdownMenuTrigger render={<Button variant="outline" className="h-10" />}>
                        <Settings2 />
                        Columns
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
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
