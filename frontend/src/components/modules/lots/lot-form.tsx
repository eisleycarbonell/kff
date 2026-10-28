"use client"

import { useId, useState, type FormEvent } from "react"
import {
    QC_STATUSES,
    lotHasReservations,
    formatLotDecimal,
    validateLot,
    type Lot,
    type LotFormValues,
    type LotFormErrors,
} from "@/components/modules/lots/lot.schema"
import { useLotDetail } from "@/hooks/modules/lots/use-lots"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"

type Props = {
    open: boolean
    onOpenChange: (open: boolean) => void
    lot: Lot | null
    onSave: (values: LotFormValues, lot: Lot | null) => Promise<boolean>
    isSaving: boolean
    saveError: string | null
}
const qualityItems = QC_STATUSES.map((status) => ({ value: status, label: status }))

function LotFormContent({
    lot,
    onOpenChange,
    onSave,
    isSaving,
    saveError,
}: Omit<Props, "open"> & { lot: Lot }) {
    const id = useId()
    const [values, setValues] = useState<LotFormValues>(() => ({
        supplierLotNumber: lot.supplierLotNumber ?? "",
        manufactureDate: lot.manufactureDate ?? "",
        expirationDate: lot.expirationDate ?? "",
        qcStatus: lot.qcStatus,
    }))
    const [errors, setErrors] = useState<LotFormErrors>({})
    const locked = lotHasReservations(lot)
    const lockedValuesChanged =
        values.manufactureDate !== (lot.manufactureDate ?? "") ||
        values.expirationDate !== (lot.expirationDate ?? "") ||
        values.qcStatus !== lot.qcStatus
    function update<Key extends keyof LotFormValues>(key: Key, value: LotFormValues[Key]) {
        setValues((current) => ({ ...current, [key]: value }))
        setErrors((current) => ({ ...current, [key]: undefined }))
    }
    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (isSaving) return
        const nextErrors = validateLot(values, lot)
        setErrors(nextErrors)
        const first = Object.keys(nextErrors)[0]
        if (first) {
            document.getElementById(`${id}-${first}`)?.focus()
            return
        }
        if (await onSave(values, lot)) onOpenChange(false)
    }
    return (
        <form onSubmit={submit} className="space-y-5" aria-busy={isSaving}>
            <dl className="grid gap-3 rounded-lg border bg-muted/15 p-4 text-sm sm:grid-cols-2">
                <div className="min-w-0">
                    <dt className="text-xs text-muted-foreground">Item</dt>
                    <dd className="mt-1 break-words font-medium">{lot.itemName}</dd>
                    <dd className="break-words text-xs text-muted-foreground">
                        {lot.itemSku} · {lot.primaryUomName}
                    </dd>
                </div>
                <div className="min-w-0">
                    <dt className="text-xs text-muted-foreground">Origin</dt>
                    <dd className="mt-1 break-words">
                        {lot.poNumber ?? lot.packingOrderNumber ?? lot.sourceType}
                    </dd>
                    {lot.unitCost !== null && (
                        <dd className="mt-1 break-words text-xs text-muted-foreground">
                            Unit cost {formatLotDecimal(lot.unitCost)} / {lot.primaryUomName}
                        </dd>
                    )}
                </div>
            </dl>
            {locked && (
                <Alert>
                    <AlertTitle>Stock is reserved</AlertTitle>
                    <AlertDescription>
                        Dates and quality status are locked while this lot has active reservations.
                        You can still correct the supplier lot reference.
                        {lockedValuesChanged && (
                            <Button
                                type="button"
                                variant="outline"
                                className="mt-2"
                                disabled={isSaving}
                                onClick={() => {
                                    setValues((current) => ({
                                        ...current,
                                        manufactureDate: lot.manufactureDate ?? "",
                                        expirationDate: lot.expirationDate ?? "",
                                        qcStatus: lot.qcStatus,
                                    }))
                                    setErrors({})
                                }}
                            >
                                Use current dates and quality status
                            </Button>
                        )}
                    </AlertDescription>
                </Alert>
            )}
            <FieldGroup className="gap-4">
                <Field data-invalid={Boolean(errors.supplierLotNumber)}>
                    <FieldLabel htmlFor={`${id}-supplierLotNumber`}>
                        Supplier lot reference{" "}
                        <span className="font-normal text-muted-foreground">(optional)</span>
                    </FieldLabel>
                    <Input
                        id={`${id}-supplierLotNumber`}
                        name="supplierLotNumber"
                        value={values.supplierLotNumber}
                        onChange={(event) => update("supplierLotNumber", event.target.value)}
                        maxLength={100}
                        disabled={isSaving}
                        autoComplete="off"
                        className="h-10"
                        aria-invalid={Boolean(errors.supplierLotNumber)}
                        aria-describedby={`${id}-supplierLotNumber-error`}
                    />
                    <FieldError id={`${id}-supplierLotNumber-error`}>
                        {errors.supplierLotNumber}
                    </FieldError>
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                    {(["manufactureDate", "expirationDate"] as const).map((field) => (
                        <Field key={field} data-invalid={Boolean(errors[field])}>
                            <FieldLabel htmlFor={`${id}-${field}`}>
                                {field === "manufactureDate"
                                    ? "Manufacture date"
                                    : "Expiration date"}{" "}
                                <span className="font-normal text-muted-foreground">
                                    (optional)
                                </span>
                            </FieldLabel>
                            <Input
                                id={`${id}-${field}`}
                                name={field}
                                type="date"
                                value={values[field]}
                                onChange={(event) => update(field, event.target.value)}
                                disabled={isSaving || locked}
                                className="h-10"
                                aria-invalid={Boolean(errors[field])}
                                aria-describedby={`${id}-${field}-error`}
                            />
                            <FieldError id={`${id}-${field}-error`}>{errors[field]}</FieldError>
                        </Field>
                    ))}
                </div>
                <Field data-invalid={Boolean(errors.qcStatus)}>
                    <FieldLabel htmlFor={`${id}-qcStatus`}>Quality status</FieldLabel>
                    <Select
                        items={qualityItems}
                        value={values.qcStatus}
                        disabled={isSaving || locked}
                        onValueChange={(value) => {
                            if (value !== null) update("qcStatus", value)
                        }}
                    >
                        <SelectTrigger
                            id={`${id}-qcStatus`}
                            className="w-full data-[size=default]:h-10"
                            aria-invalid={Boolean(errors.qcStatus)}
                            aria-describedby={`${id}-qcStatus-error`}
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {qualityItems.map((item) => (
                                <SelectItem key={item.value} value={item.value}>
                                    {item.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <FieldDescription>
                        Changes apply to this lot across all inventory locations.
                    </FieldDescription>
                    <FieldError id={`${id}-qcStatus-error`}>{errors.qcStatus}</FieldError>
                </Field>
            </FieldGroup>
            {saveError && (
                <Alert variant="destructive">
                    <AlertDescription>{saveError}</AlertDescription>
                </Alert>
            )}
            <DialogFooter>
                <Button
                    type="button"
                    variant="outline"
                    disabled={isSaving}
                    onClick={() => onOpenChange(false)}
                >
                    Cancel
                </Button>
                <Button type="submit" disabled={isSaving}>
                    {isSaving ? "Saving..." : "Save changes"}
                </Button>
            </DialogFooter>
        </form>
    )
}

export function LotForm({ open, onOpenChange, lot, ...props }: Props) {
    const detail = useLotDetail(open && lot ? lot.lotId : null)
    return (
        <Dialog
            open={open}
            onOpenChange={(value) => {
                if (!props.isSaving) onOpenChange(value)
            }}
        >
            {open && (
                <DialogContent
                    className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl"
                    showCloseButton={!props.isSaving}
                >
                    <DialogHeader>
                        <DialogTitle className="break-words pr-6">
                            Edit {detail.lot?.lotNumber ?? lot?.lotNumber ?? "lot details"}
                        </DialogTitle>
                        <DialogDescription>
                            Correct the supplier reference, optional dates, and quality status.
                        </DialogDescription>
                    </DialogHeader>
                    {detail.loadStatus === "loading" && (
                        <div
                            className="space-y-3"
                            aria-busy="true"
                            aria-label="Loading lot details"
                        >
                            <Skeleton className="h-20" />
                            <Skeleton className="h-48" />
                        </div>
                    )}
                    {detail.loadError && (
                        <Alert variant="destructive">
                            <AlertTitle>Unable to refresh lot details</AlertTitle>
                            <AlertDescription>
                                {detail.loadError.message}
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="mt-2"
                                    onClick={detail.retry}
                                    disabled={detail.isFetching || props.isSaving}
                                >
                                    {detail.isFetching ? "Retrying..." : "Retry"}
                                </Button>
                            </AlertDescription>
                        </Alert>
                    )}
                    {detail.loadStatus === "signed-out" && (
                        <Alert>
                            <AlertTitle>Sign in required</AlertTitle>
                            <AlertDescription>Sign in again to edit this lot.</AlertDescription>
                        </Alert>
                    )}
                    {detail.lot && (
                        <LotFormContent
                            key={detail.lot.lotId}
                            lot={detail.lot}
                            onOpenChange={onOpenChange}
                            {...props}
                        />
                    )}
                    {!detail.lot && (
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                disabled={props.isSaving}
                                onClick={() => onOpenChange(false)}
                            >
                                Close
                            </Button>
                        </DialogFooter>
                    )}
                </DialogContent>
            )}
        </Dialog>
    )
}
