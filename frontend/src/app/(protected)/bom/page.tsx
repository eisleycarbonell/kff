import type { Metadata } from "next"
import { FlaskConical } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { PagePlaceholder } from "@/components/shared/page-placeholder"

export const metadata: Metadata = {
    title: "Packing Formulas",
    description: "Bills of materials that define how products are packed.",
}

export default function PackingFormulasPage() {
    return (
        <>
            <PageHeader
                title="Packing Formulas"
                description="Bills of materials that define how products are packed."
            />
            <PagePlaceholder icon={FlaskConical} />
        </>
    )
}