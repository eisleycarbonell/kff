"use client"
import dynamic from "next/dynamic"
import { PageHeader } from "@/components/shared/page-header"
import { RecordTable, type RecordColumn } from "@/components/shared/record-table"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useFeature } from "@/hooks/modules/reason-codes/use-reason-codes"
import type { RecordDto } from "@/components/modules/reason-codes/reason-code.schema"
const Form = dynamic(() => import("@/components/modules/reason-codes/reason-code-form"))
const columns: RecordColumn<RecordDto>[] = [
    { key: "codeName", label: "Code", value: (r) => String(r.codeName ?? "") },
    { key: "category", label: "Category", value: (r) => String(r.category ?? "") },
    { key: "description", label: "Description", value: (r) => String(r.description ?? "") },
    { key: "isActive", label: "Active", value: (r) => String(r.isActive ?? "") },
]
export default function Page() {
    const f = useFeature()
    return (
        <>
            <title>Reason Codes</title>
            <PageHeader
                title="Reason Codes"
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
                name="reason-codes"
                rows={f.rows}
                columns={columns}
                id={(r) => String(r.reasonId)}
                actions={f.canManage ? [{ label: "Edit", run: f.openForm }] : []}
            />
            {f.formRequested && (
                <Form
                    record={f.editing}
                    open={f.formOpen}
                    onOpenChange={f.setFormOpen}
                    busy={f.busy}
                    error={f.mutationError}
                    onSave={f.save}
                />
            )}
        </>
    )
}
