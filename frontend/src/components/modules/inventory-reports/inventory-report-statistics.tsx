import { memo } from "react"
import type { InventoryReport } from "./inventory-report.schema"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
export const InventoryReportStatistics = memo(function InventoryReportStatistics({ report }: { report: InventoryReport }) {
    const movement = report.report === "movement"
    return (
        <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {[
                    ["Matching rows", report.summary.rowCount],
                    ["Items", report.summary.itemCount],
                    ["Lots", report.summary.lotCount],
                    ["Locations", report.summary.locationCount],
                ].map(([label, value]) => (
                    <Card key={label}>
                        <CardHeader>
                            <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
                        </CardHeader>
                        <CardContent className="text-3xl font-semibold text-primary">
                            {value}
                        </CardContent>
                    </Card>
                ))}
            </div>
            {report.totals.length > 0 && (
                <div className="grid gap-4 lg:grid-cols-2">
                    {report.totals.map((total) => (
                        <Card key={total.primaryUomId}>
                            <CardHeader>
                                <CardTitle>Quantities in {total.primaryUomName}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <dl className="grid grid-cols-3 gap-3">
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
                                        <div key={label}>
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
