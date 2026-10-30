"use client"

import Link from "next/link"
import {
    Activity,
    ArrowDownLeft,
    ArrowLeftRight,
    ArrowUpRight,
    Clock,
    PackageCheck,
    Sliders,
    Trash2,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    formatDate,
    formatQuantity,
    type DashboardRecentActivity,
} from "@/components/modules/dashboard/dashboard.schema"

export function DashboardRecentActivityCard({ activity }: { activity: DashboardRecentActivity[] }) {
    function getTxnMeta(type: string) {
        switch (type) {
            case "Receive":
                return {
                    icon: ArrowDownLeft,
                    color: "text-emerald-600 dark:text-emerald-400",
                    bg: "bg-emerald-500/10",
                    badgeVariant: "default" as const,
                }
            case "Produce":
                return {
                    icon: PackageCheck,
                    color: "text-blue-600 dark:text-blue-400",
                    bg: "bg-blue-500/10",
                    badgeVariant: "secondary" as const,
                }
            case "Consume":
                return {
                    icon: ArrowUpRight,
                    color: "text-amber-600 dark:text-amber-400",
                    bg: "bg-amber-500/10",
                    badgeVariant: "outline" as const,
                }
            case "Transfer":
                return {
                    icon: ArrowLeftRight,
                    color: "text-teal-600 dark:text-teal-400",
                    bg: "bg-teal-500/10",
                    badgeVariant: "secondary" as const,
                }
            case "Adjust":
                return {
                    icon: Sliders,
                    color: "text-purple-600 dark:text-purple-400",
                    bg: "bg-purple-500/10",
                    badgeVariant: "outline" as const,
                }
            case "Scrap":
                return {
                    icon: Trash2,
                    color: "text-destructive",
                    bg: "bg-destructive/10",
                    badgeVariant: "destructive" as const,
                }
            default:
                return {
                    icon: Activity,
                    color: "text-muted-foreground",
                    bg: "bg-muted",
                    badgeVariant: "outline" as const,
                }
        }
    }

    return (
        <Card className="border shadow-xs">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                        <Activity className="size-4 text-primary" />
                        <CardTitle className="text-base font-semibold">Recent Ledger Activity</CardTitle>
                    </div>
                    <CardDescription className="text-xs">
                        Authoritative append-only transactions committed to the inventory ledger
                    </CardDescription>
                </div>
                <Badge variant="outline" className="text-xs font-mono">
                    Append-Only Ledger
                </Badge>
            </CardHeader>

            <CardContent>
                {activity.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-8 text-center">
                        <Activity className="size-8 text-muted-foreground/60" />
                        <p className="mt-2 text-sm font-medium text-foreground">No recent ledger movements</p>
                        <p className="text-xs text-muted-foreground">Transactions will appear as operations take place.</p>
                    </div>
                ) : (
                    <div className="space-y-2.5">
                        {activity.map((entry) => {
                            const meta = getTxnMeta(entry.transactionType)
                            const Icon = meta.icon
                            const qtyNum = parseFloat(entry.qtyChange) || 0
                            const isPositive = qtyNum > 0

                            return (
                                <div
                                    key={entry.transactionId}
                                    className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card p-3 transition-colors hover:bg-muted/20"
                                >
                                    <div className="flex items-start gap-3">
                                        <div className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg ${meta.bg}`}>
                                            <Icon className={`size-4 ${meta.color}`} />
                                        </div>

                                        <div className="space-y-0.5">
                                            <div className="flex items-center gap-2">
                                                <Badge variant={meta.badgeVariant} className="text-[10px]">
                                                    {entry.transactionType}
                                                </Badge>
                                                <span className="font-semibold text-xs text-foreground">
                                                    {entry.itemName}
                                                </span>
                                                <span className="font-mono text-[10px] text-muted-foreground">
                                                    ({entry.itemSku})
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                                <span>Lot: <span className="font-mono text-foreground">{entry.lotNumber}</span></span>
                                                <span>•</span>
                                                <span>{entry.locationName}</span>
                                                {entry.referenceId && (
                                                    <>
                                                        <span>•</span>
                                                        <span className="font-mono text-[10px]">Ref: {entry.referenceId}</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="text-right shrink-0">
                                        <p
                                            className={`text-xs font-bold tabular-nums ${
                                                isPositive
                                                    ? "text-emerald-600 dark:text-emerald-400"
                                                    : "text-amber-600 dark:text-amber-400"
                                            }`}
                                        >
                                            {isPositive ? "+" : ""}
                                            {formatQuantity(entry.qtyChange)} {entry.primaryUomName}
                                        </p>
                                        <div className="flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
                                            <Clock className="size-2.5" />
                                            <span>{formatDate(entry.createdAt)}</span>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}

                        <div className="flex justify-end pt-1">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground"
                                render={<Link href="/inventory" />}
                                nativeButton={false}
                            >
                                View Complete Ledger
                                <ArrowUpRight className="size-3.5" />
                            </Button>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
