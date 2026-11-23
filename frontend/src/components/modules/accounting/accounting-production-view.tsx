"use client"

import { Fragment, useDeferredValue, useMemo, useState } from "react"
import {
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    Download,
    Factory,
    Layers,
    PackageCheck,
    Search,
} from "lucide-react"
import { formatScaled4, scaled4 } from "@/components/modules/accounting/accounting-engine"
import {
    AccountingKpiStrip,
    AccountingPagination,
    parseDecimalNumber,
    varianceClass,
} from "@/components/modules/accounting/accounting-pagination"
import {
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

const PACKING_STATUS_FILTERS = ["Draft", "Planned", "In Progress", "Completed", "Cancelled"] as const

export function AccountingProductionView({ overview }: { overview: AccountingOverview }) {
    const currency = overview.currencyCode

    const [searchInput, setSearchInput] = useState("")
    const deferredSearch = useDeferredValue(searchInput.trim().toLowerCase())
    const [statusFilter, setStatusFilter] = useState("all")
    const [expandedId, setExpandedId] = useState<number | null>(null)
    const [pageIndex, setPageIndex] = useState(0)
    const [pageSize, setPageSize] = useState(10)

    const statusItems = useMemo(
        () => [
            { value: "all", label: "All statuses" },
            ...PACKING_STATUS_FILTERS.map((s) => ({ value: s, label: s })),
        ],
        [],
    )

    const stats = useMemo(() => {
        const completed = overview.packingCosting.filter((r) => r.status === "Completed")
        const totalOutputUnits = completed.reduce((sum, r) => sum + scaled4(r.actualQty), BigInt(0))
        const totalComponents = overview.packingCosting.reduce(
            (sum, r) => sum + r.components.length,
            0,
        )
        return {
            completedCount: completed.length,
            totalOrders: overview.packingCosting.length,
            totalOutputQty: formatScaled4(totalOutputUnits),
            totalComponents,
        }
    }, [overview.packingCosting])

    const filtered = useMemo(() => {
        return overview.packingCosting.filter((row) => {
            if (statusFilter !== "all" && row.status !== statusFilter) return false
            if (!deferredSearch) return true
            return (
                row.packingOrderNumber.toLowerCase().includes(deferredSearch) ||
                row.itemSku.toLowerCase().includes(deferredSearch) ||
                row.itemName.toLowerCase().includes(deferredSearch) ||
                (row.finishedLotNumber ?? "").toLowerCase().includes(deferredSearch)
            )
        })
    }, [overview.packingCosting, statusFilter, deferredSearch])

    const safePageIndex = Math.min(pageIndex, Math.max(0, Math.ceil(filtered.length / pageSize) - 1))
    const sliceStart = safePageIndex * pageSize
    const sliceEnd = sliceStart + pageSize

    function handleExport() {
        downloadCsv("accounting-production-cost-rollup.csv", [
            [
                "Packing Order",
                "Status",
                "Item SKU",
                "Item Name",
                "Target Qty",
                "Actual Qty",
                "Primary UOM",
                "Consumed Material Cost",
                "Computed Unit Cost",
                "Catalog Unit Cost",
                "Unit Variance",
                "Finished Lot",
                "Currency",
            ],
            ...filtered.map((row) => [
                row.packingOrderNumber,
                row.status,
                row.itemSku,
                row.itemName,
                row.targetQty,
                row.actualQty,
                row.primaryUomName,
                row.consumedMaterialCost,
                row.computedUnitCost ?? "",
                row.catalogUnitCost,
                row.unitVariance,
                row.finishedLotNumber ?? "",
                currency,
            ]),
        ])
    }

    return (
        <div className="space-y-6">
            <AccountingKpiStrip
                cards={[
                    {
                        title: "Absorbed Production Material Cost",
                        value: formatCurrency(overview.summary.totalProductionCost, currency),
                        badge: "BOM Roll-Up",
                        helper: "Bulk spice, hardware & label batch cost consumed in completed runs.",
                        icon: Factory,
                        color: "text-amber-600 dark:text-amber-400",
                        bg: "bg-amber-500/10",
                    },
                    {
                        title: "Completed Packing Runs",
                        value: String(stats.completedCount),
                        badge: `${stats.totalOrders} total runs`,
                        helper: "Packing orders with finished lot output cost calculated.",
                        icon: CheckCircle2,
                        color: "text-emerald-600 dark:text-emerald-400",
                        bg: "bg-emerald-500/10",
                    },
                    {
                        title: "Finished Units Produced",
                        value: formatQuantity(stats.totalOutputQty),
                        badge: "Period output",
                        helper: "Completed finished units carrying computed batch unit cost.",
                        icon: PackageCheck,
                        color: "text-primary",
                        bg: "bg-primary/10",
                    },
                    {
                        title: "BOM Cost Lines Consumed",
                        value: String(stats.totalComponents),
                        badge: "Traceable lots",
                        helper: "Individual component lot consumptions rolled into finished goods.",
                        icon: Layers,
                        color: "text-sky-600 dark:text-sky-400",
                        bg: "bg-sky-500/10",
                    },
                ]}
            />

            <Card className="border shadow-xs">
                <CardHeader className="gap-3 border-b pb-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <CardTitle className="text-base font-semibold">
                                Production &amp; BOM Cost Roll-Up Subledger
                            </CardTitle>
                            <CardDescription className="text-xs">
                                Expand any packing order to audit exact component quantities, batch unit costs, and unit variance versus catalog reference.
                            </CardDescription>
                        </div>
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={handleExport}
                            disabled={filtered.length === 0}
                        >
                            <Download className="mr-1.5 size-4" />
                            Export CSV
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
                                placeholder="Search packing #, SKU, finished lot..."
                                className="h-8 pl-8 text-xs"
                            />
                        </div>
                        <div className="w-full sm:w-44">
                            <ComboboxSelect
                                items={statusItems}
                                value={statusFilter}
                                onValueChange={(v) => {
                                    setStatusFilter(v ?? "all")
                                    setPageIndex(0)
                                }}
                                placeholder="Status"
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow>
                                <TableHead className="w-10" />
                                <TableHead>Packing Order</TableHead>
                                <TableHead>Finished Good</TableHead>
                                <TableHead className="text-right">Output Qty</TableHead>
                                <TableHead className="text-right">Consumed Cost</TableHead>
                                <TableHead className="text-right">Rolled-Up Unit Cost</TableHead>
                                <TableHead className="text-right">Catalog Ref Cost</TableHead>
                                <TableHead className="text-right">Unit Variance</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filtered.slice(sliceStart, sliceEnd).map((row) => {
                                const isOpen = expandedId === row.packingOrderId
                                return (
                                    <Fragment key={row.packingOrderId}>
                                        <TableRow>
                                            <TableCell>
                                                {row.components.length > 0 && (
                                                    <Button
                                                        type="button"
                                                        size="icon-xs"
                                                        variant="ghost"
                                                        aria-label={
                                                            isOpen
                                                                ? "Hide BOM breakdown"
                                                                : "Show BOM breakdown"
                                                        }
                                                        onClick={() =>
                                                            setExpandedId(isOpen ? null : row.packingOrderId)
                                                        }
                                                    >
                                                        {isOpen ? (
                                                            <ChevronUp className="size-4" />
                                                        ) : (
                                                            <ChevronDown className="size-4" />
                                                        )}
                                                    </Button>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <div className="font-medium">{row.packingOrderNumber}</div>
                                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                    <Badge variant="outline" className="text-[10px]">
                                                        {row.status}
                                                    </Badge>
                                                    {row.finishedLotNumber ? `Lot ${row.finishedLotNumber}` : ""}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="font-medium">
                                                    {row.itemSku} — {row.itemName}
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    {row.components.length} consumed components
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums">
                                                {formatQuantity(
                                                    parseDecimalNumber(row.actualQty) > 0
                                                        ? row.actualQty
                                                        : row.targetQty,
                                                )}{" "}
                                                {row.primaryUomName}
                                            </TableCell>
                                            <TableCell className="text-right font-medium tabular-nums">
                                                {formatCurrency(row.consumedMaterialCost, currency)}
                                            </TableCell>
                                            <TableCell className="text-right font-semibold tabular-nums">
                                                {row.computedUnitCost
                                                    ? formatCurrency(row.computedUnitCost, currency)
                                                    : "Pending completion"}
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums text-muted-foreground">
                                                {formatCurrency(row.catalogUnitCost, currency)}
                                            </TableCell>
                                            <TableCell className={`text-right tabular-nums ${varianceClass(row.unitVariance)}`}>
                                                {formatSignedCurrency(row.unitVariance, currency)}
                                            </TableCell>
                                        </TableRow>
                                        {isOpen && row.components.length > 0 && (
                                            <TableRow className="bg-muted/20">
                                                <TableCell colSpan={8} className="p-3">
                                                    <div className="rounded-lg border bg-background p-3">
                                                        <p className="mb-2 text-xs font-semibold text-foreground">
                                                            BOM Component Cost Breakdown for {row.packingOrderNumber}
                                                        </p>
                                                        <div className="grid grid-cols-1 gap-1.5 text-xs sm:grid-cols-2 lg:grid-cols-3">
                                                            {row.components.map((comp, idx) => (
                                                                <div
                                                                    key={`${row.packingOrderId}-${comp.componentSku}-${idx}`}
                                                                    className="flex items-center justify-between rounded border px-2.5 py-1.5"
                                                                >
                                                                    <div className="min-w-0 pr-2">
                                                                        <p className="truncate font-medium">
                                                                            {comp.componentSku} · {comp.componentName}
                                                                        </p>
                                                                        <p className="text-muted-foreground">
                                                                            {formatQuantity(comp.qtyConsumed)} {comp.uomName} ×{" "}
                                                                            {formatCurrency(comp.unitCost, currency)}
                                                                        </p>
                                                                    </div>
                                                                    <span className="shrink-0 font-semibold tabular-nums">
                                                                        {formatCurrency(comp.totalCost, currency)}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </Fragment>
                                )
                            })}
                            {filtered.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                                        No matching packing cost records found.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                    <AccountingPagination
                        totalRows={filtered.length}
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
