"use client"

import { useState } from "react"
import { ChartNoAxesCombined } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { PagePlaceholder } from "@/components/shared/page-placeholder"

const reportTypes = [
    "Stock by Location",
    "Stock by Lot",
    "Low Stock",
    "Near Expiry",
    "Inventory Movement",
] as const

export default function InventoryReportsPage() {
    const [activeReport, setActiveReport] = useState<(typeof reportTypes)[number]>(reportTypes[0])

    return (
        <>
            <title>Inventory Reports</title>
            <meta name="description" content="Inventory stock, lot, and movement reports." />
            <PageHeader
                title="Inventory Reports"
                description="Review stock, expiry, and movement reports."
            />
            <div className="min-w-0 border-b">
                <div role="tablist" aria-label="Inventory report types" className="flex gap-1 overflow-x-auto">
                    {reportTypes.map((reportType) => (
                        <button
                            key={reportType}
                            type="button"
                            role="tab"
                            id={`report-tab-${reportType.replaceAll(" ", "-").toLowerCase()}`}
                            aria-selected={activeReport === reportType}
                            aria-controls="inventory-report-panel"
                            onClick={() => setActiveReport(reportType)}
                            className="shrink-0 border-b-2 border-transparent px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground aria-selected:border-primary aria-selected:text-primary"
                        >
                            {reportType}
                        </button>
                    ))}
                </div>
            </div>
            <div
                id="inventory-report-panel"
                role="tabpanel"
                aria-labelledby={`report-tab-${activeReport.replaceAll(" ", "-").toLowerCase()}`}
            >
                <PagePlaceholder
                    icon={ChartNoAxesCombined}
                    title={`${activeReport} report is planned`}
                    description="This report will use operational inventory records once its API is available."
                />
            </div>
        </>
    )
}
