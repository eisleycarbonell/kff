"use client"

import { useDeferredValue, useMemo, useState } from "react"
import { Boxes, Download, Layers, MapPin, Package, Search, Tag } from "lucide-react"
import {
    AccountingKpiStrip,
    AccountingPagination,
    basisBadgeVariant,
    varianceClass,
} from "@/components/modules/accounting/accounting-pagination"
import {
    COST_BASES,
    ITEM_TYPES,
    formatCurrency,
    formatQuantity,
    formatSignedCurrency,
    type AccountingOverview,
} from "@/components/modules/accounting/accounting.schema"
import { ComboboxSelect } from "@/components/shared/combobox-select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { downloadCsv } from "@/lib/csv"

export function AccountingValuationView({ overview }: { overview: AccountingOverview }) {
    const currency = overview.currencyCode
    const s = overview.summary

    const [searchInput, setSearchInput] = useState("")
    const deferredSearch = useDeferredValue(searchInput.trim().toLowerCase())
    const [typeFilter, setTypeFilter] = useState("all")
    const [basisFilter, setBasisFilter] = useState("all")
    const [pageIndex, setPageIndex] = useState(0)
    const [pageSize, setPageSize] = useState(10)

    const itemTypeItems = useMemo(
        () => [
            { value: "all", label: "All item types" },
            ...ITEM_TYPES.map((type) => ({ value: type, label: type })),
        ],
        [],
    )

    const basisItems = useMemo(
        () => [
            { value: "all", label: "All cost bases" },
            ...COST_BASES.map((basis) => ({ value: basis, label: basis })),
        ],
        [],
    )

    const filteredLots = useMemo(() => {
        return overview.lotCosting.filter((row) => {
            if (typeFilter !== "all" && row.itemType !== typeFilter) return false
            if (basisFilter !== "all" && row.costBasis !== basisFilter) return false
            if (!deferredSearch) return true
            return (
                row.lotNumber.toLowerCase().includes(deferredSearch) ||
                row.itemSku.toLowerCase().includes(deferredSearch) ||
                row.itemName.toLowerCase().includes(deferredSearch) ||
                row.sourceReference.toLowerCase().includes(deferredSearch) ||
                (row.supplierName ?? "").toLowerCase().includes(deferredSearch)
            )
        })
    }, [overview.lotCosting, typeFilter, basisFilter, deferredSearch])

    const safePageIndex = Math.min(pageIndex, Math.max(0, Math.ceil(filteredLots.length / pageSize) - 1))
    const sliceStart = safePageIndex * pageSize
    const sliceEnd = sliceStart + pageSize

    function handleExportLots() {
        downloadCsv("accounting-inventory-lot-valuation.csv", [
            [
                "Lot Number",
                "Item SKU",
                "Item Name",
                "Item Type",
                "QC Status",
                "Source Type",
                "Source Reference",
                "Supplier",
                "Catalog Cost",
                "Effective Unit Cost",
                "Cost Basis",
                "Unit Variance",
                "On Hand Qty",
                "Primary UOM",
                "Asset Value",
                "Currency",
            ],
            ...filteredLots.map((row) => [
                row.lotNumber,
                row.itemSku,
                row.itemName,
                row.itemType,
                row.qcStatus,
                row.sourceType,
                row.sourceReference,
                row.supplierName ?? "",
                row.catalogUnitCost,
                row.effectiveUnitCost,
                row.costBasis,
                row.unitVariance,
                row.qtyOnHand,
                row.primaryUomName,
                row.assetValue,
                currency,
            ]),
        ])
    }

    return (
        <div className="space-y-6">
            <AccountingKpiStrip
                cards={[
                    {
                        title: "Total Stock Value",
                        value: formatCurrency(s.totalInventoryAssetValue, currency),
                        badge: `${s.costedLotsCount} costed batches`,
                        helper: `${s.uncostedLotsCount} batch(es) using catalog reference cost.`,
                        icon: Boxes,
                        color: "text-emerald-600 dark:text-emerald-400",
                        bg: "bg-emerald-500/10",
                    },
                    {
                        title: "Raw Spices",
                        value: formatCurrency(s.rawMaterialAssetValue, currency),
                        badge: "Bulk stock",
                        helper: "Bulk spices valued at purchase price or catalog cost.",
                        icon: Layers,
                        color: "text-amber-600 dark:text-amber-400",
                        bg: "bg-amber-500/10",
                    },
                    {
                        title: "Packaging & Labels",
                        value: formatCurrency(s.packagingAssetValue, currency),
                        badge: "Containers & labels",
                        helper: "Pouches, jars, lids, seals, and printed labels.",
                        icon: Tag,
                        color: "text-sky-600 dark:text-sky-400",
                        bg: "bg-sky-500/10",
                    },
                    {
                        title: "Finished Goods",
                        value: formatCurrency(s.finishedGoodsAssetValue, currency),
                        badge: "Ready to sell",
                        helper: "Packed products valued from ingredients + packaging used.",
                        icon: Package,
                        color: "text-primary",
                        bg: "bg-primary/10",
                    },
                ]}
            />

            <div className="grid gap-4 sm:gap-6 @4xl/main:grid-cols-2 [&>*]:min-w-0">
                <Card className="border shadow-xs">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base font-semibold">
                            Stock Value by Item Type
                        </CardTitle>
                        <CardDescription className="text-xs">
                            How your current inventory value splits across materials and finished products.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2.5">
                        {overview.valuationByCategory.map((row) => (
                            <div
                                key={row.itemType}
                                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/20 px-3 py-2.5 text-xs"
                            >
                                <div className="min-w-0">
                                    <p className="font-medium text-foreground">{row.itemType}</p>
                                    <p className="text-muted-foreground">
                                        {row.itemCount} items · {row.lotCount} lots
                                        {row.sharePercent !== null ? ` · ${row.sharePercent}% share` : ""}
                                    </p>
                                </div>
                                <span className="shrink-0 font-mono text-sm font-semibold tabular-nums">
                                    {formatCurrency(row.assetValue, currency)}
                                </span>
                            </div>
                        ))}
                    </CardContent>
                </Card>

                <Card className="border shadow-xs">
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base font-semibold">
                            <MapPin className="size-4 shrink-0 text-muted-foreground" />
                            Stock Value by Location
                        </CardTitle>
                        <CardDescription className="text-xs">
                            Current stock worth across warehouses, branches, stores, and In Transit.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="@container/val-loc">
                        {overview.valuationByLocation.length === 0 ? (
                            <p className="py-8 text-center text-xs text-muted-foreground">
                                No stocked locations found.
                            </p>
                        ) : (
                            <div className="grid grid-cols-1 gap-2.5 @lg/val-loc:grid-cols-2">
                                {overview.valuationByLocation.map((loc) => (
                                    <div
                                        key={loc.locationId}
                                        className="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2 text-xs"
                                    >
                                        <div className="min-w-0 pr-2">
                                            <p className="truncate font-medium text-foreground">
                                                {loc.locationName}
                                            </p>
                                            <p className="text-muted-foreground">
                                                {loc.locationCode} · {loc.locationType} · {loc.lotCount} lots
                                            </p>
                                        </div>
                                        <span className="shrink-0 font-mono font-semibold tabular-nums">
                                            {formatCurrency(loc.assetValue, currency)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <Card className="border shadow-xs">
                <CardHeader className="gap-3 border-b pb-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                            <CardTitle className="text-base font-semibold">
                                Batch Stock Value &amp; Cost Comparison
                            </CardTitle>
                            <CardDescription className="text-xs">
                                Compares each batch&apos;s reference cost against its actual purchase or packing unit cost.
                            </CardDescription>
                        </div>
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="shrink-0 self-start sm:self-auto"
                            onClick={handleExportLots}
                            disabled={filteredLots.length === 0}
                        >
                            <Download className="mr-1.5 size-4" />
                            Export Stock Value CSV
                        </Button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="relative w-full sm:w-64">
                            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                value={searchInput}
                                onChange={(e) => {
                                    setSearchInput(e.target.value)
                                    setPageIndex(0)
                                }}
                                placeholder="Search lot, SKU, item, supplier..."
                                className="h-8 pl-8 text-xs"
                            />
                        </div>
                        <div className="w-full sm:w-44">
                            <ComboboxSelect
                                items={itemTypeItems}
                                value={typeFilter}
                                onValueChange={(v) => {
                                    setTypeFilter(v ?? "all")
                                    setPageIndex(0)
                                }}
                                placeholder="Item type"
                                className="w-full"
                            />
                        </div>
                        <div className="w-full sm:w-44">
                            <ComboboxSelect
                                items={basisItems}
                                value={basisFilter}
                                onValueChange={(v) => {
                                    setBasisFilter(v ?? "all")
                                    setPageIndex(0)
                                }}
                                placeholder="Cost basis"
                                className="w-full"
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow>
                                <TableHead>Lot / Source</TableHead>
                                <TableHead>Item</TableHead>
                                <TableHead>Cost Basis</TableHead>
                                <TableHead className="text-right">Catalog Cost</TableHead>
                                <TableHead className="text-right">Effective Unit Cost</TableHead>
                                <TableHead className="text-right">Unit Variance</TableHead>
                                <TableHead className="text-right">On Hand</TableHead>
                                <TableHead className="text-right">Asset Value</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredLots.slice(sliceStart, sliceEnd).map((row) => (
                                <TableRow key={row.lotId}>
                                    <TableCell>
                                        <div className="font-medium">{row.lotNumber}</div>
                                        <div className="text-xs text-muted-foreground">
                                            {row.sourceType} · {row.sourceReference}
                                            {row.supplierName ? ` · ${row.supplierName}` : ""}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="font-medium">
                                            {row.itemSku} — {row.itemName}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            {row.itemType} · {row.qcStatus}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={basisBadgeVariant(row.costBasis)}>
                                            {row.costBasis}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums text-muted-foreground">
                                        {formatCurrency(row.catalogUnitCost, currency)}
                                    </TableCell>
                                    <TableCell className="text-right font-medium tabular-nums">
                                        {formatCurrency(row.effectiveUnitCost, currency)}
                                    </TableCell>
                                    <TableCell className={`text-right tabular-nums ${varianceClass(row.unitVariance)}`}>
                                        {formatSignedCurrency(row.unitVariance, currency)}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">
                                        {formatQuantity(row.qtyOnHand)} {row.primaryUomName}
                                    </TableCell>
                                    <TableCell className="text-right font-semibold tabular-nums">
                                        {formatCurrency(row.assetValue, currency)}
                                    </TableCell>
                                </TableRow>
                            ))}
                            {filteredLots.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                                        No matching lot costing records found.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                    <AccountingPagination
                        totalRows={filteredLots.length}
                        pageSize={pageSize}
                        pageIndex={safePageIndex}
                        onPageSizeChange={setPageSize}
                        onPageIndexChange={setPageIndex}
                    />
                </CardContent>
            </Card>
        </div>
    )
}
