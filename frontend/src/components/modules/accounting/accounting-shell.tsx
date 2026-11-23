"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { create } from "zustand"
import {
    BookOpenCheck,
    Boxes,
    CalendarRange,
    Factory,
    LayoutDashboard,
    Receipt,
    Wallet,
} from "lucide-react"
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
import { cn } from "cn"

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

export const ACCOUNTING_SUBMODULES = [
    { label: "Overview & P&L", href: "/accounting", icon: LayoutDashboard },
    { label: "General Ledger", href: "/accounting/general-ledger", icon: BookOpenCheck },
    { label: "Inventory Valuation", href: "/accounting/valuation", icon: Boxes },
    { label: "Production Costing", href: "/accounting/production-costing", icon: Factory },
    { label: "Receivables & Margin", href: "/accounting/receivables-margins", icon: Receipt },
    { label: "Payables & POs", href: "/accounting/payables", icon: Wallet },
] as const

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
    const pathname = usePathname().replace(/\/+$/, "") || "/"
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

            <nav
                aria-label="Accounting sub-modules"
                className="flex items-center gap-1.5 overflow-x-auto rounded-xl border bg-card p-1.5 sm:flex-wrap"
            >
                {ACCOUNTING_SUBMODULES.map((item) => {
                    const Icon = item.icon
                    const active = pathname === item.href
                    return (
                        <Button
                            key={item.href}
                            variant={active ? "default" : "ghost"}
                            size="sm"
                            className={cn(
                                "h-8 shrink-0 gap-1.5 text-xs",
                                !active && "text-muted-foreground hover:text-foreground",
                            )}
                            render={<Link href={item.href} />}
                            nativeButton={false}
                        >
                            <Icon className="size-3.5" />
                            {item.label}
                        </Button>
                    )
                })}
            </nav>

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
                    <AlertTitle>Accounting access required</AlertTitle>
                    <AlertDescription>
                        Your role does not include Accounting access. Sign in with an Accounting role
                        or ask an Administrator to enable Accounting management permission.
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
                    <Skeleton className="h-24 w-full rounded-xl" />
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        <Skeleton className="h-28 w-full rounded-xl" />
                        <Skeleton className="h-28 w-full rounded-xl" />
                        <Skeleton className="h-28 w-full rounded-xl" />
                    </div>
                    <Skeleton className="h-80 w-full rounded-xl" />
                </div>
            )}

            {loadStatus === "ready" && overview && (
                <div className="space-y-3.5">
                    <div className="flex flex-col gap-2.5 rounded-xl border bg-card p-3 lg:flex-row lg:items-end lg:justify-between">
                        <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                                <CalendarRange className="size-4 text-primary" />
                                Fiscal Period Filter for P&amp;L &amp; Subledgers
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Perpetual inventory asset balances reflect today&apos;s stock on hand; dates
                                filter Journal Entries, Sales/COGS, Production, and Purchase activity.
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
                                    MTD
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 px-2 text-xs"
                                    onClick={() => applyPreset(last30Iso, todayIso)}
                                >
                                    30D
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 px-2 text-xs"
                                    onClick={() => applyPreset(yearStartIso, todayIso)}
                                >
                                    YTD
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 px-2 text-xs"
                                    onClick={resetFilters}
                                >
                                    All
                                </Button>
                            </div>
                            <div className="grid w-full grid-cols-2 items-end gap-2 sm:flex sm:w-auto">
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
                                    className="col-span-2 sm:col-span-1"
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
