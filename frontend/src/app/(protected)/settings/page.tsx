import type { Metadata } from "next"
import { Settings } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { PagePlaceholder } from "@/components/shared/page-placeholder"

export const metadata: Metadata = {
    title: "Settings",
    description: "Application and organization preferences.",
}

export default function SettingsPage() {
    return (
        <>
            <PageHeader
                title="Settings"
                description="Application and organization preferences."
            />
            <PagePlaceholder icon={Settings} />
        </>
    )
}