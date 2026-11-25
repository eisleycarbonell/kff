"use client"

import { useMemo, useState } from "react"
import {
    Activity,
    BarChart3,
    Boxes,
    Factory,
    MapPin,
    PieChart as PieChartIcon,
    ShoppingCart,
} from "lucide-react"
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
    type DashboardActivePackingOrder,
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
    buildOperationsWorkloadChart,
    buildPackingProgressChart,
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

const workloadChartConfig = {
    count: {
        label: "Items / Orders",
        theme: { light: "oklch(0.62 0.17 250)", dark: "oklch(0.68 0.16 250)" },
    },
} satisfies ChartConfig

const locationChartConfig = {
    itemCount: {
        label: "Stocked SKUs",
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

const packingChartConfig = {
    actualQty: {
        label: "Produced",
        theme: { light: "oklch(0.58 0.16 152)", dark: "oklch(0.68 0.16 152)" },
    },
    remainingQty: {
        label: "Remaining",
        theme: { light: "oklch(0.75 0.16 70)", dark: "oklch(0.78 0.15 72)" },
    },
} satisfies ChartConfig

const activityChartConfig = {
    count: {
        label: "Movements",
        theme: { light: "oklch(0.62 0.17 250)", dark: "oklch(0.68 0.16 250)" },
    },
} satisfies ChartConfig

type CategoryMetric = "value" | "itemCount"
type OrdersTab = "purchasing" | "packing" | "activity"

export function DashboardCharts({
    summary,
    stockByType,
    stockByLocation,
    activePackingOrders,
    pendingPurchaseOrders,
    recentActivity,
}: {
    summary: DashboardSummary | null
    stockByType: DashboardStockByType[]
    stockByLocation: DashboardStockByLocation[]
    activePackingOrders: DashboardActivePackingOrder[]
    pendingPurchaseOrders: DashboardPendingPurchaseOrder[]
    recentActivity: DashboardRecentActivity[]
}) {
    const currencyCode = summary?.currencyCode ?? "PHP"
    const [categoryMetric, setCategoryMetric] = useState<CategoryMetric>("value")
    const [ordersTab, setOrdersTab] = useState<OrdersTab>(() =>
        pendingPurchaseOrders.length > 0
            ? "purchasing"
            : activePackingOrders.length > 0
              ? "packing"
              : "activity",
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

    const workloadData = useMemo(
        () => buildOperationsWorkloadChart(summary),
        [summary],
    )
    const locationData = useMemo(
        () => buildLocationChart(stockByLocation),
        [stockByLocation],
    )
    const purchaseOrderData = useMemo(
        () => buildPurchaseOrderChart(pendingPurchaseOrders),
        [pendingPurchaseOrders],
    )
    const packingData = useMemo(
        () => buildPackingProgressChart(activePackingOrders),
        [activePackingOrders],
    )
    const activityData = useMemo(
        () => buildLedgerActivityChart(recentActivity),
        [recentActivity],
    )

    return (
        <div className="grid gap-4 sm:gap-5 @4xl/main:grid-cols-2 [&>*]:min-w-0">
            {/* 1. Inventory Composition */}
            <Card className="@container/card flex flex-col border shadow-xs">
                <CardHeader className="flex flex-col gap-2.5 pb-2 @lg/card:flex-row @lg/card:items-start @lg/card:justify-between">
                    <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex items-center gap-2">
                            <PieChartIcon className="size-4 shrink-0 text-primary" />
                            <CardTitle className="text-base font-semibold">
                                Inventory Composition
                            </CardTitle>
                        </div>
                        <CardDescription className="text-xs">
                            Share across raw materials, packaging, labels, and finished goods
                        </CardDescription>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-1 self-start rounded-lg border bg-muted/40 p-1 @lg/card:self-auto">
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
                <CardContent className="min-w-0 flex-1 pb-4">
                    {activeCategoryData.length === 0 ? (
                        <div className="flex h-[265px] flex-col items-center justify-center rounded-lg border border-dashed text-center">
                            <Boxes className="size-8 text-muted-foreground/60" />
                            <p className="mt-2 text-sm font-medium text-foreground">
                                No inventory valuation data yet
                            </p>
                            <p className="mt-0.5 max-w-xs text-xs text-muted-foreground">
                                {categoryMetric === "value" && totalCategorySkus > 0
                                    ? "Stocked items have zero cost. Switch to SKUs to view balance counts."
                                    : "Receive purchase orders or record stock balances to populate this chart."}
                            </p>
                        </div>
                    ) : (
                        <ChartContainer
                            config={categoryChartConfig}
                            className="mx-auto aspect-auto h-[275px] w-full max-w-[380px] sm:h-[265px] sm:max-w-none"
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
                                    cy="45%"
                                    innerRadius="58%"
                                    outerRadius="82%"
                                    strokeWidth={3}
                                    paddingAngle={2}
                                >
                                    <Label
                                        content={({ viewBox }) => {
                                            if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                                                const centerText =
                                                    categoryMetric === "value"
                                                        ? formatCurrency(
                                                              summary?.totalInventoryValue ?? "0",
                                                              currencyCode,
                                                          )
                                                        : String(totalCategorySkus)
                                                return (
                                                    <text
                                                        x={viewBox.cx}
                                                        y={viewBox.cy}
                                                        textAnchor="middle"
                                                        dominantBaseline="middle"
                                                    >
                                                        <tspan
                                                            x={viewBox.cx}
                                                            y={(viewBox.cy || 0) - 5}
                                                            className={`fill-foreground font-bold tabular-nums ${centerText.length > 11 ? "text-[11px]" : "text-xs sm:text-sm"}`}
                                                        >
                                                            {centerText}
                                                        </tspan>
                                                        <tspan
                                                            x={viewBox.cx}
                                                            y={(viewBox.cy || 0) + 12}
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

            {/* 2. Operations & Alerts Overview */}
            <Card className="@container/card flex flex-col border shadow-xs">
                <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                        <BarChart3 className="size-4 shrink-0 text-primary" />
                        <CardTitle className="text-base font-semibold">
                            Operations &amp; Alerts Overview
                        </CardTitle>
                    </div>
                    <CardDescription className="text-xs">
                        Active packing, purchasing, sales, deliveries, transfers, and stock alerts
                    </CardDescription>
                </CardHeader>
                <CardContent className="min-w-0 flex-1 pb-4">
                    {workloadData.length === 0 ? (
                        <div className="flex h-[265px] items-center justify-center rounded-lg border border-dashed text-xs text-muted-foreground">
                            No operational activity metrics yet.
                        </div>
                    ) : (
                        <ChartContainer
                            config={workloadChartConfig}
                            className="aspect-auto h-[265px] w-full"
                        >
                            <BarChart
                                data={workloadData}
                                layout="vertical"
                                margin={{ top: 6, left: 0, right: 12, bottom: 4 }}
                            >
                                <CartesianGrid horizontal={false} />
                                <YAxis
                                    dataKey="metric"
                                    type="category"
                                    tickLine={false}
                                    axisLine={false}
                                    width={80}
                                    tick={{ fontSize: 11 }}
                                />
                                <XAxis
                                    type="number"
                                    allowDecimals={false}
                                    tickLine={false}
                                    axisLine={false}
                                    tick={{ fontSize: 11 }}
                                />
                                <ChartTooltip content={<ChartTooltipContent />} />
                                <Bar
                                    dataKey="count"
                                    fill="var(--color-count)"
                                    radius={[0, 6, 6, 0]}
                                    maxBarSize={22}
                                />
                            </BarChart>
                        </ChartContainer>
                    )}
                </CardContent>
            </Card>

            {/* 3. Stock by Location */}
            <Card className="@container/card flex flex-col border shadow-xs">
                <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <MapPin className="size-4 shrink-0 text-primary" />
                            <CardTitle className="text-base font-semibold">
                                Stock by Location
                            </CardTitle>
                        </div>
                        <Badge variant="outline" className="h-5 text-[10px] font-medium">
                            {locationData.length} Facilities
                        </Badge>
                    </div>
                    <CardDescription className="text-xs">
                        Distinct stocked SKUs across warehouses, branches, stores, and In Transit
                    </CardDescription>
                </CardHeader>
                <CardContent className="min-w-0 flex-1 pb-4">
                    {locationData.length === 0 ? (
                        <div className="flex h-[265px] flex-col items-center justify-center rounded-lg border border-dashed text-center">
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
                            className="aspect-auto h-[265px] w-full"
                        >
                            <BarChart
                                data={locationData}
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
                                    allowDecimals={false}
                                    tickLine={false}
                                    axisLine={false}
                                    tick={{ fontSize: 11 }}
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
                                    maxBarSize={24}
                                />
                            </BarChart>
                        </ChartContainer>
                    )}
                </CardContent>
            </Card>

            {/* 4. Orders & Movements */}
            <Card className="@container/card flex flex-col border shadow-xs">
                <CardHeader className="flex flex-col gap-2.5 pb-2 @lg/card:flex-row @lg/card:items-start @lg/card:justify-between">
                    <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex flex-wrap items-center gap-2">
                            <CardTitle className="text-base font-semibold">
                                Orders &amp; Movements
                            </CardTitle>
                            <Badge variant="outline" className="h-5 text-[10px] font-medium">
                                {ordersTab === "purchasing"
                                    ? `${purchaseOrderData.length} Open POs`
                                    : ordersTab === "packing"
                                      ? `${packingData.length} Active Runs`
                                      : `${recentActivity.length} Movements`}
                            </Badge>
                        </div>
                        <CardDescription className="text-xs">
                            {ordersTab === "purchasing"
                                ? "Received vs. remaining balance on open supplier orders"
                                : ordersTab === "packing"
                                  ? "Produced vs. remaining quantity on active packing runs"
                                  : "Recent inventory movements grouped by transaction type"}
                        </CardDescription>
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-1 self-start rounded-lg border bg-muted/40 p-1 @lg/card:self-auto">
                        <Button
                            size="sm"
                            variant={ordersTab === "purchasing" ? "secondary" : "ghost"}
                            className="h-7 px-2.5 text-xs font-medium"
                            onClick={() => setOrdersTab("purchasing")}
                        >
                            <ShoppingCart className="mr-1.5 size-3.5" />
                            POs
                        </Button>
                        <Button
                            size="sm"
                            variant={ordersTab === "packing" ? "secondary" : "ghost"}
                            className="h-7 px-2.5 text-xs font-medium"
                            onClick={() => setOrdersTab("packing")}
                        >
                            <Factory className="mr-1.5 size-3.5" />
                            Packing
                        </Button>
                        <Button
                            size="sm"
                            variant={ordersTab === "activity" ? "secondary" : "ghost"}
                            className="h-7 px-2.5 text-xs font-medium"
                            onClick={() => setOrdersTab("activity")}
                        >
                            <Activity className="mr-1.5 size-3.5" />
                            Movements
                        </Button>
                    </div>
                </CardHeader>

                <CardContent className="min-w-0 flex-1 pb-4">
                    {ordersTab === "purchasing" &&
                        (purchaseOrderData.length === 0 ? (
                            <div className="flex h-[265px] flex-col items-center justify-center rounded-lg border border-dashed text-center">
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
                                className="aspect-auto h-[265px] w-full"
                            >
                                <BarChart
                                    data={purchaseOrderData}
                                    margin={{ top: 8, left: 0, right: 8, bottom: 16 }}
                                >
                                    <CartesianGrid vertical={false} />
                                    <XAxis
                                        dataKey="poNumber"
                                        tickLine={false}
                                        axisLine={false}
                                        tickMargin={8}
                                        interval={0}
                                        angle={-20}
                                        textAnchor="end"
                                        height={48}
                                        tick={{ fontSize: 10 }}
                                    />
                                    <YAxis
                                        tickLine={false}
                                        axisLine={false}
                                        width={42}
                                        tick={{ fontSize: 11 }}
                                        tickFormatter={(value: number) =>
                                            value >= 1_000_000
                                                ? `${(value / 1_000_000).toFixed(1)}M`
                                                : value >= 1000
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
                                        maxBarSize={36}
                                    />
                                    <Bar
                                        dataKey="outstandingAmount"
                                        stackId="po"
                                        fill="var(--color-outstandingAmount)"
                                        radius={[4, 4, 0, 0]}
                                        maxBarSize={36}
                                    />
                                </BarChart>
                            </ChartContainer>
                        ))}

                    {ordersTab === "packing" &&
                        (packingData.length === 0 ? (
                            <div className="flex h-[265px] flex-col items-center justify-center rounded-lg border border-dashed text-center">
                                <Factory className="size-8 text-muted-foreground/60" />
                                <p className="mt-2 text-sm font-medium text-foreground">
                                    No active packing runs
                                </p>
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                    Start or schedule a packing order to track output progress here.
                                </p>
                            </div>
                        ) : (
                            <ChartContainer
                                config={packingChartConfig}
                                className="aspect-auto h-[265px] w-full"
                            >
                                <BarChart
                                    data={packingData}
                                    margin={{ top: 8, left: 0, right: 8, bottom: 16 }}
                                >
                                    <CartesianGrid vertical={false} />
                                    <XAxis
                                        dataKey="packingOrderNumber"
                                        tickLine={false}
                                        axisLine={false}
                                        tickMargin={8}
                                        interval={0}
                                        angle={-20}
                                        textAnchor="end"
                                        height={48}
                                        tick={{ fontSize: 10 }}
                                    />
                                    <YAxis
                                        allowDecimals={false}
                                        tickLine={false}
                                        axisLine={false}
                                        width={40}
                                        tick={{ fontSize: 11 }}
                                    />
                                    <ChartTooltip
                                        content={
                                            <ChartTooltipContent
                                                labelFormatter={(_label, payload) => {
                                                    const row = payload?.[0]?.payload as
                                                        | (typeof packingData)[number]
                                                        | undefined
                                                    return row
                                                        ? `${row.packingOrderNumber} · ${row.itemName}`
                                                        : String(_label ?? "")
                                                }}
                                            />
                                        }
                                    />
                                    <ChartLegend content={<ChartLegendContent />} />
                                    <Bar
                                        dataKey="actualQty"
                                        stackId="pack"
                                        fill="var(--color-actualQty)"
                                        radius={[0, 0, 4, 4]}
                                        maxBarSize={36}
                                    />
                                    <Bar
                                        dataKey="remainingQty"
                                        stackId="pack"
                                        fill="var(--color-remainingQty)"
                                        radius={[4, 4, 0, 0]}
                                        maxBarSize={36}
                                    />
                                </BarChart>
                            </ChartContainer>
                        ))}

                    {ordersTab === "activity" &&
                        (activityData.length === 0 ? (
                            <div className="flex h-[265px] flex-col items-center justify-center rounded-lg border border-dashed text-center">
                                <Activity className="size-8 text-muted-foreground/60" />
                                <p className="mt-2 text-sm font-medium text-foreground">
                                    No recent stock movements
                                </p>
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                    Transactions will appear here once stock movements are recorded.
                                </p>
                            </div>
                        ) : (
                            <ChartContainer
                                config={activityChartConfig}
                                className="aspect-auto h-[265px] w-full"
                            >
                                <BarChart
                                    data={activityData}
                                    margin={{ top: 8, left: 0, right: 8, bottom: 18 }}
                                >
                                    <CartesianGrid vertical={false} />
                                    <XAxis
                                        dataKey="transactionType"
                                        tickLine={false}
                                        axisLine={false}
                                        tickMargin={8}
                                        interval={0}
                                        angle={-22}
                                        textAnchor="end"
                                        height={52}
                                        tick={{ fontSize: 10 }}
                                    />
                                    <YAxis
                                        allowDecimals={false}
                                        tickLine={false}
                                        axisLine={false}
                                        width={32}
                                        tick={{ fontSize: 11 }}
                                    />
                                    <ChartTooltip content={<ChartTooltipContent />} />
                                    <Bar
                                        dataKey="count"
                                        fill="var(--color-count)"
                                        radius={[6, 6, 0, 0]}
                                        maxBarSize={34}
                                    />
                                </BarChart>
                            </ChartContainer>
                        ))}
                </CardContent>
            </Card>
        </div>
    )
}
