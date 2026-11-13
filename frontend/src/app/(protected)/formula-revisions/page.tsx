"use client"
import dynamic from "next/dynamic"
import { PageHeader } from "@/components/shared/page-header"
import { RecordTable, type RecordColumn } from "@/components/shared/record-table"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useInventoryControls } from "@/hooks/modules/inventory-controls/use-inventory-controls"
import {
    LABELS,
    type Control,
} from "@/components/modules/inventory-controls/inventory-control.schema"
const Form = dynamic(() => import("@/components/modules/inventory-controls/inventory-control-form"))
const Detail = dynamic(
    () => import("@/components/modules/inventory-controls/inventory-control-detail"),
)
const columns: RecordColumn<Control>[] = [
    { key: "request", label: "Request", value: (r) => r.requestNumber },
    { key: "status", label: "Status", value: (r) => r.status },
    { key: "notes", label: "Notes", value: (r) => r.notes },
    { key: "created", label: "Prepared", value: (r) => r.createdAt },
    { key: "review", label: "Review note", value: (r) => r.reviewNote ?? "" },
]
export default function Page() {
    const f = useInventoryControls("Formula")
    return (
        <>
            <title>{LABELS.Formula}</title>
            <PageHeader
                title={LABELS.Formula}
                description="Prepare requests, preserve evidence and apply approved changes with a separate reviewer."
                actions={
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={f.refresh}>
                            Refresh
                        </Button>
                        {f.canManage && (
                            <Button onClick={() => f.openForm()}>Prepare request</Button>
                        )}
                    </div>
                }
            />
            <div className="grid gap-4 sm:grid-cols-3">
                {[
                    ["Requests", f.rows.length],
                    ["Awaiting review", f.rows.filter((r) => r.status === "Submitted").length],
                    ["Approved", f.rows.filter((r) => r.status === "Approved").length],
                ].map(([label, value]) => (
                    <div className="rounded-xl border bg-card p-5" key={label}>
                        <p className="text-sm text-muted-foreground">{label}</p>
                        <p className="text-3xl font-semibold">{value}</p>
                    </div>
                ))}
            </div>
            <p className="text-sm text-muted-foreground">
                Approval requires a different user with the operational permission and
                user-management permission. Approved and cancelled requests are final. Reject and
                reopen a stale request to take a fresh snapshot.
            </p>
            {f.error && (
                <p role="alert" className="text-destructive">
                    {f.error.message} <Button onClick={f.refresh}>Retry</Button>
                </p>
            )}
            {f.loadStatus === "signed-out" && <p>Sign in to view requests.</p>}
            {f.loadStatus === "loading" && <Skeleton className="h-64" />}
            <RecordTable
                name="Formula-requests"
                rows={f.rows}
                id={(r) => String(r.requestId)}
                columns={columns}
                actions={[{ label: "View / review", run: (r) => f.setDetailId(r.requestId) }]}
            />
            {f.formRequested && f.options && (
                <Form
                    kind={f.kind}
                    open={f.formOpen}
                    onOpenChange={f.setFormOpen}
                    options={f.options}
                    busy={f.busy}
                    error={f.errorMessage}
                    onSave={f.save}
                />
            )}{" "}
            {f.detailId && (
                <Detail
                    open
                    detail={f.detail}
                    options={f.options}
                    userId={f.session?.userId}
                    busy={f.busy}
                    canManage={f.canManage}
                    canReview={f.canReview}
                    error={f.detailError?.message ?? f.errorMessage}
                    onClose={() => f.setDetailId(null)}
                    onAction={f.action}
                    onObserve={f.observe}
                />
            )}
        </>
    )
}
