import { Archive, Download, Search, Settings2, X } from "lucide-react"
import { LOCATION_TYPES, type Location } from "@/components/modules/locations/location.schema"
import type { LocationTableInstance } from "@/components/modules/locations/location-table-columns"
import { downloadCsv } from "@/lib/csv"
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
        id: "locationType",
        label: "Filter by location type",
        items: [
            { value: "all", label: "All types" },
            ...LOCATION_TYPES.map((value) => ({ value, label: value })),
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
    code: "Code",
    locationType: "Type",
    status: "Status",
    usage: "Activity",
    createdAt: "Date added",
}
export function exportLocations(locations: Location[]) {
    downloadCsv("kff-locations.csv", [
        ["Code", "Name", "Type", "Status", "Activity"],
        ...locations.map((location) => [
            location.code,
            location.name,
            location.locationType,
            location.isActive ? "Active" : "Inactive",
            location.hasOperationalActivity
                ? "Stock or open work"
                : location.isInUse
                  ? "History only"
                  : "Unused",
        ]),
    ])
}
type Props = {
    table: LocationTableInstance
    hasFilters: boolean
    onClearFilters: () => void
    onDeactivate: (locations: Location[]) => void
    canManage: boolean
}
export function LocationTableToolbar({
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
            aria-label="Location table controls"
            className="flex flex-wrap items-center gap-3 border-b p-4 sm:p-5"
        >
            <div className="relative w-full sm:w-56 xl:w-72">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                    aria-label="Search locations"
                    placeholder="Search locations or codes..."
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
                    <X />
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
                            disabled={
                                !selected.some(
                                    (row) =>
                                        row.original.isActive &&
                                        !row.original.hasOperationalActivity,
                                )
                            }
                            onClick={() => onDeactivate(selected.map((row) => row.original))}
                        >
                            <Archive />
                            Deactivate eligible
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
                        exportLocations(
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
