import { memo } from "react"
import { FlaskConical, PackageCheck, Boxes } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import type { PackingFormula } from "@/components/modules/packing-formulas/packing-formula.schema"
export const PackingFormulaStatistics = memo(function PackingFormulaStatistics({ formulas }: { formulas: PackingFormula[] }) {
    const cards = [
        { label: "Packing formulas", value: formulas.length, icon: FlaskConical },
        {
            label: "Active finished products",
            value: formulas.filter((row) => row.isActive).length,
            icon: PackageCheck,
        },
        {
            label: "Distinct materials",
            value: new Set(
                formulas.flatMap((row) =>
                    row.components.map((component) => component.componentItemId),
                ),
            ).size,
            icon: Boxes,
        },
    ]
    return (
        <div className="grid gap-4 sm:grid-cols-3">
            {cards.map(({ label, value, icon: Icon }) => (
                <Card key={label} className="border py-5 ring-0">
                    <CardContent className="flex items-start gap-4 px-5">
                        <Icon className="mt-0.5 size-6 text-primary" aria-hidden="true" />
                        <div>
                            <p className="text-sm text-muted-foreground">{label}</p>
                            <p className="mt-2 text-3xl font-semibold tabular-nums">{value}</p>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    )
})
