import type { Metadata } from "next"
import { Truck } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { PagePlaceholder } from "@/components/shared/page-placeholder"

export const metadata: Metadata = {
    title: "Suppliers",
    description: "Manage supplier contacts and details.",
}

export default function SuppliersPage() {
    return (
        <>
            <PageHeader
                title="Suppliers"
                description="Manage supplier contacts and details."
            />
            <PagePlaceholder icon={Truck} />
        </>
    )
}