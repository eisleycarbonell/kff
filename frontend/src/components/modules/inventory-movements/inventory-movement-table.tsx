"use client"

import { useMemo, useState } from "react"
import {
    createColumnHelper,
    createPaginatedRowModel,
    createSortedRowModel,
    rowPaginationFeature,
    rowSortingFeature,
    tableFeatures,
    useTable,
} from "@tanstack/react-table"
import { ArrowDown, ArrowUp, ArrowUpDown, Download, Search, X } from "lucide-react"

import {
    MOVEMENT_TYPES,
    movementQuantityUnits,
    movementSource,
    type InventoryMovement,
    type MovementType,
} from "@/components/modules/inventory-movements/inventory-movement.schema"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"

const features = tableFeatures({
    rowSortingFeature,
    sortedRowModel: createSortedRowModel(),
    rowPaginationFeature,
    paginatedRowModel: createPaginatedRowModel(),
})
const helper = createColumnHelper<typeof features, InventoryMovement>()
const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" })
const columns = helper.columns([
    helper.accessor("createdAt", {
        header: "Date / Time",
        cell: ({ cell }) => dateFormat.format(new Date(cell.getValue())),
    }),
    helper.accessor("transactionType", { header: "Movement" }),
    helper.accessor("itemName", {
        header: "Item / Product",
        cell: ({ row }) => (
            <div className="flex flex-col gap-1">
                <span className="font-medium">{row.original.itemName}</span>
                <span className="text-xs text-muted-foreground">{row.original.itemSku}</span>
            </div>
        ),
    }),
    helper.accessor("lotNumber", { header: "Lot / Batch" }),
    helper.accessor("locationName", {
        header: "Location",
        cell: ({ row }) => (
            <div className="flex flex-col gap-1">
                <span>{row.original.locationName}</span>
                <span className="text-xs text-muted-foreground">{row.original.locationCode}</span>
            </div>
        ),
    }),
    helper.accessor("qtyChange", {
        header: "Quantity Change",
        sortFn: (left, right) => {
            const a = movementQuantityUnits(left.original.qtyChange)
            const b = movementQuantityUnits(right.original.qtyChange)
            return a < b ? -1 : a > b ? 1 : 0
        },
        cell: ({ row }) => (
            <span className="whitespace-nowrap font-medium tabular-nums">
                {movementQuantityUnits(row.original.qtyChange) > BigInt(0) ? "+" : ""}
                {row.original.qtyChange} {row.original.primaryUomName}
            </span>
        ),
    }),
    helper.accessor(movementSource, { id: "source", header: "Source / Reference" }),
    helper.accessor("reasonCode", {
        header: "Reason",
        cell: ({ cell }) => cell.getValue() ?? "—",
    }),
    helper.accessor("actorLastName", {
        header: "Recorded by",
        cell: ({ row }) => `${row.original.actorFirstName} ${row.original.actorLastName}`,
    }),
])

