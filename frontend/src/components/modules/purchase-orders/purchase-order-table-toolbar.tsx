import { Download, Search, Settings2, X } from "lucide-react"

import type { PurchaseOrder } from "@/components/modules/purchase-orders/purchase-order.schema"
import type { PurchaseOrderTableInstance } from "@/components/modules/purchase-orders/purchase-order-table-columns"
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
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

const statuses = ["Draft", "Sent", "Partially Received", "Completed", "Cancelled"]
const statusItems = [
    { value: "all", label: "All statuses" },
    ...statuses.map((status) => ({ value: status, label: status })),
]
const columnLabels: Record<string, string> = {
    supplierName: "Supplier",
    status: "Status",
    orderDate: "Order date",
    expectedDeliveryDate: "Expected delivery",
    lineCount: "Lines",
    totalAmount: "Order value",
    outstandingAmount: "Outstanding value",
}

function exportOrders(orders: PurchaseOrder[]) {
    const escape = (value: string) =>
        `"${(/^[\s]*[=+\-@]/.test(value) ? "'" + value : value).replaceAll('"', '""')}"`
    const rows = [
        [
            "PO number",
            "Supplier",
            "Status",
            "Order date",
            "Expected delivery",
            "Lines",
            "Order value",
            "Received value",
            "Outstanding value",
            "Notes",
        ],
        ...orders.map((order) => [
            order.poNumber,
            order.supplierName,
            order.status,
            order.orderDate.slice(0, 10),
            order.expectedDeliveryDate ?? "",
            String(order.lineCount),
            order.totalAmount,
            order.receivedAmount,
            order.outstandingAmount,
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
    link.download = "kff-purchase-orders.csv"
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function PurchaseOrderTableToolbar({
    table,
    orders,
    hasFilters,
    onClearFilters,
}: {
    table: PurchaseOrderTableInstance
    orders: PurchaseOrder[]
    hasFilters: boolean
    onClearFilters: () => void
}) {
    const filteredRows = table.getFilteredRowModel().rows
    const selectedRows = table.getFilteredSelectedRowModel().rows
    const supplierItems = [
        { value: "all", label: "All suppliers" },
        ...Array.from(
            new Map(orders.map((order) => [order.supplierId, order.supplierName])).values(),
        )
            .sort((left, right) => left.localeCompare(right))
            .map((name) => ({ value: `supplier:${name}`, label: name })),
    ]
    const supplierFilter = table.getColumn("supplierName")?.getFilterValue() as string | undefined
    const resetSelection = () => {
        table.resetRowSelection()
        table.setPageIndex(0)
    }

    return (
        <div
            role="group"
            aria-label="Purchase order table controls"
            className="flex flex-wrap items-center gap-3 border-b p-4 sm:p-5"
        >
            <div className="relative w-full sm:w-64">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                    aria-label="Search purchase orders"
                    placeholder="Search PO number or supplier..."
                    value={table.state.globalFilter ?? ""}
                    onChange={(event) => {
                        table.setGlobalFilter(event.target.value)
                        resetSelection()
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
                        ?.setFilterValue(!value || value === "all" ? undefined : value)
                    resetSelection()
                }}
            >
                <SelectTrigger
                    aria-label="Filter purchase orders by status"
                    className="min-w-40 bg-card data-[size=default]:h-10"
                >
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectGroup>
                        {statusItems.map((status) => (
                            <SelectItem key={status.value} value={status.value}>
                                {status.label}
                            </SelectItem>
                        ))}
                    </SelectGroup>
                </SelectContent>
            </Select>
            <Select
                items={supplierItems}
                value={supplierFilter === undefined ? "all" : `supplier:${supplierFilter}`}
                onValueChange={(value) => {
                    table
                        .getColumn("supplierName")
                        ?.setFilterValue(
                            !value || value === "all" ? undefined : value.slice("supplier:".length),
                        )
                    resetSelection()
                }}
            >
                <SelectTrigger
                    aria-label="Filter purchase orders by supplier"
                    className="w-full min-w-40 bg-card data-[size=default]:h-10 sm:w-48"
                >
                    <SelectValue className="min-w-0" />
                </SelectTrigger>
                <SelectContent>
                    <SelectGroup>
                        {supplierItems.map((supplier) => (
                            <SelectItem key={supplier.value} value={supplier.value}>
                                {supplier.label}
                            </SelectItem>
                        ))}
                    </SelectGroup>
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
                        exportOrders(
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
