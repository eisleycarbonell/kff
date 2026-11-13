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
import { useFeature } from "@/hooks/modules/reorder-policies/use-reorder-policies"
import type { RecordDto } from "@/components/modules/reorder-policies/reorder-policy.schema"
const Form = dynamic(() => import("@/components/modules/reorder-policies/reorder-policy-form"))
const columns: RecordColumn<RecordDto>[] = [
    { key: "sku", label: "SKU", value: (r) => String(r.sku ?? "") },
    { key: "itemName", label: "Item", value: (r) => String(r.itemName ?? "") },
    { key: "reorderLevel", label: "Reorder level", value: (r) => String(r.reorderLevel ?? "") },
    { key: "primaryUomName", label: "Primary UOM", value: (r) => String(r.primaryUomName ?? "") },
]
export default function Page() {
    const f = useFeature()
    return (
        <>
            <title>Reorder Levels</title>
            <PageHeader
                title="Reorder Levels"
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
                name="reorder-policies"
                rows={f.rows}
                columns={columns}
                id={(r) => String(r.itemId)}
                actions={
                    f.canManage
                        ? [
                              { label: "Edit", run: f.openForm },
                              { label: "Use company default", run: f.setTarget },
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
                        <AlertDialogTitle>Use company default?</AlertDialogTitle>
                        <AlertDialogDescription>
                            The item will use the company default reorder level after removing its
                            override.
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
