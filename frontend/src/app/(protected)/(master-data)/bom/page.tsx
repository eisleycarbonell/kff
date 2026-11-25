"use client"
import { Suspense, useEffect } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Plus, Trash2 } from "lucide-react"
import { usePackingFormulas } from "@/hooks/modules/packing-formulas/use-packing-formulas"
import { PageHeader } from "@/components/shared/page-header"
import { BulkImportActions } from "@/components/shared/bulk-import-actions"
import { PackingFormulaStatistics } from "@/components/modules/packing-formulas/packing-formula-statistics"
import { PackingFormulaTable } from "@/components/modules/packing-formulas/packing-formula-table"
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
import type { PackingFormula } from "@/components/modules/packing-formulas/packing-formula.schema"

const PackingFormulaForm = dynamic(() =>
    import("@/components/modules/packing-formulas/packing-formula-form").then(
        (module) => module.PackingFormulaForm,
    ),
)

function ProductQueryOpener({
    ready,
    canManage,
    formulas,
    openAdd,
    openEdit,
}: {
    ready: boolean
    canManage: boolean
    formulas: PackingFormula[]
    openAdd: (productId?: number | null) => void
    openEdit: (formula: PackingFormula) => void
}) {
    const searchParams = useSearchParams()
    const router = useRouter()
    const productParam = searchParams.get("productId")

    useEffect(() => {
        if (!ready || !canManage || !productParam) return
        const productId = Number(productParam)
        if (!Number.isSafeInteger(productId) || productId <= 0) return
        const existing = formulas.find((row) => row.itemId === productId)
        if (existing) openEdit(existing)
        else openAdd(productId)
        router.replace("/bom", { scroll: false })
    }, [ready, canManage, productParam, formulas, openAdd, openEdit, router])

    return null
}

function PackingFormulasContent() {
    const f = usePackingFormulas()
    const ready = !f.loading && !f.signedOut && !f.error

    return (
        <>
            <title>Packing Formulas</title>
            <meta
                name="description"
                content="Define the ingredients, pouches, seals, and labels required to pack each finished product."
            />
            <Suspense fallback={null}>
                <ProductQueryOpener
                    ready={ready}
                    canManage={f.canManage}
                    formulas={f.formulas}
                    openAdd={f.openAdd}
                    openEdit={f.openEdit}
                />
            </Suspense>
            <PageHeader
                title="Packing Formulas"
                description="Set the ingredients, pouches, seals, and labels required to pack one finished product. Changes apply to future packing orders immediately while keeping historical orders intact."
                actions={
                    f.canManage ? (
                        <>
                            <BulkImportActions moduleKey="packing-formulas" />
                            <Button
                                className="h-10 gap-2 px-4"
                                disabled={f.busy}
                                onClick={() => f.openAdd()}
                            >
                                <Plus data-icon="inline-start" />
                                Create formula
                            </Button>
                        </>
                    ) : undefined
                }
            />
            <div className="flex flex-wrap gap-3 text-sm">
                <Link className="text-primary underline" href="/items">
                    Items / Products
                </Link>
                <Link className="text-primary underline" href="/packing-orders">
                    Packing Orders
                </Link>
            </div>
            {f.signedOut && (
                <Alert>
                    <AlertTitle>Sign in to view packing formulas</AlertTitle>
                    <AlertDescription>
                        <p>Your account determines which packing setup actions are available.</p>
                        <Button className="mt-3" render={<Link href="/" />} nativeButton={false}>
                            Sign in
                        </Button>
                    </AlertDescription>
                </Alert>
            )}
            {f.loading && (
                <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading formulas">
                    <div className="grid gap-3 @lg/main:grid-cols-2 @3xl/main:grid-cols-3">
                        {[0, 1, 2].map((index) => (
                            <Skeleton key={index} className="h-24 rounded-xl" />
                        ))}
                    </div>
                    <Skeleton className="h-96 rounded-xl" />
                </div>
            )}
            {f.error && !f.signedOut && (
                <Alert variant="destructive">
                    <AlertTitle>Unable to load packing formulas</AlertTitle>
                    <AlertDescription>
                        <p>{f.error.message}</p>
                        <Button variant="outline" className="mt-3" onClick={f.retry}>
                            Retry
                        </Button>
                    </AlertDescription>
                </Alert>
            )}
            {ready && (
                <>
                    {!f.canManage && (
                        <Alert>
                            <AlertTitle>View-only access</AlertTitle>
                            <AlertDescription>
                                Packing access is required to create, update, or remove formulas.
                            </AlertDescription>
                        </Alert>
                    )}
                    <PackingFormulaStatistics formulas={f.formulas} />
                    <PackingFormulaTable
                        formulas={f.formulas}
                        canManage={f.canManage}
                        busy={f.busy}
                        onAdd={() => f.openAdd()}
                        onEdit={f.openEdit}
                        onRemove={f.openRemove}
                    />
                </>
            )}
            {f.formRequested && (
                <PackingFormulaForm
                    open={f.formOpen && f.canManage}
                    onOpenChange={f.setFormOpen}
                    formula={f.editingFormula}
                    initialProductId={f.initialProductId}
                    existingFormulas={f.formulas}
                    options={f.options}
                    optionsError={f.optionsError}
                    optionsLoading={f.optionsLoading}
                    retryOptions={f.retryOptions}
                    isSaving={f.isSaving}
                    error={f.saveError}
                    onSave={f.handleSave}
                />
            )}
            <AlertDialog
                open={Boolean(f.removingFormula) && f.canManage}
                onOpenChange={(open) => {
                    if (!open && !f.isRemoving) f.setRemovingFormula(null)
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remove packing formula?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {f.removingFormula
                                ? `${f.removingFormula.itemName} (${f.removingFormula.itemSku}) will no longer have an active packing formula for future packing orders. Historical packing orders keep their saved material requirements.`
                                : ""}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={f.isRemoving}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={f.handleRemove} disabled={f.isRemoving}>
                            <Trash2 data-icon="inline-start" />
                            {f.isRemoving ? "Removing..." : "Remove formula"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}

export default function BomPage() {
    return (
        <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
            <PackingFormulasContent />
        </Suspense>
    )
}
