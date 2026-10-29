"use client"
import dynamic from "next/dynamic"
import Link from "next/link"
import { Archive, Plus } from "lucide-react"
import { PageHeader } from "@/components/shared/page-header"
import { LocationStatistics } from "@/components/modules/locations/location-statistics"
import { LocationTable } from "@/components/modules/locations/location-table"
import { useLocations } from "@/hooks/modules/locations/use-locations"
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
const LocationForm = dynamic(() =>
    import("@/components/modules/locations/location-form").then((module) => module.LocationForm),
)
export default function LocationsPage() {
    const catalog = useLocations()
    return (
        <>
            <title>Locations</title>
            <meta
                name="description"
                content="Manage warehouses, packing areas, branches, stores, and inventory locations."
            />
            <PageHeader
                title="Locations"
                description="Manage where inventory is stored, packed, and transferred."
                actions={
                    catalog.canManage && (
                        <Button
                            className="h-10 gap-2 px-4"
                            onClick={catalog.openAdd}
                            disabled={catalog.loadStatus !== "ready"}
                        >
                            <Plus />
                            Add location
                        </Button>
                    )
                }
            />
            {catalog.loadStatus === "signed-out" && (
                <Alert>
                    <AlertTitle>Sign in to view locations</AlertTitle>
                    <AlertDescription>
                        <p>Your account determines which location actions are available.</p>
                        <Button className="mt-3" render={<Link href="/" />} nativeButton={false}>
                            Sign in
                        </Button>
                    </AlertDescription>
                </Alert>
            )}
            {catalog.loadStatus === "loading" && (
                <div
                    className="flex flex-col gap-4"
                    aria-busy="true"
                    aria-label="Loading locations"
                >
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
                    <AlertTitle>Unable to refresh locations</AlertTitle>
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
                                Your role can view and export locations. Inventory managers can add
                                or edit locations.
                            </AlertDescription>
                        </Alert>
                    )}
                    <LocationStatistics locations={catalog.locations} />
                    <LocationTable
                        locations={catalog.locations}
                        canManage={catalog.canManage}
                        onAdd={catalog.openAdd}
                        onEdit={catalog.openEdit}
                        onDeactivate={catalog.openDeactivate}
                    />
                </>
            )}
            {catalog.formRequested && (
                <LocationForm
                    open={catalog.formOpen && catalog.canManage}
                    onOpenChange={catalog.setFormOpen}
                    location={catalog.editingLocation}
                    locations={catalog.locations}
                    isSaving={catalog.isSaving}
                    onSave={catalog.handleSave}
                />
            )}
            <AlertDialog
                open={catalog.canManage && catalog.deactivatingLocations.length > 0}
                onOpenChange={(open) => {
                    if (!open && !catalog.isDeactivating) catalog.setDeactivatingLocations([])
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Deactivate{" "}
                            {catalog.deactivatingLocations.length === 1
                                ? "location"
                                : catalog.deactivatingLocations.length + " locations"}
                            ?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {catalog.deactivatingLocations.length === 1
                                ? catalog.deactivatingLocations[0].name
                                : "The eligible selected locations"}{" "}
                            will become inactive. Historical records are preserved. Edit the active
                            status to reactivate.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={catalog.isDeactivating}>
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            disabled={catalog.isDeactivating}
                            onClick={catalog.handleDeactivate}
                        >
                            <Archive />
                            {catalog.isDeactivating ? "Deactivating..." : "Deactivate"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
