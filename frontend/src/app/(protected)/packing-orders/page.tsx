import type { Metadata } from "next"
import { PackageOpen } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { PagePlaceholder } from "@/components/shared/page-placeholder"

export const metadata: Metadata = {
    title: "Packing Orders",
    description: "Plan and track packing runs based on packing formulas.",
}

export default function PackingOrdersPage() {
    return (
        <>
            <PageHeader
                title="Packing Orders"
                description="Plan and track packing runs based on packing formulas."
            />
            <PagePlaceholder icon={PackageOpen} />
        </>
    )
}