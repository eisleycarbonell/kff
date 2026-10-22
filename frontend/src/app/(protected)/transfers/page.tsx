import type { Metadata } from "next"
import { ArrowLeftRight } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { PagePlaceholder } from "@/components/shared/page-placeholder"

export const metadata: Metadata = {
    title: "Stock Transfers",
    description: "Move stock between locations and track in-transit transfers.",
}

export default function TransfersPage() {
    return (
        <>
            <PageHeader
                title="Stock Transfers"
                description="Move stock between locations and track in-transit transfers."
            />
            <PagePlaceholder icon={ArrowLeftRight} />
        </>
    )
}