"use client"
import Link from "next/link"
import { columnFilteringFeature, columnVisibilityFeature, createColumnHelper, createFilteredRowModel, createPaginatedRowModel, createSortedRowModel, filterFn_equals, filterFn_includesString, globalFilteringFeature, rowPaginationFeature, rowSelectionFeature, rowSortingFeature, sortFn_text, tableFeatures, type ReactTable } from "@tanstack/react-table"
import { compareReceivingDecimals, formatReceivingDecimal, type ReceivingReceipt } from "@/components/modules/receiving/receiving.schema"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"

export const receivingTableFeatures = tableFeatures({ columnFilteringFeature, globalFilteringFeature, filteredRowModel: createFilteredRowModel(), filterFns: { includesString: filterFn_includesString, equals: filterFn_equals }, rowSortingFeature, sortedRowModel: createSortedRowModel(), sortFns: { text: sortFn_text }, rowPaginationFeature, paginatedRowModel: createPaginatedRowModel(), rowSelectionFeature, columnVisibilityFeature })
export type ReceivingTableInstance = ReactTable<typeof receivingTableFeatures, ReceivingReceipt>
const helper = createColumnHelper<typeof receivingTableFeatures, ReceivingReceipt>()
const dateTime = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })
export function createReceivingColumns() {
    return helper.columns([
        helper.display({ id: "select", enableHiding: false, header: ({ table }) => <Checkbox aria-label="Select all receipt entries on this page" checked={table.getIsAllPageRowsSelected()} indeterminate={table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()} onCheckedChange={(checked) => table.toggleAllPageRowsSelected(checked)} />, cell: ({ row }) => <Checkbox aria-label={`Select receipt for ${row.original.lotNumber}`} checked={row.getIsSelected()} onCheckedChange={(checked) => row.toggleSelected(checked)} /> }),
        helper.accessor("createdAt", { header: "Received", sortFn: "text", enableGlobalFilter: false, cell: ({ cell }) => <span className="text-muted-foreground">{dateTime.format(new Date(cell.getValue()))}</span> }),
        helper.accessor("poNumber", { header: "Purchase order", sortFn: "text", filterFn: "equals", cell: ({ cell }) => <Link href="/purchase-orders" className="font-medium underline-offset-4 hover:underline">{cell.getValue()}</Link> }),
        helper.accessor("supplierName", { header: "Supplier", sortFn: "text", filterFn: "equals" }),
        helper.accessor((receipt) => `${receipt.itemSku} · ${receipt.itemName}`, { id: "item", header: "Material", sortFn: "text", cell: ({ row }) => <div><p className="font-medium">{row.original.itemName}</p><p className="mt-0.5 text-xs text-muted-foreground">{row.original.itemSku}</p></div> }),
        helper.accessor("lotNumber", { header: "Lot number", enableHiding: false, sortFn: "text", cell: ({ cell }) => <Link href="/lots" className="font-medium underline-offset-4 hover:underline">{cell.getValue()}</Link> }),
        helper.accessor("supplierLotNumber", { header: "Supplier lot", sortFn: "text", cell: ({ cell }) => <span className="text-muted-foreground">{cell.getValue() ?? "—"}</span> }),
        helper.accessor("qtyReceived", { header: "Purchase quantity", enableGlobalFilter: false, sortFn: (left, right, id) => { const a = left.getValue<string | null>(id), b = right.getValue<string | null>(id); return a === null ? b === null ? 0 : 1 : b === null ? -1 : compareReceivingDecimals(a, b) }, cell: ({ row }) => row.original.qtyReceived === null ? <span className="text-muted-foreground">Not recorded</span> : <span className="tabular-nums">{formatReceivingDecimal(row.original.qtyReceived)} <span className="text-muted-foreground">{row.original.purchaseUomName}</span></span> }),
        helper.accessor("qtyPrimary", { header: "Inventory quantity", enableGlobalFilter: false, sortFn: (left, right, id) => compareReceivingDecimals(left.getValue<string>(id), right.getValue<string>(id)), cell: ({ row }) => <span className="tabular-nums">{formatReceivingDecimal(row.original.qtyPrimary)} <span className="text-muted-foreground">{row.original.primaryUomName}</span></span> }),
        helper.accessor((receipt) => `${receipt.locationCode} · ${receipt.locationName}`, { id: "location", header: "Location", sortFn: "text", filterFn: "equals", cell: ({ row }) => <div><p>{row.original.locationName}</p><p className="mt-0.5 text-xs text-muted-foreground">{row.original.locationCode}</p></div> }),
        helper.accessor("qcStatus", { header: "Quality status", sortFn: "text", filterFn: "equals", enableGlobalFilter: false, cell: ({ cell }) => <Badge variant="secondary" className={cell.getValue() === "Approved" ? "bg-primary/10 text-primary" : "text-muted-foreground"}>{cell.getValue()}</Badge> }),
        helper.accessor("manufactureDate", { header: "Manufacture date", sortFn: "text", enableGlobalFilter: false, cell: ({ cell }) => <span className="text-muted-foreground">{cell.getValue() ?? "Not set"}</span> }),
        helper.accessor("expirationDate", { header: "Expiration date", sortFn: "text", enableGlobalFilter: false, cell: ({ cell }) => <span className="text-muted-foreground">{cell.getValue() ?? "Not set"}</span> }),
        helper.accessor("unitCost", { header: "Cost / primary unit", enableGlobalFilter: false, cell: ({ row }) => <span className="tabular-nums">{row.original.unitCost === null ? "Not set" : `${formatReceivingDecimal(row.original.unitCost)} / ${row.original.primaryUomName}`}</span> }),
    ])
}
