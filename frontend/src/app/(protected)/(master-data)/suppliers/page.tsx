"use client"

import dynamic from "next/dynamic"
import Link from "next/link"
import { useCallback } from "react"
import { Plus } from "lucide-react"

import type { Supplier } from "@/components/modules/suppliers/supplier.schema"
import { SupplierStatistics } from "@/components/modules/suppliers/supplier-statistics"
import { SupplierTable } from "@/components/modules/suppliers/supplier-table"
import { PageHeader } from "@/components/shared/page-header"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useSuppliers } from "@/hooks/modules/suppliers/use-suppliers"

const SupplierForm = dynamic(() =>
    import("@/components/modules/suppliers/supplier-form").then((module) => module.SupplierForm),
)
const SupplierItemsDialog = dynamic(() =>
    import("@/components/modules/suppliers/supplier-items-dialog").then(
        (module) => module.SupplierItemsDialog,
    ),
)

export default function SuppliersPage() {
    const {
        suppliers,
        currentSupplier,
        itemsOpen,
        setItemsOpen,
        openItems,
        canManage,
        loadStatus,
        loadError,
        isFetching,
        retry,
        formOpen,
        setFormOpen,
        formRequested,
        editingSupplier,
        openAdd,
        openEdit,
        deactivatingSupplier,
        setDeactivatingSupplier,
        openDeactivate,
        handleSave,
        handleDeactivate,
        handleActivate,
        isSaving,
        isDeactivating,
        isActivating,
        saveError,
        deactivateError,
    } = useSuppliers()
    const activate = useCallback(
        (supplier: Supplier) => {
            void handleActivate(supplier)
        },
        [handleActivate],
    )
    const isBusy = isSaving || isDeactivating || isActivating
    const errorMessage =
        loadError instanceof Error ? loadError.message : "Unable to load supplier records."

    return (
        <>
            <title>Suppliers</title>
            <meta
                name="description"
                content="Manage suppliers and link the materials they supply."
            />
            <PageHeader
                title="Suppliers"
                description="Manage supplier details and the materials they supply."
                actions={
                    canManage && (
                        <Button className="h-10 gap-2 px-4" onClick={openAdd} disabled={isBusy}>
                            <Plus />
                            Add supplier
                        </Button>
                    )
                }
            />
            {loadStatus === "signed-out" && (
                <Alert>
                    <AlertTitle>Sign in to view suppliers</AlertTitle>
                    <AlertDescription>
                        <Button className="mt-2" render={<Link href="/" />} nativeButton={false}>
                            Sign in
                        </Button>
                    </AlertDescription>
                </Alert>
            )}
            {(loadStatus === "error" || (loadStatus === "ready" && loadError)) && (
                <Alert variant="destructive">
                    <AlertTitle>Unable to load suppliers</AlertTitle>
                    <AlertDescription>
                        {errorMessage}
                        <Button
                            className="mt-2"
                            variant="outline"
                            disabled={isFetching}
                            onClick={retry}
                        >
                            {isFetching ? "Retrying..." : "Retry loading suppliers"}
                        </Button>
                    </AlertDescription>
                </Alert>
            )}
            {loadStatus === "loading" && (
                <div className="space-y-4" aria-label="Loading suppliers" aria-busy="true">
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
                                You can view suppliers and their linked items. Purchasing managers
                                can add or change supplier records.
                            </AlertDescription>
                        </Alert>
                    )}
                    <SupplierStatistics suppliers={suppliers} />
                    <SupplierTable
                        suppliers={suppliers}
                        canManage={canManage}
                        isBusy={isBusy}
                        onAdd={openAdd}
                        onEdit={openEdit}
                        onViewItems={openItems}
                        onDeactivate={openDeactivate}
                        onActivate={activate}
                    />
                </>
            )}
            {formRequested && (
                <SupplierForm
                    open={formOpen && canManage}
                    onOpenChange={setFormOpen}
                    supplier={editingSupplier}
                    suppliers={suppliers}
                    onSave={handleSave}
                    isSaving={isSaving}
                    saveError={saveError}
                />
            )}
            {currentSupplier && (
                <SupplierItemsDialog
                    key={currentSupplier.supplierId}
                    open={itemsOpen}
                    onOpenChange={setItemsOpen}
                    supplier={currentSupplier}
                />
            )}
            <AlertDialog
                open={canManage && Boolean(deactivatingSupplier)}
                onOpenChange={(value) => {
                    if (!value && !isDeactivating) setDeactivatingSupplier(null)
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Deactivate supplier?</AlertDialogTitle>
                        <AlertDialogDescription className="break-words">
                            {deactivatingSupplier?.name} will be disabled and its items unlinked.
                            Purchase history remains available. After reactivating the supplier,
                            link its items again before purchasing.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    {deactivateError && (
                        <Alert variant="destructive">
                            <AlertDescription>{deactivateError}</AlertDescription>
                        </Alert>
                    )}
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeactivating}>Cancel</AlertDialogCancel>
                        <AlertDialogAction disabled={isDeactivating} onClick={handleDeactivate}>
                            {isDeactivating ? "Deactivating..." : "Deactivate supplier"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
