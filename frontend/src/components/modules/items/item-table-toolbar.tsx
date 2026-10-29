import { Archive, Download, Search, Settings2, X } from "lucide-react"
import { ITEM_TYPES, type Item } from "@/components/modules/items/item.schema"
import type { ItemTableInstance } from "@/components/modules/items/item-table-columns"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

const filters = [
    {
        id: "itemType",
        label: "Filter by item type",
        items: [
            { value: "all", label: "All types" },
            ...ITEM_TYPES.map((value) => ({ value, label: value })),
        ],
    },
    {
        id: "status",
        label: "Filter by status",
        items: [
            { value: "all", label: "All statuses" },
            { value: "Active", label: "Active" },
            { value: "Inactive", label: "Inactive" },
        ],
    },
]
const columnLabels: Record<string, string> = {
    sku: "SKU",
    itemType: "Type",
    primaryUomName: "Primary UOM",
    unitCost: "Reference cost",
    status: "Status",
    requiresQc: "Quality check",
    netWeightG: "Net weight (g)",
    shelfLifeDays: "Shelf life (days)",
    createdAt: "Date added",
}

export function exportItems(items: Item[]) {
    const escape = (value: string) =>
        `"${(/^[\s]*[=+\-@]/.test(value) ? "'" + value : value).replaceAll('"', '""')}"`
    const rows = [
        [
            "SKU",
            "Name",
            "Type",
            "Primary UOM",
            "Reference cost",
            "Net weight (g)",
            "Shelf life (days)",
            "Requires QC",
            "Status",
        ],
        ...items.map((item) => [
            item.sku,
            item.name,
            item.itemType,
            item.primaryUomName,
            item.unitCost,
            item.netWeightG ?? "",
            item.shelfLifeDays?.toString() ?? "",
            item.requiresQc ? "Yes" : "No",
            item.isActive ? "Active" : "Inactive",
        ]),
    ]
    const url = URL.createObjectURL(
        new Blob(["\uFEFF" + rows.map((row) => row.map(escape).join(",")).join("\r\n")], {
            type: "text/csv;charset=utf-8;",
        }),
    )
    const link = document.createElement("a")
    link.href = url
    link.download = "kff-items.csv"
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
}

type Props = {
    table: ItemTableInstance
    hasFilters: boolean
    onClearFilters: () => void
    onDeactivate: (items: Item[]) => void
    canManage: boolean
}
export function ItemTableToolbar({
    table,
    hasFilters,
    onClearFilters,
    onDeactivate,
    canManage,
}: Props) {
    const filtered = table.getFilteredRowModel().rows
    const selected = table.getFilteredSelectedRowModel().rows
    return (
        <div
            role="group"
            aria-label="Item table controls"
            className="flex flex-wrap items-center gap-3 border-b p-4 sm:p-5"
        >
            <div className="relative w-full sm:w-56 xl:w-72">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                    aria-label="Search items"
                    placeholder="Search items or SKUs..."
                    className="h-10 pl-10"
                    value={table.state.globalFilter ?? ""}
                    onChange={(event) => {
                        table.setGlobalFilter(event.target.value)
                        table.resetRowSelection()
                        table.setPageIndex(0)
                    }}
                />
            </div>
            {filters.map((filter) => (
                <Select
                    key={filter.id}
                    items={filter.items}
                    value={(table.getColumn(filter.id)?.getFilterValue() as string) ?? "all"}
                    onValueChange={(value) => {
                        table
                            .getColumn(filter.id)
                            ?.setFilterValue(value === "all" ? undefined : value)
                        table.resetRowSelection()
                        table.setPageIndex(0)
                    }}
                >
                    <SelectTrigger
                        aria-label={filter.label}
                        className="min-w-36 data-[size=default]:h-10"
                    >
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectGroup>
                            {filter.items.map((item) => (
                                <SelectItem key={item.value} value={item.value}>
                                    {item.label}
                                </SelectItem>
                            ))}
                        </SelectGroup>
                    </SelectContent>
                </Select>
            ))}
            {hasFilters && (
                <Button variant="ghost" className="h-10" onClick={onClearFilters}>
                    <X data-icon="inline-start" />
                    Reset
                </Button>
            )}
            {selected.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span aria-live="polite">{selected.length} selected</span>
                    <Button
                        variant="ghost"
                        className="h-10"
                        onClick={() => table.resetRowSelection()}
                    >
                        Clear selection
                    </Button>
                    {canManage && (
                        <Button
                            variant="outline"
                            className="h-10"
                            disabled={!selected.some((row) => row.original.isActive)}
                            onClick={() => onDeactivate(selected.map((row) => row.original))}
                        >
                            <Archive data-icon="inline-start" />
                            Deactivate selected
                        </Button>
                    )}
                </div>
            )}
            <div className="flex flex-wrap items-center gap-3 sm:ml-auto">
                <Button
                    variant="outline"
                    className="h-10"
                    disabled={!filtered.length}
                    onClick={() =>
                        exportItems(
                            (selected.length ? selected : filtered).map((row) => row.original),
                        )
                    }
                >
                    <Download data-icon="inline-start" />
                    {selected.length ? "Export selected" : "Export CSV"}
                </Button>
                <DropdownMenu>
                    <DropdownMenuTrigger render={<Button variant="outline" className="h-10" />}>
                        <Settings2 data-icon="inline-start" />
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
