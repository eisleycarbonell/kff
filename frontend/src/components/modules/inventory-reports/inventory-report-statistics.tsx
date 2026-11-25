import { memo } from "react"
import type { InventoryReport } from "./inventory-report.schema"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
export const InventoryReportStatistics = memo(function InventoryReportStatistics({ report }: { report: InventoryReport }) {
    const movement = report.report === "movement"
    return (
        <div className="space-y-3">
            <div className="grid gap-3 @lg/main:grid-cols-2 @5xl/main:grid-cols-4">
                {[
                    ["Matching rows", report.summary.rowCount],
                    ["Items", report.summary.itemCount],
                    ["Lots", report.summary.lotCount],
                    ["Locations", report.summary.locationCount],
                ].map(([label, value]) => (
                    <Card key={label} className="min-w-0 py-3">
                        <CardHeader className="px-4">
                            <CardTitle className="text-xs text-muted-foreground">{label}</CardTitle>
                        </CardHeader>
                        <CardContent className="px-4 text-xl font-semibold text-primary sm:text-2xl">
                            {value}
                        </CardContent>
                    </Card>
                ))}
            </div>
            {report.totals.length > 0 && (
                <div className="grid gap-4 @3xl/main:grid-cols-2">
                    {report.totals.map((total) => (
                        <Card key={total.primaryUomId} className="min-w-0">
                            <CardHeader>
                                <CardTitle>Quantities in {total.primaryUomName}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <dl className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-3">
                                    {(movement
                                        ? [
                                              ["In", total.qtyIn],
                                              ["Out", total.qtyOut],
                                              ["Net change", total.netChange],
                                          ]
                                        : [
                                              ["On hand", total.qtyOnHand],
                                              ["Reserved", total.qtyReserved],
                                              ["Available", total.qtyAvailable],
                                          ]
                                    ).map(([label, value]) => (
                                        <div key={label} className="min-w-0">
                                            <dt className="text-sm text-muted-foreground">
                                                {label}
                                            </dt>
                                            <dd className="mt-1 break-all font-semibold tabular-nums">
                                                {value}
                                            </dd>
                                        </div>
                                    ))}
                                </dl>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    )
})
