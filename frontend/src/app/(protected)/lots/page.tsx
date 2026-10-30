"use client"

import dynamic from "next/dynamic"
import Link from "next/link"
import { useCallback, useState } from "react"

import type { Lot } from "@/components/modules/lots/lot.schema"
import { LotStatistics } from "@/components/modules/lots/lot-statistics"
import { LotTable } from "@/components/modules/lots/lot-table"
import { PageHeader } from "@/components/shared/page-header"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useLots } from "@/hooks/modules/lots/use-lots"

const LotForm = dynamic(() =>
    import("@/components/modules/lots/lot-form").then((module) => module.LotForm),
)
const LotDetailDialog = dynamic(() =>
    import("@/components/modules/lots/lot-detail-dialog").then(
        (module) => module.LotDetailDialog,
    ),
)

export default function LotsPage() {
    const {
        lots,
        canManage,
        loadStatus,
        loadError,
        retry,
        isFetching,
        formOpen,
        setFormOpen,
        formRequested,
        editingLot,
        openEdit,
        handleSave,
        isSaving,
        saveError,
    } = useLots()
    const [viewingLot, setViewingLot] = useState<Lot | null>(null)
    const [detailOpen, setDetailOpen] = useState(false)
    const openDetail = useCallback((lot: Lot) => {
        setViewingLot(lot)
        setDetailOpen(true)
    }, [])
    const editLot = useCallback(
        (lot: Lot) => {
            setDetailOpen(false)
            openEdit(lot)
        },
        [openEdit],
    )

    return (
        <>
            <title>Lots / Batches</title>
            <meta
                name="description"
                content="Trace purchased and packed lots, their balances, and inventory movements."
            />
            <PageHeader
                title="Lots / Batches"
                description="Trace each lot to its source document, stock locations, and inventory movements."
            />
            {loadStatus === "signed-out" && (
                <Alert>
                    <AlertTitle>Sign in to view lots</AlertTitle>
                    <AlertDescription>
                        <Button className="mt-2" render={<Link href="/" />} nativeButton={false}>
                            Sign in
                        </Button>
                    </AlertDescription>
                </Alert>
            )}
            {(loadStatus === "error" || (loadStatus === "ready" && loadError)) && (
                <Alert variant="destructive">
                    <AlertTitle>Unable to load lots</AlertTitle>
                    <AlertDescription>
                        {loadError?.message ?? "Lot records could not be loaded."}
                        <Button
                            variant="outline"
                            className="mt-2"
                            disabled={isFetching}
                            onClick={retry}
                        >
                            {isFetching ? "Retrying..." : "Retry loading lots"}
                        </Button>
                    </AlertDescription>
                </Alert>
            )}
            {loadStatus === "loading" && (
                <div className="space-y-4" aria-label="Loading lots" aria-busy="true">
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        {[0, 1, 2, 3].map((index) => (
                            <Skeleton key={index} className="h-28 rounded-xl" />
                        ))}
                    </div>
                    <Skeleton className="h-96 rounded-xl" />
                </div>
            )}
            {loadStatus === "ready" && (
                <>
                    {!canManage && (
                        <Alert>
                            <AlertTitle>Read-only access</AlertTitle>
                            <AlertDescription>
                                You can inspect lot origins, balances, and movements. Inventory
                                managers can correct lot references, dates, and quality status.
                            </AlertDescription>
                        </Alert>
                    )}
                    <LotStatistics lots={lots} />
                    <LotTable
                        lots={lots}
                        canManage={canManage}
                        isBusy={isSaving}
                        onView={openDetail}
                        onEdit={editLot}
                    />
                </>
            )}
            {formRequested && (
                <LotForm
                    open={formOpen && canManage}
                    onOpenChange={setFormOpen}
                    lot={editingLot}
                    onSave={handleSave}
                    isSaving={isSaving}
                    saveError={saveError}
                />
            )}
            {viewingLot && (
                <LotDetailDialog
                    key={viewingLot.lotId}
                    open={detailOpen}
                    onOpenChange={setDetailOpen}
                    lot={viewingLot}
                    canManage={canManage}
                    isBusy={isSaving}
                    onEdit={editLot}
                />
            )}
        </>
    )
}
