import type { Metadata } from "next"
import { Package } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { PagePlaceholder } from "@/components/shared/page-placeholder"

export const metadata: Metadata = {
    title: "Items / Products",
    description: "Manage the product catalog, SKUs, and item details.",
}

export default function ItemsPage() {
    return (
        <>
            <PageHeader
                title="Items / Products"
                description="Manage the product catalog, SKUs, and item details."
            />
            <PagePlaceholder icon={Package} />
        </>
    )
}