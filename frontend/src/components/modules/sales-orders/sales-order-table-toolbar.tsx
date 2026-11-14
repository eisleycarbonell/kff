"use client"

import { Download, Search, Settings2, X } from "lucide-react"
import {
    SALES_ORDER_STATUSES,
    type SalesOrder,
} from "@/components/modules/sales-orders/sales-order.schema"
import type { SalesOrderTableInstance } from "@/components/modules/sales-orders/sales-order-table-columns"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const statuses = [
    { value: "all", label: "All statuses" },
    ...SALES_ORDER_STATUSES.map((status) => ({ value: status, label: status })),
]
const labels: Record<string, string> = {
    customerName: "Customer",
    customerPoNumber: "Customer PO",
    status: "Status",
    orderDate: "Order date",
    requestedDeliveryDate: "Requested delivery",
    totalAmount: "Order total",
}
function exportOrders(orders: SalesOrder[]) {
    const escape = (value: string) =>
        `"${(/^[=+\-@\t\r]/.test(value) ? "'" : "") + value.replace(/"/g, '""')}"`
    const rows = [
        [
            "Order number",
            "Customer PO",
            "Customer",
            "Status",
            "Order date",
            "Requested delivery",
            "Order total",
        ],
        ...orders.map((order) => [
            order.salesOrderNumber,
            order.customerPoNumber ?? "",
            order.customerName,
            order.status,
            order.orderDate,
            order.requestedDeliveryDate ?? "",
            order.totalAmount,
        ]),
    ]
    const url = URL.createObjectURL(
        new Blob(
            [
                "\uFEFF" +
                    rows.map((row) => row.map(escape).join(",")).join("\r\n"),
            ],
            {
                type: "text/csv;charset=utf-8;",
            },
        ),
    )
    const link = document.createElement("a")
    link.href = url
    link.download = "kff-sales-orders.csv"
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export function SalesOrderTableToolbar({
    table,
    hasFilters,
    onClearFilters,
}: {
    table: SalesOrderTableInstance
    hasFilters: boolean
    onClearFilters: () => void
}) {
    const filtered = table.getFilteredRowModel().rows
    const selected = table.getFilteredSelectedRowModel().rows
    return (
        <div
            role="group"
            aria-label="Sales order table controls"
            className="flex flex-wrap items-center gap-3 border-b p-4 sm:p-5"
        >
            <div className="relative w-full sm:w-64">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                    aria-label="Search sales orders"
                    placeholder="Search orders, customer POs..."
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
                items={statuses}
                value={
                    (table.getColumn("status")?.getFilterValue() as string) ??
                    "all"
                }
                onValueChange={(value) => {
                    table
                        .getColumn("status")
                        ?.setFilterValue(value === "all" ? undefined : value)
                    table.resetRowSelection()
                    table.setPageIndex(0)
                }}
            >
                <SelectTrigger
                    aria-label="Filter by status"
                    className="min-w-44 bg-card data-[size=default]:h-10"
                >
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {statuses.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                            {item.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            {hasFilters && (
                <Button
                    variant="ghost"
                    className="h-10"
                    onClick={onClearFilters}
                >
                    <X />
                    Reset
                </Button>
            )}
            {selected.length > 0 && (
                <div className="flex items-center gap-2 text-sm">
                    <span
                        className="font-medium text-primary"
                        aria-live="polite"
                    >
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
                        exportOrders(
                            (selected.length ? selected : filtered).map(
                                (row) => row.original,
                            ),
                        )
                    }
                >
                    <Download />
                    {selected.length ? "Export selected" : "Export CSV"}
                </Button>
                <DropdownMenu>
                    <DropdownMenuTrigger
                        render={<Button variant="outline" className="h-10" />}
                    >
                        <Settings2 />
                        Columns
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuGroup>
                            <DropdownMenuLabel>
                                Visible columns
                            </DropdownMenuLabel>
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
