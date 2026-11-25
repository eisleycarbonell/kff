"use client"

import Link from "next/link"
import { ArrowLeftRight, ArrowRight, ArrowUpRight, Truck } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    formatDate,
    type DashboardActiveTransfer,
} from "@/components/modules/dashboard/dashboard.schema"

export function DashboardTransfersCard({ transfers }: { transfers: DashboardActiveTransfer[] }) {
    return (
        <Card className="@container/card flex flex-col border shadow-xs">
            <CardHeader className="flex flex-col gap-2 pb-3 @lg/card:flex-row @lg/card:items-center @lg/card:justify-between">
                <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center gap-2">
                        <Truck className="size-4 shrink-0 text-teal-600 dark:text-teal-400" />
                        <CardTitle className="text-base font-semibold">Active Transfers</CardTitle>
                    </div>
                    <CardDescription className="text-xs">
                        Finished goods and stock movements in transit to branches and stores
                    </CardDescription>
                </div>
                <Badge
                    variant={transfers.length > 0 ? "default" : "outline"}
                    className="shrink-0 self-start text-xs @lg/card:self-auto"
                >
                    {transfers.length} Active
                </Badge>
            </CardHeader>

            <CardContent className="flex min-w-0 flex-1 flex-col">
                {transfers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-8 text-center">
                        <ArrowLeftRight className="size-8 text-muted-foreground/60" />
                        <p className="mt-2 text-sm font-medium text-foreground">No active transfers</p>
                        <p className="text-xs text-muted-foreground">
                            All dispatched stock transfers have been received at destination branches.
                        </p>
                        <Button
                            size="sm"
                            variant="outline"
                            className="mt-3 h-8 text-xs"
                            render={<Link href="/transfers" />}
                            nativeButton={false}
                        >
                            Start New Transfer
                        </Button>
                    </div>
                ) : (
                    <>
                        <div className="space-y-2.5">
                            {transfers.map((transfer) => (
                                <div
                                    key={transfer.transferId}
                                    className="flex flex-col gap-2 rounded-xl border border-border/60 bg-card p-3 transition-colors hover:bg-muted/20 @md/card:flex-row @md/card:items-center @md/card:justify-between"
                                >
                                    <div className="min-w-0 flex-1 space-y-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="font-mono text-xs font-semibold text-primary">
                                                {transfer.transferNumber}
                                            </span>
                                            <Badge
                                                variant={transfer.status === "In Transit" ? "default" : "secondary"}
                                                className="text-[10px]"
                                            >
                                                {transfer.status}
                                            </Badge>
                                            <span className="text-[11px] text-muted-foreground">
                                                {transfer.lineCount} item line{transfer.lineCount !== 1 ? "s" : ""}
                                            </span>
                                        </div>

                                        {/* Route visualizer */}
                                        <div className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-foreground">
                                            <span>{transfer.sourceLocationName}</span>
                                            <ArrowRight className="size-3 shrink-0 text-muted-foreground" />
                                            <span>{transfer.destinationLocationName}</span>
                                        </div>

                                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                                            <span>Requested: {formatDate(transfer.requestedAt)}</span>
                                            {transfer.dispatchedAt && (
                                                <span>Dispatched: {formatDate(transfer.dispatchedAt)}</span>
                                            )}
                                        </div>
                                    </div>

                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-7.5 shrink-0 gap-1 self-start text-xs @md/card:self-center"
                                        render={<Link href="/transfers" />}
                                        nativeButton={false}
                                    >
                                        Receive / Track
                                        <ArrowUpRight className="size-3" />
                                    </Button>
                                </div>
                            ))}
                        </div>

                        <div className="mt-auto flex justify-end pt-3">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground"
                                render={<Link href="/transfers" />}
                                nativeButton={false}
                            >
                                View Transfer Ledger
                                <ArrowUpRight className="size-3.5" />
                            </Button>
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    )
}
