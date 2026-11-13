"use client"

import { useId, useState, type FormEvent } from "react"
import { Plus, Trash2 } from "lucide-react"
import {
    formatDeliveryQuantity,
    quantityUnits,
    remainingAllocation,
    unitsToQuantity,
    validateDeliveryOrder,
    type CreateDeliveryOrderInput,
    type DeliveryOrder,
    type DeliveryOrderOptions,
    type DeliveryOrderFormErrors,
    type DeliveryOrderFormValues,
} from "@/components/modules/delivery-orders/delivery-order.schema"
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
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

type Props = {
    open: boolean
    onOpenChange: (open: boolean) => void
    order: DeliveryOrder | null
    options?: DeliveryOrderOptions
    optionsLoading: boolean
    optionsError?: string
    retryOptions: () => void
    onSave: (input: CreateDeliveryOrderInput) => Promise<boolean>
    isSaving: boolean
    saveError?: string
}
function FormContent({
    order,
    options,
    onOpenChange,
    onSave,
    isSaving,
    saveError,
}: Omit<Props, "open" | "optionsLoading" | "optionsError" | "retryOptions"> & {
    options: DeliveryOrderOptions
}) {
    const id = useId()
    const [values, setValues] = useState<DeliveryOrderFormValues>(() => ({
        deliveryOrderNumber: order?.deliveryOrderNumber ?? "",
        salesOrderId: order?.salesOrderId ?? null,
        sourceLocationId: order?.sourceLocationId ?? null,
        deliveryDate: order?.deliveryDate ?? new Intl.DateTimeFormat("en-CA").format(new Date()),
        notes: order?.notes ?? "",
        lines:
            order?.lines.map((line) => ({
                salesOrderLineId: line.salesOrderLineId,
                lotId: line.lotId,
                qtyDelivered: line.qtyDelivered,
            })) ?? [],
    }))
    const [errors, setErrors] = useState<DeliveryOrderFormErrors>({})
    const salesOrder = options.salesOrders.find((row) => row.salesOrderId === values.salesOrderId)
    const orderItems = options.salesOrders.map((row) => ({
        value: row.salesOrderId,
        label: `${row.salesOrderNumber} · ${row.customerName}`,
    }))
    const sources = options.locations
        .filter(
            (row) => row.isActive && ["Warehouse", "Branch", "Store"].includes(row.locationType),
        )
        .map((row) => ({ value: row.locationId, label: row.name }))
    function update<Key extends keyof DeliveryOrderFormValues>(
        key: Key,
        value: DeliveryOrderFormValues[Key],
    ) {
        setValues((current) => ({ ...current, [key]: value }))
        setErrors((current) => ({ ...current, [key]: undefined }))
    }
    function updateLine(index: number, changes: Partial<DeliveryOrderFormValues["lines"][number]>) {
        update(
            "lines",
            values.lines.map((line, position) =>
                position === index ? { ...line, ...changes } : line,
            ),
        )
    }
    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (isSaving) return
        const normalized = {
            ...values,
            deliveryOrderNumber: values.deliveryOrderNumber.trim(),
            notes: values.notes.trim(),
            lines: values.lines.map((line) => ({
                ...line,
                qtyDelivered: line.qtyDelivered.trim(),
            })),
        }
        const next = validateDeliveryOrder(normalized, options, order)
        setErrors(next)
        if (Object.keys(next).length) return
        const saved = await onSave({
            ...normalized,
            salesOrderId: normalized.salesOrderId!,
            sourceLocationId: normalized.sourceLocationId!,
            notes: normalized.notes || null,
        })
        if (saved) onOpenChange(false)
    }
    return (
        <form onSubmit={submit} className="space-y-5" aria-busy={isSaving}>
            <fieldset disabled={isSaving} className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                    <Field data-invalid={Boolean(errors.deliveryOrderNumber)}>
                        <FieldLabel htmlFor={`${id}-number`}>Delivery number</FieldLabel>
                        <Input
                            id={`${id}-number`}
                            required
                            maxLength={30}
                            value={values.deliveryOrderNumber}
                            onChange={(event) => update("deliveryOrderNumber", event.target.value)}
                            aria-invalid={Boolean(errors.deliveryOrderNumber)}
                        />
                        <FieldError>{errors.deliveryOrderNumber}</FieldError>
                    </Field>
                    <Field data-invalid={Boolean(errors.deliveryDate)}>
                        <FieldLabel htmlFor={`${id}-date`}>Delivery date</FieldLabel>
                        <Input
                            id={`${id}-date`}
                            type="date"
                            required
                            value={values.deliveryDate}
                            onChange={(event) => update("deliveryDate", event.target.value)}
                            aria-invalid={Boolean(errors.deliveryDate)}
                        />
                        <FieldError>{errors.deliveryDate}</FieldError>
                    </Field>
                </div>
                <Field data-invalid={Boolean(errors.salesOrderId)}>
                    <FieldLabel htmlFor={`${id}-sales-order`}>Sales order</FieldLabel>
                    <Select
                        items={orderItems}
                        value={values.salesOrderId}
                        onValueChange={(value) => {
                            update("salesOrderId", value)
                            update("lines", [])
                        }}
                        required
                    >
                        <SelectTrigger
                            id={`${id}-sales-order`}
                            className="w-full"
                            aria-invalid={Boolean(errors.salesOrderId)}
                        >
                            <SelectValue placeholder="Select a confirmed sales order" />
                        </SelectTrigger>
                        <SelectContent>
                            {orderItems.map((item) => (
                                <SelectItem key={item.value} value={item.value}>
                                    {item.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <FieldError>{errors.salesOrderId}</FieldError>
                    {orderItems.length === 0 && (
                        <p className="text-sm text-muted-foreground">
                            Confirm a sales order before creating a delivery.
                        </p>
                    )}
                </Field>
                <Field data-invalid={Boolean(errors.sourceLocationId)}>
                    <FieldLabel htmlFor={`${id}-source`}>Source location</FieldLabel>
                    <Select
                        items={sources}
                        value={values.sourceLocationId}
                        onValueChange={(value) => {
                            update("sourceLocationId", value)
                            update("lines", [])
                        }}
                        required
                    >
                        <SelectTrigger
                            id={`${id}-source`}
                            className="w-full"
                            aria-invalid={Boolean(errors.sourceLocationId)}
                        >
                            <SelectValue placeholder="Select a warehouse, branch or store" />
                        </SelectTrigger>
                        <SelectContent>
                            {sources.map((item) => (
                                <SelectItem key={item.value} value={item.value}>
                                    {item.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <FieldError>{errors.sourceLocationId}</FieldError>
                </Field>
                <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <h3 className="text-sm font-medium">Lot allocations</h3>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={
                                !salesOrder ||
                                !values.sourceLocationId ||
                                values.lines.length >= 100
                            }
                            onClick={() =>
                                update("lines", [
                                    ...values.lines,
                                    { salesOrderLineId: 0, lotId: 0, qtyDelivered: "" },
                                ])
                            }
                        >
                            <Plus />
                            Add lot
                        </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        Quantities use each product&apos;s primary unit. Drafts allocate the sales
                        order quantity; stock availability is checked again at dispatch.
                    </p>
                    {values.lines.map((line, index) => {
                        const selectedLine = salesOrder?.lines.find(
                            (row) => row.salesOrderLineId === line.salesOrderLineId,
                        )
                        const lineItems =
                            salesOrder?.lines.map((row) => ({
                                value: row.salesOrderLineId,
                                label: `${row.itemSku} · ${row.itemName}`,
                            })) ?? []
                        const stocks = options.stock.filter(
                            (row) =>
                                row.locationId === values.sourceLocationId &&
                                row.itemId === selectedLine?.itemId &&
                                row.qcStatus === "Approved" &&
                                row.packingOrderId !== null &&
                                (quantityUnits(row.qtyOnHand) ?? BigInt(0)) > BigInt(0) &&
                                (row.expirationDate === null ||
                                    row.expirationDate > new Date().toISOString().slice(0, 10)),
                        )
                        const lotItems = stocks.map((row) => ({
                            value: row.lotId,
                            label: row.lotNumber,
                        }))
                        const stock = stocks.find((row) => row.lotId === line.lotId)
                        return (
                            <div key={index} className="space-y-3 rounded-lg border p-3">
                                <div className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_9rem_auto]">
                                    <Field>
                                        <FieldLabel htmlFor={`${id}-line-${index}`}>
                                            Product
                                        </FieldLabel>
                                        <Select
                                            items={lineItems}
                                            value={line.salesOrderLineId || null}
                                            onValueChange={(value) =>
                                                updateLine(index, {
                                                    salesOrderLineId: value ?? 0,
                                                    lotId: 0,
                                                })
                                            }
                                        >
                                            <SelectTrigger
                                                id={`${id}-line-${index}`}
                                                className="w-full"
                                            >
                                                <SelectValue placeholder="Select product" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {lineItems.map((item) => (
                                                    <SelectItem key={item.value} value={item.value}>
                                                        {item.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </Field>
                                    <Field>
                                        <FieldLabel htmlFor={`${id}-lot-${index}`}>
                                            Finished-product lot
                                        </FieldLabel>
                                        <Select
                                            items={lotItems}
                                            value={line.lotId || null}
                                            onValueChange={(value) =>
                                                updateLine(index, { lotId: value ?? 0 })
                                            }
                                            disabled={!selectedLine}
                                        >
                                            <SelectTrigger
                                                id={`${id}-lot-${index}`}
                                                className="w-full"
                                            >
                                                <SelectValue placeholder="Select lot" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {lotItems.map((item) => (
                                                    <SelectItem key={item.value} value={item.value}>
                                                        {item.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </Field>
                                    <Field>
                                        <FieldLabel htmlFor={`${id}-qty-${index}`}>
                                            Quantity{" "}
                                            {selectedLine ? `(${selectedLine.uomName})` : ""}
                                        </FieldLabel>
                                        <Input
                                            id={`${id}-qty-${index}`}
                                            inputMode="decimal"
                                            required
                                            value={line.qtyDelivered}
                                            onChange={(event) =>
                                                updateLine(index, {
                                                    qtyDelivered: event.target.value,
                                                })
                                            }
                                        />
                                    </Field>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        aria-label={`Remove lot allocation ${index + 1}`}
                                        onClick={() =>
                                            update(
                                                "lines",
                                                values.lines.filter(
                                                    (_, position) => position !== index,
                                                ),
                                            )
                                        }
                                    >
                                        <Trash2 />
                                    </Button>
                                </div>
                                {selectedLine && (
                                    <p className="text-xs text-muted-foreground">
                                        Order quantity available to allocate:{" "}
                                        {formatDeliveryQuantity(
                                            unitsToQuantity(
                                                remainingAllocation(selectedLine, order),
                                            ),
                                        )}{" "}
                                        {selectedLine.uomName}
                                    </p>
                                )}
                                {stock && (
                                    <p className="text-xs text-muted-foreground">
                                        On hand: {formatDeliveryQuantity(stock.qtyOnHand)} ·
                                        Reserved: {formatDeliveryQuantity(stock.qtyReserved)} ·
                                        Available: {formatDeliveryQuantity(stock.qtyAvailable)}{" "}
                                        {stock.uomName}
                                        {stock.expirationDate
                                            ? ` · Expires ${stock.expirationDate}`
                                            : ""}
                                    </p>
                                )}
                                {selectedLine && stocks.length === 0 && (
                                    <p className="text-xs text-muted-foreground">
                                        No eligible finished-product lots at this source.
                                    </p>
                                )}
                            </div>
                        )
                    })}
                    <FieldError>{errors.lines}</FieldError>
                    {values.lines.length > 0 &&
                        values.lines.some(
                            (line) => (quantityUnits(line.qtyDelivered) ?? BigInt(0)) <= BigInt(0),
                        ) && (
                            <p className="text-xs text-muted-foreground">
                                Enter a positive quantity for every allocation.
                            </p>
                        )}
                </div>
                <Field data-invalid={Boolean(errors.notes)}>
                    <FieldLabel htmlFor={`${id}-notes`}>Notes (optional)</FieldLabel>
                    <Textarea
                        id={`${id}-notes`}
                        maxLength={5000}
                        value={values.notes}
                        onChange={(event) => update("notes", event.target.value)}
                    />
                    <FieldError>{errors.notes}</FieldError>
                </Field>
            </fieldset>
            {saveError && (
                <Alert variant="destructive">
                    <AlertTitle>Unable to save delivery</AlertTitle>
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
                    {isSaving ? "Saving..." : order ? "Save changes" : "Create delivery order"}
                </Button>
            </DialogFooter>
        </form>
    )
}
export function DeliveryOrderForm({ open, onOpenChange, ...props }: Props) {
    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                if (!props.isSaving) onOpenChange(next)
            }}
        >
            <DialogContent
                className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-4xl"
                showCloseButton={!props.isSaving}
            >
                <DialogHeader>
                    <DialogTitle>
                        {props.order ? "Edit delivery order" : "Create delivery order"}
                    </DialogTitle>
                    <DialogDescription>
                        Allocate finished-product lots to a confirmed customer order.
                    </DialogDescription>
                </DialogHeader>
                {props.optionsError && (
                    <Alert variant="destructive">
                        <AlertTitle>Unable to load delivery options</AlertTitle>
                        <AlertDescription>
                            {props.optionsError}
                            <Button type="button" variant="outline" onClick={props.retryOptions}>
                                Retry
                            </Button>
                        </AlertDescription>
                    </Alert>
                )}
                {!props.options && props.optionsLoading && (
                    <p role="status" className="py-6 text-sm text-muted-foreground">
                        Loading sales orders and available stock...
                    </p>
                )}
                {open && props.options && (
                    <FormContent
                        key={props.order?.deliveryOrderId ?? "new"}
                        {...props}
                        options={props.options}
                        onOpenChange={onOpenChange}
                    />
                )}
            </DialogContent>
        </Dialog>
    )
}
