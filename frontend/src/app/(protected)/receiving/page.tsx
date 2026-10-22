import type { Metadata } from "next"
import { PackageCheck } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { PagePlaceholder } from "@/components/shared/page-placeholder"

export const metadata: Metadata = {
    title: "Receiving & Lots",
    description: "Receive incoming stock and record lot / batch information.",
}

export default function ReceivingPage() {
    return (
        <>
            <PageHeader
                title="Receiving & Lots"
                description="Receive incoming stock and record lot / batch information."
            />
            <PagePlaceholder icon={PackageCheck} />
        </>
    )
}