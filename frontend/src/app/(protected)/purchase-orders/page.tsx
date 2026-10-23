import type { Metadata } from "next"
import { ShoppingCart } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { PagePlaceholder } from "@/components/shared/page-placeholder"

export const metadata: Metadata = {
    title: "Purchase Orders",
    description: "Create and track orders placed with suppliers.",
}

export default function PurchaseOrdersPage() {
    return (
        <>
            <PageHeader
                title="Purchase Orders"
                description="Create and track orders placed with suppliers."
            />
            <PagePlaceholder icon={ShoppingCart} />
        </>
    )
}