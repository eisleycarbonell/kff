"use client"
import dynamic from "next/dynamic"
import { BulkImportActions } from "@/components/shared/bulk-import-actions"
import { PageHeader } from "@/components/shared/page-header"
import { Skeleton } from "@/components/ui/skeleton"
import { useCompanySettings } from "@/hooks/modules/company-settings/use-company-settings"
const Form = dynamic(() => import("@/components/modules/company-settings/company-setting-form"))
export default function Page() {
    const f = useCompanySettings()
    return (
        <>
            <title>Company Settings</title>
            <PageHeader
                title="Company Settings"
                description="Company identity, currency and stock alert defaults."
                actions={
                    f.canManage ? (
                        <BulkImportActions moduleKey="company-settings" disabled={f.busy} />
                    ) : undefined
                }
            />
            {f.error && <p role="alert">{f.error.message}</p>}
            {f.loadStatus === "loading" && <Skeleton className="h-64" />}
            {f.loadStatus === "signed-out" && <p>Sign in to view settings.</p>}
            {f.settings && (
                <Form
                    key={f.settings.version}
                    settings={f.settings}
                    busy={f.busy}
                    error={f.mutationError}
                    canManage={f.canManage}
                    onSave={f.save}
                />
            )}
        </>
    )
}
