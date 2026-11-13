"use client"

import dynamic from "next/dynamic"
import Link from "next/link"
import { Plus } from "lucide-react"

import { BrandStatistics } from "@/components/modules/brands/brand-statistics"
import { BrandTable } from "@/components/modules/brands/brand-table"
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
import { useBrands } from "@/hooks/modules/brands/use-brands"

const BrandForm = dynamic(() =>
    import("@/components/modules/brands/brand-form").then((module) => module.BrandForm),
)

export default function BrandsPage() {
    const {
        brands,
        canManage,
        loadStatus,
        loadError,
        formOpen,
        setFormOpen,
        formRequested,
        editingBrand,
        deactivatingBrand,
        setDeactivatingBrand,
        openAdd,
        openEdit,
        openDeactivate,
        handleSave,
        handleActivate,
        handleDeactivate,
        isSaving,
        isDeactivating,
        isUpdating,
        saveError,
        deactivateError,
        isFetching,
        retry,
    } = useBrands()

    return (
        <>
            <title>Brands</title>
            <meta name="description" content="Manage product brands and catalog assignments." />
            <PageHeader
                title="Brands"
                description="Manage product brands and catalog assignments."
                actions={
                    canManage && (
                        <Button className="h-10 gap-2 px-4" onClick={openAdd} disabled={isUpdating}>
                            <Plus />
                            Add brand
                        </Button>
                    )
                }
            />
            {loadStatus === "signed-out" && (
                <Alert>
                    <AlertTitle>Sign in to view brands</AlertTitle>
                    <AlertDescription>
                        <Button className="mt-2" render={<Link href="/" />} nativeButton={false}>
                            Sign in
                        </Button>
                    </AlertDescription>
                </Alert>
            )}
            {loadError && loadStatus !== "signed-out" && (
                <Alert variant="destructive">
                    <AlertTitle>
                        {loadStatus === "ready"
                            ? "Unable to refresh brands"
                            : "Unable to load brands"}
                    </AlertTitle>
                    <AlertDescription>
                        <p>{loadError.message}</p>
                        {loadStatus === "ready" && <p>Showing the last loaded brand records.</p>}
                        <Button
                            variant="outline"
                            className="mt-2"
                            onClick={retry}
                            disabled={isFetching}
                        >
                            {isFetching ? "Retrying..." : "Retry loading brands"}
                        </Button>
                    </AlertDescription>
                </Alert>
            )}
            {loadStatus === "loading" && (
                <div className="space-y-4" aria-busy="true" aria-label="Loading brands">
                    <div className="grid gap-4 sm:grid-cols-3">
                        {[0, 1, 2].map((index) => (
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
                            <AlertTitle>View-only access</AlertTitle>
                            <AlertDescription>
                                You can view and export brands. Inventory managers can add or change
                                brand records.
                            </AlertDescription>
                        </Alert>
                    )}
                    <BrandStatistics brands={brands} />
                    <BrandTable
                        brands={brands}
                        canManage={canManage}
                        isUpdating={isUpdating}
                        onAdd={openAdd}
                        onEdit={openEdit}
                        onDeactivate={openDeactivate}
                        onActivate={handleActivate}
                    />
                </>
            )}
            {formRequested && (
                <BrandForm
                    open={formOpen && canManage}
                    onOpenChange={setFormOpen}
                    brand={editingBrand}
                    onSave={handleSave}
                    isSaving={isSaving}
                    error={saveError}
                />
            )}
            <AlertDialog
                open={canManage && Boolean(deactivatingBrand)}
                onOpenChange={(open) => {
                    if (!open && !isDeactivating) setDeactivatingBrand(null)
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Deactivate brand?</AlertDialogTitle>
                        <AlertDialogDescription className="break-words">
                            {deactivatingBrand?.name} will be marked inactive. Existing item
                            assignments remain available, and you can reactivate the brand later.
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
                            {isDeactivating ? "Deactivating..." : "Deactivate brand"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
