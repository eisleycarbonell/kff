import { memo } from "react"
import { MapPin, MapPinCheck, Warehouse } from "lucide-react"
import type { Location } from "@/components/modules/locations/location.schema"
import { Card, CardContent } from "@/components/ui/card"
export const LocationStatistics = memo(function LocationStatistics({ locations }: { locations: Location[] }) {
    const statistics = [
        {
            label: "Total locations",
            value: locations.length,
            description: "Configured inventory locations",
            icon: MapPin,
        },
        {
            label: "Active locations",
            value: locations.filter((row) => row.isActive).length,
            description: "Enabled for operations",
            icon: MapPinCheck,
        },
        {
            label: "Warehouses",
            value: locations.filter((row) => row.locationType === "Warehouse").length,
            description: "Warehouse locations",
            icon: Warehouse,
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
