"use client"

import { useMemo } from "react"
import { BarChart3, PieChart as PieChartIcon, Receipt, Wallet } from "lucide-react"
import { Bar, BarChart, CartesianGrid, Label, Pie, PieChart, XAxis, YAxis } from "recharts"
import {
    computeCustomerReceivables,
    computeSimpleAccountingSummary,
    computeSupplierPayables,
} from "@/components/modules/accounting/accounting-engine"
import {
    formatCurrency,
    type AccountingOverview,
} from "@/components/modules/accounting/accounting.schema"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
    ChartContainer,
    ChartLegend,
    ChartLegendContent,
    ChartTooltip,
    ChartTooltipContent,
    type ChartConfig,
} from "@/components/ui/chart"

const CATEGORY_KEYS = {
    "Raw Material - Bulk": "raw",
    "Packaging - Hardware": "hardware",
    "Packaging - Label": "labels",
    "Finished Good": "finished",
} as const

const assetChartConfig = {
    value: { label: "Stock Value" },
    raw: {
        label: "Raw Spices",
        theme: { light: "oklch(0.75 0.16 70)", dark: "oklch(0.78 0.15 72)" },
    },
    hardware: {
        label: "Packaging",
        theme: { light: "oklch(0.62 0.17 250)", dark: "oklch(0.68 0.16 250)" },
    },
    labels: {
        label: "Labels",
        theme: { light: "oklch(0.64 0.13 185)", dark: "oklch(0.70 0.12 185)" },
    },
    finished: {
        label: "Finished Goods",
        theme: { light: "oklch(0.58 0.16 152)", dark: "oklch(0.68 0.16 152)" },
    },
} satisfies ChartConfig

const flowChartConfig = {
    amount: {
        label: "Amount",
        theme: { light: "oklch(0.58 0.16 152)", dark: "oklch(0.68 0.16 152)" },
    },
} satisfies ChartConfig

const customerChartConfig = {
    billed: {
        label: "Billed",
        theme: { light: "oklch(0.58 0.16 152)", dark: "oklch(0.68 0.16 152)" },
    },
    pending: {
        label: "Pending",
        theme: { light: "oklch(0.75 0.16 70)", dark: "oklch(0.78 0.15 72)" },
    },
} satisfies ChartConfig

const supplierChartConfig = {
    received: {
        label: "Received Bills",
        theme: { light: "oklch(0.62 0.17 250)", dark: "oklch(0.68 0.16 250)" },
    },
    open: {
        label: "Still Open",
        theme: { light: "oklch(0.75 0.16 70)", dark: "oklch(0.78 0.15 72)" },
    },
} satisfies ChartConfig

function safeNum(value: string): number {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : 0
}

function shortLabel(text: string, maxLen = 16): string {
    return text.length > maxLen ? `${text.slice(0, maxLen - 1)}…` : text
}

function formatAxisCompact(value: number): string {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
    if (value >= 1000) return `${Math.round(value / 1000)}k`
    return String(value)
}

