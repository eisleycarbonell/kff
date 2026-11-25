import { memo, useMemo } from "react"
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
export const StockStatistics = memo(function StockStatistics({ stocks }: { stocks: Stock[] }) {
    const totals = useMemo(() => stockTotalsByUom(stocks), [stocks])
    return (
        <div className="grid gap-3 @xl/main:grid-cols-2 @4xl/main:grid-cols-3">
            {metrics.map(({ key, label, description, icon: Icon }) => (
                <Card key={key} className="border py-3 ring-0">
                    <CardHeader className="px-4">
                        <CardTitle className="text-sm">{label}</CardTitle>
                        <CardDescription className="text-xs">{description}</CardDescription>
                        <CardAction>
                            <Icon
                                className="size-5 text-primary"
                                aria-hidden="true"
                            />
                        </CardAction>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-1 px-4">
                        {totals.length ? (
                            totals.map((total) => (
                                <p
                                    key={total.uomId}
                                    className="text-lg font-semibold tracking-tight tabular-nums sm:text-xl"
                                >
                                    {formatStockQuantity(total[key])}{" "}
                                    <span className="text-xs font-normal text-muted-foreground">
                                        {total.uomName}
                                    </span>
                                </p>
                            ))
                        ) : (
                            <p className="text-xl font-semibold tabular-nums sm:text-2xl">
                                0
                            </p>
                        )}
                    </CardContent>
                    <CardFooter className="px-4 py-2">
                        <p className="text-xs text-muted-foreground">
                            {stocks.length} stock balances / quantities grouped
                            by unit
                        </p>
                    </CardFooter>
                </Card>
            ))}
        </div>
    )
})
