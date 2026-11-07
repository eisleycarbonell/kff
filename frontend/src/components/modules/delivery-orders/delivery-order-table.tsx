"use client"

import { useMemo } from "react"
import { useTable } from "@tanstack/react-table"
import {
    ArrowDown,
    ArrowUp,
    ArrowUpDown,
    ChevronLeft,
    ChevronRight,
    Download,
    Search,
    Settings2,
    Truck,
    X,
} from "lucide-react"
import {
    DELIVERY_ORDER_STATUSES,
    type DeliveryOrder,
} from "@/components/modules/delivery-orders/delivery-order.schema"
import {
    createDeliveryOrderColumns,
    deliveryOrderColumnLabels,
    deliveryOrderTableFeatures,
    type DeliveryOrderTableActions,
} from "@/components/modules/delivery-orders/delivery-order-table-columns"
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
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"

const statusItems = [
    { value: "all", label: "All statuses" },
    ...DELIVERY_ORDER_STATUSES.map((value) => ({ value, label: value })),
]
const pageSizeItems = [5, 10, 20, 50].map((size) => ({ value: String(size), label: String(size) }))
function exportDeliveries(orders: DeliveryOrder[]) {
    const escape = (value: string) =>
        `"${(/^[\s]*[=+\-@]/.test(value) ? "'" + value : value).replaceAll('"', '""')}"`
    const rows = [
        ["Delivery", "Sales order", "Customer", "Source", "Status", "Delivery date", "Notes"],
        ...orders.map((order) => [
            order.deliveryOrderNumber,
            order.salesOrderNumber,
            order.customerName,
            order.sourceLocationName,
            order.status,
            order.deliveryDate,
            order.notes ?? "",
        ]),
    ]
    const url = URL.createObjectURL(
        new Blob(["\uFEFF" + rows.map((row) => row.map(escape).join(",")).join("\r\n")], {
            type: "text/csv;charset=utf-8;",
        }),
    )
    const link = document.createElement("a")
    link.href = url
    link.download = "kff-delivery-orders.csv"
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export function DeliveryOrderTable({
    orders,
    onAdd,
    ...actions
}: DeliveryOrderTableActions & { orders: DeliveryOrder[]; onAdd: () => void }) {
    const { onView, onEdit, onAction, canManage, busy } = actions
    const columns = useMemo(
        () => createDeliveryOrderColumns({ onView, onEdit, onAction, canManage, busy }),
        [onView, onEdit, onAction, canManage, busy],
    )
    const table = useTable({
        features: deliveryOrderTableFeatures,
        data: orders,
        columns,
        getRowId: (order) => String(order.deliveryOrderId),
        globalFilterFn: "includesString",
        initialState: {
            pagination: { pageIndex: 0, pageSize: 10 },
            sorting: [{ id: "deliveryDate", desc: true }],
            columnVisibility: { notes: false },
        },
    })
    const filtered = table.getFilteredRowModel().rows
    const selected = table.getFilteredSelectedRowModel().rows
    const hasFilters = Boolean(table.state.globalFilter) || table.state.columnFilters.length > 0
    const { pageIndex, pageSize } = table.state.pagination
    function clearFilters() {
        table.setGlobalFilter("")
        table.resetColumnFilters()
        table.resetRowSelection()
        table.setPageIndex(0)
    }
    return (
        <div className="min-w-0 overflow-hidden rounded-xl border bg-card text-card-foreground shadow-xs">
            <div
                role="group"
                aria-label="Delivery order table controls"
                className="flex flex-wrap items-center gap-3 border-b p-4 sm:p-5"
            >
                <div className="relative w-full sm:w-64">
                    <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        aria-label="Search delivery orders"
                        placeholder="Search deliveries..."
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
                        table
                            .getColumn("status")
                            ?.setFilterValue(value === "all" ? undefined : value)
                        table.resetRowSelection()
                        table.setPageIndex(0)
                    }}
                >
                    <SelectTrigger
                        aria-label="Filter delivery status"
                        className="min-w-40 bg-card data-[size=default]:h-10"
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
                    <Button variant="ghost" className="h-10" onClick={clearFilters}>
                        <X />
                        Reset
                    </Button>
                )}
                {selected.length > 0 && (
                    <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium text-primary" aria-live="polite">
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
                <div className="flex flex-wrap items-center gap-3 sm:ml-auto">
                    <Button
                        variant="outline"
                        className="h-10"
                        disabled={!filtered.length}
                        onClick={() =>
                            exportDeliveries(
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
                                            {deliveryOrderColumnLabels[column.id] ?? column.id}
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
                                    className={
                                        header.column.id === "select"
                                            ? "h-12 w-14 pl-5"
                                            : "h-12 px-3"
                                    }
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
                                    <TableCell
                                        key={cell.id}
                                        className={
                                            cell.column.id === "select"
                                                ? "pl-5"
                                                : cell.column.id === "actions"
                                                  ? "pr-5 text-right"
                                                  : "px-3 py-4"
                                        }
                                    >
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
                                <Truck className="mx-auto mb-3 size-8 text-muted-foreground" />
                                <p className="font-medium">
                                    {hasFilters
                                        ? "No deliveries match your filters"
                                        : "No delivery orders yet"}
                                </p>
                                <p className="mt-1 text-muted-foreground">
                                    {hasFilters
                                        ? "Try a different search or clear your filters."
                                        : "Create a delivery from a confirmed sales order."}
                                </p>
                                {(hasFilters || canManage) && (
                                    <Button
                                        variant="outline"
                                        className="mt-4"
                                        onClick={hasFilters ? clearFilters : onAdd}
                                    >
                                        {hasFilters ? "Clear filters" : "Create delivery order"}
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
                    of {filtered.length} delivery orders
                </p>
                <div className="flex flex-wrap items-center gap-3">
                    <span className="text-sm text-muted-foreground">Rows per page</span>
                    <Select
                        items={pageSizeItems}
                        value={String(pageSize)}
                        onValueChange={(value) => {
                            if (value) table.setPageSize(Number(value))
                        }}
                    >
                        <SelectTrigger aria-label="Rows per page" className="w-16">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {pageSizeItems.map((item) => (
                                <SelectItem key={item.value} value={item.value}>
                                    {item.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <span className="text-sm tabular-nums">
                        Page {pageIndex + 1} of {Math.max(table.getPageCount(), 1)}
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
