"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { create } from "zustand"
import { CalendarRange } from "lucide-react"
import {
    accountingFilterSchema,
    type AccountingFilters,
    type AccountingOverview,
} from "@/components/modules/accounting/accounting.schema"
import { PageHeader } from "@/components/shared/page-header"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { useAccounting } from "@/hooks/modules/accounting/use-accounting"

const EMPTY_FILTERS: AccountingFilters = {
    fromDate: "",
    toDate: "",
}

type AccountingFilterStore = {
    draftFilters: AccountingFilters
    appliedFilters: AccountingFilters
    filterError: string | null
    setDraftFilters: (updater: (prev: AccountingFilters) => AccountingFilters) => void
    applyFilters: () => void
    applyPreset: (fromDate: string, toDate: string) => void
    resetFilters: () => void
}

export const useAccountingFilterStore = create<AccountingFilterStore>((set, get) => ({
    draftFilters: EMPTY_FILTERS,
    appliedFilters: EMPTY_FILTERS,
    filterError: null,
    setDraftFilters: (updater) =>
        set((state) => ({ draftFilters: updater(state.draftFilters) })),
    applyFilters: () => {
        const parsed = accountingFilterSchema.safeParse(get().draftFilters)
        if (!parsed.success) {
            set({
                filterError: parsed.error.issues[0]?.message ?? "Invalid date filter.",
            })
            return
        }
        set({
            filterError: null,
            appliedFilters: parsed.data,
        })
    },
    applyPreset: (fromDate, toDate) => {
        const next = { fromDate, toDate }
        set({
            draftFilters: next,
            appliedFilters: next,
            filterError: null,
        })
    },
    resetFilters: () =>
        set({
            draftFilters: EMPTY_FILTERS,
            appliedFilters: EMPTY_FILTERS,
            filterError: null,
        }),
}))

function localIsoDate(date: Date): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const day = String(date.getDate()).padStart(2, "0")
    return `${year}-${month}-${day}`
}

