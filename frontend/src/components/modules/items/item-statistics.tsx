import { Boxes, PackageCheck, Package } from "lucide-react"
import type { Item } from "@/components/modules/items/item.schema"
import { Card, CardContent } from "@/components/ui/card"

export function ItemStatistics({ items }: { items: Item[] }) {
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
}
