"use client"

import { Fragment, memo, useDeferredValue, useMemo, useState } from "react"
import {
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    ChevronUp,
    Download,
    MapPin,
    Search,
} from "lucide-react"
import {
    COST_BASES,
    ITEM_TYPES,
    formatCurrency,
    formatDate,
    formatQuantity,
    formatSignedCurrency,
    type AccountingOverview,
} from "@/components/modules/accounting/accounting.schema"
import { ComboboxSelect } from "@/components/shared/combobox-select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
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

type AccountingTab = "lots" | "packing" | "sales" | "purchasing" | "ledger"

const TABS: {
    id: AccountingTab
    label: string
    hint: string
}[] = [
        {
            id: "lots",
            label: "Lot & Item Costing",
            hint: "Unit cost and asset value for every inventory batch, linking purchase actuals, packing roll-ups, and catalog fallback cost.",
        },
        {
            id: "packing",
            label: "Production Cost Roll-Up",
            hint: "How raw spices, packaging hardware, and labels rolled up into each finished product's unit cost.",
        },
        {
            id: "sales",
            label: "Sales & COGS",
            hint: "Booked order revenue versus actually delivered revenue, delivered Cost of Goods Sold (COGS), and gross profit.",
        },
        {
            id: "purchasing",
            label: "Purchasing Commitments",
            hint: "Supplier purchase order totals broken into value already received into stock and remaining open commitments.",
        },
        {
            id: "ledger",
            label: "Cost Ledger",
            hint: "Costed movement audit trail across receipts, production consumption, finished output, customer deliveries, adjustments, and scrap.",
        },
    ]

const PAGE_SIZE_OPTIONS = [10, 20, 50].map((size) => ({
    value: String(size),
    label: `${size} rows`,
}))

const LEDGER_TYPES = [
    "Receive",
    "Consume",
    "Produce",
    "Sale",
    "Transfer",
    "Adjustment",
    "Scrap",
] as const

function parseNumber(value: string | null | undefined): number {
    if (!value) return 0
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : 0
}

function basisBadgeVariant(basis: string) {
    if (basis === "Purchase Actual" || basis === "Packing Roll-Up") return "secondary" as const
    return "outline" as const
}

function varianceClass(value: string): string {
    const num = parseNumber(value)
    if (num > 0) return "text-amber-700 dark:text-amber-400"
    if (num < 0) return "text-emerald-700 dark:text-emerald-400"
    return "text-muted-foreground"
}

