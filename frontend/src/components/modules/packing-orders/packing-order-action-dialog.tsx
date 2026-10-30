"use client"

import { useId, useState, type FormEvent } from "react"
import { z } from "zod"
import {
    comparePackingDecimals,
    decimalUnits,
    formatPackingDecimal,
    type CompletePackingInput,
    type PackingOrder,
} from "@/components/modules/packing-orders/packing-order.schema"
import type { PackingAction } from "@/hooks/modules/packing-orders/use-packing-orders"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldLabel, FieldError } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

type Props = {
    selection: { order: PackingOrder; action: PackingAction } | null
    onClose: () => void
    onConfirm: (input?: CompletePackingInput) => Promise<boolean>
    pending: boolean
    error?: string
}
const actions = {
    plan: {
        title: "Plan and reserve materials",
        button: "Plan and reserve",
        description:
            "Reserve required materials from approved, unexpired lots at the source, using the earliest expiration first. All requirements must be available.",
    },
    start: {
        title: "Start packing",
        button: "Start packing",
        description:
            "Mark packing as in progress. Reserved materials remain protected until completion records consumption and finished output.",
    },
    cancel: {
        title: "Cancel packing order",
        button: "Cancel order",
        description:
            "Cancel this order and release its unused material reservations. No inventory has been consumed.",
    },
    complete: {
        title: "Complete packing",
        button: "Complete packing",
        description:
            "Record actual output, consume the corresponding reserved materials and release unused reservations. A finished product lot will be created at the destination.",
    },
}
function ActionContent({
    selection,
    onClose,
    onConfirm,
    pending,
    error,
}: Props & { selection: NonNullable<Props["selection"]> }) {
    const id = useId()
    const { order, action } = selection
    const [values, setValues] = useState<CompletePackingInput>({
        actualQty: order.targetQty,
        lotNumber: "",
        manufactureDate: null,
        expirationDate: null,
    })
    const [errors, setErrors] = useState<Partial<Record<keyof CompletePackingInput, string>>>({})
    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (pending) return
        if (action === "complete") {
            const next: typeof errors = {}
            if (
                (decimalUnits(values.actualQty.trim()) ?? BigInt(0)) <= BigInt(0) ||
                comparePackingDecimals(values.actualQty.trim(), order.targetQty) > 0
            )
                next.actualQty = `Enter a positive quantity up to ${formatPackingDecimal(order.targetQty)} ${order.primaryUomName}.`
            if (!values.lotNumber.trim() || values.lotNumber.trim().length > 100)
                next.lotNumber = "Enter a unique lot number of up to 100 characters."
            for (const key of ["manufactureDate", "expirationDate"] as const)
                if (values[key] && !z.iso.date().safeParse(values[key]).success)
                    next[key] = "Enter a valid date."
            if (
                values.manufactureDate &&
                values.expirationDate &&
                values.expirationDate <= values.manufactureDate
            )
                next.expirationDate = "Expiration must be after manufacture."
            setErrors(next)
            const firstInvalid = Object.keys(next)[0]
            if (firstInvalid) {
                const field = event.currentTarget.elements.namedItem(firstInvalid)
                if (field instanceof HTMLElement) field.focus()
                return
            }
        }
        await onConfirm(
            action === "complete"
                ? {
                      ...values,
                      actualQty: values.actualQty.trim(),
                      lotNumber: values.lotNumber.trim(),
                  }
                : undefined,
        )
    }
    function update<K extends keyof CompletePackingInput>(key: K, value: CompletePackingInput[K]) {
        setValues((current) => ({ ...current, [key]: value }))
        setErrors((current) => ({ ...current, [key]: undefined }))
    }
    return (
        <DialogContent
            showCloseButton={!pending}
            className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg"
        >
            <DialogHeader>
                <DialogTitle>{actions[action].title}</DialogTitle>
                <DialogDescription>
                    {order.packingOrderNumber} · {order.itemName}. {actions[action].description}
                </DialogDescription>
            </DialogHeader>
            <form onSubmit={submit} className="space-y-4" aria-busy={pending}>
                {action === "complete" && (
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Field data-invalid={Boolean(errors.actualQty)}>
                            <FieldLabel htmlFor={`${id}-quantity`}>
                                Actual output ({order.primaryUomName})
                            </FieldLabel>
                            <Input
                                id={`${id}-quantity`}
                                name="actualQty"
                                inputMode="decimal"
                                value={values.actualQty}
                                required
                                disabled={pending}
                                onChange={(e) => update("actualQty", e.target.value)}
                                aria-invalid={Boolean(errors.actualQty)}
                                aria-describedby={
                                    errors.actualQty ? `${id}-quantity-error` : undefined
                                }
                            />
                            <FieldError id={`${id}-quantity-error`}>{errors.actualQty}</FieldError>
                        </Field>
                        <Field data-invalid={Boolean(errors.lotNumber)}>
                            <FieldLabel htmlFor={`${id}-lot`}>Finished lot number</FieldLabel>
                            <Input
                                id={`${id}-lot`}
                                name="lotNumber"
                                value={values.lotNumber}
                                maxLength={100}
                                required
                                disabled={pending}
                                onChange={(e) => update("lotNumber", e.target.value)}
                                aria-invalid={Boolean(errors.lotNumber)}
                                aria-describedby={errors.lotNumber ? `${id}-lot-error` : undefined}
                            />
                            <FieldError id={`${id}-lot-error`}>{errors.lotNumber}</FieldError>
                        </Field>
                        <Field data-invalid={Boolean(errors.manufactureDate)}>
                            <FieldLabel htmlFor={`${id}-manufactured`}>
                                Manufactured (optional)
                            </FieldLabel>
                            <Input
                                id={`${id}-manufactured`}
                                name="manufactureDate"
                                type="date"
                                value={values.manufactureDate ?? ""}
                                disabled={pending}
                                onChange={(e) => update("manufactureDate", e.target.value || null)}
                                aria-invalid={Boolean(errors.manufactureDate)}
                                aria-describedby={
                                    errors.manufactureDate ? `${id}-manufactured-error` : undefined
                                }
                            />
                            <FieldError id={`${id}-manufactured-error`}>
                                {errors.manufactureDate}
                            </FieldError>
                        </Field>
                        <Field data-invalid={Boolean(errors.expirationDate)}>
                            <FieldLabel htmlFor={`${id}-expires`}>Expiration (optional)</FieldLabel>
                            <Input
                                id={`${id}-expires`}
                                name="expirationDate"
                                type="date"
                                value={values.expirationDate ?? ""}
                                disabled={pending}
                                onChange={(e) => update("expirationDate", e.target.value || null)}
                                aria-invalid={Boolean(errors.expirationDate)}
                                aria-describedby={
                                    errors.expirationDate ? `${id}-expires-error` : undefined
                                }
                            />
                            <FieldError id={`${id}-expires-error`}>
                                {errors.expirationDate}
                            </FieldError>
                        </Field>
                    </div>
                )}
                {error && (
                    <p role="alert" className="text-sm text-destructive">
                        {error}
                    </p>
                )}
                <DialogFooter>
                    <Button type="button" variant="outline" disabled={pending} onClick={onClose}>
                        Back
                    </Button>
                    <Button
                        type="submit"
                        variant={action === "cancel" ? "destructive" : "default"}
                        disabled={pending}
                    >
                        {pending ? "Processing…" : actions[action].button}
                    </Button>
                </DialogFooter>
            </form>
        </DialogContent>
    )
}
export function PackingOrderActionDialog(props: Props) {
    return (
        <Dialog
            open={Boolean(props.selection)}
            onOpenChange={(open) => {
                if (!open && !props.pending) props.onClose()
            }}
        >
            {props.selection && (
                <ActionContent
                    key={`${props.selection.order.packingOrderId}-${props.selection.action}`}
                    {...props}
                    selection={props.selection}
                />
            )}
        </Dialog>
    )
}
