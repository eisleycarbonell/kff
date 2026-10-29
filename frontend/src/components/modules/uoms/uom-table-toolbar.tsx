import { Download, Search, Settings2, X } from "lucide-react"
import type { Uom, UomClass } from "@/components/modules/uoms/uom.schema"
import type { UomTableInstance } from "@/components/modules/uoms/uom-table-columns"
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
const columnLabels: Record<string, string> = {
    uomClassName: "Class",
    factorToBase: "Factor to base",
    kind: "Kind",
    usage: "Usage",
    createdAt: "Date added",
}
export function exportUoms(units: Uom[]) {
    downloadCsv("kff-uoms.csv", [
        ["Name", "Class", "Factor to base", "Kind", "Usage"],
        ...units.map((unit) => [
            unit.name,
            unit.uomClassName,
            unit.factorToBase,
            unit.isBase ? "Base unit" : "Conversion",
            unit.isInUse ? "In use" : "Unused",
        ]),
    ])
}
type Props = {
    table: UomTableInstance
    classes: UomClass[]
    hasFilters: boolean
    onClearFilters: () => void
}
export function UomTableToolbar({ table, classes, hasFilters, onClearFilters }: Props) {
    const filtered = table.getFilteredRowModel().rows
    const selected = table.getFilteredSelectedRowModel().rows
    const filters = [
        {
            id: "uomClassName",
            label: "Filter by unit class",
            items: [
                { value: "all", label: "All classes" },
                ...classes.map((group) => ({ value: String(group.uomClassId), label: group.name })),
            ],
        },
        {
            id: "kind",
            label: "Filter by unit kind",
            items: [
                { value: "all", label: "All units" },
                { value: "Base unit", label: "Base units" },
                { value: "Conversion", label: "Conversions" },
            ],
        },
        {
            id: "usage",
            label: "Filter by usage",
            items: [
                { value: "all", label: "All usage" },
                { value: "In use", label: "In use" },
                { value: "Unused", label: "Unused" },
            ],
        },
    ]
    return (
        <div
            role="group"
            aria-label="UOM table controls"
            className="flex flex-wrap items-center gap-3 border-b p-4 sm:p-5"
        >
            <div className="relative w-full sm:w-56">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                    aria-label="Search units of measure"
                    placeholder="Search units..."
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
                        className="min-w-32 data-[size=default]:h-10"
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
                        exportUoms(
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