export const AccountingTables = memo(function AccountingTables({
    overview,
}: {
    overview: AccountingOverview
}) {
    const currencyCode = overview.currencyCode
    const [activeTab, setActiveTab] = useState<AccountingTab>("lots")
    const [searchInput, setSearchInput] = useState("")
    const deferredSearch = useDeferredValue(searchInput.trim().toLowerCase())

    const [lotTypeFilter, setLotTypeFilter] = useState<string>("all")
    const [lotBasisFilter, setLotBasisFilter] = useState<string>("all")
    const [ledgerTypeFilter, setLedgerTypeFilter] = useState<string>("all")
    const [expandedPackingId, setExpandedPackingId] = useState<number | null>(null)
    const [pageIndex, setPageIndex] = useState(0)
    const [pageSize, setPageSize] = useState(10)

    const itemTypeFilterItems = useMemo(
        () => [
            { value: "all", label: "All item types" },
            ...ITEM_TYPES.map((type) => ({ value: type, label: type })),
        ],
        [],
    )

    const costBasisFilterItems = useMemo(
        () => [
            { value: "all", label: "All cost bases" },
            ...COST_BASES.map((basis) => ({ value: basis, label: basis })),
        ],
        [],
    )

    const ledgerTypeFilterItems = useMemo(
        () => [
            { value: "all", label: "All movement types" },
            ...LEDGER_TYPES.map((type) => ({ value: type, label: type })),
        ],
        [],
    )

    const filteredLots = useMemo(() => {
        return overview.lotCosting.filter((row) => {
            if (lotTypeFilter !== "all" && row.itemType !== lotTypeFilter) return false
            if (lotBasisFilter !== "all" && row.costBasis !== lotBasisFilter) return false
            if (!deferredSearch) return true
            return (
                row.lotNumber.toLowerCase().includes(deferredSearch) ||
                row.itemSku.toLowerCase().includes(deferredSearch) ||
                row.itemName.toLowerCase().includes(deferredSearch) ||
                row.sourceReference.toLowerCase().includes(deferredSearch) ||
                (row.supplierName ?? "").toLowerCase().includes(deferredSearch)
            )
        })
    }, [overview.lotCosting, lotTypeFilter, lotBasisFilter, deferredSearch])

    const filteredPacking = useMemo(() => {
        if (!deferredSearch) return overview.packingCosting
        return overview.packingCosting.filter(
            (row) =>
                row.packingOrderNumber.toLowerCase().includes(deferredSearch) ||
                row.itemSku.toLowerCase().includes(deferredSearch) ||
                row.itemName.toLowerCase().includes(deferredSearch) ||
                (row.finishedLotNumber ?? "").toLowerCase().includes(deferredSearch),
        )
    }, [overview.packingCosting, deferredSearch])

    const filteredSales = useMemo(() => {
        if (!deferredSearch) return overview.salesCosting
        return overview.salesCosting.filter(
            (row) =>
                row.salesOrderNumber.toLowerCase().includes(deferredSearch) ||
                (row.customerPoNumber ?? "").toLowerCase().includes(deferredSearch) ||
                row.customerName.toLowerCase().includes(deferredSearch) ||
                row.status.toLowerCase().includes(deferredSearch),
        )
    }, [overview.salesCosting, deferredSearch])

    const filteredPurchasing = useMemo(() => {
        if (!deferredSearch) return overview.purchasingCosting
        return overview.purchasingCosting.filter(
            (row) =>
                row.poNumber.toLowerCase().includes(deferredSearch) ||
                row.supplierName.toLowerCase().includes(deferredSearch) ||
                row.status.toLowerCase().includes(deferredSearch),
        )
    }, [overview.purchasingCosting, deferredSearch])

    const filteredLedger = useMemo(() => {
        return overview.costLedger.filter((row) => {
            if (ledgerTypeFilter !== "all" && row.transactionType !== ledgerTypeFilter) {
                return false
            }
            if (!deferredSearch) return true
            return (
                row.itemSku.toLowerCase().includes(deferredSearch) ||
                row.itemName.toLowerCase().includes(deferredSearch) ||
                row.lotNumber.toLowerCase().includes(deferredSearch) ||
                row.locationName.toLowerCase().includes(deferredSearch) ||
                (row.referenceId ?? "").toLowerCase().includes(deferredSearch) ||
                row.authorizedByName.toLowerCase().includes(deferredSearch)
            )
        })
    }, [overview.costLedger, ledgerTypeFilter, deferredSearch])

    const totalRows =
        activeTab === "lots"
            ? filteredLots.length
            : activeTab === "packing"
                ? filteredPacking.length
                : activeTab === "sales"
                    ? filteredSales.length
                    : activeTab === "purchasing"
                        ? filteredPurchasing.length
                        : filteredLedger.length

    const pageCount = Math.max(1, Math.ceil(totalRows / pageSize))
    const safePageIndex = Math.min(pageIndex, pageCount - 1)
    const sliceStart = safePageIndex * pageSize
    const sliceEnd = sliceStart + pageSize

    function handleTabChange(nextTab: AccountingTab) {
        setActiveTab(nextTab)
        setPageIndex(0)
        setExpandedPackingId(null)
    }

    function handleExportCsv() {
        if (activeTab === "lots") {
            downloadCsv("accounting-lot-costing.csv", [
                [
                    "Lot Number",
                    "Item SKU",
                    "Item Name",
                    "Item Type",
                    "Source Type",
                    "Source Reference",
                    "Supplier",
                    "Catalog Unit Cost",
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
                    currencyCode,
                ]),
            ])
            return
        }

        if (activeTab === "packing") {
            downloadCsv("accounting-production-costing.csv", [
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
                ...filteredPacking.map((row) => [
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
                    currencyCode,
                ]),
            ])
            return
        }

        if (activeTab === "sales") {
            downloadCsv("accounting-sales-cogs.csv", [
                [
                    "Sales Order",
                    "Customer PO",
                    "Customer",
                    "Status",
                    "Order Date",
                    "Booked Revenue (Ex-VAT)",
                    "Delivered Revenue (Ex-VAT)",
                    "Output VAT",
                    "Delivered Billing (Incl. VAT)",
                    "Delivered COGS",
                    "Gross Profit",
                    "Gross Margin %",
                    "Completed Deliveries",
                    "Total Deliveries",
                    "Currency",
                ],
                ...filteredSales.map((row) => [
                    row.salesOrderNumber,
                    row.customerPoNumber ?? "",
                    row.customerName,
                    row.status,
                    row.orderDate,
                    row.bookedRevenue,
                    row.deliveredRevenue,
                    row.deliveredVatAmount ?? "0.0000",
                    row.deliveredBilling ?? row.deliveredRevenue,
                    row.deliveredCogs,
                    row.grossProfit,
                    row.grossMarginPercent ?? "",
                    String(row.completedDeliveryCount),
                    String(row.deliveryCount),
                    currencyCode,
                ]),
            ])
            return
        }

        if (activeTab === "purchasing") {
            downloadCsv("accounting-purchasing-commitments.csv", [
                [
                    "PO Number",
                    "Supplier",
                    "Status",
                    "Order Date",
                    "Expected Delivery",
                    "Lines",
                    "Ordered Net (Ex-VAT)",
                    "Input VAT",
                    "Ordered Total",
                    "Received Net",
                    "Received Input VAT",
                    "Received Value",
                    "Remaining Commitment",
                    "Currency",
                ],
                ...filteredPurchasing.map((row) => [
                    row.poNumber,
                    row.supplierName,
                    row.status,
                    row.orderDate,
                    row.expectedDeliveryDate ?? "",
                    String(row.lineCount),
                    row.netAmount ?? row.totalAmount,
                    row.vatAmount ?? "0.0000",
                    row.totalAmount,
                    row.receivedNetAmount ?? row.receivedAmount,
                    row.receivedVatAmount ?? "0.0000",
                    row.receivedAmount,
                    row.outstandingAmount,
                    currencyCode,
                ]),
            ])
            return
        }

        downloadCsv("accounting-cost-ledger.csv", [
            [
                "Transaction ID",
                "Timestamp",
                "Movement Type",
                "Reference",
                "Item SKU",
                "Item Name",
                "Lot Number",
                "Location",
                "Qty Change",
                "Primary UOM",
                "Effective Unit Cost",
                "Cost Basis",
                "Total Cost Impact",
                "Authorized By",
                "Currency",
            ],
            ...filteredLedger.map((row) => [
                String(row.transactionId),
                row.createdAt,
                row.transactionType,
                row.referenceId ?? "",
                row.itemSku,
                row.itemName,
                row.lotNumber,
                row.locationName,
                row.qtyChange,
                row.primaryUomName,
                row.effectiveUnitCost,
                row.costBasis,
                row.totalCostImpact,
                row.authorizedByName,
                currencyCode,
            ]),
        ])
    }

    const activeTabMeta = TABS.find((tab) => tab.id === activeTab) ?? TABS[0]

    return (
        <div className="space-y-4">
            {overview.valuationByLocation.length > 0 && (
                <Card size="sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-sm font-medium">
                            <MapPin className="size-4 text-muted-foreground" />
                            Stock Asset Value by Location
                        </CardTitle>
                        <CardDescription>
                            Live on-hand inventory valuation across warehouses, branches, stores, and In Transit.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 gap-2 @lg/main:grid-cols-2 @5xl/main:grid-cols-4">
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
                                    <span className="shrink-0 font-semibold tabular-nums">
                                        {formatCurrency(loc.assetValue, currencyCode)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardHeader className="gap-3 border-b pb-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex flex-wrap gap-1.5">
                            {TABS.map((tab) => (
                                <Button
                                    key={tab.id}
                                    type="button"
                                    size="sm"
                                    variant={activeTab === tab.id ? "default" : "outline"}
                                    onClick={() => handleTabChange(tab.id)}
                                >
                                    {tab.label}
                                </Button>
                            ))}
                        </div>

                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="shrink-0 self-start lg:self-auto"
                            onClick={handleExportCsv}
                            disabled={totalRows === 0}
                        >
                            <Download className="mr-1.5 size-4" />
                            Export CSV
                        </Button>
                    </div>

                    <div className="flex flex-col gap-2 pt-1 md:flex-row md:items-center md:justify-between">
                        <p className="min-w-0 text-xs text-muted-foreground">{activeTabMeta.hint}</p>
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="relative w-full sm:w-64">
                                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    value={searchInput}
                                    onChange={(event) => {
                                        setSearchInput(event.target.value)
                                        setPageIndex(0)
                                    }}
                                    placeholder="Search SKU, lot, order, partner..."
                                    aria-label="Search accounting records"
                                    className="h-8 pl-8 text-xs"
                                />
                            </div>

                            {activeTab === "lots" && (
                                <>
                                    <div className="w-full sm:w-40">
                                        <ComboboxSelect
                                            items={itemTypeFilterItems}
                                            value={lotTypeFilter}
                                            onValueChange={(value) => {
                                                setLotTypeFilter(value ?? "all")
                                                setPageIndex(0)
                                            }}
                                            placeholder="Item type"
                                            aria-label="Filter by item type"
                                            className="w-full"
                                        />
                                    </div>
                                    <div className="w-full sm:w-40">
                                        <ComboboxSelect
                                            items={costBasisFilterItems}
                                            value={lotBasisFilter}
                                            onValueChange={(value) => {
                                                setLotBasisFilter(value ?? "all")
                                                setPageIndex(0)
                                            }}
                                            placeholder="Cost basis"
                                            aria-label="Filter by cost basis"
                                            className="w-full"
                                        />
                                    </div>
                                </>
                            )}

                            {activeTab === "ledger" && (
                                <div className="w-full sm:w-44">
                                    <ComboboxSelect
                                        items={ledgerTypeFilterItems}
                                        value={ledgerTypeFilter}
                                        onValueChange={(value) => {
                                            setLedgerTypeFilter(value ?? "all")
                                            setPageIndex(0)
                                        }}
                                        placeholder="Movement type"
                                        aria-label="Filter by movement type"
                                        className="w-full"
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="p-0">
                    {activeTab === "lots" && (
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
                                            {formatCurrency(row.catalogUnitCost, currencyCode)}
                                        </TableCell>
                                        <TableCell className="text-right font-medium tabular-nums">
                                            {formatCurrency(row.effectiveUnitCost, currencyCode)}
                                        </TableCell>
                                        <TableCell
                                            className={`text-right tabular-nums ${varianceClass(row.unitVariance)}`}
                                        >
                                            {formatSignedCurrency(row.unitVariance, currencyCode)}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums">
                                            {formatQuantity(row.qtyOnHand)} {row.primaryUomName}
                                        </TableCell>
                                        <TableCell className="text-right font-semibold tabular-nums">
                                            {formatCurrency(row.assetValue, currencyCode)}
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
                    )}

                    {activeTab === "packing" && (
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead className="w-10"></TableHead>
                                    <TableHead>Packing Order</TableHead>
                                    <TableHead>Finished Good</TableHead>
                                    <TableHead className="text-right">Output Qty</TableHead>
                                    <TableHead className="text-right">Consumed Material Cost</TableHead>
                                    <TableHead className="text-right">Rolled-Up Unit Cost</TableHead>
                                    <TableHead className="text-right">Catalog Ref Cost</TableHead>
                                    <TableHead className="text-right">Unit Variance</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredPacking.slice(sliceStart, sliceEnd).map((row) => {
                                    const isOpen = expandedPackingId === row.packingOrderId
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
                                                                    ? "Hide BOM component breakdown"
                                                                    : "Show BOM component breakdown"
                                                            }
                                                            onClick={() =>
                                                                setExpandedPackingId(
                                                                    isOpen ? null : row.packingOrderId,
                                                                )
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
                                                    <div className="text-xs text-muted-foreground">
                                                        {row.status}
                                                        {row.finishedLotNumber
                                                            ? ` · Lot ${row.finishedLotNumber}`
                                                            : ""}
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
                                                        parseNumber(row.actualQty) > 0
                                                            ? row.actualQty
                                                            : row.targetQty,
                                                    )}{" "}
                                                    {row.primaryUomName}
                                                </TableCell>
                                                <TableCell className="text-right font-medium tabular-nums">
                                                    {formatCurrency(row.consumedMaterialCost, currencyCode)}
                                                </TableCell>
                                                <TableCell className="text-right font-semibold tabular-nums">
                                                    {row.computedUnitCost
                                                        ? formatCurrency(row.computedUnitCost, currencyCode)
                                                        : "Pending completion"}
                                                </TableCell>
                                                <TableCell className="text-right tabular-nums text-muted-foreground">
                                                    {formatCurrency(row.catalogUnitCost, currencyCode)}
                                                </TableCell>
                                                <TableCell
                                                    className={`text-right tabular-nums ${varianceClass(row.unitVariance)}`}
                                                >
                                                    {formatSignedCurrency(row.unitVariance, currencyCode)}
                                                </TableCell>
                                            </TableRow>
                                            {isOpen && row.components.length > 0 && (
                                                <TableRow className="bg-muted/20">
                                                    <TableCell colSpan={8} className="p-3">
                                                        <div className="rounded-lg border bg-background p-3">
                                                            <p className="mb-2 text-xs font-semibold text-foreground">
                                                                BOM Component Cost Breakdown for{" "}
                                                                {row.packingOrderNumber}
                                                            </p>
                                                            <div className="grid grid-cols-1 gap-1.5 text-xs sm:grid-cols-2 lg:grid-cols-3">
                                                                {row.components.map((comp, idx) => (
                                                                    <div
                                                                        key={`${row.packingOrderId}-${comp.componentSku}-${idx}`}
                                                                        className="flex items-center justify-between rounded border px-2.5 py-1.5"
                                                                    >
                                                                        <div className="min-w-0 pr-2">
                                                                            <p className="truncate font-medium">
                                                                                {comp.componentSku} ·{" "}
                                                                                {comp.componentName}
                                                                            </p>
                                                                            <p className="text-muted-foreground">
                                                                                {formatQuantity(comp.qtyConsumed)}{" "}
                                                                                {comp.uomName} ×{" "}
                                                                                {formatCurrency(
                                                                                    comp.unitCost,
                                                                                    currencyCode,
                                                                                )}
                                                                            </p>
                                                                        </div>
                                                                        <span className="shrink-0 font-semibold tabular-nums">
                                                                            {formatCurrency(
                                                                                comp.totalCost,
                                                                                currencyCode,
                                                                            )}
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
                                {filteredPacking.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                                            No packing cost roll-up records found.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    )}

                    {activeTab === "sales" && (
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead>Sales Order</TableHead>
                                    <TableHead>Customer</TableHead>
                                    <TableHead>Order Date</TableHead>
                                    <TableHead className="text-right">Booked Revenue</TableHead>
                                    <TableHead className="text-right">Delivered Revenue</TableHead>
                                    <TableHead className="text-right">Delivered COGS</TableHead>
                                    <TableHead className="text-right">Gross Profit</TableHead>
                                    <TableHead className="text-right">Margin</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredSales.slice(sliceStart, sliceEnd).map((row) => (
                                    <TableRow key={row.salesOrderId}>
                                        <TableCell>
                                            <div className="font-medium">{row.salesOrderNumber}</div>
                                            <div className="text-xs text-muted-foreground">
                                                {row.status}
                                                {row.customerPoNumber
                                                    ? ` · PO ${row.customerPoNumber}`
                                                    : ""}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="font-medium">{row.customerName}</div>
                                            <div className="text-xs text-muted-foreground">
                                                {row.completedDeliveryCount}/{row.deliveryCount} completed deliveries
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">
                                            {formatDate(row.orderDate)}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums">
                                            <div>{formatCurrency(row.bookedRevenue, currencyCode)}</div>
                                            {row.bookedVatAmount && parseNumber(row.bookedVatAmount) > 0 && (
                                                <div className="text-xs text-muted-foreground">
                                                    + VAT {formatCurrency(row.bookedVatAmount, currencyCode)}
                                                </div>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right font-medium tabular-nums">
                                            <div>{formatCurrency(row.deliveredRevenue, currencyCode)}</div>
                                            <div className="text-xs font-normal text-muted-foreground">
                                                {row.deliveredVatAmount && parseNumber(row.deliveredVatAmount) > 0
                                                    ? `+ VAT ${formatCurrency(row.deliveredVatAmount, currencyCode)}`
                                                    : "No VAT"}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums text-muted-foreground">
                                            {formatCurrency(row.deliveredCogs, currencyCode)}
                                        </TableCell>
                                        <TableCell
                                            className={`text-right font-semibold tabular-nums ${parseNumber(row.grossProfit) >= 0
                                                ? "text-emerald-700 dark:text-emerald-400"
                                                : "text-destructive"
                                                }`}
                                        >
                                            {formatSignedCurrency(row.grossProfit, currencyCode)}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums">
                                            {row.grossMarginPercent ? `${row.grossMarginPercent}%` : "—"}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {filteredSales.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                                            No sales and COGS records found for the selected period.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    )}

                    {activeTab === "purchasing" && (
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead>Purchase Order</TableHead>
                                    <TableHead>Supplier</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Order Date</TableHead>
                                    <TableHead className="text-right">Lines</TableHead>
                                    <TableHead className="text-right">Ordered Total</TableHead>
                                    <TableHead className="text-right">Received Value</TableHead>
                                    <TableHead className="text-right">Remaining</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredPurchasing.slice(sliceStart, sliceEnd).map((row) => (
                                    <TableRow key={row.poId}>
                                        <TableCell className="font-medium">{row.poNumber}</TableCell>
                                        <TableCell>{row.supplierName}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline">{row.status}</Badge>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">
                                            {formatDate(row.orderDate)}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums">{row.lineCount}</TableCell>
                                        <TableCell className="text-right font-medium tabular-nums">
                                            <div>{formatCurrency(row.totalAmount, currencyCode)}</div>
                                            <div className="text-xs font-normal text-muted-foreground">
                                                {row.vatAmount && parseNumber(row.vatAmount) > 0
                                                    ? `Net ${formatCurrency(row.netAmount ?? row.totalAmount, currencyCode)} + VAT ${formatCurrency(row.vatAmount, currencyCode)}`
                                                    : "No VAT"}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums text-emerald-700 dark:text-emerald-400">
                                            <div>{formatCurrency(row.receivedAmount, currencyCode)}</div>
                                            {row.receivedVatAmount && parseNumber(row.receivedVatAmount) > 0 && (
                                                <div className="text-xs text-muted-foreground">
                                                    VAT {formatCurrency(row.receivedVatAmount, currencyCode)}
                                                </div>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right font-semibold tabular-nums">
                                            {formatCurrency(row.outstandingAmount, currencyCode)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {filteredPurchasing.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                                            No purchasing commitment records found.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    )}

                    {activeTab === "ledger" && (
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead>Date / Ref</TableHead>
                                    <TableHead>Movement</TableHead>
                                    <TableHead>Item & Lot</TableHead>
                                    <TableHead>Location</TableHead>
                                    <TableHead className="text-right">Qty Change</TableHead>
                                    <TableHead className="text-right">Unit Cost</TableHead>
                                    <TableHead className="text-right">Cost Impact</TableHead>
                                    <TableHead>By</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredLedger.slice(sliceStart, sliceEnd).map((row) => (
                                    <TableRow key={row.transactionId}>
                                        <TableCell>
                                            <div className="font-medium">{formatDate(row.createdAt)}</div>
                                            <div className="text-xs text-muted-foreground">
                                                {row.referenceId ?? `#${row.transactionId}`}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline">{row.transactionType}</Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="font-medium">
                                                {row.itemSku} — {row.itemName}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                Lot {row.lotNumber} · {row.costBasis}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">{row.locationName}</TableCell>
                                        <TableCell className="text-right tabular-nums">
                                            {formatQuantity(row.qtyChange)} {row.primaryUomName}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums">
                                            {formatCurrency(row.effectiveUnitCost, currencyCode)}
                                        </TableCell>
                                        <TableCell
                                            className={`text-right font-semibold tabular-nums ${parseNumber(row.totalCostImpact) >= 0
                                                ? "text-emerald-700 dark:text-emerald-400"
                                                : "text-foreground"
                                                }`}
                                        >
                                            {formatSignedCurrency(row.totalCostImpact, currencyCode)}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">
                                            {row.authorizedByName}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {filteredLedger.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                                            No ledger movements match the current filter.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    )}

                    <div className="flex flex-col gap-3 border-t px-4 py-3 text-xs sm:flex-row sm:items-center sm:justify-between">
                        <div className="text-muted-foreground">
                            Showing{" "}
                            <span className="font-medium text-foreground">
                                {totalRows === 0 ? 0 : sliceStart + 1}
                            </span>
                            –
                            <span className="font-medium text-foreground">
                                {Math.min(sliceEnd, totalRows)}
                            </span>{" "}
                            of <span className="font-medium text-foreground">{totalRows}</span> records
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="w-28">
                                <ComboboxSelect
                                    items={PAGE_SIZE_OPTIONS}
                                    value={String(pageSize)}
                                    onValueChange={(value) => {
                                        const next = Number(value ?? "10")
                                        setPageSize(Number.isFinite(next) && next > 0 ? next : 10)
                                        setPageIndex(0)
                                    }}
                                    placeholder="Rows"
                                    aria-label="Rows per page"
                                    className="w-full"
                                />
                            </div>
                            <Button
                                type="button"
                                size="icon-xs"
                                variant="outline"
                                aria-label="Previous page"
                                onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
                                disabled={safePageIndex === 0}
                            >
                                <ChevronLeft className="size-4" />
                            </Button>
                            <span className="min-w-16 text-center text-muted-foreground tabular-nums">
                                Page {safePageIndex + 1} / {pageCount}
                            </span>
                            <Button
                                type="button"
                                size="icon-xs"
                                variant="outline"
                                aria-label="Next page"
                                onClick={() => setPageIndex((p) => Math.min(pageCount - 1, p + 1))}
                                disabled={safePageIndex >= pageCount - 1}
                            >
                                <ChevronRight className="size-4" />
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
})
