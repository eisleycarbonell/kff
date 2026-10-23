import type { Metadata } from "next"
import { ChartNoAxesCombined } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { PagePlaceholder } from "@/components/shared/page-placeholder"

export const metadata: Metadata = {
    title: "Inventory Report",
    description: "Stock valuation, movement, and aging analytics.",
}

export default function InventoryReportPage() {
    return (
        <>
            <PageHeader
                title="Inventory Report"
                description="Stock valuation, movement, and aging analytics."
            />
            <PagePlaceholder icon={ChartNoAxesCombined} />
        </>
    )
}