function exportMovements(rows: InventoryMovement[]) {
    const escape = (value: string) =>
        `"${(/^[\s]*[=+\-@]/.test(value) ? "'" + value : value).replaceAll('"', '""')}"`
    const data = [
        [
            "Date / Time",
            "Movement",
            "SKU",
            "Item",
            "Lot",
            "Location",
            "Location code",
            "Quantity change",
            "UOM",
            "Source / Reference",
            "Reason",
            "Recorded by",
        ],
        ...rows.map((row) => [
            row.createdAt,
            row.transactionType,
            row.itemSku,
            row.itemName,
            row.lotNumber,
            row.locationName,
            row.locationCode,
            row.qtyChange,
            row.primaryUomName,
            movementSource(row),
            row.reasonCode ?? "",
            `${row.actorFirstName} ${row.actorLastName}`,
        ]),
    ]
    const url = URL.createObjectURL(
        new Blob(["\uFEFF" + data.map((row) => row.map(escape).join(",")).join("\r\n")], {
            type: "text/csv;charset=utf-8;",
        }),
    )
    const link = document.createElement("a")
    link.href = url
    link.download = "kff-stock-movements.csv"
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function InventoryMovementTable({
    movements,
    adjustmentsOnly = false,
}: {
    movements: InventoryMovement[]
    adjustmentsOnly?: boolean
}) {
    const [search, setSearch] = useState("")
    const [type, setType] = useState<MovementType | "all">("all")
    const [location, setLocation] = useState("all")
    const locations = useMemo(
        () =>
            [
                ...new Map(
                    movements.map((row) => [
                        row.locationId,
                        {
                            value: String(row.locationId),
                            label: `${row.locationName} (${row.locationCode})`,
                        },
                    ]),
                ).values(),
            ].sort((a, b) => a.label.localeCompare(b.label)),
        [movements],
    )
    const filtered = useMemo(() => {
        const term = search.trim().toLowerCase()
        return movements.filter(
            (row) =>
                (type === "all" || row.transactionType === type) &&
                (location === "all" || String(row.locationId) === location) &&
                (!term ||
                    [
                        row.itemName,
                        row.itemSku,
                        row.lotNumber,
                        row.locationName,
                        row.locationCode,
                        row.reasonCode,
                        row.referenceId,
                        movementSource(row),
                        row.actorFirstName,
                        row.actorLastName,
                    ].some((value) => value?.toLowerCase().includes(term))),
        )
    }, [movements, search, type, location])
    const table = useTable({
        features,
        data: filtered,
        columns,
        getRowId: (row) => String(row.transactionId),
        initialState: {
            sorting: [{ id: "createdAt", desc: true }],
            pagination: { pageIndex: 0, pageSize: 20 },
        },
    })
    const { pageIndex, pageSize } = table.state.pagination
    const hasFilters = Boolean(search || type !== "all" || location !== "all")
    const clearFilters = () => {
        setSearch("")
        setType("all")
        setLocation("all")
        table.setPageIndex(0)
    }

    return (
        <div className="min-w-0 overflow-hidden rounded-xl border bg-card text-card-foreground shadow-xs">
            <div
                role="group"
                aria-label="Stock movement table controls"
                className="flex flex-wrap items-center gap-3 border-b p-4 sm:p-5"
            >
                <div className="relative w-full sm:w-64">
                    <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        aria-label="Search stock movements"
                        placeholder="Search items, lots, locations..."
                        className="h-10 pl-10"
                        value={search}
                        onChange={(event) => {
                            setSearch(event.target.value)
                            table.setPageIndex(0)
                        }}
                    />
                </div>
                {!adjustmentsOnly && (
                    <Select
                        items={[
                            { value: "all", label: "All movements" },
                            ...MOVEMENT_TYPES.map((value) => ({ value, label: value })),
                        ]}
                        value={type}
                        onValueChange={(value) => {
                            setType((value ?? "all") as MovementType | "all")
                            table.setPageIndex(0)
                        }}
                    >
                        <SelectTrigger
                            aria-label="Filter by movement type"
                            className="min-w-40 data-[size=default]:h-10"
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectGroup>
                                <SelectItem value="all">All movements</SelectItem>
                                {MOVEMENT_TYPES.map((value) => (
                                    <SelectItem key={value} value={value}>
                                        {value}
                                    </SelectItem>
                                ))}
                            </SelectGroup>
                        </SelectContent>
                    </Select>
                )}
                <Select
                    items={[{ value: "all", label: "All locations" }, ...locations]}
                    value={location}
                    onValueChange={(value) => {
                        setLocation(value ?? "all")
                        table.setPageIndex(0)
                    }}
                >
                    <SelectTrigger
                        aria-label="Filter by location"
                        className="max-w-64 min-w-40 data-[size=default]:h-10"
                    >
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectGroup>
                            <SelectItem value="all">All locations</SelectItem>
                            {locations.map((item) => (
                                <SelectItem key={item.value} value={item.value}>
                                    {item.label}
                                </SelectItem>
                            ))}
                        </SelectGroup>
                    </SelectContent>
                </Select>
                {hasFilters && (
                    <Button variant="ghost" className="h-10" onClick={clearFilters}>
                        <X />
                        Reset
                    </Button>
                )}
                <Button
                    variant="outline"
                    className="h-10 sm:ml-auto"
                    disabled={!filtered.length}
                    onClick={() => exportMovements(filtered)}
                >
                    <Download /> Export CSV
                </Button>
            </div>
            <div className="overflow-x-auto">
                <Table className="min-w-[1100px]">
                    <TableHeader className="bg-muted/50">
                        {table.getHeaderGroups().map((group) => (
                            <TableRow key={group.id}>
                                {group.headers.map((header) => (
                                    <TableHead
                                        key={header.id}
                                        className="h-12 px-3"
                                        aria-sort={
                                            header.column.getCanSort()
                                                ? header.column.getIsSorted() === "asc"
                                                    ? "ascending"
                                                    : header.column.getIsSorted() === "desc"
                                                      ? "descending"
                                                      : "none"
                                                : undefined
                                        }
                                    >
                                        {header.isPlaceholder ? null : header.column.getCanSort() ? (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="-ml-2"
                                                onClick={header.column.getToggleSortingHandler()}
                                            >
                                                <table.FlexRender header={header} />
                                                {header.column.getIsSorted() === "asc" ? (
                                                    <ArrowUp className="size-3.5" />
                                                ) : header.column.getIsSorted() === "desc" ? (
                                                    <ArrowDown className="size-3.5" />
                                                ) : (
                                                    <ArrowUpDown className="size-3.5 text-muted-foreground" />
                                                )}
                                            </Button>
                                        ) : (
                                            <table.FlexRender header={header} />
                                        )}
                                    </TableHead>
                                ))}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {table.getRowModel().rows.length ? (
                            table.getRowModel().rows.map((row) => (
                                <TableRow key={row.id} className="hover:bg-primary/5">
                                    {row.getAllCells().map((cell) => (
                                        <TableCell key={cell.id} className="px-3 py-4">
                                            <table.FlexRender cell={cell} />
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell
                                    colSpan={columns.length}
                                    className="h-44 text-center text-muted-foreground"
                                >
                                    {hasFilters
                                        ? "No movements match your filters."
                                        : adjustmentsOnly
                                          ? "No stock adjustments recorded yet."
                                          : "No stock movements recorded yet."}
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/15 px-5 py-4 text-sm">
                <span className="text-muted-foreground" aria-live="polite">
                    {filtered.length
                        ? `${pageIndex * pageSize + 1}–${Math.min((pageIndex + 1) * pageSize, filtered.length)}`
                        : "0"}{" "}
                    of {filtered.length} movements
                </span>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={!table.getCanPreviousPage()}
                        onClick={() => table.previousPage()}
                    >
                        Previous
                    </Button>
                    <span className="tabular-nums">
                        Page {pageIndex + 1} of {Math.max(table.getPageCount(), 1)}
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={!table.getCanNextPage()}
                        onClick={() => table.nextPage()}
                    >
                        Next
                    </Button>
                </div>
            </div>
        </div>
    )
}
