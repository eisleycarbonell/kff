import type { Metadata } from "next"
import { BookmarkCheck } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { PagePlaceholder } from "@/components/shared/page-placeholder"

export const metadata: Metadata = {
    title: "Inventory Reservations",
    description: "Stock reserved against packing orders.",
}

export default function InventoryReservationsPage() {
    return (
        <>
            <PageHeader
                title="Inventory Reservations"
                description="Stock reserved against packing orders."
            />
            <PagePlaceholder icon={BookmarkCheck} />
        </>
    )
}