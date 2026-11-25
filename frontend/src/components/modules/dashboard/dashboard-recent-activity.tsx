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
            case "Adjustment":
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
        <Card className="@container/card flex flex-col border shadow-xs">
            <CardHeader className="flex flex-col gap-2 pb-3 @lg/card:flex-row @lg/card:items-center @lg/card:justify-between">
                <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center gap-2">
                        <Activity className="size-4 shrink-0 text-primary" />
                        <CardTitle className="text-base font-semibold">Recent Ledger Activity</CardTitle>
                    </div>
                    <CardDescription className="text-xs">
                        Authoritative append-only transactions committed to the inventory ledger
                    </CardDescription>
                </div>
                <Badge variant="outline" className="shrink-0 self-start font-mono text-xs @lg/card:self-auto">
                    Append-Only Ledger
                </Badge>
            </CardHeader>

            <CardContent className="flex min-w-0 flex-1 flex-col">
                {activity.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-8 text-center">
                        <Activity className="size-8 text-muted-foreground/60" />
                        <p className="mt-2 text-sm font-medium text-foreground">No recent ledger movements</p>
                        <p className="text-xs text-muted-foreground">Transactions will appear as operations take place.</p>
                    </div>
                ) : (
                    <>
                        <div className="space-y-2.5">
                            {activity.map((entry) => {
                                const meta = getTxnMeta(entry.transactionType)
                                const Icon = meta.icon
                                const qtyNum = parseFloat(entry.qtyChange) || 0
                                const isPositive = qtyNum > 0

                                return (
                                    <div
                                        key={entry.transactionId}
                                        className="flex flex-col gap-2.5 rounded-xl border border-border/60 bg-card p-3 transition-colors hover:bg-muted/20 @md/card:flex-row @md/card:items-center @md/card:justify-between"
                                    >
                                        <div className="flex min-w-0 flex-1 items-start gap-3">
                                            <div className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg ${meta.bg}`}>
                                                <Icon className={`size-4 ${meta.color}`} />
                                            </div>

                                            <div className="min-w-0 flex-1 space-y-0.5">
                                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                                    <Badge variant={meta.badgeVariant} className="text-[10px]">
                                                        {entry.transactionType}
                                                    </Badge>
                                                    <span className="break-words text-xs font-semibold text-foreground">
                                                        {entry.itemName}
                                                    </span>
                                                    <span className="font-mono text-[10px] text-muted-foreground">
                                                        ({entry.itemSku})
                                                    </span>
                                                </div>

                                                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                                                    <span className="break-words">
                                                        Lot: <span className="font-mono text-foreground">{entry.lotNumber}</span>
                                                    </span>
                                                    <span className="break-words">{entry.locationName}</span>
                                                    {entry.referenceId && (
                                                        <span className="break-all font-mono text-[10px]">
                                                            Ref: {entry.referenceId}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between gap-2 pl-11 @md/card:block @md/card:shrink-0 @md/card:pl-0 @md/card:text-right">
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
                        </div>

                        <div className="mt-auto flex justify-end pt-3">
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
                    </>
                )}
            </CardContent>
        </Card>
    )
}
