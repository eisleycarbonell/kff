import type { Metadata } from "next"
import { Users } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { PagePlaceholder } from "@/components/shared/page-placeholder"

export const metadata: Metadata = {
    title: "Customers",
    description: "Manage customer accounts and contacts.",
}

export default function CustomersPage() {
    return (
        <>
            <PageHeader
                title="Customers"
                description="Manage customer accounts and contacts."
            />
            <PagePlaceholder icon={Users} />
        </>
    )
}