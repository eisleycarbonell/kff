"use client"
import { useState } from "react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { RecordTable } from "@/components/shared/record-table"
import type { ControlDetail, ControlOptions, ControlAction } from "./inventory-control.schema"
type Props = {
    detail?: ControlDetail
    options?: ControlOptions
    userId?: number
    open: boolean
    onClose: () => void
    busy: boolean
    canManage: boolean
    canReview: boolean
    error?: string
    onAction: (id: number, action: ControlAction, note: string) => Promise<unknown>
    onObserve: (
        id: number,
        rows: { observationId: number; countedQty: string }[],
    ) => Promise<unknown>
}
function Content(p: Props & { detail: ControlDetail }) {
    const d = p.detail,
        [note, setNote] = useState(""),
        [counts, setCounts] = useState<Record<number, string>>({}),
        [error, setError] = useState("")
    const dirty = d.observations.some(
        (r) => counts[r.observationId] !== undefined && counts[r.observationId] !== r.countedQty,
    )
    const maker = p.canManage && p.userId === d.createdBy
    const reviewer = p.canReview && p.userId !== d.createdBy && p.userId !== d.submittedBy
    const disposalLot = p.options?.lots.find((row) => row.lotId === d.disposal?.lotId)
    const disposalItem = p.options?.items.find((row) => row.itemId === disposalLot?.itemId)
    const qcLot = p.options?.lots.find((row) => row.lotId === d.qc?.lotId)
    async function act(action: ControlAction) {
        if (note.trim().length < 3) {
            setError("Add an action note of at least three characters.")
            return
        }
        try {
            await p.onAction(d.requestId, action, note)
            setError("")
            setNote("")
        } catch (e) {
            setError((e as Error).message)
        }
    }
    return (
        <div className="space-y-5">
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                    <dt className="text-muted-foreground">Status</dt>
                    <dd>{d.status}</dd>
                </div>
                <div>
                    <dt className="text-muted-foreground">Prepared by user</dt>
                    <dd>{d.createdBy}</dd>
                </div>
                <div>
                    <dt className="text-muted-foreground">Preparation notes</dt>
                    <dd className="whitespace-pre-wrap">{d.notes}</dd>
                </div>
                <div>
                    <dt className="text-muted-foreground">Evidence reference</dt>
                    <dd>{d.evidenceReference ?? "None recorded"}</dd>
                </div>
            </dl>
            {d.count && (
                <p className="text-sm">
                    Location:{" "}
                    {p.options?.locations.find((r) => r.locationId === d.count?.locationId)?.name} ·
                    Reason:{" "}
                    {p.options?.reasons.find((r) => r.reasonId === d.count?.reasonId)?.codeName}
                </p>
            )}
            {d.observations.length > 0 && (
                <div className="space-y-3">
                    <h3 className="font-medium">Preserved count observations</h3>
                    {dirty && (
                        <p className="text-sm text-muted-foreground">
                            Save changed observations before submitting.
                        </p>
                    )}
                    {d.observations.map((r) => (
                        <Field key={r.observationId}>
                            <FieldLabel htmlFor={"count-" + r.observationId}>
                                {r.lotNumber} · {r.sku} · expected {r.expectedQty}{" "}
                                {r.primaryUomName}
                            </FieldLabel>
                            <Input
                                id={"count-" + r.observationId}
                                value={counts[r.observationId] ?? r.countedQty ?? ""}
                                onChange={(e) =>
                                    setCounts((v) => ({ ...v, [r.observationId]: e.target.value }))
                                }
                                disabled={p.busy || !maker || d.status !== "Draft"}
                                placeholder={"Count in " + r.primaryUomName}
                            />
                            <p className="text-xs text-muted-foreground">
                                {r.observedAt
                                    ? "Observed by user " + r.observedBy + " at " + r.observedAt
                                    : "Not yet observed"}
                            </p>
                        </Field>
                    ))}
                    {maker && d.status === "Draft" && (
                        <Button
                            disabled={p.busy}
                            onClick={async () => {
                                const rows = d.observations.map((r) => ({
                                    observationId: r.observationId,
                                    countedQty: counts[r.observationId] ?? r.countedQty ?? "",
                                }))
                                if (
                                    rows.some((r) => !/^\d{1,10}(?:\.\d{1,4})?$/.test(r.countedQty))
                                ) {
                                    setError(
                                        "Enter every count as a nonnegative decimal with up to four places.",
                                    )
                                    return
                                }
                                try {
                                    await p.onObserve(d.requestId, rows)
                                    setCounts({})
                                    setError("")
                                } catch (e) {
                                    setError((e as Error).message)
                                }
                            }}
                        >
                            Save observations
                        </Button>
                    )}
                </div>
            )}
            {d.disposal && (
                <p className="text-sm">
                    Lot {disposalLot?.lotNumber} · {disposalItem?.name} · {d.disposal.quantity}{" "}
                    {disposalItem?.primaryUomName} · expected {d.disposal.expectedQty}{" "}
                    {disposalItem?.primaryUomName} at{" "}
                    {
                        p.options?.locations.find(
                            (r) => r.locationId === d.disposal?.sourceLocationId,
                        )?.name
                    }
                    {d.disposal.destinationLocationId
                        ? " → " +
                          p.options?.locations.find(
                              (r) => r.locationId === d.disposal?.destinationLocationId,
                          )?.name
                        : ""}{" "}
                    · reason{" "}
                    {p.options?.reasons.find((r) => r.reasonId === d.disposal?.reasonId)?.codeName}
                </p>
            )}
            {d.qc && (
                <p className="text-sm">
                    Lot {qcLot?.lotNumber}: {d.qc.previousStatus} → {d.qc.newStatus}
                    {" · Current status: "}
                    {qcLot?.qcStatus}
                    {" · Expiry: "}
                    {qcLot?.expirationDate ?? "Undated"}
                </p>
            )}
            {d.formula && (
                <p className="text-sm">
                    {p.options?.items.find((r) => r.itemId === d.formula?.itemId)?.name} · Revision{" "}
                    {d.formula.revisionNumber} · {d.formula.changeType} · effective{" "}
                    {d.formula.effectiveDate}
                </p>
            )}
            {d.materials.length > 0 && (
                <RecordTable
                    name="revision-materials"
                    rows={d.materials}
                    id={(r) => String(r.materialId)}
                    columns={[
                        {
                            key: "sku",
                            label: "Component",
                            value: (r) => r.sku + " · " + r.itemName,
                        },
                        {
                            key: "quantity",
                            label: "Quantity per product unit",
                            value: (r) => r.quantity + " " + r.uomName,
                        },
                    ]}
                />
            )}
            {((maker && ["Draft", "Submitted", "Rejected"].includes(d.status)) ||
                (reviewer && d.status === "Submitted")) && (
                <div className="space-y-3 rounded border p-4">
                    <Field>
                        <FieldLabel htmlFor="review-note">Action / review note</FieldLabel>
                        <Input
                            id="review-note"
                            value={note}
                            maxLength={2000}
                            disabled={p.busy}
                            onChange={(e) => setNote(e.target.value)}
                        />
                    </Field>
                    <div className="flex flex-wrap gap-2">
                        {maker && d.status === "Draft" && (
                            <Button disabled={p.busy || dirty} onClick={() => void act("submit")}>
                                Submit for review
                            </Button>
                        )}
                        {reviewer && d.status === "Submitted" && (
                            <>
                                <Button disabled={p.busy} onClick={() => void act("approve")}>
                                    Approve and apply
                                </Button>
                                <Button
                                    variant="outline"
                                    disabled={p.busy}
                                    onClick={() => void act("reject")}
                                >
                                    Reject
                                </Button>
                            </>
                        )}
                        {maker && d.status === "Rejected" && (
                            <Button disabled={p.busy} onClick={() => void act("reopen")}>
                                Reopen with fresh snapshot
                            </Button>
                        )}
                        {maker && ["Draft", "Submitted", "Rejected"].includes(d.status) && (
                            <Button
                                variant="outline"
                                disabled={p.busy}
                                onClick={() => void act("cancel")}
                            >
                                Cancel request
                            </Button>
                        )}
                    </div>
                </div>
            )}
            {d.reviewedBy && (
                <p className="text-sm">
                    Reviewed by user {d.reviewedBy} at {d.reviewedAt}: {d.reviewNote}
                </p>
            )}
            {(error || p.error) && (
                <p role="alert" className="text-sm text-destructive">
                    {error || p.error}
                </p>
            )}
            <h3 className="font-medium">Action history</h3>
            <div className="space-y-2">
                {d.events.map((e) => (
                    <div className="rounded border p-3 text-sm" key={e.eventId}>
                        <p>
                            {e.action} · user {e.actorId} · {e.createdAt}
                        </p>
                        <p className="text-muted-foreground">{e.note}</p>
                        {Object.keys(e.details).length > 0 && (
                            <details>
                                <summary>Preserved observations / prior snapshot</summary>
                                <pre className="max-h-48 overflow-auto whitespace-pre-wrap text-xs">
                                    {JSON.stringify(e.details, null, 2)}
                                </pre>
                            </details>
                        )}
                    </div>
                ))}
            </div>
        </div>
    )
}
export default function ControlDetailDialog(p: Props) {
    return (
        <Dialog
            open={p.open}
            onOpenChange={(v) => {
                if (!v && !p.busy) p.onClose()
            }}
        >
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
                <DialogHeader>
                    <DialogTitle>{p.detail?.requestNumber ?? "Request details"}</DialogTitle>
                    <DialogDescription>
                        Review preparation, saved evidence and workflow history.
                    </DialogDescription>
                </DialogHeader>
                {p.detail ? (
                    <Content key={p.detail.requestId} {...p} detail={p.detail} />
                ) : (
                    <p role={p.error ? "alert" : "status"}>{p.error ?? "Loading request…"}</p>
                )}
            </DialogContent>
        </Dialog>
    )
}
