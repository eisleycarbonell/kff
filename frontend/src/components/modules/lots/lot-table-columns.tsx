"use client"
import { columnFilteringFeature, columnVisibilityFeature, createColumnHelper, createFilteredRowModel, createPaginatedRowModel, createSortedRowModel, filterFn_equals, filterFn_includesString, globalFilteringFeature, rowPaginationFeature, rowSelectionFeature, rowSortingFeature, sortFn_text, tableFeatures, type ReactTable } from "@tanstack/react-table"
import { Ellipsis, Eye, Pencil } from "lucide-react"
import { compareLotDecimals, formatLotDecimal, type Lot } from "@/components/modules/lots/lot.schema"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

export const lotTableFeatures = tableFeatures({ columnFilteringFeature, globalFilteringFeature, filteredRowModel: createFilteredRowModel(), filterFns: { includesString: filterFn_includesString, equals: filterFn_equals }, rowSortingFeature, sortedRowModel: createSortedRowModel(), sortFns: { text: sortFn_text }, rowPaginationFeature, paginatedRowModel: createPaginatedRowModel(), rowSelectionFeature, columnVisibilityFeature })
export type LotTableInstance = ReactTable<typeof lotTableFeatures, Lot>
const helper = createColumnHelper<typeof lotTableFeatures, Lot>()
const dateFormat = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
export function createLotColumns({ canManage, isBusy, onView, onEdit }: { canManage: boolean; isBusy: boolean; onView: (lot: Lot) => void; onEdit: (lot: Lot) => void }) {
    return helper.columns([
        helper.display({ id: "select", enableHiding: false, header: ({ table }) => <Checkbox aria-label="Select all lots on this page" checked={table.getIsAllPageRowsSelected()} indeterminate={table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()} onCheckedChange={(checked) => table.toggleAllPageRowsSelected(checked)} />, cell: ({ row }) => <Checkbox aria-label={`Select ${row.original.lotNumber}`} checked={row.getIsSelected()} onCheckedChange={(checked) => row.toggleSelected(checked)} /> }),
        helper.accessor("lotNumber", { header: "Lot number", enableHiding: false, sortFn: "text", cell: ({ row }) => <button type="button" className="rounded-sm text-left font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring" onClick={() => onView(row.original)}>{row.original.lotNumber}</button> }),
        helper.accessor((lot) => `${lot.itemSku} · ${lot.itemName}`, { id: "item", header: "Item", sortFn: "text", filterFn: "equals", cell: ({ row }) => <div><p className="font-medium">{row.original.itemName}</p><p className="mt-0.5 text-xs text-muted-foreground">{row.original.itemSku}</p></div> }),
        helper.accessor("qcStatus", { header: "Quality status", sortFn: "text", filterFn: "equals", enableGlobalFilter: false, cell: ({ cell }) => <Badge variant="secondary" className={cell.getValue() === "Approved" ? "bg-primary/10 text-primary" : "text-muted-foreground"}>{cell.getValue()}</Badge> }),
        helper.accessor("sourceType", { header: "Source", sortFn: "text", filterFn: "equals", enableGlobalFilter: false, cell: ({ cell }) => <Badge variant="outline">{cell.getValue()}</Badge> }),
        helper.accessor((lot) => lot.poNumber ?? lot.packingOrderNumber ?? "Opening balance", { id: "sourceReference", header: "Source reference", sortFn: "text" }),
        helper.accessor("qtyOnHand", { header: "On hand", enableGlobalFilter: false, sortFn: (left, right, id) => compareLotDecimals(left.getValue<string>(id), right.getValue<string>(id)), cell: ({ row }) => <span className="tabular-nums">{formatLotDecimal(row.original.qtyOnHand)} <span className="text-muted-foreground">{row.original.primaryUomName}</span></span> }),
        helper.accessor("qtyReserved", { header: "Reserved", enableGlobalFilter: false, sortFn: (left, right, id) => compareLotDecimals(left.getValue<string>(id), right.getValue<string>(id)), cell: ({ row }) => <span className="tabular-nums">{formatLotDecimal(row.original.qtyReserved)} <span className="text-muted-foreground">{row.original.primaryUomName}</span></span> }),
        helper.accessor("qtyAvailable", { header: "Available", enableGlobalFilter: false, sortFn: (left, right, id) => compareLotDecimals(left.getValue<string>(id), right.getValue<string>(id)), cell: ({ row }) => <span className="tabular-nums">{formatLotDecimal(row.original.qtyAvailable)} <span className="text-muted-foreground">{row.original.primaryUomName}</span></span> }),
        helper.accessor("expirationDate", { header: "Expiration date", sortFn: "text", enableGlobalFilter: false, cell: ({ cell }) => <span className="text-muted-foreground">{cell.getValue() ?? "Not set"}</span> }),
        helper.accessor("supplierLotNumber", { header: "Supplier lot", sortFn: "text", cell: ({ cell }) => <span className="text-muted-foreground">{cell.getValue() ?? "—"}</span> }),
        helper.accessor("createdAt", { header: "Date created", sortFn: "text", enableGlobalFilter: false, cell: ({ cell }) => <span className="text-muted-foreground">{dateFormat.format(new Date(cell.getValue()))}</span> }),
        helper.display({ id: "actions", enableHiding: false, header: () => <span className="sr-only">Actions</span>, cell: ({ row }) => <DropdownMenu><DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${row.original.lotNumber}`} />}><Ellipsis /></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuGroup><DropdownMenuItem onClick={() => onView(row.original)}><Eye />View lot</DropdownMenuItem>{canManage && <DropdownMenuItem disabled={isBusy} onClick={() => onEdit(row.original)}><Pencil />Edit metadata</DropdownMenuItem>}</DropdownMenuGroup></DropdownMenuContent></DropdownMenu> }),
    ])
}
