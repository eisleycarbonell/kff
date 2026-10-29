import { Download, Search, Settings2, X } from "lucide-react"
import {
    QC_STATUSES,
    type Stock,
} from "@/components/modules/inventory-stocks/inventory-stock.schema"
import type { StockTableInstance } from "@/components/modules/inventory-stocks/inventory-stock-table-columns"
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
const labels: Record<string, string> = {
    sku: "SKU",
    itemType: "Item type",
    lotNumber: "Lot / Batch",
    supplierLotNumber: "Supplier lot",
    locationName: "Location",
    locationCode: "Location code",
    primaryUomName: "UOM",
    qtyOnHand: "On hand",
    qtyReserved: "Reserved",
    qtyAvailable: "Available",
    availability: "Availability",
    qcStatus: "Quality status",
    expirationDate: "Expiry date",
    manufactureDate: "Manufactured",
    lotUnitCost: "Lot cost / UOM",
    lastUpdated: "Last updated",
}
export function exportStocks(stocks: Stock[]) {
    const escape = (value: string) =>
        `"${(/^[\s]*[=+\-@]/.test(value) ? "'" + value : value).replaceAll('"', '""')}"`
    const rows = [
        [
            "SKU",
            "Item",
            "Lot",
            "Supplier lot",
            "Location code",
            "Location",
            "Location type",
            "UOM",
            "On hand",
            "Reserved",
            "Available",
            "Quality status",
            "Expiry date",
            "Lot cost / UOM",
            "Last updated",
        ],
        ...stocks.map((stock) => [
            stock.sku,
            stock.itemName,
            stock.lotNumber,
            stock.supplierLotNumber ?? "",
            stock.locationCode,
            stock.locationName,
            stock.locationType,
            stock.primaryUomName,
            stock.qtyOnHand,
            stock.qtyReserved,
            stock.qtyAvailable,
            stock.qcStatus,
            stock.expirationDate ?? "",
            stock.lotUnitCost ?? "",
            stock.lastUpdated,
        ]),
    ]
    const url = URL.createObjectURL(
        new Blob(["\uFEFF" + rows.map((row) => row.map(escape).join(",")).join("\r\n")], {
            type: "text/csv;charset=utf-8;",
        }),
    )
    const link = document.createElement("a")
    link.href = url
    link.download = "kff-inventory-stocks.csv"
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export function StockTableToolbar({
    table,
    stocks,
    hasFilters,
    onClearFilters,
}: {
    table: StockTableInstance
    stocks: Stock[]
    hasFilters: boolean
    onClearFilters: () => void
}) {
    const filtered = table.getFilteredRowModel().rows
    const selected = table.getFilteredSelectedRowModel().rows
    const items = [
        ...new Map(
            stocks.map((stock) => [
                stock.itemId,
                { value: String(stock.itemId), label: `${stock.itemName} (${stock.sku})` },
            ]),
        ).values(),
    ].sort((a, b) => a.label.localeCompare(b.label))
    const locations = [
        ...new Map(
            stocks.map((stock) => [
                stock.locationId,
                {
                    value: String(stock.locationId),
                    label: `${stock.locationName} (${stock.locationCode})`,
                },
            ]),
        ).values(),
    ].sort((a, b) => a.label.localeCompare(b.label))
    const filters = [
        {
            id: "item",
            label: "Filter by item",
            items: [{ value: "all", label: "All items" }, ...items],
        },
        {
            id: "location",
            label: "Filter by location",
            items: [{ value: "all", label: "All locations" }, ...locations],
        },
        {
            id: "qcStatus",
            label: "Filter by quality status",
            items: [
                { value: "all", label: "All quality statuses" },
                ...QC_STATUSES.map((value) => ({ value, label: value })),
            ],
        },
        {
            id: "availability",
            label: "Filter by availability",
            items: [
                { value: "all", label: "All availability" },
                { value: "Available", label: "Available" },
                { value: "Unavailable", label: "Unavailable" },
            ],
        },
    ]
    return (
        <div
            role="group"
            aria-label="Inventory stock table controls"
            className="flex flex-wrap items-center gap-3 border-b p-4 sm:p-5"
        >
            <div className="relative w-full sm:w-56">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                    aria-label="Search inventory stocks"
                    placeholder="Search items, lots, or locations..."
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
                        className="max-w-64 min-w-36 data-[size=default]:h-10"
                    >
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectGroup>
                            {filter.items.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                    {option.label}
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
                <div className="flex items-center gap-2 text-sm">
                    <span aria-live="polite">{selected.length} selected</span>
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
                    className="h-10"
                    disabled={!filtered.length}
                    onClick={() =>
                        exportStocks(
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
                                        {labels[column.id] ?? column.id}
                                    </DropdownMenuCheckboxItem>
                                ))}
                        </DropdownMenuGroup>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    )
}
