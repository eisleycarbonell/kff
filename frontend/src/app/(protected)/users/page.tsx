import type { Metadata } from "next"
import { UserCog } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { PagePlaceholder } from "@/components/shared/page-placeholder"

export const metadata: Metadata = {
    title: "Users",
    description: "Manage user accounts and access.",
}

export default function UsersPage() {
    return (
        <>
            <PageHeader
                title="Users"
                description="Manage user accounts and access."
            />
            <PagePlaceholder icon={UserCog} />
        </>
    )
}