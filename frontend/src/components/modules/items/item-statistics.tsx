import { memo } from "react"
import { Boxes, PackageCheck, Package } from "lucide-react"
import type { Item } from "@/components/modules/items/item.schema"
import { Card, CardContent } from "@/components/ui/card"

export const ItemStatistics = memo(function ItemStatistics({ items }: { items: Item[] }) {
    const statistics = [
        {
            label: "Total items",
            value: items.length,
            description: "Items in your catalog",
            icon: Boxes,
        },
        {
            label: "Active items",
            value: items.filter((item) => item.isActive).length,
            description: "Available for operations",
            icon: PackageCheck,
        },
        {
            label: "Finished products",
            value: items.filter((item) => item.itemType === "Finished Good").length,
            description: "Packed product SKUs",
            icon: Package,
        },
    ]
    return (
        <div className="grid gap-3 @lg/main:grid-cols-2 @3xl/main:grid-cols-3">
            {statistics.map(({ label, value, description, icon: Icon }) => (
                <Card key={label} className="border py-3 ring-0">
                    <CardContent className="flex items-start gap-3 px-4">
                        <Icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                        <div className="min-w-0">
                            <p className="text-xs font-medium text-muted-foreground">{label}</p>
                            <p className="mt-1 text-xl font-semibold tracking-tight tabular-nums sm:text-2xl">
                                {value}
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    )
})
