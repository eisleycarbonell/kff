"use client"

import dynamic from "next/dynamic"
import Link from "next/link"
import { Archive, Plus } from "lucide-react"
import { PageHeader } from "@/components/shared/page-header"
import { ItemStatistics } from "@/components/modules/items/item-statistics"
import { ItemTable } from "@/components/modules/items/item-table"
import { useItems } from "@/hooks/modules/items/use-items"
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

const ItemForm = dynamic(() =>
    import("@/components/modules/items/item-form").then((module) => module.ItemForm),
)

export default function ItemsPage() {
    const catalog = useItems()
    return (
        <>
            <title>Items / Products</title>
            <meta
                name="description"
                content="Manage raw materials, packaging, labels, and finished products."
            />
            <PageHeader
                title="Items / Products"
                description="Manage your product catalog, units, and item details."
                actions={
                    catalog.canManage && (
                        <Button
                            className="h-10 gap-2 px-4"
                            onClick={catalog.openAdd}
                            disabled={!catalog.uoms.length}
                        >
                            <Plus data-icon="inline-start" />
                            Add item
                        </Button>
                    )
                }
            />
            {catalog.loadStatus === "signed-out" && (
                <Alert>
                    <AlertTitle>Sign in to view the catalog</AlertTitle>
                    <AlertDescription>
                        <p>Your account determines which catalog actions are available.</p>
                        <Button className="mt-3" render={<Link href="/" />} nativeButton={false}>
                            Sign in
                        </Button>
                    </AlertDescription>
                </Alert>
            )}
            {catalog.loadStatus === "loading" && (
                <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading items">
                    <div className="grid gap-4 sm:grid-cols-3">
                        {[0, 1, 2].map((index) => (
                            <Skeleton key={index} className="h-36 rounded-xl" />
                        ))}
                    </div>
                    <Skeleton className="h-96 rounded-xl" />
                </div>
            )}
            {catalog.loadError && catalog.loadStatus !== "signed-out" && (
                <Alert variant="destructive">
                    <AlertTitle>Unable to refresh catalog data</AlertTitle>
                    <AlertDescription>
                        <p>{catalog.loadError.message}</p>
                        <Button
                            variant="outline"
                            className="mt-3"
                            disabled={catalog.isFetching}
                            onClick={catalog.retry}
                        >
                            {catalog.isFetching ? "Retrying..." : "Retry loading"}
                        </Button>
                    </AlertDescription>
                </Alert>
            )}
            {catalog.loadStatus === "ready" && (
                <>
                    {!catalog.canManage && (
                        <Alert>
                            <AlertTitle>View-only access</AlertTitle>
                            <AlertDescription>
                                Your role can view and export the catalog. Inventory managers can
                                add or edit items.
                            </AlertDescription>
                        </Alert>
                    )}
                    {catalog.canManage && !catalog.uoms.length && (
                        <Alert>
                            <AlertTitle>Primary units are required</AlertTitle>
                            <AlertDescription>
                                Add units of measure before creating catalog items.
                            </AlertDescription>
                        </Alert>
                    )}
                    <ItemStatistics items={catalog.items} />
                    <ItemTable
                        items={catalog.items}
                        canManage={catalog.canManage && catalog.uoms.length > 0}
                        onAdd={catalog.openAdd}
                        onEdit={catalog.openEdit}
                        onDeactivate={catalog.openDeactivate}
                    />
                </>
            )}
            {catalog.formRequested && (
                <ItemForm
                    open={catalog.formOpen && catalog.canManage}
                    onOpenChange={catalog.setFormOpen}
                    item={catalog.editingItem}
                    items={catalog.items}
                    uoms={catalog.uoms}
                    onSave={catalog.handleSave}
                    isSaving={catalog.isSaving}
                />
            )}
            <AlertDialog
                open={catalog.canManage && catalog.deactivatingItems.length > 0}
                onOpenChange={(open) => {
                    if (!open && !catalog.isDeactivating) catalog.setDeactivatingItems([])
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Deactivate{" "}
                            {catalog.deactivatingItems.length === 1
                                ? "item"
                                : `${catalog.deactivatingItems.length} items`}
                            ?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {catalog.deactivatingItems.length === 1
                                ? catalog.deactivatingItems[0].name
                                : "The selected items"}{" "}
                            will become inactive. Historical records are preserved. You can
                            reactivate an item by editing its active status.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={catalog.isDeactivating}>
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={catalog.handleDeactivate}
                            disabled={catalog.isDeactivating}
                        >
                            <Archive data-icon="inline-start" />
                            {catalog.isDeactivating ? "Deactivating..." : "Deactivate"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
