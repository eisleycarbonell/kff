"use client"
import dynamic from "next/dynamic"
import Link from "next/link"
import { FolderCog, Plus, Trash2 } from "lucide-react"
import { PageHeader } from "@/components/shared/page-header"
import { UomStatistics } from "@/components/modules/uoms/uom-statistics"
import { UomTable } from "@/components/modules/uoms/uom-table"
import { useUoms } from "@/hooks/modules/uoms/use-uoms"
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
const UomForm = dynamic(() =>
    import("@/components/modules/uoms/uom-form").then((module) => module.UomForm),
)
const UomClassManager = dynamic(() =>
    import("@/components/modules/uoms/uom-class-manager").then((module) => module.UomClassManager),
)
export default function UnitsOfMeasurePage() {
    const catalog = useUoms()
    const deleting = catalog.isDeleting || catalog.isDeletingClass
    return (
        <>
            <title>Units of Measure</title>
            <meta
                name="description"
                content="Manage unit classes, base units, and exact conversion factors."
            />
            <PageHeader
                title="Units of Measure"
                description="Define compatible units and their conversion to a class base unit."
                actions={
                    catalog.canManage && (
                        <div className="flex flex-wrap gap-2">
                            <Button
                                variant="outline"
                                className="h-10 gap-2 px-4"
                                disabled={catalog.loadStatus !== "ready"}
                                onClick={() => catalog.setClassesOpen(true)}
                            >
                                <FolderCog />
                                Manage classes
                            </Button>
                            <Button
                                className="h-10 gap-2 px-4"
                                disabled={catalog.loadStatus !== "ready" || !catalog.classes.length}
                                onClick={catalog.openAdd}
                            >
                                <Plus />
                                Add UOM
                            </Button>
                        </div>
                    )
                }
            />
            {catalog.loadStatus === "signed-out" && (
                <Alert>
                    <AlertTitle>Sign in to view units of measure</AlertTitle>
                    <AlertDescription>
                        <p>Your account determines which UOM actions are available.</p>
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
                    aria-label="Loading units of measure"
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
                    <AlertTitle>Unable to refresh units of measure</AlertTitle>
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
                                Your role can view and export units. Inventory managers can manage
                                units and classes.
                            </AlertDescription>
                        </Alert>
                    )}
                    {catalog.canManage && !catalog.classes.length && (
                        <Alert>
                            <AlertTitle>Create a unit class first</AlertTitle>
                            <AlertDescription>
                                <p>Use Manage classes to add a class, then add its base unit.</p>
                                <Button
                                    variant="outline"
                                    className="mt-3"
                                    onClick={() => catalog.setClassesOpen(true)}
                                >
                                    Add a class
                                </Button>
                            </AlertDescription>
                        </Alert>
                    )}
                    <UomStatistics units={catalog.units} classes={catalog.classes} />
                    <UomTable
                        uoms={catalog.units}
                        classes={catalog.classes}
                        canManage={catalog.canManage}
                        onAdd={
                            catalog.classes.length
                                ? catalog.openAdd
                                : () => catalog.setClassesOpen(true)
                        }
                        onEdit={catalog.openEdit}
                        onDelete={catalog.openDelete}
                    />
                </>
            )}
            {catalog.formRequested && (
                <UomForm
                    open={catalog.formOpen && catalog.canManage}
                    onOpenChange={catalog.setFormOpen}
                    unit={catalog.editingUnit}
                    units={catalog.units}
                    classes={catalog.classes}
                    isSaving={catalog.isSaving}
                    onSave={catalog.handleSave}
                />
            )}
            <UomClassManager
                open={catalog.classesOpen && catalog.canManage}
                onOpenChange={catalog.setClassesOpen}
                classes={catalog.classes}
                isSaving={catalog.isSavingClass}
                isDeleting={catalog.isDeletingClass}
                onSave={catalog.handleSaveClass}
                onDelete={catalog.setDeletingClass}
            />
            <AlertDialog
                open={catalog.canManage && Boolean(catalog.deletingUnit || catalog.deletingClass)}
                onOpenChange={(open) => {
                    if (!open && !deleting) {
                        catalog.setDeletingUnit(null)
                        catalog.setDeletingClass(null)
                    }
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Delete {catalog.deletingClass ? "unit class" : "unused unit"}?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {catalog.deletingClass?.name ?? catalog.deletingUnit?.name} will be
                            permanently removed.{" "}
                            {catalog.deletingClass
                                ? "Only empty classes can be deleted."
                                : "Only unused units that do not anchor other units can be deleted."}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            variant="destructive"
                            disabled={deleting}
                            onClick={
                                catalog.deletingClass
                                    ? catalog.handleDeleteClass
                                    : catalog.handleDelete
                            }
                        >
                            <Trash2 />
                            {deleting ? "Deleting..." : "Delete"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
