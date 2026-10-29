import { MapPin, MapPinCheck, Warehouse } from "lucide-react"
import type { Location } from "@/components/modules/locations/location.schema"
import { Card, CardContent } from "@/components/ui/card"
export function LocationStatistics({ locations }: { locations: Location[] }) {
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
