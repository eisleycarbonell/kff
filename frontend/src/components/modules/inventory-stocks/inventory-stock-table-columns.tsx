"use client"
import {
    columnFilteringFeature,
    columnVisibilityFeature,
    createColumnHelper,
    createFilteredRowModel,
    createPaginatedRowModel,
    createSortedRowModel,
    filterFn_equalsString,
    filterFn_includesString,
    globalFilteringFeature,
    rowPaginationFeature,
    rowSelectionFeature,
    rowSortingFeature,
    sortFn_text,
    tableFeatures,
    type ReactTable,
} from "@tanstack/react-table"
import { Ellipsis, ClipboardPenLine } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    formatStockQuantity,
    compareStockQuantities,
    type Stock,
} from "@/components/modules/inventory-stocks/inventory-stock.schema"
export const stockTableFeatures = tableFeatures({
    columnFilteringFeature,
    globalFilteringFeature,
    filteredRowModel: createFilteredRowModel(),
    filterFns: { includesString: filterFn_includesString, equalsString: filterFn_equalsString },
    rowSortingFeature,
    sortedRowModel: createSortedRowModel(),
    sortFns: { text: sortFn_text },
    rowPaginationFeature,
    paginatedRowModel: createPaginatedRowModel(),
    rowSelectionFeature,
    columnVisibilityFeature,
})
export type StockTableInstance = ReactTable<typeof stockTableFeatures, Stock>
const helper = createColumnHelper<typeof stockTableFeatures, Stock>()
const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" })
export function createStockColumns({
    onAdjust,
    canManage,
}: {
    onAdjust: (stock: Stock) => void
    canManage: boolean
}) {
    return helper.columns([
        helper.display({
            id: "select",
            enableHiding: false,
            header: ({ table }) => (
                <Checkbox
                    aria-label="Select all stock balances on this page"
                    checked={table.getIsAllPageRowsSelected()}
                    indeterminate={
                        table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()
                    }
                    onCheckedChange={(checked) => table.toggleAllPageRowsSelected(checked)}
                />
            ),
            cell: ({ row }) => (
                <Checkbox
                    aria-label={`Select ${row.original.lotNumber} at ${row.original.locationName}`}
                    checked={row.getIsSelected()}
                    onCheckedChange={(checked) => row.toggleSelected(checked)}
                />
            ),
        }),
        helper.accessor("itemName", {
            header: "Item / Product",
            enableHiding: false,
            sortFn: "text",
            filterFn: "includesString",
            cell: ({ row }) => (
                <div className="flex flex-col gap-1">
                    <span className="font-medium">{row.original.itemName}</span>
                    <span className="text-xs text-muted-foreground">{row.original.sku}</span>
                </div>
            ),
        }),
        helper.accessor("sku", { header: "SKU", sortFn: "text", filterFn: "includesString" }),
        helper.accessor((stock) => String(stock.itemId), {
            id: "item",
            header: "Item ID",
            enableHiding: false,
            filterFn: "equalsString",
            enableGlobalFilter: false,
        }),
        helper.accessor((stock) => String(stock.locationId), {
            id: "location",
            header: "Location ID",
            enableHiding: false,
            filterFn: "equalsString",
            enableGlobalFilter: false,
        }),
        helper.accessor("itemType", { header: "Type", sortFn: "text", filterFn: "equalsString" }),
        helper.accessor("lotNumber", {
            header: "Lot / Batch",
            sortFn: "text",
            filterFn: "includesString",
            cell: ({ row }) => (
                <div className="flex flex-col gap-1">
                    <span>{row.original.lotNumber}</span>
                    {row.original.supplierLotNumber && (
                        <span className="text-xs text-muted-foreground">
                            Supplier: {row.original.supplierLotNumber}
                        </span>
                    )}
                </div>
            ),
        }),
        helper.accessor("supplierLotNumber", {
            header: "Supplier lot",
            sortFn: "text",
            filterFn: "includesString",
        }),
        helper.accessor("locationName", {
            header: "Location",
            sortFn: "text",
            filterFn: "includesString",
            cell: ({ row }) => (
                <div className="flex flex-col gap-1">
                    <span>{row.original.locationName}</span>
                    <span className="text-xs text-muted-foreground">
                        {row.original.locationCode} / {row.original.locationType}
                    </span>
                </div>
            ),
        }),
        helper.accessor("locationCode", {
            header: "Location code",
            sortFn: "text",
            filterFn: "includesString",
        }),
        helper.accessor("primaryUomName", { header: "UOM", sortFn: "text" }),
        ...(["qtyOnHand", "qtyReserved", "qtyAvailable"] as const).map((key) =>
            helper.accessor(key, {
                header: {
                    qtyOnHand: "On hand",
                    qtyReserved: "Reserved",
                    qtyAvailable: "Available",
                }[key],
                enableGlobalFilter: false,
                sortFn: (a, b, columnId) =>
                    compareStockQuantities(
                        a.getValue<string>(columnId),
                        b.getValue<string>(columnId),
                    ),
                cell: (context) => (
                    <span className="whitespace-nowrap tabular-nums">
                        {formatStockQuantity(context.getValue())}
                    </span>
                ),
            }),
        ),
        helper.accessor(
            (stock) =>
                compareStockQuantities(stock.qtyAvailable, "0") > 0 ? "Available" : "Unavailable",
            {
                id: "availability",
                header: "Availability",
                filterFn: "equalsString",
                enableGlobalFilter: false,
            },
        ),
        helper.accessor("qcStatus", {
            header: "Quality",
            filterFn: "equalsString",
            sortFn: "text",
            enableGlobalFilter: false,
            cell: (context) => (
                <Badge variant={context.getValue() === "Approved" ? "secondary" : "outline"}>
                    {context.getValue()}
                </Badge>
            ),
        }),
        helper.accessor("expirationDate", {
            header: "Expiry date",
            sortFn: "text",
            enableGlobalFilter: false,
            cell: (context) =>
                context.getValue() ? (
                    dateFormat.format(new Date(`${context.getValue()}T00:00:00Z`))
                ) : (
                    <span className="text-muted-foreground">{"\u2014"}</span>
                ),
        }),
        helper.accessor("manufactureDate", {
            header: "Manufactured",
            sortFn: "text",
            enableGlobalFilter: false,
            cell: (context) =>
                context.getValue() ? (
                    dateFormat.format(new Date(`${context.getValue()}T00:00:00Z`))
                ) : (
                    <span className="text-muted-foreground">{"\u2014"}</span>
                ),
        }),
        helper.accessor("lotUnitCost", {
            header: "Lot cost / UOM",
            sortFn: (a, b) => {
                const left = a.original.lotUnitCost
                const right = b.original.lotUnitCost
                if (left === null) return right === null ? 0 : -1
                if (right === null) return 1
                return compareStockQuantities(left, right)
            },
            enableGlobalFilter: false,
            cell: (context) =>
                context.getValue() === null ? (
                    <span className="text-muted-foreground">{"\u2014"}</span>
                ) : (
                    formatStockQuantity(context.getValue()!)
                ),
        }),
        helper.accessor("lastUpdated", {
            header: "Last updated",
            sortFn: "text",
            enableGlobalFilter: false,
            cell: (context) => dateFormat.format(new Date(context.getValue())),
        }),
        helper.display({
            id: "actions",
            enableHiding: false,
            header: () => <span className="sr-only">Actions</span>,
            cell: ({ row }) =>
                canManage ? (
                    <DropdownMenu>
                        <DropdownMenuTrigger
                            render={
                                <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    aria-label={`Actions for ${row.original.lotNumber} at ${row.original.locationName}`}
                                />
                            }
                        >
                            <Ellipsis />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuGroup>
                                <DropdownMenuLabel>Inventory stock</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => onAdjust(row.original)}>
                                    <ClipboardPenLine />
                                    Adjust stock
                                </DropdownMenuItem>
                            </DropdownMenuGroup>
                        </DropdownMenuContent>
                    </DropdownMenu>
                ) : null,
        }),
    ])
}
