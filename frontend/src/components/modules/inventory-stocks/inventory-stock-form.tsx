"use client"
import { useId, useState, type FormEvent } from "react"
import {
    formatStockQuantity,
    validateStockAdjustment,
    type Stock,
    type StockOptions,
    type AdjustmentFormValues,
    type AdjustmentFormErrors,
} from "@/components/modules/inventory-stocks/inventory-stock.schema"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
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
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
type Props = {
    open: boolean
    onOpenChange: (open: boolean) => void
    stock: Stock | null
    stocks: Stock[]
    options: StockOptions
    isSaving: boolean
    saveError: Error | null
    onSave: (values: AdjustmentFormValues) => Promise<boolean>
}
function AdjustmentContent({
    onOpenChange,
    stock,
    stocks,
    options,
    isSaving,
    saveError,
    onSave,
}: Omit<Props, "open">) {
    const id = useId()
    const [values, setValues] = useState<AdjustmentFormValues>(() => ({
        lotId: stock?.lotId ?? null,
        locationId: stock?.locationId ?? null,
        reasonId: null,
        expectedQtyOnHand: stock?.qtyOnHand ?? "0",
        qtyOnHand: "",
        referenceId: "",
    }))
    const [snapshot, setSnapshot] = useState(() => ({
        qtyOnHand: stock?.qtyOnHand ?? "0",
        qtyReserved: stock?.qtyReserved ?? "0",
        qtyAvailable: stock?.qtyAvailable ?? "0",
    }))
    const [errors, setErrors] = useState<AdjustmentFormErrors>({})
    const unit = options.lots.find((lot) => lot.lotId === values.lotId)?.primaryUomName ?? ""
    function update<K extends keyof AdjustmentFormValues>(
        field: K,
        value: AdjustmentFormValues[K],
    ) {
        setValues((current) => ({ ...current, [field]: value }))
        setErrors((current) => {
            const next = { ...current }
            delete next[field]
            return next
        })
    }
    function selectPosition(field: "lotId" | "locationId", value: number | null) {
        const next = { ...values, [field]: value }
        const balance = stocks.find(
            (row) => row.lotId === next.lotId && row.locationId === next.locationId,
        )
        const nextSnapshot = {
            qtyOnHand: balance?.qtyOnHand ?? "0",
            qtyReserved: balance?.qtyReserved ?? "0",
            qtyAvailable: balance?.qtyAvailable ?? "0",
        }
        setSnapshot(nextSnapshot)
        setValues({ ...next, expectedQtyOnHand: nextSnapshot.qtyOnHand, qtyOnHand: "" })
        setErrors({})
    }
    const selects: {
        name: "lotId" | "locationId" | "reasonId"
        label: string
        items: { value: number | null; label: string; disabled?: boolean }[]
    }[] = [
        {
            name: "lotId",
            label: "Item and lot",
            items: [
                { value: null, label: "Select an item / lot" },
                ...options.lots.map((lot) => ({
                    value: lot.lotId,
                    label: `${lot.itemName} (${lot.sku}) / ${lot.lotNumber}`,
                })),
            ],
        },
        {
            name: "locationId",
            label: "Location",
            items: [
                { value: null, label: "Select a location" },
                ...options.locations.map((location) => ({
                    value: location.locationId,
                    disabled: !location.isActive,
                    label: `${location.name} (${location.code})${location.isActive ? "" : " / inactive"}`,
                })),
            ],
        },
        {
            name: "reasonId",
            label: "Adjustment reason",
            items: [
                { value: null, label: "Select a reason" },
                ...options.reasons.map((reason) => ({
                    value: reason.reasonId,
                    label: reason.codeName,
                })),
            ],
        },
    ]
    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (isSaving) return
        const next = validateStockAdjustment(values, options, snapshot.qtyReserved)
        setErrors(next)
        const first = Object.keys(next)[0]
        if (first) {
            document.getElementById(`${id}-${first}`)?.focus()
            return
        }
        if (await onSave(values)) onOpenChange(false)
    }
    return (
        <DialogContent
            className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl"
            showCloseButton={!isSaving}
        >
            <DialogHeader>
                <DialogTitle>Record stock adjustment</DialogTitle>
                <DialogDescription>
                    Enter the physical count for one lot and location. Every adjustment is recorded
                    in stock history.
                </DialogDescription>
            </DialogHeader>
            <form onSubmit={submit} aria-busy={isSaving} className="flex flex-col gap-5">
                {saveError && (
                    <Alert variant="destructive">
                        <AlertTitle>Adjustment was not recorded</AlertTitle>
                        <AlertDescription>{saveError.message}</AlertDescription>
                    </Alert>
                )}
                <FieldGroup className="gap-4">
                    {selects.map((field) => (
                        <Field
                            key={field.name}
                            data-invalid={Boolean(errors[field.name])}
                            data-disabled={isSaving}
                        >
                            <FieldLabel htmlFor={`${id}-${field.name}`}>{field.label}</FieldLabel>
                            <Select
                                name={field.name}
                                items={field.items}
                                value={values[field.name]}
                                disabled={isSaving}
                                onValueChange={(value) =>
                                    field.name === "reasonId"
                                        ? update("reasonId", value)
                                        : selectPosition(field.name, value)
                                }
                            >
                                <SelectTrigger
                                    id={`${id}-${field.name}`}
                                    className="w-full data-[size=default]:h-10"
                                    aria-invalid={Boolean(errors[field.name])}
                                    aria-describedby={`${id}-${field.name}-error`}
                                >
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectGroup>
                                        {field.items
                                            .filter((option) => option.value !== null)
                                            .map((option) => (
                                                <SelectItem
                                                    key={option.value}
                                                    value={option.value!}
                                                    disabled={option.disabled}
                                                >
                                                    {option.label}
                                                </SelectItem>
                                            ))}
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                            <FieldError id={`${id}-${field.name}-error`}>
                                {errors[field.name]}
                            </FieldError>
                        </Field>
                    ))}
                    {values.lotId && values.locationId && (
                        <dl className="grid grid-cols-3 gap-3 rounded-lg border bg-muted/30 p-3 text-sm">
                            {[
                                ["On hand", snapshot.qtyOnHand],
                                ["Reserved", snapshot.qtyReserved],
                                ["Available", snapshot.qtyAvailable],
                            ].map(([label, quantity]) => (
                                <div key={label}>
                                    <dt className="text-muted-foreground">{label}</dt>
                                    <dd className="mt-1 font-medium tabular-nums">
                                        {formatStockQuantity(quantity)} {unit}
                                    </dd>
                                </div>
                            ))}
                        </dl>
                    )}
                    <Field data-invalid={Boolean(errors.qtyOnHand)} data-disabled={isSaving}>
                        <FieldLabel htmlFor={`${id}-qtyOnHand`}>
                            Counted quantity {unit && `(${unit})`}
                        </FieldLabel>
                        <Input
                            id={`${id}-qtyOnHand`}
                            name="qtyOnHand"
                            inputMode="decimal"
                            value={values.qtyOnHand}
                            onChange={(event) => update("qtyOnHand", event.target.value)}
                            disabled={isSaving}
                            required
                            aria-invalid={Boolean(errors.qtyOnHand)}
                            aria-describedby={`${id}-quantity-feedback`}
                            className="h-10"
                        />
                        <div id={`${id}-quantity-feedback`}>
                            <FieldDescription>
                                The final on-hand balance after correction, including stock reserved
                                for orders.
                            </FieldDescription>
                            <FieldError>{errors.qtyOnHand}</FieldError>
                        </div>
                    </Field>
                    <Field data-invalid={Boolean(errors.referenceId)} data-disabled={isSaving}>
                        <FieldLabel htmlFor={`${id}-referenceId`}>
                            Count reference (optional)
                        </FieldLabel>
                        <Input
                            id={`${id}-referenceId`}
                            name="referenceId"
                            value={values.referenceId}
                            maxLength={60}
                            onChange={(event) => update("referenceId", event.target.value)}
                            disabled={isSaving}
                            aria-invalid={Boolean(errors.referenceId)}
                            aria-describedby={`${id}-reference-error`}
                            className="h-10"
                        />
                        <FieldError id={`${id}-reference-error`}>{errors.referenceId}</FieldError>
                    </Field>
                </FieldGroup>
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
                        {isSaving ? "Recording..." : "Record adjustment"}
                    </Button>
                </DialogFooter>
            </form>
        </DialogContent>
    )
}
export function StockAdjustmentForm({ open, onOpenChange, ...props }: Props) {
    return (
        <Dialog
            open={open}
            onOpenChange={(value) => {
                if (!props.isSaving) onOpenChange(value)
            }}
        >
            {open && (
                <AdjustmentContent
                    key={props.stock?.stockId ?? "new"}
                    onOpenChange={onOpenChange}
                    {...props}
                />
            )}
        </Dialog>
    )
}
