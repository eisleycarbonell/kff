import { memo } from "react"
import { BadgeCheck, Tag, Tags } from "lucide-react"

import type { Brand } from "@/components/modules/brands/brand.schema"
import { Card, CardContent } from "@/components/ui/card"

export const BrandStatistics = memo(function BrandStatistics({ brands }: { brands: Brand[] }) {
    const activeCount = brands.filter((brand) => brand.isActive).length
    const statistics = [
        {
            label: "Total brands",
            value: brands.length,
            description: "Product brands in your catalog",
            icon: Tags,
        },
        {
            label: "Active brands",
            value: activeCount,
            description: "Available for new item assignments",
            icon: BadgeCheck,
        },
        {
            label: "Inactive brands",
            value: brands.length - activeCount,
            description: "Retained for reference",
            icon: Tag,
        },
    ]

    return (
        <div className="grid gap-4 sm:grid-cols-3">
            {statistics.map(({ label, value, description, icon: Icon }) => (
                <Card key={label} className="border py-5 ring-0 sm:py-6">
                    <CardContent className="flex items-start gap-4 px-5 sm:px-6">
                        <Icon className="mt-0.5 size-6 shrink-0 text-primary" aria-hidden="true" />
                        <div className="min-w-0">
                            <p className="text-sm font-medium text-muted-foreground">{label}</p>
                            <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">
                                {value}
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    )
})
