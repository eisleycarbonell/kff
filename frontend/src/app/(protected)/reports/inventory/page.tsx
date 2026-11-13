"use client"
import Link from "next/link"
import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import {
    REPORT_TYPES,
    REPORT_LABELS,
} from "@/components/modules/inventory-reports/inventory-report.schema"
import { InventoryReportFilters } from "@/components/modules/inventory-reports/inventory-report-filters"
import { InventoryReportStatistics } from "@/components/modules/inventory-reports/inventory-report-statistics"
import { InventoryReportTable } from "@/components/modules/inventory-reports/inventory-report-table"
import { useInventoryReports } from "@/hooks/modules/inventory-reports/use-inventory-reports"
export default function InventoryReportsPage() {
    const feature = useInventoryReports()
    const filters = (
        <InventoryReportFilters
            key={feature.filters.report}
            filters={feature.filters}
            options={feature.options}
            optionsError={feature.optionsError?.message}
            retryOptions={feature.retryOptions}
            busy={feature.isFetching}
            onApply={feature.setFilters}
        />
    )
    return (
        <>
            <title>Inventory Reports</title>
            <meta
                name="description"
                content="Current stock, shortage, expiry and ledger movement reports."
            />
            <PageHeader
                title="Inventory Reports"
                description="Review stock, reservations, expiry and traceable inventory movements."
                actions={
                    <Button
                        className="h-10"
                        variant="outline"
                        onClick={feature.refresh}
                        disabled={feature.isFetching}
                    >
                        Refresh report
                    </Button>
                }
            />
            <div className="min-w-0 border-b">
                <div
                    role="tablist"
                    aria-label="Inventory report types"
                    className="flex gap-1 overflow-x-auto"
                >
                    {REPORT_TYPES.map((report, index) => (
                        <button
                            key={report}
                            type="button"
                            role="tab"
                            id={"report-tab-" + report}
                            aria-selected={feature.filters.report === report}
                            aria-controls="inventory-report-panel"
                            tabIndex={feature.filters.report === report ? 0 : -1}
                            onClick={() => feature.switchReport(report)}
                            onKeyDown={(event) => {
                                const offset =
                                    event.key === "ArrowRight"
                                        ? 1
                                        : event.key === "ArrowLeft"
                                          ? -1
                                          : 0
                                const next =
                                    event.key === "Home"
                                        ? 0
                                        : event.key === "End"
                                          ? REPORT_TYPES.length - 1
                                          : (index + offset + REPORT_TYPES.length) %
                                            REPORT_TYPES.length
                                if (offset || event.key === "Home" || event.key === "End") {
                                    event.preventDefault()
                                    feature.switchReport(REPORT_TYPES[next])
                                    event.currentTarget.parentElement
                                        ?.querySelectorAll<HTMLButtonElement>("[role=tab]")
                                        [next]?.focus()
                                }
                            }}
                            className="shrink-0 border-b-2 border-transparent px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground aria-selected:border-primary aria-selected:text-primary"
                        >
                            {REPORT_LABELS[report]}
                        </button>
                    ))}
                </div>
            </div>
            {feature.loadStatus === "signed-out" ? (
                <Alert>
                    <AlertTitle>Sign in to view inventory reports</AlertTitle>
                    <AlertDescription>
                        <Button className="mt-2" render={<Link href="/" />} nativeButton={false}>
                            Sign in
                        </Button>
                    </AlertDescription>
                </Alert>
            ) : (
                <div
                    id="inventory-report-panel"
                    role="tabpanel"
                    aria-labelledby={"report-tab-" + feature.filters.report}
                    className="space-y-5"
                >
                    {feature.filters.report === "low-stock" && (
                        <p className="text-sm text-muted-foreground">
                            Low stock includes active unstocked items. It uses saved reorder levels
                            or the company default, unless you enter a threshold override. Available
                            supply excludes held, In Transit, unapproved and expired lots. With a
                            location filter, quantities cover only that location.
                        </p>
                    )}
                    {feature.filters.report !== "movement" && (
                        <p className="text-sm text-muted-foreground">
                            Balances include In Transit and held stock unless filtered. Availability
                            alone does not mean a lot is approved or unexpired.
                        </p>
                    )}
                    {feature.error && (
                        <Alert variant="destructive">
                            <AlertTitle>Unable to load inventory report</AlertTitle>
                            <AlertDescription>
                                {feature.error.message}
                                <Button
                                    className="ml-3"
                                    variant="outline"
                                    onClick={feature.refresh}
                                    disabled={feature.isFetching}
                                >
                                    Retry
                                </Button>
                            </AlertDescription>
                        </Alert>
                    )}
                    {feature.report && (
                        <>
                            <p className="text-xs text-muted-foreground">
                                Generated{" "}
                                {feature.report.generatedAt.replace("T", " ").replace("Z", " UTC")}
                                {feature.isFetching ? " / Refreshing..." : ""}
                            </p>
                            <InventoryReportStatistics report={feature.report} />
                        </>
                    )}
                    <div className="min-w-0 overflow-hidden rounded-xl border bg-card shadow-xs">
                        {filters}
                        {feature.loadStatus === "loading" && (
                            <Skeleton className="h-96" aria-label="Loading inventory report" />
                        )}
                        {feature.report && (
                            <InventoryReportTable
                                key={JSON.stringify(feature.filters)}
                                report={feature.report}
                            />
                        )}
                    </div>
                </div>
            )}
        </>
    )
}
