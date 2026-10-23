import type { Metadata } from "next"
import { Receipt } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { PagePlaceholder } from "@/components/shared/page-placeholder"

export const metadata: Metadata = {
    title: "Sales Orders",
    description: "Manage customer orders and fulfillment.",
}

export default function SalesOrdersPage() {
    return (
        <>
            <PageHeader
                title="Sales Orders"
                description="Manage customer orders and fulfillment."
            />
            <PagePlaceholder icon={Receipt} />
        </>
    )
}