import type { Metadata } from "next"
import { ShieldCheck } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { PagePlaceholder } from "@/components/shared/page-placeholder"

export const metadata: Metadata = {
    title: "Roles & Permissions",
    description: "Define roles and what each role can do.",
}

export default function RolesPage() {
    return (
        <>
            <PageHeader
                title="Roles & Permissions"
                description="Define roles and what each role can do."
            />
            <PagePlaceholder icon={ShieldCheck} />
        </>
    )
}