export function AccountingCharts({ overview }: { overview: AccountingOverview }) {
    const currency = overview.currencyCode

    const simpleSummary = useMemo(
        () => computeSimpleAccountingSummary(overview),
        [overview],
    )

    const categorySeries = useMemo(
        () =>
            overview.valuationByCategory
                .map((row) => {
                    const key = CATEGORY_KEYS[row.itemType]
                    return {
                        category: key,
                        label: assetChartConfig[key].label,
                        value: Math.max(0, safeNum(row.assetValue)),
                        rawValue: row.assetValue,
                        sharePercent: row.sharePercent,
                        fill: `var(--color-${key})`,
                    }
                })
                .filter((row) => row.value > 0),
        [overview.valuationByCategory],
    )

    const flowSeries = useMemo(
        () => [
            {
                stage: "Total Sales",
                amount: Math.max(0, safeNum(simpleSummary.totalSales)),
                rawValue: simpleSummary.totalSales,
            },
            {
                stage: "Total Expenses",
                amount: Math.max(0, safeNum(simpleSummary.totalExpenses)),
                rawValue: simpleSummary.totalExpenses,
            },
            {
                stage: "Net Profit",
                amount: Math.max(0, safeNum(simpleSummary.netProfit)),
                rawValue: simpleSummary.netProfit,
            },
            {
                stage: "Supplier Bills",
                amount: Math.max(0, safeNum(simpleSummary.totalSupplierBills)),
                rawValue: simpleSummary.totalSupplierBills,
            },
            {
                stage: "Packing Cost",
                amount: Math.max(0, safeNum(overview.summary.totalProductionCost)),
                rawValue: overview.summary.totalProductionCost,
            },
            {
                stage: "Pending Sales",
                amount: Math.max(0, safeNum(simpleSummary.pendingSales)),
                rawValue: simpleSummary.pendingSales,
            },
        ],
        [simpleSummary, overview.summary.totalProductionCost],
    )

    const customerSeries = useMemo(
        () =>
            computeCustomerReceivables(overview.salesCosting)
                .slice(0, 6)
                .map((row) => ({
                    customer: row.customerName,
                    shortName: shortLabel(row.customerName),
                    billed: Math.max(0, safeNum(row.deliveredRevenue)),
                    pending: Math.max(0, safeNum(row.backlogRevenue)),
                    billedRaw: row.deliveredRevenue,
                    pendingRaw: row.backlogRevenue,
                })),
        [overview.salesCosting],
    )

    const supplierSeries = useMemo(
        () =>
            computeSupplierPayables(overview.purchasingCosting)
                .slice(0, 6)
                .map((row) => ({
                    supplier: row.supplierName,
                    shortName: shortLabel(row.supplierName),
                    received: Math.max(0, safeNum(row.receivedPayable)),
                    open: Math.max(0, safeNum(row.outstandingCommitment)),
                    receivedRaw: row.receivedPayable,
                    openRaw: row.outstandingCommitment,
                })),
        [overview.purchasingCosting],
    )

    return (
        <div className="grid gap-4 sm:gap-5 @4xl/main:grid-cols-2 [&>*]:min-w-0">
            {/* 1. Sales, Expenses & Profit */}
            <Card className="border shadow-xs">
                <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                        <BarChart3 className="size-4 shrink-0 text-primary" />
                        <CardTitle className="text-base font-semibold">
                            Sales, Expenses &amp; Profit
                        </CardTitle>
                    </div>
                    <CardDescription className="text-xs">
                        Side-by-side totals for sales, expenses, profit, supplier bills, and packing cost
                    </CardDescription>
                </CardHeader>
                <CardContent className="pb-4">
                    <ChartContainer
                        config={flowChartConfig}
                        className="aspect-auto h-[265px] w-full"
                    >
                        <BarChart
                            data={flowSeries}
                            margin={{ top: 8, left: 0, right: 8, bottom: 8 }}
                        >
                            <CartesianGrid vertical={false} />
                            <XAxis
                                dataKey="stage"
                                tickLine={false}
                                axisLine={false}
                                interval={0}
                                angle={-18}
                                textAnchor="end"
                                height={48}
                                tick={{ fontSize: 11 }}
                            />
                            <YAxis
                                tickLine={false}
                                axisLine={false}
                                width={48}
                                tick={{ fontSize: 11 }}
                                tickFormatter={formatAxisCompact}
                            />
                            <ChartTooltip
                                content={
                                    <ChartTooltipContent
                                        formatter={(value, _name, item) => {
                                            const row = item?.payload as
                                                | (typeof flowSeries)[number]
                                                | undefined
                                            return (
                                                <div className="flex w-full items-center justify-between gap-4">
                                                    <span className="text-muted-foreground">
                                                        {row?.stage ?? "Amount"}
                                                    </span>
                                                    <span className="font-mono font-medium text-foreground tabular-nums">
                                                        {formatCurrency(
                                                            row?.rawValue ?? String(value),
                                                            currency,
                                                        )}
                                                    </span>
                                                </div>
                                            )
                                        }}
                                    />
                                }
                            />
                            <Bar
                                dataKey="amount"
                                fill="var(--color-amount)"
                                radius={[6, 6, 0, 0]}
                                maxBarSize={32}
                            />
                        </BarChart>
                    </ChartContainer>
                </CardContent>
            </Card>

            {/* 2. Stock Value by Type */}
            <Card className="border shadow-xs">
                <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                        <PieChartIcon className="size-4 shrink-0 text-primary" />
                        <CardTitle className="text-base font-semibold">
                            Stock Value by Type
                        </CardTitle>
                    </div>
                    <CardDescription className="text-xs">
                        Where your inventory money sits right now across all warehouses
                    </CardDescription>
                </CardHeader>
                <CardContent className="pb-4">
                    {categorySeries.length === 0 ? (
                        <div className="flex h-[265px] items-center justify-center rounded-lg border border-dashed text-xs text-muted-foreground">
                            No positive valued inventory balances yet.
                        </div>
                    ) : (
                        <ChartContainer
                            config={assetChartConfig}
                            className="mx-auto aspect-auto h-[275px] w-full max-w-[380px] sm:h-[265px] sm:max-w-none"
                        >
                            <PieChart>
                                <ChartTooltip
                                    cursor={false}
                                    content={
                                        <ChartTooltipContent
                                            nameKey="category"
                                            hideLabel
                                            formatter={(value, name, item) => {
                                                const row = item?.payload as
                                                    | (typeof categorySeries)[number]
                                                    | undefined
                                                return (
                                                    <div className="flex w-full items-center justify-between gap-4">
                                                        <span className="text-muted-foreground">
                                                            {row?.label ?? String(name)}
                                                        </span>
                                                        <span className="font-mono font-medium text-foreground tabular-nums">
                                                            {formatCurrency(
                                                                row?.rawValue ?? String(value),
                                                                currency,
                                                            )}
                                                        </span>
                                                    </div>
                                                )
                                            }}
                                        />
                                    }
                                />
                                <Pie
                                    data={categorySeries}
                                    dataKey="value"
                                    nameKey="category"
                                    cy="46%"
                                    innerRadius="48%"
                                    outerRadius="74%"
                                    strokeWidth={3}
                                    paddingAngle={2}
                                >
                                    <Label
                                        content={({ viewBox }) => {
                                            if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                                                return (
                                                    <text
                                                        x={viewBox.cx}
                                                        y={viewBox.cy}
                                                        textAnchor="middle"
                                                        dominantBaseline="middle"
                                                    >
                                                        <tspan
                                                            x={viewBox.cx}
                                                            y={viewBox.cy}
                                                            className="fill-foreground text-xs font-bold tabular-nums sm:text-sm"
                                                        >
                                                            {formatCurrency(
                                                                overview.summary
                                                                    .totalInventoryAssetValue,
                                                                currency,
                                                            )}
                                                        </tspan>
                                                        <tspan
                                                            x={viewBox.cx}
                                                            y={(viewBox.cy || 0) + 18}
                                                            className="fill-muted-foreground text-[11px]"
                                                        >
                                                            Total Stock
                                                        </tspan>
                                                    </text>
                                                )
                                            }
                                            return null
                                        }}
                                    />
                                </Pie>
                                <ChartLegend
                                    content={
                                        <ChartLegendContent
                                            nameKey="category"
                                            className="flex-wrap gap-x-3 gap-y-1 text-xs"
                                        />
                                    }
                                />
                            </PieChart>
                        </ChartContainer>
                    )}
                </CardContent>
            </Card>

            {/* 3. Top Customers: Billed vs Pending */}
            <Card className="border shadow-xs">
                <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                        <Receipt className="size-4 shrink-0 text-primary" />
                        <CardTitle className="text-base font-semibold">
                            Top Customers (Billed vs. Pending)
                        </CardTitle>
                    </div>
                    <CardDescription className="text-xs">
                        Delivered customer invoices compared against pending orders
                    </CardDescription>
                </CardHeader>
                <CardContent className="pb-4">
                    {customerSeries.length === 0 ? (
                        <div className="flex h-[265px] items-center justify-center rounded-lg border border-dashed text-xs text-muted-foreground">
                            No customer orders recorded in this date range.
                        </div>
                    ) : (
                        <ChartContainer
                            config={customerChartConfig}
                            className="aspect-auto h-[265px] w-full"
                        >
                            <BarChart
                                data={customerSeries}
                                layout="vertical"
                                margin={{ top: 8, left: 0, right: 12, bottom: 4 }}
                            >
                                <CartesianGrid horizontal={false} />
                                <YAxis
                                    dataKey="shortName"
                                    type="category"
                                    tickLine={false}
                                    axisLine={false}
                                    width={104}
                                    tick={{ fontSize: 10 }}
                                />
                                <XAxis
                                    type="number"
                                    tickLine={false}
                                    axisLine={false}
                                    tick={{ fontSize: 11 }}
                                    tickFormatter={formatAxisCompact}
                                />
                                <ChartTooltip
                                    content={
                                        <ChartTooltipContent
                                            labelFormatter={(_label, payload) => {
                                                const row = payload?.[0]?.payload as
                                                    | (typeof customerSeries)[number]
                                                    | undefined
                                                return row?.customer ?? String(_label ?? "")
                                            }}
                                            formatter={(value, name, item) => {
                                                const row = item?.payload as
                                                    | (typeof customerSeries)[number]
                                                    | undefined
                                                const isBilled = name === "billed"
                                                const rawAmount = isBilled
                                                    ? row?.billedRaw
                                                    : row?.pendingRaw
                                                return (
                                                    <div className="flex w-full items-center justify-between gap-4">
                                                        <span className="text-muted-foreground">
                                                            {isBilled ? "Billed" : "Pending"}
                                                        </span>
                                                        <span className="font-mono font-medium text-foreground tabular-nums">
                                                            {formatCurrency(
                                                                rawAmount ?? String(value),
                                                                currency,
                                                            )}
                                                        </span>
                                                    </div>
                                                )
                                            }}
                                        />
                                    }
                                />
                                <ChartLegend content={<ChartLegendContent />} />
                                <Bar
                                    dataKey="billed"
                                    stackId="customer"
                                    fill="var(--color-billed)"
                                    radius={[0, 0, 0, 0]}
                                    maxBarSize={22}
                                />
                                <Bar
                                    dataKey="pending"
                                    stackId="customer"
                                    fill="var(--color-pending)"
                                    radius={[0, 6, 6, 0]}
                                    maxBarSize={22}
                                />
                            </BarChart>
                        </ChartContainer>
                    )}
                </CardContent>
            </Card>

            {/* 4. Supplier Bills: Received vs Open */}
            <Card className="border shadow-xs">
                <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                        <Wallet className="size-4 shrink-0 text-primary" />
                        <CardTitle className="text-base font-semibold">
                            Supplier Bills (Received vs. Open)
                        </CardTitle>
                    </div>
                    <CardDescription className="text-xs">
                        Received vendor bills compared with remaining open purchase orders
                    </CardDescription>
                </CardHeader>
                <CardContent className="pb-4">
                    {supplierSeries.length === 0 ? (
                        <div className="flex h-[265px] items-center justify-center rounded-lg border border-dashed text-xs text-muted-foreground">
                            No supplier purchase orders recorded in this date range.
                        </div>
                    ) : (
                        <ChartContainer
                            config={supplierChartConfig}
                            className="aspect-auto h-[265px] w-full"
                        >
                            <BarChart
                                data={supplierSeries}
                                layout="vertical"
                                margin={{ top: 8, left: 0, right: 12, bottom: 4 }}
                            >
                                <CartesianGrid horizontal={false} />
                                <YAxis
                                    dataKey="shortName"
                                    type="category"
                                    tickLine={false}
                                    axisLine={false}
                                    width={104}
                                    tick={{ fontSize: 10 }}
                                />
                                <XAxis
                                    type="number"
                                    tickLine={false}
                                    axisLine={false}
                                    tick={{ fontSize: 11 }}
                                    tickFormatter={formatAxisCompact}
                                />
                                <ChartTooltip
                                    content={
                                        <ChartTooltipContent
                                            labelFormatter={(_label, payload) => {
                                                const row = payload?.[0]?.payload as
                                                    | (typeof supplierSeries)[number]
                                                    | undefined
                                                return row?.supplier ?? String(_label ?? "")
                                            }}
                                            formatter={(value, name, item) => {
                                                const row = item?.payload as
                                                    | (typeof supplierSeries)[number]
                                                    | undefined
                                                const isReceived = name === "received"
                                                const rawAmount = isReceived
                                                    ? row?.receivedRaw
                                                    : row?.openRaw
                                                return (
                                                    <div className="flex w-full items-center justify-between gap-4">
                                                        <span className="text-muted-foreground">
                                                            {isReceived
                                                                ? "Received Bills"
                                                                : "Still Open"}
                                                        </span>
                                                        <span className="font-mono font-medium text-foreground tabular-nums">
                                                            {formatCurrency(
                                                                rawAmount ?? String(value),
                                                                currency,
                                                            )}
                                                        </span>
                                                    </div>
                                                )
                                            }}
                                        />
                                    }
                                />
                                <ChartLegend content={<ChartLegendContent />} />
                                <Bar
                                    dataKey="received"
                                    stackId="supplier"
                                    fill="var(--color-received)"
                                    radius={[0, 0, 0, 0]}
                                    maxBarSize={22}
                                />
                                <Bar
                                    dataKey="open"
                                    stackId="supplier"
                                    fill="var(--color-open)"
                                    radius={[0, 6, 6, 0]}
                                    maxBarSize={22}
                                />
                            </BarChart>
                        </ChartContainer>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
