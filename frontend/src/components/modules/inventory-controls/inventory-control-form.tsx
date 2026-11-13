"use client"
import { useState, useId, type FormEvent } from "react"
import {
    controlInputSchema,
    type ControlKind,
    type ControlInput,
    type ControlOptions,
} from "./inventory-control.schema"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { ChoiceField } from "@/components/shared/choice-field"
type Props = {
    kind: ControlKind
    open: boolean
    onOpenChange: (v: boolean) => void
    options: ControlOptions
    busy: boolean
    error?: string
    onSave: (v: ControlInput) => Promise<boolean>
}
function Content(p: Props) {
    const uid = useId()
    const [values, setValues] = useState({
        requestNumber: "",
        notes: "",
        evidenceReference: "",
        locationId: "",
        sourceLocationId: "",
        destinationLocationId: "",
        reasonId: "",
        lotId: "",
        itemId: "",
        quantity: "",
        newStatus: "Approved",
        effectiveDate: new Date().toISOString().slice(0, 10),
        changeType: "Replace",
    })
    const [lotIds, setLots] = useState<number[]>([]),
        [components, setComponents] = useState([{ componentItemId: 0, quantity: "", uomId: 0 }]),
        [validation, setValidation] = useState("")
    const change = (key: keyof typeof values, value: string) =>
        setValues((v) => ({ ...v, [key]: value }))
    const item = p.options.items.find((r) => r.itemId === Number(values.itemId)),
        lot = p.options.lots.find((r) => r.lotId === Number(values.lotId))
    const locations = p.options.locations.filter(
        (r) => r.isActive && r.locationType !== "In Transit",
    )
    const choices = locations.map((r) => ({
        value: String(r.locationId),
        label: r.name + " · " + r.locationType,
    }))
    const expected =
        p.options.stocks.find(
            (r) => r.lotId === lot?.lotId && r.locationId === Number(values.sourceLocationId),
        )?.qtyOnHand ?? "0.0000"
    function field(key: keyof typeof values, label: string, type = "text", required = true) {
        return (
            <Field>
                <FieldLabel htmlFor={uid + key}>{label}</FieldLabel>
                <Input
                    id={uid + key}
                    type={type}
                    value={values[key]}
                    required={required}
                    maxLength={key === "requestNumber" ? 40 : 2000}
                    onChange={(e) => change(key, e.target.value)}
                />
            </Field>
        )
    }
    async function submit(e: FormEvent) {
        e.preventDefault()
        if (p.busy) return
        const common = {
            kind: p.kind,
            requestNumber: values.requestNumber,
            notes: values.notes,
            evidenceReference: values.evidenceReference || null,
        }
        const raw =
            p.kind === "Count"
                ? {
                    ...common,
                    locationId: Number(values.locationId),
                    reasonId: Number(values.reasonId),
                    lotIds,
                }
                : p.kind === "Formula"
                    ? {
                        ...common,
                        itemId: Number(values.itemId),
                        effectiveDate: values.effectiveDate,
                        changeType: values.changeType,
                        components: values.changeType === "Retire" ? [] : components,
                    }
                    : p.kind === "QC"
                        ? {
                            ...common,
                            lotId: Number(values.lotId),
                            previousStatus: lot?.qcStatus,
                            newStatus: values.newStatus,
                        }
                        : {
                            ...common,
                            lotId: Number(values.lotId),
                            sourceLocationId: Number(values.sourceLocationId),
                            reasonId: Number(values.reasonId),
                            quantity: values.quantity,
                            expectedQty: expected,
                            ...(p.kind === "Disposition"
                                ? { destinationLocationId: Number(values.destinationLocationId) }
                                : {}),
                        }
        const parsed = controlInputSchema.safeParse(raw)
        if (!parsed.success) {
            setValidation(parsed.error.issues.map((r) => r.message).join(" "))
            return
        }
        setValidation("")
        await p.onSave(parsed.data)
    }
    return (
        <form onSubmit={submit} className="min-w-0 space-y-5">
            <fieldset disabled={p.busy} className="min-w-0 space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                    {field("requestNumber", "Request number")}
                    {field(
                        "evidenceReference",
                        "Evidence / document reference",
                        "text",
                        p.kind === "QC",
                    )}
                </div>
                {field("notes", "Preparation notes")}
                {p.kind === "Count" && (
                    <>
                        <ChoiceField
                            label="Count location"
                            value={values.locationId}
                            onChange={(v) => {
                                change("locationId", v)
                                setLots([])
                            }}
                            choices={choices}
                        />
                        <div className="space-y-2">
                            <p className="text-sm font-medium">Lots to count (up to 100)</p>
                            <p className="text-xs text-muted-foreground">
                                The saved request preserves balances at preparation. Enter
                                observations after creating it.
                            </p>
                            <div className="max-h-56 space-y-2 overflow-y-auto rounded border p-3">
                                {p.options.lots.map((r) => (
                                    <label
                                        key={r.lotId}
                                        className="flex items-center gap-2 text-sm"
                                    >
                                        <Checkbox
                                            checked={lotIds.includes(r.lotId)}
                                            onCheckedChange={(v) =>
                                                setLots((ids) =>
                                                    v === true
                                                        ? [...ids, r.lotId]
                                                        : ids.filter((id) => id !== r.lotId),
                                                )
                                            }
                                        />
                                        {r.lotNumber} ·{" "}
                                        {p.options.items.find((i) => i.itemId === r.itemId)?.name}
                                    </label>
                                ))}
                            </div>
                        </div>
                    </>
                )}
                {["Scrap", "Disposition", "QC"].includes(p.kind) && (
                    <ChoiceField
                        label="Lot"
                        value={values.lotId}
                        onChange={(v) => change("lotId", v)}
                        choices={p.options.lots.map((r) => ({
                            value: String(r.lotId),
                            label:
                                r.lotNumber +
                                " · " +
                                p.options.items.find((i) => i.itemId === r.itemId)?.name +
                                " · " +
                                r.qcStatus,
                        }))}
                    />
                )}
                {["Scrap", "Disposition"].includes(p.kind) && (
                    <>
                        <ChoiceField
                            label="Source location"
                            value={values.sourceLocationId}
                            onChange={(v) => change("sourceLocationId", v)}
                            choices={choices}
                        />
                        <p className="text-sm text-muted-foreground">
                            Expected on hand: {expected}{" "}
                            {p.options.items.find((i) => i.itemId === lot?.itemId)?.primaryUomName}.
                            Approval checks current reservations.
                        </p>
                        {field("quantity", "Quantity in primary UOM")}
                        {p.kind === "Disposition" && (
                            <ChoiceField
                                label="Destination"
                                value={values.destinationLocationId}
                                onChange={(v) => change("destinationLocationId", v)}
                                choices={choices.filter((r) => r.value !== values.sourceLocationId)}
                            />
                        )}
                    </>
                )}
                {["Count", "Scrap", "Disposition"].includes(p.kind) && (
                    <ChoiceField
                        label="Reason"
                        value={values.reasonId}
                        onChange={(v) => change("reasonId", v)}
                        choices={p.options.reasons
                            .filter(
                                (r) =>
                                    r.isActive &&
                                    (p.kind === "Count"
                                        ? r.category === "Inventory Adjustment"
                                        : r.category !== "Inventory Adjustment"),
                            )
                            .map((r) => ({
                                value: String(r.reasonId),
                                label: r.codeName + " · " + r.category,
                            }))}
                    />
                )}
                {p.kind === "QC" && (
                    <ChoiceField
                        label="New QC status"
                        value={values.newStatus}
                        onChange={(v) => change("newStatus", v)}
                        choices={["Quarantine", "Approved", "Rejected", "Expired"]
                            .filter((r) => r !== lot?.qcStatus)
                            .map((v) => ({ value: v, label: v }))}
                    />
                )}
                {p.kind === "Formula" && (
                    <>
                        <ChoiceField
                            label="Finished product"
                            value={values.itemId}
                            onChange={(v) => change("itemId", v)}
                            choices={p.options.items
                                .filter((r) => r.isActive && r.itemType === "Finished Good")
                                .map((r) => ({
                                    value: String(r.itemId),
                                    label: r.sku + " · " + r.name,
                                }))}
                        />
                        <p className="text-sm text-muted-foreground">
                            Requirements are for one {item?.primaryUomName ?? "primary unit"} of
                            finished product. Revision number is assigned by the server.
                        </p>
                        <div className="grid gap-4 sm:grid-cols-2">
                            {field("effectiveDate", "Effective date", "date")}
                            <ChoiceField
                                label="Change"
                                value={values.changeType}
                                onChange={(v) => change("changeType", v)}
                                choices={["Replace", "Retire"].map((v) => ({ value: v, label: v }))}
                            />
                        </div>
                        {values.changeType === "Replace" && (
                            <div className="space-y-3">
                                {components.map((row, index) => {
                                    const material = p.options.items.find(
                                        (r) => r.itemId === row.componentItemId,
                                    )
                                    return (
                                        <div
                                            key={index}
                                            className="grid gap-3 rounded border p-3 sm:grid-cols-2"
                                        >
                                            <ChoiceField
                                                label="Component"
                                                value={String(row.componentItemId || "")}
                                                onChange={(v) =>
                                                    setComponents((rows) =>
                                                        rows.map((r, i) =>
                                                            i === index
                                                                ? {
                                                                    ...r,
                                                                    componentItemId: Number(v),
                                                                    uomId: 0,
                                                                }
                                                                : r,
                                                        ),
                                                    )
                                                }
                                                choices={p.options.items
                                                    .filter(
                                                        (r) =>
                                                            r.isActive &&
                                                            r.itemType !== "Finished Good",
                                                    )
                                                    .map((r) => ({
                                                        value: String(r.itemId),
                                                        label: r.sku + " · " + r.name,
                                                    }))}
                                            />
                                            <ChoiceField
                                                label="Component UOM"
                                                value={String(row.uomId || "")}
                                                onChange={(v) =>
                                                    setComponents((rows) =>
                                                        rows.map((r, i) =>
                                                            i === index
                                                                ? { ...r, uomId: Number(v) }
                                                                : r,
                                                        ),
                                                    )
                                                }
                                                choices={p.options.uoms
                                                    .filter(
                                                        (r) =>
                                                            !material ||
                                                            r.uomClassId === material.uomClassId,
                                                    )
                                                    .map((r) => ({
                                                        value: String(r.uomId),
                                                        label: r.name,
                                                    }))}
                                            />
                                            <Field>
                                                <FieldLabel htmlFor={uid + "quantity" + index}>
                                                    Quantity per product unit
                                                </FieldLabel>
                                                <Input
                                                    id={uid + "quantity" + index}
                                                    value={row.quantity}
                                                    required
                                                    onChange={(e) =>
                                                        setComponents((rows) =>
                                                            rows.map((r, i) =>
                                                                i === index
                                                                    ? {
                                                                        ...r,
                                                                        quantity: e.target.value,
                                                                    }
                                                                    : r,
                                                            ),
                                                        )
                                                    }
                                                />
                                            </Field>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={() =>
                                                    setComponents((rows) =>
                                                        rows.filter((_, i) => i !== index),
                                                    )
                                                }
                                            >
                                                Remove component
                                            </Button>
                                        </div>
                                    )
                                })}
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() =>
                                        setComponents((rows) => [
                                            ...rows,
                                            { componentItemId: 0, quantity: "", uomId: 0 },
                                        ])
                                    }
                                >
                                    Add component
                                </Button>
                            </div>
                        )}
                        <p className="text-sm text-muted-foreground">
                            A different authorized reviewer releases this revision on or after the
                            effective date. Existing packing orders keep their saved requirements.
                        </p>
                    </>
                )}
            </fieldset>
            {(validation || p.error) && (
                <p role="alert" className="text-sm text-destructive">
                    {validation || p.error}
                </p>
            )}
            <DialogFooter>
                <Button
                    type="button"
                    variant="outline"
                    disabled={p.busy}
                    onClick={() => p.onOpenChange(false)}
                >
                    Cancel
                </Button>
                <Button disabled={p.busy}>{p.busy ? "Saving…" : "Create draft"}</Button>
            </DialogFooter>
        </form>
    )
}
export default function ControlForm(p: Props) {
    return (
        <Dialog
            open={p.open}
            onOpenChange={(v) => {
                if (!p.busy) p.onOpenChange(v)
            }}
        >
            <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-x-hidden overflow-y-auto sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Prepare {p.kind.toLowerCase()} request</DialogTitle>
                    <DialogDescription>
                        Save the preparation, then submit it for independent review.
                    </DialogDescription>
                </DialogHeader>
                {p.open && <Content {...p} />}
            </DialogContent>
        </Dialog>
    )
}
