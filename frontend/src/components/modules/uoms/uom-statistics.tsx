import { memo } from "react"
import { Ruler, Layers, Scale } from "lucide-react"
import type { Uom, UomClass } from "@/components/modules/uoms/uom.schema"
import { Card, CardContent } from "@/components/ui/card"
export const UomStatistics = memo(function UomStatistics({ units, classes }: { units: Uom[]; classes: UomClass[] }) {
    const statistics = [
        {
            label: "Total units",
            value: units.length,
            description: "Configured units of measure",
            icon: Ruler,
        },
        {
            label: "Unit classes",
            value: classes.length,
            description: "Groups of compatible units",
            icon: Layers,
        },
        {
            label: "Base units",
            value: units.filter((row) => row.isBase).length,
            description: "Conversion anchors for each class",
            icon: Scale,
        },
    ]
    return (
        <div className="grid gap-3 sm:grid-cols-3">
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
