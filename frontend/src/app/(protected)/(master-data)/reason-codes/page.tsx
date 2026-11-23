"use client"

import dynamic from "next/dynamic"
import Link from "next/link"
import { Plus } from "lucide-react"
import { BulkImportActions } from "@/components/shared/bulk-import-actions"
import { PageHeader } from "@/components/shared/page-header"
import { RecordTable, type RecordColumn } from "@/components/shared/record-table"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useFeature } from "@/hooks/modules/reason-codes/use-reason-codes"
import type { RecordDto } from "@/components/modules/reason-codes/reason-code.schema"

const Form = dynamic(() => import("@/components/modules/reason-codes/reason-code-form"))

const columns: RecordColumn<RecordDto>[] = [
    { key: "codeName", label: "Reason code", value: (r) => r.codeName },
    { key: "category", label: "Category", value: (r) => r.category },
    { key: "description", label: "Description", value: (r) => r.description ?? "" },
    { key: "isActive", label: "Status", value: (r) => (r.isActive ? "Active" : "Inactive") },
]

export default function Page() {
    const f = useFeature()
    const totalCount = f.rows.length
    const activeCount = f.rows.filter((r) => r.isActive).length
    const adjustmentCount = f.rows.filter((r) => r.category === "Inventory Adjustment").length
    const scrapCount = totalCount - adjustmentCount

    return (
        <>
            <title>Reason Codes</title>
            <meta
                name="description"
                content="Configure reason codes for stock adjustments and scrap disposals."
            />
            <PageHeader
                title="Reason Codes"
                description="Configure active Inventory Adjustment reasons for stock corrections and non-adjustment reasons for scrap and disposal."
                actions={
                    f.canManage ? (
                        <>
                            <BulkImportActions moduleKey="reason-codes" disabled={f.busy} />
                            <Button className="gap-2" onClick={() => f.openForm()} disabled={f.busy}>
                                <Plus className="size-4" />
                                Add reason code
                            </Button>
                        </>
                    ) : undefined
                }
            />
            {f.loadStatus === "signed-out" && (
                <Alert>
                    <AlertTitle>Sign in to view reason codes</AlertTitle>
                    <AlertDescription>
                        <Button className="mt-2" render={<Link href="/" />} nativeButton={false}>
                            Sign in
                        </Button>
                    </AlertDescription>
                </Alert>
            )}
            {f.error && f.loadStatus !== "signed-out" && (
                <Alert variant="destructive">
                    <AlertTitle>
                        {f.loadStatus === "ready"
                            ? "Unable to refresh reason codes"
                            : "Unable to load reason codes"}
                    </AlertTitle>
                    <AlertDescription>
                        <p>{f.error.message}</p>
                        {f.loadStatus === "ready" && (
                            <p>Showing the last loaded reason code records.</p>
                        )}
                        <Button
                            variant="outline"
                            className="mt-2"
                            onClick={f.refresh}
                            disabled={f.isFetching}
                        >
                            {f.isFetching ? "Retrying..." : "Retry"}
                        </Button>
                    </AlertDescription>
                </Alert>
            )}
            {f.loadStatus === "loading" && <Skeleton className="h-64" />}
            {f.loadStatus === "ready" && (
                <>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="rounded-xl border bg-card p-3.5">
                            <p className="text-xs font-medium text-muted-foreground">Total reason codes</p>
                            <p className="mt-1 text-xl font-semibold sm:text-2xl">{totalCount}</p>
                        </div>
                        <div className="rounded-xl border bg-card p-3.5">
                            <p className="text-xs font-medium text-muted-foreground">Active codes</p>
                            <p className="mt-1 text-xl font-semibold sm:text-2xl">{activeCount}</p>
                        </div>
                        <div className="rounded-xl border bg-card p-3.5">
                            <p className="text-xs font-medium text-muted-foreground">Inventory Adjustment</p>
                            <p className="mt-1 text-xl font-semibold sm:text-2xl">{adjustmentCount}</p>
                        </div>
                        <div className="rounded-xl border bg-card p-3.5">
                            <p className="text-xs font-medium text-muted-foreground">Scrap &amp; Disposal</p>
                            <p className="mt-1 text-xl font-semibold sm:text-2xl">{scrapCount}</p>
                        </div>
                    </div>
                    <RecordTable
                        name="reason-codes"
                        rows={f.rows}
                        columns={columns}
                        id={(r) => String(r.reasonId)}
                        actions={
                            f.canManage
                                ? [
                                      {
                                          label: "Edit",
                                          run: f.openForm,
                                          disabled: () => f.busy,
                                      },
                                      {
                                          label: "Deactivate",
                                          run: (r) => void f.toggleActive(r),
                                          disabled: (r) => f.busy || !r.isActive,
                                      },
                                      {
                                          label: "Activate",
                                          run: (r) => void f.toggleActive(r),
                                          disabled: (r) => f.busy || r.isActive,
                                      },
                                  ]
                                : []
                        }
                    />
                </>
            )}
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
