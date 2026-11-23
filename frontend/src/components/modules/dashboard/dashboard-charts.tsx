"use client"

import { useMemo, useState } from "react"
import { Activity, Boxes, MapPin, PieChart as PieChartIcon, ShoppingCart } from "lucide-react"
import { Bar, BarChart, CartesianGrid, Label, Pie, PieChart, XAxis, YAxis } from "recharts"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
    type DashboardPendingPurchaseOrder,
    type DashboardRecentActivity,
    type DashboardStockByLocation,
    type DashboardStockByType,
    type DashboardSummary,
} from "@/components/modules/dashboard/dashboard.schema"
import {
    buildCategoryDistributionChart,
    buildLedgerActivityChart,
    buildLocationChart,
    buildPurchaseOrderChart,
} from "@/components/modules/dashboard/dashboard-charts.data"

const categoryChartConfig = {
    value: { label: "Inventory Value" },
    itemCount: { label: "Stocked SKUs" },
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

const purchaseOrderChartConfig = {
    receivedAmount: {
        label: "Received",
        theme: { light: "oklch(0.58 0.16 152)", dark: "oklch(0.68 0.16 152)" },
    },
    outstandingAmount: {
        label: "Remaining",
        theme: { light: "oklch(0.75 0.16 70)", dark: "oklch(0.78 0.15 72)" },
    },
} satisfies ChartConfig

const locationChartConfig = {
    itemCount: {
        label: "Stocked SKUs",
        theme: { light: "oklch(0.58 0.16 152)", dark: "oklch(0.68 0.16 152)" },
    },
} satisfies ChartConfig

const activityChartConfig = {
    count: {
        label: "Transactions",
        theme: { light: "oklch(0.62 0.17 250)", dark: "oklch(0.68 0.16 250)" },
    },
} satisfies ChartConfig

type CategoryMetric = "value" | "itemCount"
type OperationsTab = "purchasing" | "locations" | "activity"

export function DashboardCharts({
    summary,
    stockByType,
    stockByLocation,
    pendingPurchaseOrders,
    recentActivity,
}: {
    summary: DashboardSummary | null
    stockByType: DashboardStockByType[]
    stockByLocation: DashboardStockByLocation[]
    pendingPurchaseOrders: DashboardPendingPurchaseOrder[]
    recentActivity: DashboardRecentActivity[]
}) {
    const currencyCode = summary?.currencyCode ?? "PHP"
    const [categoryMetric, setCategoryMetric] = useState<CategoryMetric>("value")
    const [opsTab, setOpsTab] = useState<OperationsTab>(() =>
        pendingPurchaseOrders.length > 0 ? "purchasing" : "locations",
    )

    const categoryData = useMemo(
        () => buildCategoryDistributionChart(stockByType),
        [stockByType],
    )
    const activeCategoryData = useMemo(
        () => categoryData.filter((entry) => entry[categoryMetric] > 0),
        [categoryData, categoryMetric],
    )
    const totalCategorySkus = useMemo(
        () => categoryData.reduce((sum, entry) => sum + entry.itemCount, 0),
        [categoryData],
    )

    const purchaseOrderData = useMemo(
        () => buildPurchaseOrderChart(pendingPurchaseOrders),
        [pendingPurchaseOrders],
    )
    const locationData = useMemo(
        () => buildLocationChart(stockByLocation),
        [stockByLocation],
    )
    const activityData = useMemo(
        () => buildLedgerActivityChart(recentActivity),
        [recentActivity],
    )

    return (
        <div className="grid gap-6 lg:grid-cols-2">
            {/* Left Chart: Inventory Value / SKU Mix by Category */}
            <Card className="flex flex-col border shadow-xs">
                <CardHeader className="flex flex-col gap-3 pb-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                            <PieChartIcon className="size-4 text-primary" />
                            <CardTitle className="text-base font-semibold">
                                Inventory Composition
                            </CardTitle>
                        </div>
                        <CardDescription className="text-xs">
                            Share across raw materials, packaging, labels, and finished goods
                        </CardDescription>
                    </div>
                    <div className="flex items-center gap-1 rounded-lg border bg-muted/40 p-1 self-start sm:self-auto">
                        <Button
                            size="sm"
                            variant={categoryMetric === "value" ? "secondary" : "ghost"}
                            className="h-7 px-2.5 text-xs font-medium"
                            onClick={() => setCategoryMetric("value")}
                        >
                            Value
                        </Button>
                        <Button
                            size="sm"
                            variant={categoryMetric === "itemCount" ? "secondary" : "ghost"}
                            className="h-7 px-2.5 text-xs font-medium"
                            onClick={() => setCategoryMetric("itemCount")}
                        >
                            SKUs
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="flex-1 pb-4">
                    {activeCategoryData.length === 0 ? (
                        <div className="flex h-[260px] flex-col items-center justify-center rounded-lg border border-dashed text-center">
                            <Boxes className="size-8 text-muted-foreground/60" />
                            <p className="mt-2 text-sm font-medium text-foreground">
                                No inventory valuation data yet
                            </p>
                            <p className="mt-0.5 max-w-xs text-xs text-muted-foreground">
                                {categoryMetric === "value" && totalCategorySkus > 0
                                    ? "Stocked items currently have zero cost. Switch to SKUs to view balance counts."
                                    : "Receive purchase orders or record stock balances to populate this chart."}
                            </p>
                        </div>
                    ) : (
                        <ChartContainer
                            config={categoryChartConfig}
                            className="mx-auto aspect-square max-h-[260px] w-full"
                        >
                            <PieChart>
                                <ChartTooltip
                                    cursor={false}
                                    content={
                                        <ChartTooltipContent
                                            nameKey="category"
                                            hideLabel
                                            formatter={(value, _name, item) => {
                                                const payload = item?.payload as
                                                    | (typeof categoryData)[number]
                                                    | undefined
                                                const label = payload?.label ?? String(_name)
                                                const formatted =
                                                    categoryMetric === "value"
                                                        ? formatCurrency(
                                                              payload?.totalValueRaw ?? String(value),
                                                              currencyCode,
                                                          )
                                                        : `${value} SKU${value === 1 ? "" : "s"}`
                                                return (
                                                    <div className="flex w-full items-center justify-between gap-4">
                                                        <span className="text-muted-foreground">
                                                            {label}
                                                        </span>
                                                        <span className="font-mono font-medium text-foreground tabular-nums">
                                                            {formatted}
                                                        </span>
                                                    </div>
                                                )
                                            }}
                                        />
                                    }
                                />
                                <Pie
                                    data={activeCategoryData}
                                    dataKey={categoryMetric}
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
                                                            {categoryMetric === "value"
                                                                ? formatCurrency(
                                                                      summary?.totalInventoryValue ??
                                                                          "0",
                                                                      currencyCode,
                                                                  )
                                                                : totalCategorySkus}
                                                        </tspan>
                                                        <tspan
                                                            x={viewBox.cx}
                                                            y={(viewBox.cy || 0) + 18}
                                                            className="fill-muted-foreground text-[11px]"
                                                        >
                                                            {categoryMetric === "value"
                                                                ? "Total Value"
                                                                : "Stocked SKUs"}
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

            {/* Right Chart: Open POs / Locations / Ledger Mix */}
            <Card className="flex flex-col border shadow-xs">
                <CardHeader className="flex flex-col gap-3 pb-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                            <CardTitle className="text-base font-semibold">
                                Operations Analytics
                            </CardTitle>
                            <Badge variant="outline" className="h-5 text-[10px] font-medium">
                                {opsTab === "purchasing"
                                    ? `${purchaseOrderData.length} Open POs`
                                    : opsTab === "locations"
                                      ? `${locationData.length} Facilities`
                                      : `${recentActivity.length} Movements`}
                            </Badge>
                        </div>
                        <CardDescription className="text-xs">
                            {opsTab === "purchasing"
                                ? "Received vs. remaining balance on open supplier orders"
                                : opsTab === "locations"
                                  ? "Distinct SKUs currently stored per warehouse, branch, or store"
                                  : "Recent inventory ledger movements grouped by transaction type"}
                        </CardDescription>
                    </div>

                    <div className="flex flex-wrap items-center gap-1 rounded-lg border bg-muted/40 p-1 self-start sm:self-auto">
                        <Button
                            size="sm"
                            variant={opsTab === "purchasing" ? "secondary" : "ghost"}
                            className="h-7 px-2.5 text-xs font-medium"
                            onClick={() => setOpsTab("purchasing")}
                        >
                            <ShoppingCart className="mr-1.5 size-3.5" />
                            POs
                        </Button>
                        <Button
                            size="sm"
                            variant={opsTab === "locations" ? "secondary" : "ghost"}
                            className="h-7 px-2.5 text-xs font-medium"
                            onClick={() => setOpsTab("locations")}
                        >
                            <MapPin className="mr-1.5 size-3.5" />
                            Locations
                        </Button>
                        <Button
                            size="sm"
                            variant={opsTab === "activity" ? "secondary" : "ghost"}
                            className="h-7 px-2.5 text-xs font-medium"
                            onClick={() => setOpsTab("activity")}
                        >
                            <Activity className="mr-1.5 size-3.5" />
                            Ledger
                        </Button>
                    </div>
                </CardHeader>

                <CardContent className="flex-1 pb-4">
                    {opsTab === "purchasing" &&
                        (purchaseOrderData.length === 0 ? (
                            <div className="flex h-[260px] flex-col items-center justify-center rounded-lg border border-dashed text-center">
                                <ShoppingCart className="size-8 text-muted-foreground/60" />
                                <p className="mt-2 text-sm font-medium text-foreground">
                                    No open purchase orders
                                </p>
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                    All supplier purchase orders have been received or closed.
                                </p>
                            </div>
                        ) : (
                            <ChartContainer
                                config={purchaseOrderChartConfig}
                                className="aspect-auto h-[260px] w-full"
                            >
                                <BarChart data={purchaseOrderData} margin={{ top: 8, left: 4, right: 8 }}>
                                    <CartesianGrid vertical={false} />
                                    <XAxis
                                        dataKey="poNumber"
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
                                                labelFormatter={(_label, payload) => {
                                                    const row = payload?.[0]?.payload as
                                                        | (typeof purchaseOrderData)[number]
                                                        | undefined
                                                    return row
                                                        ? `${row.poNumber} · ${row.supplierName}`
                                                        : String(_label ?? "")
                                                }}
                                                formatter={(value, name, item) => {
                                                    const row = item?.payload as
                                                        | (typeof purchaseOrderData)[number]
                                                        | undefined
                                                    const isReceived = name === "receivedAmount"
                                                    const rawAmount = isReceived
                                                        ? row?.receivedRaw
                                                        : row?.outstandingRaw
                                                    return (
                                                        <div className="flex w-full items-center justify-between gap-4">
                                                            <span className="text-muted-foreground">
                                                                {isReceived
                                                                    ? "Received"
                                                                    : "Remaining"}
                                                            </span>
                                                            <span className="font-mono font-medium text-foreground tabular-nums">
                                                                {formatCurrency(
                                                                    rawAmount ?? String(value),
                                                                    currencyCode,
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
                                        dataKey="receivedAmount"
                                        stackId="po"
                                        fill="var(--color-receivedAmount)"
                                        radius={[0, 0, 4, 4]}
                                    />
                                    <Bar
                                        dataKey="outstandingAmount"
                                        stackId="po"
                                        fill="var(--color-outstandingAmount)"
                                        radius={[4, 4, 0, 0]}
                                    />
                                </BarChart>
                            </ChartContainer>
                        ))}

                    {opsTab === "locations" &&
                        (locationData.length === 0 ? (
                            <div className="flex h-[260px] flex-col items-center justify-center rounded-lg border border-dashed text-center">
                                <MapPin className="size-8 text-muted-foreground/60" />
                                <p className="mt-2 text-sm font-medium text-foreground">
                                    No facility stock balances yet
                                </p>
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                    Receive or transfer inventory to see stocked items per location.
                                </p>
                            </div>
                        ) : (
                            <ChartContainer
                                config={locationChartConfig}
                                className="aspect-auto h-[260px] w-full"
                            >
                                <BarChart
                                    data={locationData}
                                    layout="vertical"
                                    margin={{ top: 8, left: 8, right: 16 }}
                                >
                                    <CartesianGrid horizontal={false} />
                                    <YAxis
                                        dataKey="shortName"
                                        type="category"
                                        tickLine={false}
                                        axisLine={false}
                                        width={110}
                                    />
                                    <XAxis
                                        type="number"
                                        allowDecimals={false}
                                        tickLine={false}
                                        axisLine={false}
                                    />
                                    <ChartTooltip
                                        content={
                                            <ChartTooltipContent
                                                labelFormatter={(_label, payload) => {
                                                    const row = payload?.[0]?.payload as
                                                        | (typeof locationData)[number]
                                                        | undefined
                                                    return row
                                                        ? `${row.name} (${row.locationType})`
                                                        : String(_label ?? "")
                                                }}
                                            />
                                        }
                                    />
                                    <Bar
                                        dataKey="itemCount"
                                        fill="var(--color-itemCount)"
                                        radius={[0, 6, 6, 0]}
                                        barSize={24}
                                    />
                                </BarChart>
                            </ChartContainer>
                        ))}

                    {opsTab === "activity" &&
                        (activityData.length === 0 ? (
                            <div className="flex h-[260px] flex-col items-center justify-center rounded-lg border border-dashed text-center">
                                <Activity className="size-8 text-muted-foreground/60" />
                                <p className="mt-2 text-sm font-medium text-foreground">
                                    No recent ledger movements
                                </p>
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                    Transactions will appear here once stock movements are recorded.
                                </p>
                            </div>
                        ) : (
                            <ChartContainer
                                config={activityChartConfig}
                                className="aspect-auto h-[260px] w-full"
                            >
                                <BarChart data={activityData} margin={{ top: 8, left: 4, right: 8 }}>
                                    <CartesianGrid vertical={false} />
                                    <XAxis
                                        dataKey="transactionType"
                                        tickLine={false}
                                        axisLine={false}
                                        tickMargin={8}
                                    />
                                    <YAxis
                                        allowDecimals={false}
                                        tickLine={false}
                                        axisLine={false}
                                        width={36}
                                    />
                                    <ChartTooltip content={<ChartTooltipContent />} />
                                    <Bar
                                        dataKey="count"
                                        fill="var(--color-count)"
                                        radius={[6, 6, 0, 0]}
                                        barSize={34}
                                    />
                                </BarChart>
                            </ChartContainer>
                        ))}
                </CardContent>
            </Card>
        </div>
    )
}
