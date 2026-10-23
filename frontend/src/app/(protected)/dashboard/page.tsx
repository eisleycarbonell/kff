import type { Metadata } from "next"
import { LayoutDashboard } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { PagePlaceholder } from "@/components/shared/page-placeholder"

export const metadata: Metadata = {
    title: "Dashboard",
    description: "Overview of stock levels, open orders, and recent activity.",
}

export default function DashboardPage() {
    return (
        <>
            <PageHeader
                title="Dashboard"
                description="Overview of stock levels, open orders, and recent activity."
            />
            <PagePlaceholder icon={LayoutDashboard} />
        </>
    )
}