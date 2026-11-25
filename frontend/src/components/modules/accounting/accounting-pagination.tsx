"use client"

import { ChevronLeft, ChevronRight, type LucideIcon } from "lucide-react"
import { ComboboxSelect } from "@/components/shared/combobox-select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

export const ACCOUNTING_PAGE_SIZE_OPTIONS = [10, 20, 50].map((size) => ({
    value: String(size),
    label: `${size} rows`,
}))

export function parseDecimalNumber(value: string | null | undefined): number {
    if (!value) return 0
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : 0
}

export function basisBadgeVariant(basis: string) {
    if (basis === "Purchase Actual" || basis === "Packing Roll-Up") return "secondary" as const
    return "outline" as const
}

export function varianceClass(value: string): string {
    const num = parseDecimalNumber(value)
    if (num > 0) return "text-amber-700 dark:text-amber-400"
    if (num < 0) return "text-emerald-700 dark:text-emerald-400"
    return "text-muted-foreground"
}

export type AccountingKpiCard = {
    title: string
    value: string
    badge: string
    helper: string
    icon: LucideIcon
    color: string
    bg: string
}

export function AccountingKpiStrip({ cards }: { cards: AccountingKpiCard[] }) {
    return (
        <div className="grid gap-3 @lg/main:grid-cols-2 @5xl/main:grid-cols-4">
            {cards.map((card) => {
                const Icon = card.icon
                return (
                    <Card key={card.title} className="border py-0 shadow-xs">
                        <CardContent className="p-3.5">
                            <div className="flex items-start justify-between gap-2">
                                <span className="min-w-0 text-xs font-medium text-muted-foreground">
                                    {card.title}
                                </span>
                                <div
                                    className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${card.bg}`}
                                >
                                    <Icon className={`size-4 ${card.color}`} />
                                </div>
                            </div>
                            <div className="mt-1.5 flex flex-wrap items-baseline justify-between gap-2">
                                <span className="min-w-0 break-words text-lg font-bold tracking-tight tabular-nums sm:text-xl">
                                    {card.value}
                                </span>
                                <Badge variant="secondary" className="max-w-full truncate text-[10px] font-medium tabular-nums">
                                    {card.badge}
                                </Badge>
                            </div>
                            <p className="mt-1.5 text-xs text-muted-foreground">{card.helper}</p>
                        </CardContent>
                    </Card>
                )
            })}
        </div>
    )
}

export function AccountingPagination({
    totalRows,
    pageSize,
    pageIndex,
    onPageSizeChange,
    onPageIndexChange,
}: {
    totalRows: number
    pageSize: number
    pageIndex: number
    onPageSizeChange: (nextSize: number) => void
    onPageIndexChange: (nextIndex: number) => void
}) {
    const pageCount = Math.max(1, Math.ceil(totalRows / pageSize))
    const safePageIndex = Math.min(pageIndex, pageCount - 1)
    const sliceStart = safePageIndex * pageSize
    const sliceEnd = sliceStart + pageSize

    return (
        <div className="flex flex-col gap-3 border-t px-4 py-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <div>
                Showing{" "}
                <span className="font-medium text-foreground">
                    {totalRows === 0 ? 0 : sliceStart + 1}–{Math.min(sliceEnd, totalRows)}
                </span>{" "}
                of <span className="font-medium text-foreground">{totalRows}</span> records
            </div>
            <div className="flex flex-wrap items-center gap-2">
                <div className="w-24">
                    <ComboboxSelect
                        items={ACCOUNTING_PAGE_SIZE_OPTIONS}
                        value={String(pageSize)}
                        onValueChange={(value) => {
                            if (!value) return
                            onPageSizeChange(Number(value))
                            onPageIndexChange(0)
                        }}
                        placeholder="Rows"
                        aria-label="Rows per page"
                        className="w-full"
                    />
                </div>
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    aria-label="Previous page"
                    disabled={safePageIndex === 0}
                    onClick={() => onPageIndexChange(Math.max(0, safePageIndex - 1))}
                >
                    <ChevronLeft className="size-4" />
                </Button>
                <span className="tabular-nums">
                    Page {safePageIndex + 1} / {pageCount}
                </span>
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    aria-label="Next page"
                    disabled={safePageIndex >= pageCount - 1}
                    onClick={() => onPageIndexChange(Math.min(pageCount - 1, safePageIndex + 1))}
                >
                    <ChevronRight className="size-4" />
                </Button>
            </div>
        </div>
    )
}
