"use client"

import { useId, useState, type FormEvent } from "react"
import {
    validatePacking,
    decimalUnits,
    formatPackingDecimal,
    type PackingOrder,
    type PackingFormValues,
    type PackingFormErrors,
    type PackingOptions,
} from "@/components/modules/packing-orders/packing-order.schema"
import { usePackingPreview } from "@/hooks/modules/packing-orders/use-packing-orders"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import { Field, FieldLabel, FieldError } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Table,
    TableHeader,
    TableHead,
    TableBody,
    TableRow,
    TableCell,
} from "@/components/ui/table"

type Props = {
    open: boolean
    onOpenChange: (open: boolean) => void
    order: PackingOrder | null
    options?: PackingOptions
    optionsLoading: boolean
    optionsError?: string
    retryOptions: () => void
    onSave: (values: PackingFormValues, order: PackingOrder | null) => Promise<boolean>
    isSaving: boolean
    saveError?: string
}
function PackingOrderFormContent({
    order,
    options,
    optionsLoading,
    optionsError,
    retryOptions,
    onSave,
    onOpenChange,
    isSaving,
    saveError,
}: Omit<Props, "open">) {
    const id = useId()
    const [values, setValues] = useState<PackingFormValues>(() => ({
        packingOrderNumber: order?.packingOrderNumber ?? "",
        itemId: order?.itemId ?? null,
        targetQty: order?.targetQty ?? "",
        sourceLocationId: order?.sourceLocationId ?? null,
        destinationLocationId: order?.destinationLocationId ?? null,
        scheduledDate: order?.scheduledDate ?? "",
        notes: order?.notes ?? "",
    }))
    const [errors, setErrors] = useState<PackingFormErrors>({})
    const preview = usePackingPreview(
        !order &&
            values.itemId &&
            values.sourceLocationId &&
            (decimalUnits(values.targetQty) ?? BigInt(0)) > BigInt(0)
            ? {
                  itemId: values.itemId,
                  sourceLocationId: values.sourceLocationId,
                  targetQty: values.targetQty,
              }
            : null,
    )
    function update<K extends keyof PackingFormValues>(key: K, value: PackingFormValues[K]) {
        setValues((current) => ({ ...current, [key]: value }))
        setErrors((current) => ({ ...current, [key]: undefined }))
    }
    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (isSaving || !options) return
        const next = validatePacking(values, options, Boolean(order))
        setErrors(next)
        if (Object.keys(next).length) {
            const first = event.currentTarget.elements.namedItem(Object.keys(next)[0])
            if (first instanceof HTMLElement) first.focus()
            return
        }
        if (await onSave(values, order)) onOpenChange(false)
    }
    const products =
        options?.items.map((item) => ({
            value: item.itemId,
            label: `${item.sku} · ${item.name}${item.hasBom ? "" : " (no formula)"}`,
        })) ?? []
    if (order && !products.some((item) => item.value === order.itemId))
        products.push({ value: order.itemId, label: `${order.itemSku} · ${order.itemName}` })
    const locations =
        options?.locations.map((location) => ({
            value: location.locationId,
            label: `${location.code} · ${location.name}`,
        })) ?? []
    if (order && !locations.some((location) => location.value === order.sourceLocationId))
        locations.push({
            value: order.sourceLocationId,
            label: `${order.sourceLocationCode} · ${order.sourceLocationName}`,
        })
    const product = options?.items.find((item) => item.itemId === values.itemId)
    return (
        <DialogContent
            className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-3xl"
            showCloseButton={!isSaving}
        >
            <DialogHeader>
                <DialogTitle>{order ? "Edit packing order" : "Create packing order"}</DialogTitle>
                <DialogDescription>
                    {order
                        ? "Update draft order details. Product, source, target and material snapshot are fixed."
                        : "Select a finished product and review available materials. Creating a draft copies its packing formula."}
                </DialogDescription>
            </DialogHeader>
            {optionsLoading ? (
                <p role="status" className="py-6 text-muted-foreground">
                    Loading products and locations…
                </p>
            ) : optionsError ? (
                <div role="alert" className="space-y-3">
                    <p>{optionsError}</p>
                    <Button variant="outline" onClick={retryOptions}>
                        Retry options
                    </Button>
                </div>
            ) : (
                <form onSubmit={submit} className="space-y-5" aria-busy={isSaving}>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Field data-invalid={Boolean(errors.packingOrderNumber)}>
                            <FieldLabel htmlFor={`${id}-number`}>Order number</FieldLabel>
                            <Input
                                id={`${id}-number`}
                                name="packingOrderNumber"
                                required
                                maxLength={30}
                                value={values.packingOrderNumber}
                                disabled={isSaving}
                                onChange={(e) => update("packingOrderNumber", e.target.value)}
                                aria-invalid={Boolean(errors.packingOrderNumber)}
                                aria-describedby={
                                    errors.packingOrderNumber ? `${id}-number-error` : undefined
                                }
                            />
                            <FieldError id={`${id}-number-error`}>
                                {errors.packingOrderNumber}
                            </FieldError>
                        </Field>
                        <Field data-invalid={Boolean(errors.scheduledDate)}>
                            <FieldLabel htmlFor={`${id}-date`}>
                                Scheduled date (optional)
                            </FieldLabel>
                            <Input
                                id={`${id}-date`}
                                name="scheduledDate"
                                type="date"
                                value={values.scheduledDate}
                                disabled={isSaving}
                                onChange={(e) => update("scheduledDate", e.target.value)}
                                aria-invalid={Boolean(errors.scheduledDate)}
                                aria-describedby={
                                    errors.scheduledDate ? `${id}-date-error` : undefined
                                }
                            />
                            <FieldError id={`${id}-date-error`}>{errors.scheduledDate}</FieldError>
                        </Field>
                        <Field className="sm:col-span-2" data-invalid={Boolean(errors.itemId)}>
                            <FieldLabel htmlFor={`${id}-product`}>Finished product</FieldLabel>
                            <Select
                                name="itemId"
                                items={products}
                                value={values.itemId}
                                disabled={isSaving || Boolean(order)}
                                onValueChange={(value) => update("itemId", value)}
                            >
                                <SelectTrigger
                                    id={`${id}-product`}
                                    className="w-full data-[size=default]:h-10"
                                    aria-invalid={Boolean(errors.itemId)}
                                    aria-describedby={
                                        errors.itemId ? `${id}-product-error` : undefined
                                    }
                                >
                                    <SelectValue placeholder="Select a finished product" />
                                </SelectTrigger>
                                <SelectContent>
                                    {products.map((item) => (
                                        <SelectItem
                                            key={item.value}
                                            value={item.value}
                                            disabled={
                                                !options?.items.find(
                                                    (row) => row.itemId === item.value,
                                                )?.hasBom
                                            }
                                        >
                                            {item.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <FieldError id={`${id}-product-error`}>{errors.itemId}</FieldError>
                        </Field>
                        <Field data-invalid={Boolean(errors.targetQty)}>
                            <FieldLabel htmlFor={`${id}-quantity`}>
                                Target quantity {product ? `(${product.primaryUomName})` : ""}
                            </FieldLabel>
                            <Input
                                id={`${id}-quantity`}
                                name="targetQty"
                                inputMode="decimal"
                                required
                                value={values.targetQty}
                                disabled={isSaving || Boolean(order)}
                                onChange={(e) => update("targetQty", e.target.value)}
                                aria-invalid={Boolean(errors.targetQty)}
                                aria-describedby={
                                    errors.targetQty ? `${id}-quantity-error` : undefined
                                }
                            />
                            <FieldError id={`${id}-quantity-error`}>{errors.targetQty}</FieldError>
                        </Field>
                        <Field data-invalid={Boolean(errors.sourceLocationId)}>
                            <FieldLabel htmlFor={`${id}-source`}>Material source</FieldLabel>
                            <Select
                                name="sourceLocationId"
                                items={locations}
                                value={values.sourceLocationId}
                                disabled={isSaving || Boolean(order)}
                                onValueChange={(value) => update("sourceLocationId", value)}
                            >
                                <SelectTrigger
                                    id={`${id}-source`}
                                    className="w-full data-[size=default]:h-10"
                                    aria-invalid={Boolean(errors.sourceLocationId)}
                                    aria-describedby={
                                        errors.sourceLocationId ? `${id}-source-error` : undefined
                                    }
                                >
                                    <SelectValue placeholder="Select source" />
                                </SelectTrigger>
                                <SelectContent>
                                    {locations.map((item) => (
                                        <SelectItem key={item.value} value={item.value}>
                                            {item.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <FieldError id={`${id}-source-error`}>
                                {errors.sourceLocationId}
                            </FieldError>
                        </Field>
                        <Field
                            className="sm:col-span-2"
                            data-invalid={Boolean(errors.destinationLocationId)}
                        >
                            <FieldLabel htmlFor={`${id}-destination`}>
                                Finished goods destination
                            </FieldLabel>
                            <Select
                                name="destinationLocationId"
                                items={locations.filter(
                                    (item) => item.value !== values.sourceLocationId,
                                )}
                                value={values.destinationLocationId}
                                disabled={isSaving}
                                onValueChange={(value) => update("destinationLocationId", value)}
                            >
                                <SelectTrigger
                                    id={`${id}-destination`}
                                    className="w-full data-[size=default]:h-10"
                                    aria-invalid={Boolean(errors.destinationLocationId)}
                                    aria-describedby={
                                        errors.destinationLocationId
                                            ? `${id}-destination-error`
                                            : undefined
                                    }
                                >
                                    <SelectValue placeholder="Select destination" />
                                </SelectTrigger>
                                <SelectContent>
                                    {locations
                                        .filter((item) => item.value !== values.sourceLocationId)
                                        .map((item) => (
                                            <SelectItem key={item.value} value={item.value}>
                                                {item.label}
                                            </SelectItem>
                                        ))}
                                </SelectContent>
                            </Select>
                            <FieldError id={`${id}-destination-error`}>
                                {errors.destinationLocationId}
                            </FieldError>
                        </Field>
                        <Field className="sm:col-span-2" data-invalid={Boolean(errors.notes)}>
                            <FieldLabel htmlFor={`${id}-notes`}>Notes (optional)</FieldLabel>
                            <Textarea
                                id={`${id}-notes`}
                                name="notes"
                                maxLength={5000}
                                value={values.notes}
                                disabled={isSaving}
                                onChange={(e) => update("notes", e.target.value)}
                                aria-invalid={Boolean(errors.notes)}
                                aria-describedby={errors.notes ? `${id}-notes-error` : undefined}
                            />
                            <FieldError id={`${id}-notes-error`}>{errors.notes}</FieldError>
                        </Field>
                    </div>
                    {!order && values.itemId && values.sourceLocationId && values.targetQty && (
                        <section
                            className="overflow-hidden rounded-lg border"
                            aria-label="Material availability preview"
                        >
                            <div className="border-b bg-muted/30 px-4 py-3">
                                <h3 className="font-medium">Material availability</h3>
                                <p className="text-sm text-muted-foreground">
                                    Availability excludes active reservations and unusable lots.
                                    Planning checks stock again.
                                </p>
                            </div>
                            {preview.isFetching ? (
                                <p className="p-4 text-sm text-muted-foreground" role="status">
                                    Checking materials…
                                </p>
                            ) : preview.error ? (
                                <p role="alert" className="p-4 text-sm text-destructive">
                                    {preview.error.message}
                                </p>
                            ) : preview.data ? (
                                <>
                                    <p className="px-4 py-3 text-sm">
                                        Maximum producible:{" "}
                                        <strong>
                                            {formatPackingDecimal(preview.data.maxProducible)}{" "}
                                            {preview.data.primaryUomName}
                                        </strong>{" "}
                                        ·{" "}
                                        {preview.data.canPlan
                                            ? "Materials available for target"
                                            : "Material shortage for target"}
                                    </p>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Material</TableHead>
                                                <TableHead>Required</TableHead>
                                                <TableHead>On hand</TableHead>
                                                <TableHead>Reserved</TableHead>
                                                <TableHead>Available</TableHead>
                                                <TableHead>Shortage</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {preview.data.materials.map((row) => (
                                                <TableRow key={row.itemId}>
                                                    <TableCell>
                                                        {row.itemName}
                                                        <div className="text-xs text-muted-foreground">
                                                            {row.itemSku} · {row.uomName}
                                                        </div>
                                                    </TableCell>
                                                    {[
                                                        row.requiredQty,
                                                        row.qtyOnHand,
                                                        row.qtyReserved,
                                                        row.qtyAvailable,
                                                        row.shortageQty,
                                                    ].map((quantity, index) => (
                                                        <TableCell
                                                            key={index}
                                                            className="tabular-nums"
                                                        >
                                                            {formatPackingDecimal(quantity)}
                                                        </TableCell>
                                                    ))}
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </>
                            ) : null}
                        </section>
                    )}
                    {saveError && (
                        <p role="alert" className="text-sm text-destructive">
                            {saveError}
                        </p>
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
                        <Button type="submit" disabled={isSaving || !options}>
                            {isSaving ? "Saving…" : order ? "Save changes" : "Create draft"}
                        </Button>
                    </DialogFooter>
                </form>
            )}
        </DialogContent>
    )
}
export function PackingOrderForm({ open, onOpenChange, ...props }: Props) {
    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                if (!props.isSaving) onOpenChange(next)
            }}
        >
            {open && (
                <PackingOrderFormContent
                    key={props.order?.packingOrderId ?? "new"}
                    onOpenChange={onOpenChange}
                    {...props}
                />
            )}
        </Dialog>
    )
}
