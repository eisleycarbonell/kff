"use client"

import dynamic from "next/dynamic"
import { useState } from "react"
import { Download, Upload } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { BulkImportModuleKey } from "@/lib/module-bulk-imports"

const BulkImportDialog = dynamic(
    () => import("./bulk-import-dialog").then((mod) => mod.BulkImportDialog),
    { ssr: false },
)

export type BulkImportActionsProps = {
    moduleKey: BulkImportModuleKey
    canManage?: boolean
    disabled?: boolean
    onCompleted?: () => void
}

export function BulkImportActions({
    moduleKey,
    canManage = true,
    disabled = false,
    onCompleted,
}: BulkImportActionsProps) {
    const [open, setOpen] = useState(false)
    const [dialogMounted, setDialogMounted] = useState(false)
    const [downloading, setDownloading] = useState(false)

    if (!canManage) return null

    async function handleDownloadTemplate() {
        if (downloading) return
        setDownloading(true)
        try {
            const { downloadModuleTemplate } = await import("@/lib/module-bulk-imports")
            downloadModuleTemplate(moduleKey)
        } finally {
            setDownloading(false)
        }
    }

    return (
        <>
            <Button
                type="button"
                variant="outline"
                className="h-10 gap-2 px-3"
                disabled={disabled || downloading}
                onClick={() => void handleDownloadTemplate()}
            >
                <Download className="size-4" />
                Download template
            </Button>
            <Button
                type="button"
                variant="outline"
                className="h-10 gap-2 px-3"
                disabled={disabled}
                onClick={() => {
                    setDialogMounted(true)
                    setOpen(true)
                }}
            >
                <Upload className="size-4" />
                Import CSV
            </Button>

            {dialogMounted ? (
                <BulkImportDialog
                    moduleKey={moduleKey}
                    open={open}
                    onOpenChange={setOpen}
                    onCompleted={onCompleted}
                />
            ) : null}
        </>
    )
}
