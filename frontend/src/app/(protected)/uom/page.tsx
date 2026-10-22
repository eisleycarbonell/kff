import type { Metadata } from "next"
import { Ruler } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { PagePlaceholder } from "@/components/shared/page-placeholder"

export const metadata: Metadata = {
    title: "Units of Measure",
    description: "Define units and conversions used across items.",
}

export default function UnitsOfMeasurePage() {
    return (
        <>
            <PageHeader
                title="Units of Measure"
                description="Define units and conversions used across items."
            />
            <PagePlaceholder icon={Ruler} />
        </>
    )
}