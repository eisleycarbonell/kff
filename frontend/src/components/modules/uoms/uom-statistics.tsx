import { Ruler, Layers, Scale } from "lucide-react"
import type { Uom, UomClass } from "@/components/modules/uoms/uom.schema"
import { Card, CardContent } from "@/components/ui/card"
export function UomStatistics({ units, classes }: { units: Uom[]; classes: UomClass[] }) {
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
