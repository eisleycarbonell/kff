import { Boxes, LockKeyhole, PackageCheck } from "lucide-react"
import {
    stockTotalsByUom,
    formatStockQuantity,
    type Stock,
} from "@/components/modules/inventory-stocks/inventory-stock.schema"
import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardAction,
    CardContent,
    CardFooter,
} from "@/components/ui/card"
const metrics = [
    {
        key: "qtyOnHand",
        label: "Total on hand",
        description: "Stock across every lot and location",
        icon: Boxes,
    },
    {
        key: "qtyReserved",
        label: "Reserved",
        description: "Outstanding active reservations",
        icon: LockKeyhole,
    },
    {
        key: "qtyAvailable",
        label: "Available",
        description: "On hand minus reserved; QC still applies",
        icon: PackageCheck,
    },
] as const
export function StockStatistics({ stocks }: { stocks: Stock[] }) {
    const totals = stockTotalsByUom(stocks)
    return (
        <div className="grid gap-4 sm:grid-cols-3">
            {metrics.map(({ key, label, description, icon: Icon }) => (
                <Card key={key} className="border ring-0">
                    <CardHeader>
                        <CardTitle>{label}</CardTitle>
                        <CardDescription>{description}</CardDescription>
                        <CardAction>
                            <Icon className="size-6 text-primary" aria-hidden="true" />
                        </CardAction>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-2">
                        {totals.length ? (
                            totals.map((total) => (
                                <p
                                    key={total.uomId}
                                    className="text-2xl font-semibold tracking-tight tabular-nums"
                                >
                                    {formatStockQuantity(total[key])}{" "}
                                    <span className="text-sm font-normal text-muted-foreground">
                                        {total.uomName}
                                    </span>
                                </p>
                            ))
                        ) : (
                            <p className="text-3xl font-semibold tabular-nums">0</p>
                        )}
                    </CardContent>
                    <CardFooter>
                        <p className="text-sm text-muted-foreground">
                            {stocks.length} stock balances / quantities grouped by unit
                        </p>
                    </CardFooter>
                </Card>
            ))}
        </div>
    )
}
