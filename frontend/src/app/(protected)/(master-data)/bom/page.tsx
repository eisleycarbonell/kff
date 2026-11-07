"use client"
import dynamic from "next/dynamic"
import Link from "next/link"
import { Plus } from "lucide-react"
import { usePackingFormulas } from "@/hooks/modules/packing-formulas/use-packing-formulas"
import { PackingFormulaTable } from "@/components/modules/packing-formulas/packing-formula-table"
import { PackingFormulaStatistics } from "@/components/modules/packing-formulas/packing-formula-statistics"
import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogCancel,
    AlertDialogAction,
} from "@/components/ui/alert-dialog"
const PackingFormulaForm = dynamic(() =>
    import("@/components/modules/packing-formulas/packing-formula-form").then(
        (module) => module.PackingFormulaForm,
    ),
)
export default function PackingFormulasPage() {
    const feature = usePackingFormulas()
    return (
        <>
            <title>Packing Formulas</title>
            <meta
                name="description"
                content="Manage finished-product packing formulas and material requirements."
            />
            <PageHeader
                title="Packing Formulas"
                description="Define the materials needed for one finished product unit."
                actions={
                    feature.canManage && (
                        <Button
                            className="h-10"
                            disabled={feature.isSaving || feature.isRemoving}
                            onClick={feature.openAdd}
                        >
                            <Plus />
                            Create formula
                        </Button>
                    )
                }
            />
            {feature.loading && <Skeleton className="h-96" aria-label="Loading packing formulas" />}
            {feature.signedOut && (
                <Alert>
                    <AlertTitle>Sign in to view packing formulas</AlertTitle>
                    <AlertDescription>
                        <Link href="/">Sign in</Link>
                    </AlertDescription>
                </Alert>
            )}
            {feature.error && (
                <Alert variant="destructive">
                    <AlertTitle>Unable to load packing formulas</AlertTitle>
                    <AlertDescription>
                        {feature.error.message}
                        <Button variant="outline" onClick={feature.retry}>
                            Retry
                        </Button>
                    </AlertDescription>
                </Alert>
            )}
            {!feature.loading && !feature.signedOut && (
                <>
                    {!feature.canManage && (
                        <Alert>
                            <AlertTitle>View-only access</AlertTitle>
                            <AlertDescription>
                                You can inspect and export formulas. Packing managers can create or
                                edit them.
                            </AlertDescription>
                        </Alert>
                    )}
                    <PackingFormulaStatistics formulas={feature.formulas} />
                    <PackingFormulaTable
                        formulas={feature.formulas}
                        canManage={feature.canManage}
                        busy={feature.isSaving || feature.isRemoving}
                        onAdd={feature.openAdd}
                        onEdit={feature.openEdit}
                        onRemove={feature.setRemoving}
                    />
                </>
            )}
            {feature.formRequested && (
                <PackingFormulaForm
                    open={feature.formOpen && feature.canManage}
                    onOpenChange={feature.setFormOpen}
                    formula={feature.editing}
                    options={feature.options}
                    optionsError={feature.optionsError}
                    optionsLoading={feature.optionsLoading}
                    retryOptions={feature.retryOptions}
                    isSaving={feature.isSaving}
                    error={feature.saveError}
                    onSave={feature.handleSave}
                />
            )}
            <AlertDialog
                open={Boolean(feature.removing) && feature.canManage}
                onOpenChange={(open) => {
                    if (!open && !feature.isRemoving) feature.setRemoving(null)
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remove packing formula?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {feature.removing?.itemName} will need a new formula before new packing
                            orders can be created. Existing packing orders keep their saved
                            requirements and reservations.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    {feature.removeError && (
                        <p role="alert" className="text-destructive">
                            {feature.removeError}
                        </p>
                    )}
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={feature.isRemoving}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            variant="destructive"
                            disabled={feature.isRemoving}
                            onClick={feature.handleRemove}
                        >
                            {feature.isRemoving ? "Removing..." : "Remove formula"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
