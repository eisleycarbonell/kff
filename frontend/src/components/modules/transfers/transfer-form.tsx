"use client"

import { useId, useState, type FormEvent } from "react"
import { Plus, Trash2 } from "lucide-react"
import {
    formatTransferDecimal,
    validateTransfer,
    type TransferDetail,
    type TransferOptions,
    type TransferFormValues,
    type TransferFormErrors,
    type CreateTransferInput,
    type UpdateTransferInput,
} from "@/components/modules/transfers/transfer.schema"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

type Props = {
    open: boolean
    onOpenChange: (open: boolean) => void
    transfer: TransferDetail | null
    options: TransferOptions | undefined
    isOptionsLoading: boolean
    optionsError?: string
    onRetryOptions: () => void
    onSubmit: (input: CreateTransferInput | UpdateTransferInput) => Promise<boolean>
    isSubmitting: boolean
    saveError?: string
}

function TransferFormContent({
    transfer,
    options,
    isOptionsLoading,
    optionsError,
    onRetryOptions,
    onSubmit,
    isSubmitting,
    saveError,
    onOpenChange,
}: Omit<Props, "open">) {
    const id = useId()
    const [values, setValues] = useState<TransferFormValues>(() => ({
        transferNumber: transfer?.transferNumber ?? "",
        sourceLocationId: transfer?.sourceLocationId ?? null,
        destinationLocationId: transfer?.destinationLocationId ?? null,
        notes: transfer?.notes ?? "",
        lines:
            transfer?.lines.map(({ itemId, lotId, qtyRequested }) => ({
                itemId,
                lotId,
                qtyRequested,
            })) ?? [],
    }))
    const [errors, setErrors] = useState<TransferFormErrors>({})
    function update<K extends keyof TransferFormValues>(key: K, value: TransferFormValues[K]) {
        setValues((current) => ({ ...current, [key]: value }))
        setErrors((current) => ({ ...current, [key]: undefined }))
    }
    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (isSubmitting || !options) return
        const next = validateTransfer(values, options, transfer)
        setErrors(next)
        if (Object.keys(next).length) {
            const firstError = Object.keys(next)[0]
            const field = document.getElementById(
                firstError === "lines" && values.lines.length
                    ? `${id}-qty-${values.lines[0].lotId}`
                    : `${id}-${firstError}`,
            )
            if (field instanceof HTMLElement) field.focus()
            return
        }
        const input: CreateTransferInput = {
            transferNumber: values.transferNumber.trim().toUpperCase(),
            sourceLocationId: values.sourceLocationId!,
            destinationLocationId: values.destinationLocationId!,
            notes: values.notes.trim() || null,
            lines: values.lines.map((line) => ({
                ...line,
                qtyRequested: line.qtyRequested.trim(),
            })),
        }
        if (await onSubmit(input)) onOpenChange(false)
    }
    const sources =
        options?.locations
            .filter((row) => row.locationType === "Warehouse")
            .map((row) => ({ value: row.locationId, label: `${row.code} · ${row.name}` })) ?? []
    const destinations =
        options?.locations
            .filter(
                (row) =>
                    row.locationType !== "In Transit" && row.locationId !== values.sourceLocationId,
            )
            .map((row) => ({ value: row.locationId, label: `${row.code} · ${row.name}` })) ?? []
    const availableLots =
        options?.stock.filter(
            (row) =>
                row.locationId === values.sourceLocationId &&
                !values.lines.some((line) => line.lotId === row.lotId),
        ) ?? []
    const lotItems = availableLots.map((row) => ({
        value: row.lotId,
        label: `${row.itemSku} · ${row.lotNumber} · ${formatTransferDecimal(row.qtyAvailable)} ${row.primaryUomName} available`,
    }))
    return (
        <DialogContent
            className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-3xl"
            showCloseButton={!isSubmitting}
        >
            <DialogHeader>
                <DialogTitle>
                    {transfer ? "Edit stock transfer" : "Create stock transfer"}
                </DialogTitle>
                <DialogDescription>
                    Select finished-product lots and requested quantities. Stock availability is
                    checked again at dispatch.
                </DialogDescription>
            </DialogHeader>
            {isOptionsLoading && !options ? (
                <p role="status" className="py-6 text-muted-foreground">
                    Loading warehouses and finished-product lots…
                </p>
            ) : null}
            {optionsError && (
                <div role="alert" className="space-y-2">
                    <p className="text-sm text-destructive">{optionsError}</p>
                    <Button
                        type="button"
                        variant="outline"
                        disabled={isSubmitting || isOptionsLoading}
                        onClick={onRetryOptions}
                    >
                        Retry options
                    </Button>
                </div>
            )}
            {options && (
                <form onSubmit={submit} className="space-y-5" aria-busy={isSubmitting}>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Field
                            className="sm:col-span-2"
                            data-invalid={Boolean(errors.transferNumber)}
                        >
                            <FieldLabel htmlFor={`${id}-transferNumber`}>
                                Transfer number
                            </FieldLabel>
                            <Input
                                id={`${id}-transferNumber`}
                                name="transferNumber"
                                required
                                maxLength={30}
                                value={values.transferNumber}
                                disabled={isSubmitting}
                                onChange={(event) => update("transferNumber", event.target.value)}
                                aria-invalid={Boolean(errors.transferNumber)}
                                aria-describedby={
                                    errors.transferNumber ? `${id}-number-error` : undefined
                                }
                            />
                            <FieldError id={`${id}-number-error`}>
                                {errors.transferNumber}
                            </FieldError>
                        </Field>
                        <Field data-invalid={Boolean(errors.sourceLocationId)}>
                            <FieldLabel htmlFor={`${id}-sourceLocationId`}>
                                Source warehouse
                            </FieldLabel>
                            <Select
                                name="sourceLocationId"
                                items={sources}
                                value={values.sourceLocationId}
                                disabled={isSubmitting}
                                onValueChange={(value) => {
                                    if (value === values.sourceLocationId) return
                                    setValues((current) => ({
                                        ...current,
                                        sourceLocationId: value,
                                        lines: [],
                                        destinationLocationId:
                                            current.destinationLocationId === value
                                                ? null
                                                : current.destinationLocationId,
                                    }))
                                    setErrors({})
                                }}
                            >
                                <SelectTrigger
                                    id={`${id}-sourceLocationId`}
                                    className="w-full data-[size=default]:h-10"
                                    aria-invalid={Boolean(errors.sourceLocationId)}
                                    aria-describedby={`${id}-source-help`}
                                >
                                    <SelectValue placeholder="Select source warehouse" />
                                </SelectTrigger>
                                <SelectContent>
                                    {sources.map((row) => (
                                        <SelectItem key={row.value} value={row.value}>
                                            {row.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p id={`${id}-source-help`} className="text-xs text-muted-foreground">
                                Changing the source clears selected lots.
                            </p>
                            <FieldError>{errors.sourceLocationId}</FieldError>
                        </Field>
                        <Field data-invalid={Boolean(errors.destinationLocationId)}>
                            <FieldLabel htmlFor={`${id}-destinationLocationId`}>
                                Destination
                            </FieldLabel>
                            <Select
                                name="destinationLocationId"
                                items={destinations}
                                value={values.destinationLocationId}
                                disabled={isSubmitting}
                                onValueChange={(value) => update("destinationLocationId", value)}
                            >
                                <SelectTrigger
                                    id={`${id}-destinationLocationId`}
                                    className="w-full data-[size=default]:h-10"
                                    aria-invalid={Boolean(errors.destinationLocationId)}
                                >
                                    <SelectValue placeholder="Select warehouse, branch or store" />
                                </SelectTrigger>
                                <SelectContent>
                                    {destinations.map((row) => (
                                        <SelectItem key={row.value} value={row.value}>
                                            {row.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <FieldError>{errors.destinationLocationId}</FieldError>
                        </Field>
                    </div>
                    <section className="space-y-3" aria-labelledby={`${id}-lots-title`}>
                        <div>
                            <h3 id={`${id}-lots-title`} className="font-medium">
                                Finished-product lots
                            </h3>
                            <p className="text-sm text-muted-foreground">
                                Use each product’s primary unit. Draft quantities do not reserve
                                stock.
                            </p>
                        </div>
                        <Select
                            items={lotItems}
                            value={null}
                            disabled={
                                isSubmitting ||
                                !values.sourceLocationId ||
                                values.lines.length >= 100 ||
                                !lotItems.length
                            }
                            onValueChange={(value) => {
                                const lot = availableLots.find((row) => row.lotId === value)
                                if (lot)
                                    update("lines", [
                                        ...values.lines,
                                        { itemId: lot.itemId, lotId: lot.lotId, qtyRequested: "" },
                                    ])
                            }}
                        >
                            <SelectTrigger
                                id={`${id}-lines`}
                                aria-label="Add finished-product lot"
                                className="w-full data-[size=default]:h-10"
                                aria-invalid={Boolean(errors.lines)}
                            >
                                <Plus className="size-4" />
                                <SelectValue placeholder="Add a finished-product lot" />
                            </SelectTrigger>
                            <SelectContent>
                                {lotItems.map((row) => (
                                    <SelectItem key={row.value} value={row.value}>
                                        {row.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {values.sourceLocationId &&
                            !availableLots.length &&
                            !values.lines.length && (
                                <p className="rounded-lg border p-3 text-sm text-muted-foreground">
                                    No approved, unexpired finished-product stock is available at
                                    this warehouse. Configure stock before creating a transfer.
                                </p>
                            )}
                        {values.lines.map((line) => {
                            const stock = options.stock.find(
                                (row) =>
                                    row.lotId === line.lotId &&
                                    row.locationId === values.sourceLocationId,
                            )
                            const historical = transfer?.lines.find(
                                (row) => row.lotId === line.lotId,
                            )
                            const label = stock ?? historical
                            return (
                                <div key={line.lotId} className="space-y-3 rounded-lg border p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="font-medium">
                                                {label?.itemName ?? `Item ${line.itemId}`}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {label?.itemSku} ·{" "}
                                                {label?.lotNumber ?? `Lot ${line.lotId}`}
                                            </p>
                                        </div>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon-sm"
                                            aria-label={`Remove ${label?.lotNumber ?? "lot"}`}
                                            disabled={isSubmitting}
                                            onClick={() =>
                                                update(
                                                    "lines",
                                                    values.lines.filter(
                                                        (row) => row.lotId !== line.lotId,
                                                    ),
                                                )
                                            }
                                        >
                                            <Trash2 className="size-4" />
                                        </Button>
                                    </div>
                                    {stock ? (
                                        <dl className="grid grid-cols-3 gap-2 text-sm">
                                            {[
                                                ["On hand", stock.qtyOnHand],
                                                ["Reserved", stock.qtyReserved],
                                                ["Available", stock.qtyAvailable],
                                            ].map(([name, quantity]) => (
                                                <div key={name}>
                                                    <dt className="text-xs text-muted-foreground">
                                                        {name}
                                                    </dt>
                                                    <dd className="mt-1 tabular-nums">
                                                        {formatTransferDecimal(quantity)}{" "}
                                                        {stock.primaryUomName}
                                                    </dd>
                                                </div>
                                            ))}
                                        </dl>
                                    ) : (
                                        <p className="text-xs text-muted-foreground">
                                            Availability will be rechecked at dispatch. Replace this
                                            lot if it is no longer eligible.
                                        </p>
                                    )}
                                    <Field>
                                        <FieldLabel htmlFor={`${id}-qty-${line.lotId}`}>
                                            Requested quantity{" "}
                                            {label ? `(${label.primaryUomName})` : ""}
                                        </FieldLabel>
                                        <Input
                                            id={`${id}-qty-${line.lotId}`}
                                            name={`quantity-${line.lotId}`}
                                            inputMode="decimal"
                                            required
                                            value={line.qtyRequested}
                                            disabled={isSubmitting}
                                            aria-invalid={Boolean(errors.lines)}
                                            onChange={(event) =>
                                                update(
                                                    "lines",
                                                    values.lines.map((row) =>
                                                        row.lotId === line.lotId
                                                            ? {
                                                                  ...row,
                                                                  qtyRequested: event.target.value,
                                                              }
                                                            : row,
                                                    ),
                                                )
                                            }
                                        />
                                    </Field>
                                </div>
                            )
                        })}
                        <FieldError>{errors.lines}</FieldError>
                    </section>
                    <Field data-invalid={Boolean(errors.notes)}>
                        <FieldLabel htmlFor={`${id}-notes`}>Notes (optional)</FieldLabel>
                        <Textarea
                            id={`${id}-notes`}
                            name="notes"
                            maxLength={5000}
                            value={values.notes}
                            disabled={isSubmitting}
                            onChange={(event) => update("notes", event.target.value)}
                            aria-invalid={Boolean(errors.notes)}
                        />
                        <FieldError>{errors.notes}</FieldError>
                    </Field>
                    {saveError && (
                        <p role="alert" className="text-sm text-destructive">
                            {saveError}
                        </p>
                    )}
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            disabled={isSubmitting}
                            onClick={() => onOpenChange(false)}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSubmitting || isOptionsLoading}>
                            {isSubmitting ? "Saving…" : transfer ? "Save draft" : "Create draft"}
                        </Button>
                    </DialogFooter>
                </form>
            )}
        </DialogContent>
    )
}

export function TransferForm({ open, onOpenChange, ...props }: Props) {
    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                if (!props.isSubmitting) onOpenChange(next)
            }}
        >
            {open && (
                <TransferFormContent
                    key={props.transfer?.transferId ?? "new"}
                    onOpenChange={onOpenChange}
                    {...props}
                />
            )}
        </Dialog>
    )
}
