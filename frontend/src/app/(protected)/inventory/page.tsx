import type { Metadata } from "next"
import { Warehouse } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { PagePlaceholder } from "@/components/shared/page-placeholder"

export const metadata: Metadata = {
    title: "Inventory Stock",
    description: "View on-hand quantities across items, locations, and lots.",
}

export default function InventoryPage() {
    return (
        <>
            <PageHeader
                title="Inventory Stock"
                description="View on-hand quantities across items, locations, and lots."
            />
            <PagePlaceholder icon={Warehouse} />
        </>
    )
}