export function AccountingShell({
    title,
    description,
    actions,
    children,
}: {
    title: string
    description: string
    actions?: ReactNode
    children: (overview: AccountingOverview) => ReactNode
}) {
    const {
        draftFilters,
        appliedFilters,
        filterError,
        setDraftFilters,
        applyFilters,
        applyPreset,
        resetFilters,
    } = useAccountingFilterStore()

    const { overview, loadStatus, loadError, isFetching, retry } =
        useAccounting(appliedFilters)

    const today = new Date()
    const todayIso = localIsoDate(today)
    const monthStartIso = localIsoDate(new Date(today.getFullYear(), today.getMonth(), 1))
    const yearStartIso = localIsoDate(new Date(today.getFullYear(), 0, 1))
    const last30Date = new Date(today)
    last30Date.setDate(last30Date.getDate() - 30)
    const last30Iso = localIsoDate(last30Date)

    return (
        <div className="space-y-3.5">
            <PageHeader title={title} description={description} actions={actions} />

            {loadStatus === "signed-out" && (
                <Alert>
                    <AlertTitle>Sign in to open Accounting</AlertTitle>
                    <AlertDescription>
                        <Button className="mt-2" render={<Link href="/" />} nativeButton={false}>
                            Sign in
                        </Button>
                    </AlertDescription>
                </Alert>
            )}

            {loadStatus === "forbidden" && (
                <Alert>
                    <AlertTitle>Accounting Portal access required</AlertTitle>
                    <AlertDescription>
                        The standalone Accounting Portal is restricted to roles with Accounting
                        access. Sign in with an Accounting account to view financial ledgers.
                    </AlertDescription>
                </Alert>
            )}

            {loadStatus === "error" && (
                <Alert variant="destructive">
                    <AlertTitle>Unable to load accounting ledger</AlertTitle>
                    <AlertDescription className="space-y-3">
                        <p>
                            {loadError instanceof Error
                                ? loadError.message
                                : "Please check your connection and try again."}
                        </p>
                        <Button variant="outline" size="sm" onClick={retry} disabled={isFetching}>
                            {isFetching ? "Retrying..." : "Retry"}
                        </Button>
                    </AlertDescription>
                </Alert>
            )}

            {loadStatus === "loading" && (
                <div className="space-y-4">
                    <Skeleton className="h-20 w-full rounded-xl" />
                    <div className="grid grid-cols-1 gap-3 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
                        <Skeleton className="h-28 w-full rounded-xl" />
                        <Skeleton className="h-28 w-full rounded-xl" />
                        <Skeleton className="h-28 w-full rounded-xl" />
                        <Skeleton className="h-28 w-full rounded-xl" />
                    </div>
                    <div className="grid gap-4 sm:gap-5 @4xl/main:grid-cols-2">
                        <Skeleton className="h-80 w-full rounded-xl" />
                        <Skeleton className="h-80 w-full rounded-xl" />
                        <Skeleton className="h-80 w-full rounded-xl" />
                        <Skeleton className="h-80 w-full rounded-xl" />
                    </div>
                </div>
            )}

            {loadStatus === "ready" && overview && (
                <div className="space-y-3.5">
                    <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 @4xl/main:flex-row @4xl/main:items-end @4xl/main:justify-between">
                        <div className="min-w-0 space-y-0.5">
                            <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                                <CalendarRange className="size-4 text-primary" />
                                Date Range Filter
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Current Stock Value always reflects what is on hand today; dates filter Sales, Expenses, Packing, and Reports.
                            </p>
                        </div>
                        <div className="flex flex-wrap items-end gap-2">
                            <div className="flex flex-wrap items-center gap-1 pb-0.5">
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 px-2 text-xs"
                                    onClick={() => applyPreset(monthStartIso, todayIso)}
                                >
                                    This Month
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 px-2 text-xs"
                                    onClick={() => applyPreset(last30Iso, todayIso)}
                                >
                                    Last 30 Days
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 px-2 text-xs"
                                    onClick={() => applyPreset(yearStartIso, todayIso)}
                                >
                                    This Year
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 px-2 text-xs"
                                    onClick={resetFilters}
                                >
                                    All Time
                                </Button>
                            </div>
                            <div className="grid w-full grid-cols-1 items-end gap-2 min-[380px]:grid-cols-2 sm:flex sm:w-auto">
                                <div className="space-y-1">
                                    <label
                                        htmlFor="accounting-from-date"
                                        className="block text-xs text-muted-foreground"
                                    >
                                        From date
                                    </label>
                                    <Input
                                        id="accounting-from-date"
                                        type="date"
                                        value={draftFilters.fromDate}
                                        onChange={(e) =>
                                            setDraftFilters((prev) => ({
                                                ...prev,
                                                fromDate: e.target.value,
                                            }))
                                        }
                                        className="h-8 w-full text-xs sm:w-36"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label
                                        htmlFor="accounting-to-date"
                                        className="block text-xs text-muted-foreground"
                                    >
                                        To date
                                    </label>
                                    <Input
                                        id="accounting-to-date"
                                        type="date"
                                        value={draftFilters.toDate}
                                        onChange={(e) =>
                                            setDraftFilters((prev) => ({
                                                ...prev,
                                                toDate: e.target.value,
                                            }))
                                        }
                                        className="h-8 w-full text-xs sm:w-36"
                                    />
                                </div>
                                <Button
                                    type="button"
                                    size="sm"
                                    onClick={applyFilters}
                                    className="min-[380px]:col-span-2 sm:col-span-1"
                                >
                                    Apply
                                </Button>
                            </div>
                        </div>
                    </div>

                    {filterError && (
                        <Alert variant="destructive">
                            <AlertTitle>Invalid fiscal period</AlertTitle>
                            <AlertDescription>{filterError}</AlertDescription>
                        </Alert>
                    )}

                    {children(overview)}
                </div>
            )}
        </div>
    )
}
