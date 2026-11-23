"use client"

import { useRef, useState, type ChangeEvent } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Toast } from "@base-ui/react/toast"
import {
    AlertCircle,
    CheckCircle2,
    Download,
    FileSpreadsheet,
    Loader2,
} from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { getCsvValue, normalizeCsvKey, parseCsvRecords } from "@/lib/csv-import"
import { invalidateInventoryAvailability } from "@/lib/inventory-query-cache"
import {
    downloadModuleTemplate,
    MODULE_BULK_IMPORTS,
    type BulkImportModuleKey,
    type BulkImportResult,
} from "@/lib/module-bulk-imports"

export type BulkImportDialogProps = {
    moduleKey: BulkImportModuleKey
    open: boolean
    onOpenChange: (open: boolean) => void
    onCompleted?: () => void
}

export function BulkImportDialog({
    moduleKey,
    open,
    onOpenChange,
    onCompleted,
}: BulkImportDialogProps) {
    const config = MODULE_BULK_IMPORTS[moduleKey]
    const queryClient = useQueryClient()
    const { add: showToast } = Toast.useToastManager()
    const fileInputRef = useRef<HTMLInputElement>(null)

    const [fileName, setFileName] = useState("")
    const [headers, setHeaders] = useState<string[]>([])
    const [rows, setRows] = useState<Record<string, string>[]>([])
    const [parseError, setParseError] = useState<string | null>(null)
    const [importing, setImporting] = useState(false)
    const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
    const [result, setResult] = useState<BulkImportResult | null>(null)

    const normalizedHeaderSet = new Set(headers.map(normalizeCsvKey))
    const missingRequiredColumns =
        headers.length > 0
            ? config.columns.filter(
                (col) => col.required && !normalizedHeaderSet.has(normalizeCsvKey(col.key)),
            )
            : []

    function resetSelection() {
        setFileName("")
        setHeaders([])
        setRows([])
        setParseError(null)
        setProgress(null)
        setResult(null)
        if (fileInputRef.current) fileInputRef.current.value = ""
    }

    function handleOpenChange(nextOpen: boolean) {
        if (importing) return
        onOpenChange(nextOpen)
        if (!nextOpen) resetSelection()
    }

    async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0]
        if (!file) return

        setParseError(null)
        setResult(null)
        setProgress(null)
        setFileName(file.name)

        try {
            const text = await file.text()
            const parsed = parseCsvRecords(text)
            if (parsed.headers.length === 0) {
                setHeaders([])
                setRows([])
                setParseError("The selected CSV file is empty.")
                return
            }
            if (parsed.rows.length === 0) {
                setHeaders(parsed.headers)
                setRows([])
                setParseError("No data rows were found below the CSV header row.")
                return
            }
            setHeaders(parsed.headers)
            setRows(parsed.rows)
        } catch (error) {
            setHeaders([])
            setRows([])
            setParseError(
                error instanceof Error ? error.message : "Unable to read the selected CSV file.",
            )
        }
    }

    async function handleRunImport() {
        if (rows.length === 0 || missingRequiredColumns.length > 0 || importing) return

        setImporting(true)
        setResult(null)
        setProgress({ done: 0, total: rows.length })

        try {
            const outcome = await config.runImport(rows, (done, total) => {
                setProgress({ done, total })
            })
            setResult(outcome)

            await Promise.all([
                invalidateInventoryAvailability(queryClient),
                ...config.queryKeys.map((prefix) =>
                    queryClient.invalidateQueries({ queryKey: [prefix] }),
                ),
            ])
            onCompleted?.()

            const summaryParts: string[] = []
            if (outcome.created > 0) summaryParts.push(`${outcome.created} created`)
            if (outcome.updated > 0) summaryParts.push(`${outcome.updated} updated`)
            if (outcome.errors.length > 0) summaryParts.push(`${outcome.errors.length} failed`)
            const description = summaryParts.join(", ") || "No changes recorded."

            if (outcome.errors.length > 0 && outcome.created === 0 && outcome.updated === 0) {
                showToast({
                    type: "error",
                    title: `${config.title} import failed`,
                    description,
                })
            } else if (outcome.errors.length > 0) {
                showToast({
                    type: "warning",
                    title: `${config.title} partially imported`,
                    description,
                })
            } else {
                showToast({
                    type: "success",
                    title: `${config.title} imported`,
                    description,
                })
            }
        } catch (error) {
            const message =
                error instanceof Error ? error.message : "Bulk import could not be completed."
            setResult({
                created: 0,
                updated: 0,
                errors: [{ row: 0, key: "Import", message }],
            })
            showToast({
                type: "error",
                title: `${config.title} import failed`,
                description: message,
            })
        } finally {
            setImporting(false)
        }
    }

    const previewHeaders = config.columns.map((col) => col.key)
    const previewRows = rows.slice(0, 5)

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
                <DialogHeader>
                    <div className="flex flex-wrap items-center gap-2 pr-6">
                        <DialogTitle>Import {config.title}</DialogTitle>
                        <Badge variant="secondary">
                            {config.supportsUpdate ? "Create & Update" : "Bulk Create"}
                        </Badge>
                    </div>
                    <DialogDescription>{config.description}</DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="rounded-lg border bg-muted/30 p-3 text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-medium text-foreground">
                                Expected CSV columns ({config.columns.length})
                            </span>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 gap-1.5 px-2 text-xs"
                                onClick={() => downloadModuleTemplate(moduleKey)}
                            >
                                <Download className="size-3.5" />
                                {config.templateFilename}
                            </Button>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                            {config.columns.map((column) => (
                                <Badge
                                    key={column.key}
                                    variant={column.required ? "default" : "outline"}
                                    title={column.description}
                                    className="font-mono text-[11px]"
                                >
                                    {column.key}
                                    {column.required ? " *" : ""}
                                </Badge>
                            ))}
                        </div>
                        <p className="mt-2 text-muted-foreground">
                            Columns marked with <span className="font-semibold">*</span> are
                            required. Column headers are matched case-insensitively.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed p-4">
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".csv,text/csv"
                            className="sr-only"
                            onChange={(event) => void handleFileChange(event)}
                        />
                        <div className="flex min-w-0 items-center gap-3">
                            <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
                                <FileSpreadsheet className="size-4 text-muted-foreground" />
                            </div>
                            <div className="min-w-0">
                                <p className="truncate text-sm font-medium">
                                    {fileName || "No CSV file selected"}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {rows.length > 0
                                        ? `${rows.length} row(s) parsed and ready`
                                        : "Select a .csv file exported from Excel, Google Sheets, or the template."}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {fileName && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    disabled={importing}
                                    onClick={resetSelection}
                                >
                                    Clear
                                </Button>
                            )}
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={importing}
                                onClick={() => fileInputRef.current?.click()}
                            >
                                {fileName ? "Choose another file" : "Choose CSV file"}
                            </Button>
                        </div>
                    </div>

                    {parseError && (
                        <Alert variant="destructive">
                            <AlertCircle className="size-4" />
                            <AlertTitle>Invalid CSV file</AlertTitle>
                            <AlertDescription>{parseError}</AlertDescription>
                        </Alert>
                    )}

                    {missingRequiredColumns.length > 0 && (
                        <Alert variant="destructive">
                            <AlertCircle className="size-4" />
                            <AlertTitle>Missing required column(s)</AlertTitle>
                            <AlertDescription>
                                Add:{" "}
                                {missingRequiredColumns
                                    .map((col) => `${col.key} (${col.label})`)
                                    .join(", ")}
                            </AlertDescription>
                        </Alert>
                    )}

                    {previewRows.length > 0 && (
                        <div className="space-y-1.5">
                            <p className="text-xs font-medium text-muted-foreground">
                                Preview (first {previewRows.length} of {rows.length} row
                                {rows.length === 1 ? "" : "s"})
                            </p>
                            <div className="max-h-56 overflow-auto rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-12">#</TableHead>
                                            {previewHeaders.map((header) => (
                                                <TableHead
                                                    key={header}
                                                    className="whitespace-nowrap font-mono text-xs"
                                                >
                                                    {header}
                                                </TableHead>
                                            ))}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {previewRows.map((row, index) => (
                                            <TableRow key={index}>
                                                <TableCell className="text-xs text-muted-foreground">
                                                    {index + 2}
                                                </TableCell>
                                                {previewHeaders.map((header) => (
                                                    <TableCell
                                                        key={header}
                                                        className="max-w-44 truncate text-xs"
                                                        title={getCsvValue(row, header)}
                                                    >
                                                        {getCsvValue(row, header) || "—"}
                                                    </TableCell>
                                                ))}
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    )}

                    {importing && progress && (
                        <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-xs">
                            <Loader2 className="size-4 animate-spin" />
                            <span>
                                Processing {progress.done} of {progress.total}...
                            </span>
                        </div>
                    )}

                    {result && (
                        <Alert
                            variant={
                                result.errors.length > 0 &&
                                result.created === 0 &&
                                result.updated === 0
                                    ? "destructive"
                                    : "default"
                            }
                        >
                            {result.errors.length === 0 ? (
                                <CheckCircle2 className="size-4" />
                            ) : (
                                <AlertCircle className="size-4" />
                            )}
                            <AlertTitle>
                                Import complete — {result.created} created, {result.updated}{" "}
                                updated
                                {result.errors.length > 0
                                    ? `, ${result.errors.length} failed`
                                    : ""}
                            </AlertTitle>
                            {result.errors.length > 0 && (
                                <AlertDescription>
                                    <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs">
                                        {result.errors.map((err, idx) => (
                                            <li key={`${err.row}-${idx}`}>
                                                <span className="font-medium">
                                                    Row {err.row}
                                                    {err.key ? ` (${err.key})` : ""}:
                                                </span>{" "}
                                                {err.message}
                                            </li>
                                        ))}
                                    </ul>
                                </AlertDescription>
                            )}
                        </Alert>
                    )}
                </div>

                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        disabled={importing}
                        onClick={() => handleOpenChange(false)}
                    >
                        Close
                    </Button>
                    <Button
                        type="button"
                        disabled={
                            importing ||
                            rows.length === 0 ||
                            missingRequiredColumns.length > 0
                        }
                        onClick={() => void handleRunImport()}
                    >
                        {importing ? (
                            <>
                                <Loader2 className="size-4 animate-spin" />
                                Importing...
                            </>
                        ) : (
                            `Import ${rows.length} row${rows.length === 1 ? "" : "s"}`
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
