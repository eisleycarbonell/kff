"use client"
import dynamic from "next/dynamic"
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogDescription,
    AlertDialogFooter,
} from "@/components/ui/alert-dialog"
import { PageHeader } from "@/components/shared/page-header"
import { RecordTable, type RecordColumn } from "@/components/shared/record-table"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useFeature } from "@/hooks/modules/item-packaging/use-item-packaging"
import type { RecordDto } from "@/components/modules/item-packaging/item-package.schema"
const Form = dynamic(() => import("@/components/modules/item-packaging/item-package-form"))
const columns: RecordColumn<RecordDto>[] = [
    { key: "sku", label: "SKU", value: (r) => String(r.sku ?? "") },
    { key: "itemName", label: "Item", value: (r) => String(r.itemName ?? "") },
    { key: "uomName", label: "Pack UOM", value: (r) => String(r.uomName ?? "") },
    { key: "baseQty", label: "Primary units per pack", value: (r) => String(r.baseQty ?? "") },
    { key: "primaryUomName", label: "Primary UOM", value: (r) => String(r.primaryUomName ?? "") },
    { key: "barcode", label: "Barcode", value: (r) => String(r.barcode ?? "") },
    { key: "grossWeightG", label: "Gross weight (g)", value: (r) => String(r.grossWeightG ?? "") },
    { key: "isInUse", label: "In use", value: (r) => String(r.isInUse ?? "") },
]
export default function Page() {
    const f = useFeature()
    return (
        <>
            <title>Item Packaging</title>
            <PageHeader
                title="Item Packaging"
                description="Maintain the data used by operational workflows and reports."
                actions={
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={f.refresh}>
                            Refresh
                        </Button>
                        {f.canManage && <Button onClick={() => f.openForm()}>Add record</Button>}
                    </div>
                }
            />
            <div className="rounded-xl border bg-card p-5">
                <p className="text-sm text-muted-foreground">Configured records</p>
                <p className="text-3xl font-semibold">{f.rows.length}</p>
            </div>
            {f.error && (
                <p role="alert" className="text-destructive">
                    {f.error.message}
                    <Button onClick={f.refresh}>Retry</Button>
                </p>
            )}
            {f.loadStatus === "signed-out" && <p>Sign in to view records.</p>}
            {f.loadStatus === "loading" && <Skeleton className="h-64" />}
            <RecordTable
                name="item-packaging"
                rows={f.rows}
                columns={columns}
                id={(r) => String(r.packagingId)}
                actions={
                    f.canManage
                        ? [
                              { label: "Edit", run: f.openForm },
                              {
                                  label: "Delete unused packaging",
                                  run: f.setTarget,
                                  disabled: (r) => r.isInUse,
                              },
                          ]
                        : []
                }
            />
            {f.optionsLoading && <p role="status">Loading form options...</p>}
            {f.formRequested && f.options && (
                <Form
                    record={f.editing}
                    options={f.options}
                    open={f.formOpen}
                    onOpenChange={f.setFormOpen}
                    busy={f.busy}
                    error={f.mutationError}
                    onSave={f.save}
                />
            )}
            <AlertDialog
                open={Boolean(f.target)}
                onOpenChange={(open) => {
                    if (!open && !f.busy) f.setTarget(null)
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete unused packaging?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Only an unused item packaging conversion can be removed. Referenced
                            conversions remain protected.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    {f.removalError && (
                        <p role="alert" className="text-destructive">
                            {f.removalError}
                        </p>
                    )}
                    <AlertDialogFooter>
                        <Button
                            variant="outline"
                            disabled={f.busy}
                            onClick={() => f.setTarget(null)}
                        >
                            Cancel
                        </Button>
                        <Button
                            disabled={f.busy}
                            onClick={() => {
                                void f.remove().catch(() => {})
                            }}
                        >
                            {f.busy ? "Saving…" : "Confirm"}
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
