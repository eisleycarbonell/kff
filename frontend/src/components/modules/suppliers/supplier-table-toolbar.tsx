import { Download, Search, Settings2, X } from "lucide-react"

import type { Supplier } from "@/components/modules/suppliers/supplier.schema"
import type { SupplierTableInstance } from "@/components/modules/suppliers/supplier-table-columns"
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

const statuses = [
    { value: "all", label: "All statuses" },
    { value: "Active", label: "Active" },
    { value: "Inactive", label: "Inactive" },
]
const columnLabels: Record<string, string> = {
    email: "Email",
    status: "Status",
    itemCount: "Linked items",
    activeItemCount: "Active offers",
    preferredItemCount: "Preferred offers",
    orders: "Purchasing",
    createdAt: "Date added",
}

function exportSuppliers(suppliers: Supplier[]) {
    const escape = (value: string) =>
        `"${(/^[\s]*[=+\-@]/.test(value) ? "'" + value : value).replaceAll('"', '""')}"`
    const rows = [
        [
            "Supplier",
            "Email",
            "Status",
            "Linked items",
            "Active offers",
            "Preferred offers",
            "Open purchase orders",
            "Date added",
        ],
        ...suppliers.map((supplier) => [
            supplier.name,
            supplier.email ?? "",
            supplier.isActive ? "Active" : "Inactive",
            String(supplier.itemCount),
            String(supplier.activeItemCount),
            String(supplier.preferredItemCount),
            supplier.hasOpenPurchaseOrders ? "Yes" : "No",
            supplier.createdAt.slice(0, 10),
        ]),
    ]
    const url = URL.createObjectURL(
        new Blob(["\uFEFF" + rows.map((row) => row.map(escape).join(",")).join("\r\n")], {
            type: "text/csv;charset=utf-8;",
        }),
    )
    const link = document.createElement("a")
    link.href = url
    link.download = "kff-suppliers.csv"
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function SupplierTableToolbar({
    table,
    hasFilters,
    onClearFilters,
}: {
    table: SupplierTableInstance
    hasFilters: boolean
    onClearFilters: () => void
}) {
    const filteredRows = table.getFilteredRowModel().rows
    const selectedRows = table.getFilteredSelectedRowModel().rows

    return (
        <div
            role="group"
            aria-label="Supplier table controls"
            className="flex flex-wrap items-center gap-3 border-b p-4 sm:p-5"
        >
            <div className="relative w-full sm:w-64">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                    aria-label="Search suppliers"
                    placeholder="Search name or email..."
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
                items={statuses}
                value={(table.getColumn("status")?.getFilterValue() as string) ?? "all"}
                onValueChange={(value) => {
                    table.getColumn("status")?.setFilterValue(value === "all" ? undefined : value)
                    table.resetRowSelection()
                    table.setPageIndex(0)
                }}
            >
                <SelectTrigger
                    aria-label="Filter suppliers by status"
                    className="min-w-36 bg-card data-[size=default]:h-10"
                >
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {statuses.map((status) => (
                        <SelectItem key={status.value} value={status.value}>
                            {status.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            {hasFilters && (
                <Button variant="ghost" className="h-10" onClick={onClearFilters}>
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
                </div>
            )}
            <div className="flex flex-wrap items-center gap-3 sm:ml-auto">
                <Button
                    variant="outline"
                    className="h-10 gap-2 px-3"
                    disabled={!filteredRows.length}
                    onClick={() =>
                        exportSuppliers(
                            (selectedRows.length ? selectedRows : filteredRows).map(
                                (row) => row.original,
                            ),
                        )
                    }
                >
                    <Download />
                    {selectedRows.length ? "Export selected" : "Export CSV"}
                </Button>
                <DropdownMenu>
                    <DropdownMenuTrigger
                        render={<Button variant="outline" className="h-10 gap-2 px-3" />}
                    >
                        <Settings2 />
                        Columns
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
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
