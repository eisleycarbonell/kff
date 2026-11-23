"use client"

import { useMemo } from "react"
import { BarChart3, PieChart as PieChartIcon } from "lucide-react"
import { Bar, BarChart, CartesianGrid, Label, Pie, PieChart, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
    ChartContainer,
    ChartLegend,
    ChartLegendContent,
    ChartTooltip,
    ChartTooltipContent,
    type ChartConfig,
} from "@/components/ui/chart"
import {
    formatCurrency,
    type AccountingOverview,
} from "@/components/modules/accounting/accounting.schema"

const CATEGORY_KEYS = {
    "Raw Material - Bulk": "raw",
    "Packaging - Hardware": "hardware",
    "Packaging - Label": "labels",
    "Finished Good": "finished",
} as const

const assetChartConfig = {
    value: { label: "Asset Value" },
    raw: {
        label: "Raw Materials",
        theme: { light: "oklch(0.75 0.16 70)", dark: "oklch(0.78 0.15 72)" },
    },
    hardware: {
        label: "Hardware",
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

function safeNum(value: string): number {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : 0
}

export function AccountingCharts({ overview }: { overview: AccountingOverview }) {
    const currency = overview.currencyCode

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

    const costFlowSeries = useMemo(
        () => [
            {
                stage: "PO Received",
                amount: Math.max(0, safeNum(overview.summary.purchaseReceivedValue)),
                rawValue: overview.summary.purchaseReceivedValue,
            },
            {
                stage: "PO Remaining",
                amount: Math.max(0, safeNum(overview.summary.purchaseOutstandingValue)),
                rawValue: overview.summary.purchaseOutstandingValue,
            },
            {
                stage: "Packed Cost",
                amount: Math.max(0, safeNum(overview.summary.totalProductionCost)),
                rawValue: overview.summary.totalProductionCost,
            },
            {
                stage: "Sales Rev",
                amount: Math.max(0, safeNum(overview.summary.totalDeliveredRevenue)),
                rawValue: overview.summary.totalDeliveredRevenue,
            },
            {
                stage: "COGS",
                amount: Math.max(0, safeNum(overview.summary.totalDeliveredCogs)),
                rawValue: overview.summary.totalDeliveredCogs,
            },
            {
                stage: "Gross Profit",
                amount: Math.max(0, safeNum(overview.summary.grossProfit)),
                rawValue: overview.summary.grossProfit,
            },
        ],
        [overview.summary],
    )

    return (
        <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border shadow-xs">
                <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                        <PieChartIcon className="size-4 text-primary" />
                        <CardTitle className="text-base font-semibold">
                            Inventory Asset Value by Category
                        </CardTitle>
                    </div>
                    <CardDescription className="text-xs">
                        Where your inventory capital is held right now across all locations
                    </CardDescription>
                </CardHeader>
                <CardContent className="pb-4">
                    {categorySeries.length === 0 ? (
                        <div className="flex h-[260px] items-center justify-center rounded-lg border border-dashed text-xs text-muted-foreground">
                            No positive valued inventory balances yet.
                        </div>
                    ) : (
                        <ChartContainer
                            config={assetChartConfig}
                            className="mx-auto aspect-square max-h-[260px] w-full"
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
                                    innerRadius={58}
                                    outerRadius={88}
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
                                                            className="fill-foreground text-sm font-bold tabular-nums"
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
                                                            Total Asset
                                                        </tspan>
                                                    </text>
                                                )
                                            }
                                            return null
                                        }}
                                    />
                                </Pie>
                                <ChartLegend
                                    content={<ChartLegendContent nameKey="category" />}
                                    className="flex-wrap gap-3 text-xs"
                                />
                            </PieChart>
                        </ChartContainer>
                    )}
                </CardContent>
            </Card>

            <Card className="border shadow-xs">
                <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                        <BarChart3 className="size-4 text-primary" />
                        <CardTitle className="text-base font-semibold">
                            Cost Flow: Purchasing to Profit
                        </CardTitle>
                    </div>
                    <CardDescription className="text-xs">
                        Financial flow across supplier receipts, production roll-up, sales, COGS, and profit
                    </CardDescription>
                </CardHeader>
                <CardContent className="pb-4">
                    <ChartContainer
                        config={flowChartConfig}
                        className="aspect-auto h-[260px] w-full"
                    >
                        <BarChart
                            data={costFlowSeries}
                            margin={{ top: 8, left: 4, right: 8 }}
                        >
                            <CartesianGrid vertical={false} />
                            <XAxis
                                dataKey="stage"
                                tickLine={false}
                                axisLine={false}
                                tickMargin={8}
                            />
                            <YAxis
                                tickLine={false}
                                axisLine={false}
                                width={68}
                                tickFormatter={(value: number) =>
                                    value >= 1000
                                        ? `${Math.round(value / 1000)}k`
                                        : String(value)
                                }
                            />
                            <ChartTooltip
                                content={
                                    <ChartTooltipContent
                                        formatter={(value, _name, item) => {
                                            const row = item?.payload as
                                                | (typeof costFlowSeries)[number]
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
                                barSize={32}
                            />
                        </BarChart>
                    </ChartContainer>
                </CardContent>
            </Card>
        </div>
    )
}
