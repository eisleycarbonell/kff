import type { Metadata } from "next"
import { MapPin } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { PagePlaceholder } from "@/components/shared/page-placeholder"

export const metadata: Metadata = {
    title: "Locations",
    description: "Warehouses, storage areas, and bins.",
}

export default function LocationsPage() {
    return (
        <>
            <PageHeader
                title="Locations"
                description="Warehouses, storage areas, and bins."
            />
            <PagePlaceholder icon={MapPin} />
        </>
    )
}