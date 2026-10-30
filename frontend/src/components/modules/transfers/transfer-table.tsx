"use client"

import { useMemo } from "react"
import { useTable, type ReactTable } from "@tanstack/react-table"
import {
    ArrowDown,
    ArrowUp,
    ArrowUpDown,
    ChevronLeft,
    ChevronRight,
    ClipboardList,
    Download,
    Search,
    Settings2,
    X,
} from "lucide-react"
import { TRANSFER_STATUSES, type Transfer } from "@/components/modules/transfers/transfer.schema"
import {
    features,
    labels,
    transferColumns,
    type TransferTableActions,
} from "@/components/modules/transfers/transfer-table-columns"
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

function exportCsv(name: string, rows: string[][]) {
    const escape = (value: string) =>
        `"${(/^[\s]*[=+\-@]/.test(value) ? "'" + value : value).replaceAll('"', '""')}"`
    const url = URL.createObjectURL(
        new Blob(["\uFEFF" + rows.map((row) => row.map(escape).join(",")).join("\r\n")], {
            type: "text/csv;charset=utf-8;",
        }),
    )
    const link = document.createElement("a")
    link.href = url
    link.download = name
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
}
type GridProps = {
    table: ReactTable<typeof features, Transfer>
    name: string
    statuses: readonly string[]
    onExport: (rows: Transfer[]) => void
    onAdd?: () => void
}
function TransferGrid({ table, name, statuses, onExport, onAdd }: GridProps) {
    const filtered = table.getFilteredRowModel().rows
    const selected = table.getFilteredSelectedRowModel().rows
    const hasFilters = Boolean(table.state.globalFilter) || table.state.columnFilters.length > 0
    const { pageIndex, pageSize } = table.state.pagination
    const statusItems = [
        { value: "all", label: "All statuses" },
        ...statuses.map((value) => ({ value, label: value })),
    ]
    function reset() {
        table.setGlobalFilter("")
        table.resetColumnFilters()
        table.resetRowSelection()
        table.setPageIndex(0)
    }
    return (
        <div className="min-w-0 overflow-hidden rounded-xl border bg-card text-card-foreground shadow-xs">
            <div
                role="group"
                aria-label={`${name} table controls`}
                className="flex flex-wrap items-center gap-3 border-b p-4 sm:p-5"
            >
                <div className="relative w-full sm:w-64">
                    <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        className="h-10 bg-card pl-10"
                        aria-label={`Search ${name}`}
                        placeholder={`Search ${name}…`}
                        value={table.state.globalFilter ?? ""}
                        onChange={(e) => {
                            table.setGlobalFilter(e.target.value)
                            table.resetRowSelection()
                            table.setPageIndex(0)
                        }}
                    />
                </div>
                <Select
                    items={statusItems}
                    value={(table.getColumn("status")?.getFilterValue() as string) ?? "all"}
                    onValueChange={(value) => {
                        table
                            .getColumn("status")
                            ?.setFilterValue(value === "all" ? undefined : value)
                        table.resetRowSelection()
                        table.setPageIndex(0)
                    }}
                >
                    <SelectTrigger
                        className="min-w-40 data-[size=default]:h-10"
                        aria-label="Filter by status"
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
                    <Button variant="ghost" className="h-10" onClick={reset}>
                        <X />
                        Reset
                    </Button>
                )}
                {selected.length > 0 && (
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-primary" aria-live="polite">
                            {selected.length} selected
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
                <div className="flex flex-wrap gap-3 sm:ml-auto">
                    <Button
                        variant="outline"
                        className="h-10"
                        disabled={!filtered.length}
                        onClick={() =>
                            onExport(
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
                                            {labels[column.id] ?? column.id}
                                        </DropdownMenuCheckboxItem>
                                    ))}
                            </DropdownMenuGroup>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
            <Table>
                <TableHeader className="bg-muted/50">
                    {table.getHeaderGroups().map((group) => (
                        <TableRow key={group.id}>
                            {group.headers.map((header) => (
                                <TableHead
                                    key={header.id}
                                    className="h-12 px-4"
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
                            <TableRow
                                key={row.id}
                                className="hover:bg-primary/5 data-[state=selected]:bg-primary/10"
                                data-state={row.getIsSelected() ? "selected" : undefined}
                            >
                                {row.getVisibleCells().map((cell) => (
                                    <TableCell key={cell.id} className="px-4 py-4">
                                        <table.FlexRender cell={cell} />
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))
                    ) : (
                        <TableRow>
                            <TableCell
                                colSpan={table.getVisibleLeafColumns().length}
                                className="h-64 text-center"
                            >
                                <ClipboardList className="mx-auto mb-3 size-8 text-muted-foreground" />
                                <p className="font-medium">
                                    {hasFilters
                                        ? `No ${name} match your filters`
                                        : `No ${name} yet`}
                                </p>
                                <p className="mt-1 text-muted-foreground">
                                    {hasFilters
                                        ? "Try another search or clear the filters."
                                        : onAdd
                                          ? "Create a stock transfer to begin."
                                          : "Dispatched goods appear here until their destination confirms receipt."}
                                </p>
                                {(hasFilters || onAdd) && (
                                    <Button
                                        variant="outline"
                                        className="mt-4"
                                        onClick={hasFilters ? reset : onAdd}
                                    >
                                        {hasFilters ? "Clear filters" : "Create transfer"}
                                    </Button>
                                )}
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
            <div className="flex flex-col gap-4 border-t bg-muted/15 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground" aria-live="polite">
                    {filtered.length
                        ? `${pageIndex * pageSize + 1}–${Math.min((pageIndex + 1) * pageSize, filtered.length)}`
                        : "0"}{" "}
                    of {filtered.length} {name}
                </p>
                <div className="flex flex-wrap items-center gap-3">
                    <Select
                        items={[5, 10, 20, 50].map((value) => ({
                            value: String(value),
                            label: String(value),
                        }))}
                        value={String(pageSize)}
                        onValueChange={(value) => {
                            if (value) table.setPageSize(Number(value))
                        }}
                    >
                        <SelectTrigger aria-label="Rows per page" className="w-20">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {[5, 10, 20, 50].map((value) => (
                                <SelectItem key={value} value={String(value)}>
                                    {value}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <span className="text-sm">
                        Page {pageIndex + 1} of {Math.max(1, table.getPageCount())}
                    </span>
                    <Button
                        variant="outline"
                        size="icon-sm"
                        aria-label="Previous page"
                        disabled={!table.getCanPreviousPage()}
                        onClick={() => table.previousPage()}
                    >
                        <ChevronLeft />
                    </Button>
                    <Button
                        variant="outline"
                        size="icon-sm"
                        aria-label="Next page"
                        disabled={!table.getCanNextPage()}
                        onClick={() => table.nextPage()}
                    >
                        <ChevronRight />
                    </Button>
                </div>
            </div>
        </div>
    )
}
export function TransferTable({
    transfers,
    onAdd,
    inTransitOnly = false,
    ...actions
}: { transfers: Transfer[]; onAdd?: () => void; inTransitOnly?: boolean } & TransferTableActions) {
    const { onView, onEdit, onAction, canManage, busy } = actions
    const columns = useMemo(
        () => transferColumns({ onView, onEdit, onAction, canManage, busy }),
        [onView, onEdit, onAction, canManage, busy],
    )
    const table = useTable({
        features,
        data: transfers,
        columns,
        getRowId: (transfer) => String(transfer.transferId),
        globalFilterFn: "includesString",
        initialState: {
            pagination: { pageIndex: 0, pageSize: 10 },
            sorting: [{ id: "requestedAt", desc: true }],
            columnVisibility: { dispatchedAt: false, receivedAt: false, notes: false },
        },
    })
    return (
        <TransferGrid
            table={table}
            name={inTransitOnly ? "transfers in transit" : "transfers"}
            statuses={inTransitOnly ? ["In Transit"] : TRANSFER_STATUSES}
            onAdd={canManage && !inTransitOnly ? onAdd : undefined}
            onExport={(rows) =>
                exportCsv("kff-stock-transfers.csv", [
                    [
                        "Transfer",
                        "Status",
                        "Source",
                        "Destination",
                        "Lots",
                        "Requested",
                        "Dispatched",
                        "Received",
                        "Notes",
                    ],
                    ...rows.map((row) => [
                        row.transferNumber,
                        row.status,
                        `${row.sourceLocationCode} - ${row.sourceLocationName}`,
                        `${row.destinationLocationCode} - ${row.destinationLocationName}`,
                        String(row.lineCount),
                        row.requestedAt,
                        row.dispatchedAt ?? "",
                        row.receivedAt ?? "",
                        row.notes ?? "",
                    ]),
                ])
            }
        />
    )
}
