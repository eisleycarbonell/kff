"use client"
import { useMemo, type ReactNode } from "react"
import {
    useTable,
    createColumnHelper,
    tableFeatures,
    columnFilteringFeature,
    globalFilteringFeature,
    createFilteredRowModel,
    filterFn_includesString,
    rowSortingFeature,
    createSortedRowModel,
    sortFn_text,
    rowPaginationFeature,
    createPaginatedRowModel,
    columnVisibilityFeature,
    rowSelectionFeature,
} from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu"
import {
    Table,
    TableHeader,
    TableHead,
    TableBody,
    TableRow,
    TableCell,
} from "@/components/ui/table"
import { downloadCsv } from "@/lib/csv"
const features = tableFeatures({
    columnFilteringFeature,
    globalFilteringFeature,
    filteredRowModel: createFilteredRowModel(),
    filterFns: { includesString: filterFn_includesString },
    rowSortingFeature,
    sortedRowModel: createSortedRowModel(),
    sortFns: { text: sortFn_text },
    rowPaginationFeature,
    paginatedRowModel: createPaginatedRowModel(),
    columnVisibilityFeature,
    rowSelectionFeature,
})
export type RecordColumn<T> = { key: string; label: string; value: (row: T) => string }
export type RecordAction<T> = {
    label: string
    run: (row: T) => void
    disabled?: (row: T) => boolean
}
/** Shared rendering for metadata, approval queues and operational report tables. Columns remain feature-owned. */
export function RecordTable<T extends object>({
    rows,
    columns,
    id,
    actions = [],
    name,
    toolbar,
}: {
    rows: T[]
    columns: RecordColumn<T>[]
    id: (row: T) => string
    actions?: RecordAction<T>[]
    name: string
    toolbar?: ReactNode
}) {
    const defs = useMemo(() => {
        const h = createColumnHelper<typeof features, T>()
        return h.columns([
            h.display({
                id: "selection",
                header: ({ table }) => (
                    <Checkbox
                        aria-label="Select page rows"
                        checked={table.getIsAllPageRowsSelected()}
                        onCheckedChange={(v) => table.toggleAllPageRowsSelected(v === true)}
                    />
                ),
                cell: ({ row }) => (
                    <Checkbox
                        aria-label="Select row"
                        checked={row.getIsSelected()}
                        onCheckedChange={(v) => row.toggleSelected(v === true)}
                    />
                ),
                enableHiding: false,
            }),
            ...columns.map((c) =>
                h.accessor(c.value, {
                    id: c.key,
                    header: c.label,
                    cell: (info) => info.getValue(),
                    filterFn: "includesString",
                    sortFn: (a, b) => {
                        const left = c.value(a.original),
                            right = c.value(b.original)
                        if (/^-?\d+(?:\.\d+)?$/.test(left) && /^-?\d+(?:\.\d+)?$/.test(right)) {
                            const units = (v: string) => {
                                const negative = v.startsWith("-")
                                const [whole, fraction = ""] = (negative ? v.slice(1) : v).split(
                                    ".",
                                )
                                const amount =
                                    BigInt(whole) * BigInt(10) ** BigInt(18) +
                                    BigInt(fraction.padEnd(18, "0"))
                                return negative ? -amount : amount
                            }
                            const x = units(left),
                                y = units(right)
                            return x < y ? -1 : x > y ? 1 : 0
                        }
                        return left.localeCompare(right)
                    },
                }),
            ),
            h.display({
                id: "actions",
                header: "Actions",
                enableHiding: false,
                cell: ({ row }) =>
                    actions.length ? (
                        <DropdownMenu>
                            <DropdownMenuTrigger
                                render={<Button variant="ghost" aria-label="Row actions" />}
                            >
                                •••
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                                {actions.map((a) => (
                                    <DropdownMenuItem
                                        key={a.label}
                                        disabled={a.disabled?.(row.original)}
                                        onClick={() => a.run(row.original)}
                                    >
                                        {a.label}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    ) : null,
            }),
        ])
    }, [columns, actions])
    const table = useTable({
        features,
        data: rows,
        columns: defs,
        getRowId: id,
        globalFilterFn: "includesString",
        initialState: { pagination: { pageIndex: 0, pageSize: 10 } },
    })
    function reset() {
        table.setGlobalFilter("")
        table.resetRowSelection()
        table.setPageIndex(0)
    }
    function csv() {
        const selected = table.getFilteredSelectedRowModel().rows
        const exportRows = selected.length ? selected : table.getFilteredRowModel().rows
        const visible = columns.filter((c) => table.getColumn(c.key)?.getIsVisible())
        downloadCsv(name + ".csv", [
            visible.map((c) => c.label),
            ...exportRows.map((r) => visible.map((c) => c.value(r.original))),
        ])
    }
    return (
        <div className="min-w-0 overflow-hidden rounded-xl border bg-card">
            <div className="flex flex-wrap items-center gap-3 border-b p-4">
                <Input
                    className="h-10 max-w-sm"
                    aria-label={"Search " + name}
                    placeholder="Search records…"
                    value={String(table.state.globalFilter ?? "")}
                    onChange={(e) => {
                        table.setGlobalFilter(e.target.value)
                        table.setPageIndex(0)
                        table.resetRowSelection()
                    }}
                />
                <Button variant="outline" onClick={reset}>
                    Reset
                </Button>
                <Button variant="outline" onClick={csv}>
                    Export CSV
                </Button>
                <DropdownMenu>
                    <DropdownMenuTrigger render={<Button variant="outline" />}>
                        Columns
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                        {table
                            .getAllLeafColumns()
                            .filter((c) => c.getCanHide())
                            .map((c) => (
                                <DropdownMenuCheckboxItem
                                    key={c.id}
                                    checked={c.getIsVisible()}
                                    onCheckedChange={(v) => c.toggleVisibility(v === true)}
                                >
                                    {columns.find((x) => x.key === c.id)?.label}
                                </DropdownMenuCheckboxItem>
                            ))}
                    </DropdownMenuContent>
                </DropdownMenu>
                {toolbar}
            </div>
            <Table>
                <TableHeader>
                    <TableRow>
                        {table.getHeaderGroups()[0]?.headers.map((h) => (
                            <TableHead
                                key={h.id}
                                aria-sort={
                                    h.column.getIsSorted() === "asc"
                                        ? "ascending"
                                        : h.column.getIsSorted() === "desc"
                                          ? "descending"
                                          : undefined
                                }
                            >
                                {h.column.getCanSort() ? (
                                    <Button
                                        variant="ghost"
                                        onClick={h.column.getToggleSortingHandler()}
                                    >
                                        <table.FlexRender header={h} />
                                        {h.column.getIsSorted() === "asc"
                                            ? " ↑"
                                            : h.column.getIsSorted() === "desc"
                                              ? " ↓"
                                              : " ↕"}
                                    </Button>
                                ) : (
                                    <table.FlexRender header={h} />
                                )}
                            </TableHead>
                        ))}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {table.getRowModel().rows.map((r) => (
                        <TableRow
                            key={r.id}
                            data-state={r.getIsSelected() ? "selected" : undefined}
                        >
                            {r.getVisibleCells().map((c) => (
                                <TableCell key={c.id} className="px-4 py-3">
                                    <table.FlexRender cell={c} />
                                </TableCell>
                            ))}
                        </TableRow>
                    ))}
                    {!table.getRowModel().rows.length && (
                        <TableRow>
                            <TableCell
                                colSpan={table.getVisibleLeafColumns().length}
                                className="h-32 text-center text-muted-foreground"
                            >
                                No matching records.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t p-4 text-sm">
                <span>
                    {table.getFilteredRowModel().rows.length} records ·{" "}
                    {table.getFilteredSelectedRowModel().rows.length} selected · Page{" "}
                    {table.state.pagination.pageIndex + 1} of {Math.max(1, table.getPageCount())}
                </span>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        disabled={!table.getCanPreviousPage()}
                        onClick={() => table.previousPage()}
                    >
                        Previous
                    </Button>
                    <Button
                        variant="outline"
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
