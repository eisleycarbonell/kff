import { Download, Search, Settings2, X } from "lucide-react"

import type { Brand } from "@/components/modules/brands/brand.schema"
import type { BrandTableInstance } from "@/components/modules/brands/brand-table-columns"
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
import { downloadCsv } from "@/lib/csv"

const statusItems = [
    { value: "all", label: "All statuses" },
    { value: "Active", label: "Active" },
    { value: "Inactive", label: "Inactive" },
]
const columnLabels: Record<string, string> = {
    code: "Code",
    name: "Brand",
    description: "Description",
    itemCount: "Items",
    status: "Status",
    createdAt: "Date added",
}

type BrandTableToolbarProps = {
    table: BrandTableInstance
    hasFilters: boolean
    onClearFilters: () => void
}

function exportBrands(brands: Brand[]) {
    downloadCsv("kff-brands.csv", [
        ["Code", "Brand", "Description", "Items", "Status"],
        ...brands.map((brand) => [
            brand.code,
            brand.name,
            brand.description ?? "",
            String(brand.itemCount),
            brand.isActive ? "Active" : "Inactive",
        ]),
    ])
}

export function BrandTableToolbar({ table, hasFilters, onClearFilters }: BrandTableToolbarProps) {
    const filteredRows = table.getFilteredRowModel().rows
    const selectedRows = table.getFilteredSelectedRowModel().rows

    return (
        <div
            role="group"
            aria-label="Brand table controls"
            className="flex flex-wrap items-center gap-3 border-b p-4 sm:p-5"
        >
            <div className="relative w-full sm:w-56 lg:w-64 xl:w-72">
                <Search
                    className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                />
                <Input
                    aria-label="Search brands"
                    placeholder="Search brands..."
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
                items={statusItems}
                value={(table.getColumn("status")?.getFilterValue() as string) ?? "all"}
                onValueChange={(value) => {
                    table.getColumn("status")?.setFilterValue(value === "all" ? undefined : value)
                    table.resetRowSelection()
                    table.setPageIndex(0)
                }}
            >
                <SelectTrigger
                    aria-label="Filter by status"
                    className="min-w-36 bg-card data-[size=default]:h-10"
                >
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {statusItems.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                            {item.label}
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
                        exportBrands(
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
                    <DropdownMenuContent align="end" className="w-44">
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
