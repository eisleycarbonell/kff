import { Download, Search, Settings2, X } from "lucide-react"
import type { ReceivingReceipt } from "@/components/modules/receiving/receiving.schema"
import type { ReceivingTableInstance } from "@/components/modules/receiving/receiving-table-columns"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuGroup, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const columnLabels: Record<string, string> = { createdAt: "Received", poNumber: "Purchase order", supplierName: "Supplier", item: "Material", supplierLotNumber: "Supplier lot", qtyReceived: "Purchase quantity", qtyPrimary: "Inventory quantity", location: "Location", qcStatus: "Quality status", manufactureDate: "Manufacture date", expirationDate: "Expiration date", unitCost: "Cost / primary unit" }
function exportReceipts(receipts: ReceivingReceipt[]) {
    const escape = (value: string) => `"${(/^[\s]*[=+\-@]/.test(value) ? "'" + value : value).replaceAll('"', '""')}"`
    const rows = [["Received at", "Purchase order", "Supplier", "Item SKU", "Item", "Lot number", "Supplier lot", "Purchase quantity", "Purchase unit", "Inventory quantity", "Primary unit", "Location code", "Location", "Quality status", "Manufacture date", "Expiration date", "Unit cost per primary unit"], ...receipts.map((receipt) => [receipt.createdAt, receipt.poNumber, receipt.supplierName, receipt.itemSku, receipt.itemName, receipt.lotNumber, receipt.supplierLotNumber ?? "", receipt.qtyReceived ?? "", receipt.purchaseUomName, receipt.qtyPrimary, receipt.primaryUomName, receipt.locationCode, receipt.locationName, receipt.qcStatus, receipt.manufactureDate ?? "", receipt.expirationDate ?? "", receipt.unitCost ?? ""])]
    const url = URL.createObjectURL(new Blob(["\uFEFF" + rows.map((row) => row.map(escape).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8;" }))
    const link = document.createElement("a"); link.href = url; link.download = "kff-receiving.csv"; document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export function ReceivingTableToolbar({ table, receipts, hasFilters, onClearFilters }: { table: ReceivingTableInstance; receipts: ReceivingReceipt[]; hasFilters: boolean; onClearFilters: () => void }) {
    const filtered = table.getFilteredRowModel().rows
    const selected = table.getFilteredSelectedRowModel().rows
    const filters = [
        { column: "supplierName", label: "suppliers", values: Array.from(new Map(receipts.map((row) => [row.supplierId, row.supplierName])).values()).sort() },
        { column: "poNumber", label: "purchase orders", values: Array.from(new Map(receipts.map((row) => [row.poId, row.poNumber])).values()).sort() },
        { column: "location", label: "locations", values: Array.from(new Map(receipts.map((row) => [row.locationId, `${row.locationCode} · ${row.locationName}`])).values()).sort() },
        { column: "qcStatus", label: "quality statuses", values: ["Quarantine", "Approved", "Rejected", "Expired"] },
    ]
    return <div role="group" aria-label="Receiving table controls" className="flex flex-wrap items-center gap-3 border-b p-4 sm:p-5">
        <div className="relative w-full sm:w-64"><Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Search receiving history" placeholder="Search lots, materials, or suppliers..." className="h-10 bg-card pl-10" value={table.state.globalFilter ?? ""} onChange={(event) => { table.setGlobalFilter(event.target.value); table.resetRowSelection(); table.setPageIndex(0) }} /></div>
        {filters.map((filter) => { const items = [{ value: "all", label: `All ${filter.label}` }, ...filter.values.map((value) => ({ value: `value:${value}`, label: value }))]; const value = table.getColumn(filter.column)?.getFilterValue() as string | undefined; return <Select key={filter.column} items={items} value={value === undefined ? "all" : `value:${value}`} onValueChange={(next) => { table.getColumn(filter.column)?.setFilterValue(!next || next === "all" ? undefined : next.slice(6)); table.resetRowSelection(); table.setPageIndex(0) }}><SelectTrigger aria-label={`Filter receiving by ${filter.label}`} className="w-full bg-card data-[size=default]:h-10 sm:w-44"><SelectValue className="min-w-0" /></SelectTrigger><SelectContent><SelectGroup>{items.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectGroup></SelectContent></Select> })}
        {hasFilters && <Button variant="ghost" className="h-10" onClick={onClearFilters}><X />Reset</Button>}
        {selected.length > 0 && <div className="flex flex-wrap items-center gap-2 text-sm"><span className="font-medium text-primary" aria-live="polite">{selected.length} selected</span><Button variant="ghost" className="h-10" onClick={() => table.resetRowSelection()}>Clear selection</Button></div>}
        <div className="flex flex-wrap items-center gap-3 sm:ml-auto"><Button variant="outline" className="h-10" disabled={!filtered.length} onClick={() => exportReceipts((selected.length ? selected : filtered).map((row) => row.original))}><Download />{selected.length ? "Export selected" : "Export CSV"}</Button><DropdownMenu><DropdownMenuTrigger render={<Button variant="outline" className="h-10" />}><Settings2 />Columns</DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuGroup><DropdownMenuLabel>Visible columns</DropdownMenuLabel>{table.getAllLeafColumns().filter((column) => column.getCanHide()).map((column) => <DropdownMenuCheckboxItem key={column.id} checked={column.getIsVisible()} onCheckedChange={(checked) => column.toggleVisibility(checked)} closeOnClick={false}>{columnLabels[column.id] ?? column.id}</DropdownMenuCheckboxItem>)}</DropdownMenuGroup></DropdownMenuContent></DropdownMenu></div>
    </div>
}
