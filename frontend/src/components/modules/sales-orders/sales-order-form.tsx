"use client"

import { useId, useRef, useState, type FormEvent } from "react"
import { Plus, Trash2 } from "lucide-react"
import {
    formatSalesDecimal,
    previewSalesTotal,
    validateSalesOrder,
    type SalesOrder,
    type SalesOrderOptions,
    type SalesOrderFormValues,
    type SalesOrderFormErrors,
} from "@/components/modules/sales-orders/sales-order.schema"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

type Props = {
    open: boolean
    onOpenChange: (open: boolean) => void
    order: SalesOrder | null
    options: SalesOrderOptions
    optionsReady: boolean
    optionsError: Error | null
    retryOptions: () => void
    onSave: (values: SalesOrderFormValues, order: SalesOrder | null) => Promise<boolean>
    isSaving: boolean
    saveError: string | null
}
function FormContent({
    order,
    options,
    onSave,
    onOpenChange,
    isSaving,
    saveError,
}: Pick<Props, "order" | "options" | "onSave" | "onOpenChange" | "isSaving" | "saveError">) {
    const id = useId()
    const nextKey = useRef(0)
    const [values, setValues] = useState<
        Omit<SalesOrderFormValues, "lines"> & {
            lines: (SalesOrderFormValues["lines"][number] & { uiKey: string })[]
        }
    >(() => {
        const today = new Date()
        return {
            salesOrderNumber: order?.salesOrderNumber ?? "",
            customerId: order?.customerId ?? null,
            orderDate:
                order?.orderDate ??
                `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`,
            requestedDeliveryDate: order?.requestedDeliveryDate ?? "",
            notes: order?.notes ?? "",
            lines: order
                ? order.lines.map((line, index) => ({
                      itemId: line.itemId,
                      uomId: line.uomId,
                      qtyOrdered: line.qtyOrdered,
                      unitPrice: line.unitPrice,
                      uiKey: `initial-${index}`,
                  }))
                : [
                      {
                          itemId: null,
                          uomId: null,
                          qtyOrdered: "",
                          unitPrice: "",
                          uiKey: "initial-0",
                      },
                  ],
        }
    })
    const [errors, setErrors] = useState<SalesOrderFormErrors>({})
    const customerItems = options.customers
        .filter((customer) => customer.isActive || customer.customerId === values.customerId)
        .map((customer) => ({
            value: customer.customerId,
            label: customer.name + (customer.isActive ? "" : " (inactive)"),
            disabled: !customer.isActive,
        }))
    const itemItems = options.items
        .filter((item) => item.isActive || values.lines.some((line) => line.itemId === item.itemId))
        .map((item) => ({
            value: item.itemId,
            label: `${item.sku} - ${item.name}${item.isActive ? "" : " (inactive)"}`,
            disabled: !item.isActive,
        }))
    const preview = previewSalesTotal(values.lines)
    function updateHeader<Key extends Exclude<keyof SalesOrderFormValues, "lines">>(
        key: Key,
        value: SalesOrderFormValues[Key],
    ) {
        setValues((current) => ({ ...current, [key]: value }))
        setErrors((current) => ({ ...current, [key]: "" }))
    }
    function updateLine(index: number, updates: Partial<SalesOrderFormValues["lines"][number]>) {
        setValues((current) => ({
            ...current,
            lines: current.lines.map((line, position) =>
                position === index ? { ...line, ...updates } : line,
            ),
        }))
        setErrors((current) =>
            Object.fromEntries(
                Object.entries(current).filter(([key]) => !key.startsWith(`lines.${index}.`)),
            ),
        )
    }
    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (isSaving) return
        const nextErrors = validateSalesOrder(values, options)
        setErrors(nextErrors)
        const first = Object.keys(nextErrors)[0]
        if (first) {
            const element = event.currentTarget.elements.namedItem(first)
            if (element instanceof HTMLElement) element.focus()
            return
        }
        const writable: SalesOrderFormValues = {
            ...values,
            lines: values.lines.map(({ itemId, uomId, qtyOrdered, unitPrice }) => ({
                itemId,
                uomId,
                qtyOrdered,
                unitPrice,
            })),
        }
        if (await onSave(writable, order)) onOpenChange(false)
    }
    return (
        <form onSubmit={submit} className="space-y-5" aria-busy={isSaving} noValidate>
            {saveError && (
                <Alert variant="destructive">
                    <AlertTitle>Unable to save order</AlertTitle>
                    <AlertDescription>{saveError}</AlertDescription>
                </Alert>
            )}
            <FieldGroup className="gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                    <Field data-invalid={Boolean(errors.salesOrderNumber)}>
                        <FieldLabel htmlFor={`${id}-number`}>Sales order number</FieldLabel>
                        <Input
                            id={`${id}-number`}
                            name="salesOrderNumber"
                            maxLength={30}
                            value={values.salesOrderNumber}
                            onChange={(event) =>
                                updateHeader("salesOrderNumber", event.target.value)
                            }
                            disabled={isSaving}
                            aria-invalid={Boolean(errors.salesOrderNumber)}
                            aria-describedby={`${id}-number-error`}
                        />
                        <FieldError id={`${id}-number-error`}>{errors.salesOrderNumber}</FieldError>
                    </Field>
                    <Field data-invalid={Boolean(errors.customerId)}>
                        <FieldLabel htmlFor={`${id}-customer`}>Customer</FieldLabel>
                        <Select
                            items={customerItems}
                            value={values.customerId}
                            onValueChange={(value) => updateHeader("customerId", value)}
                            disabled={isSaving}
                        >
                            <SelectTrigger
                                id={`${id}-customer`}
                                name="customerId"
                                className="w-full"
                                aria-invalid={Boolean(errors.customerId)}
                                aria-describedby={`${id}-customer-error`}
                            >
                                <SelectValue placeholder="Select customer" />
                            </SelectTrigger>
                            <SelectContent>
                                {customerItems.map((item) => (
                                    <SelectItem
                                        key={item.value}
                                        value={item.value}
                                        disabled={item.disabled}
                                    >
                                        {item.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <FieldError id={`${id}-customer-error`}>{errors.customerId}</FieldError>
                    </Field>
                    {(
                        [
                            ["orderDate", "Order date"],
                            ["requestedDeliveryDate", "Requested delivery date (optional)"],
                        ] as const
                    ).map(([key, label]) => (
                        <Field key={key} data-invalid={Boolean(errors[key])}>
                            <FieldLabel htmlFor={`${id}-${key}`}>{label}</FieldLabel>
                            <Input
                                id={`${id}-${key}`}
                                name={key}
                                type="date"
                                value={values[key]}
                                onChange={(event) => updateHeader(key, event.target.value)}
                                disabled={isSaving}
                                aria-invalid={Boolean(errors[key])}
                                aria-describedby={`${id}-${key}-error`}
                            />
                            <FieldError id={`${id}-${key}-error`}>{errors[key]}</FieldError>
                        </Field>
                    ))}
                </div>
                <Field>
                    <FieldLabel htmlFor={`${id}-notes`}>Notes (optional)</FieldLabel>
                    <Textarea
                        id={`${id}-notes`}
                        name="notes"
                        maxLength={5000}
                        value={values.notes}
                        onChange={(event) => updateHeader("notes", event.target.value)}
                        disabled={isSaving}
                    />
                    <FieldError>{errors.notes}</FieldError>
                </Field>
            </FieldGroup>
            <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="font-medium">Finished products</h3>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isSaving || values.lines.length >= 100}
                        onClick={() => {
                            const uiKey = `added-${nextKey.current++}`
                            setValues((current) => ({
                                ...current,
                                lines: [
                                    ...current.lines,
                                    {
                                        itemId: null,
                                        uomId: null,
                                        qtyOrdered: "",
                                        unitPrice: "",
                                        uiKey,
                                    },
                                ],
                            }))
                        }}
                    >
                        <Plus />
                        Add line
                    </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                    Quantities use each product�s primary unit. Confirmation opens the order for
                    delivery planning.
                </p>
                <FieldError>{errors.lines}</FieldError>
                {values.lines.map((line, index) => {
                    const item = options.items.find((candidate) => candidate.itemId === line.itemId)
                    return (
                        <fieldset key={line.uiKey} className="rounded-lg border p-4">
                            <legend className="px-1 text-sm font-medium">Line {index + 1}</legend>
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_auto]">
                                <Field data-invalid={Boolean(errors[`lines.${index}.itemId`])}>
                                    <FieldLabel htmlFor={`${id}-item-${index}`}>Product</FieldLabel>
                                    <Select
                                        items={itemItems}
                                        value={line.itemId}
                                        onValueChange={(value) => {
                                            const selected = options.items.find(
                                                (candidate) => candidate.itemId === value,
                                            )
                                            updateLine(index, {
                                                itemId: value,
                                                uomId: selected?.primaryUomId ?? null,
                                            })
                                        }}
                                        disabled={isSaving}
                                    >
                                        <SelectTrigger
                                            id={`${id}-item-${index}`}
                                            name={`lines.${index}.itemId`}
                                            className="w-full"
                                            aria-invalid={Boolean(errors[`lines.${index}.itemId`])}
                                            aria-describedby={`${id}-item-error-${index}`}
                                        >
                                            <SelectValue placeholder="Select product" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {itemItems.map((entry) => (
                                                <SelectItem
                                                    key={entry.value}
                                                    value={entry.value}
                                                    disabled={entry.disabled}
                                                >
                                                    {entry.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FieldError id={`${id}-item-error-${index}`}>
                                        {errors[`lines.${index}.itemId`]}
                                    </FieldError>
                                </Field>
                                <Field data-invalid={Boolean(errors[`lines.${index}.qtyOrdered`])}>
                                    <FieldLabel htmlFor={`${id}-qty-${index}`}>
                                        Quantity{item ? ` (${item.primaryUomName})` : ""}
                                    </FieldLabel>
                                    <Input
                                        id={`${id}-qty-${index}`}
                                        name={`lines.${index}.qtyOrdered`}
                                        inputMode="decimal"
                                        value={line.qtyOrdered}
                                        onChange={(event) =>
                                            updateLine(index, { qtyOrdered: event.target.value })
                                        }
                                        disabled={isSaving}
                                        aria-invalid={Boolean(errors[`lines.${index}.qtyOrdered`])}
                                        aria-describedby={`${id}-qty-error-${index}`}
                                    />
                                    <FieldError id={`${id}-qty-error-${index}`}>
                                        {errors[`lines.${index}.qtyOrdered`]}
                                    </FieldError>
                                </Field>
                                <Field data-invalid={Boolean(errors[`lines.${index}.unitPrice`])}>
                                    <FieldLabel htmlFor={`${id}-price-${index}`}>
                                        Unit price
                                    </FieldLabel>
                                    <Input
                                        id={`${id}-price-${index}`}
                                        name={`lines.${index}.unitPrice`}
                                        inputMode="decimal"
                                        value={line.unitPrice}
                                        onChange={(event) =>
                                            updateLine(index, { unitPrice: event.target.value })
                                        }
                                        disabled={isSaving}
                                        aria-invalid={Boolean(errors[`lines.${index}.unitPrice`])}
                                        aria-describedby={`${id}-price-error-${index}`}
                                    />
                                    <FieldError id={`${id}-price-error-${index}`}>
                                        {errors[`lines.${index}.unitPrice`]}
                                    </FieldError>
                                </Field>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon-sm"
                                    className="sm:mt-6"
                                    aria-label={`Remove line ${index + 1}`}
                                    disabled={isSaving || values.lines.length === 1}
                                    onClick={() => {
                                        setValues((current) => ({
                                            ...current,
                                            lines: current.lines.filter(
                                                (_, position) => position !== index,
                                            ),
                                        }))
                                        setErrors({})
                                    }}
                                >
                                    <Trash2 />
                                </Button>
                            </div>
                        </fieldset>
                    )
                })}
            </div>
            <p className="text-right text-sm text-muted-foreground">
                Order total preview:{" "}
                <span className="font-semibold text-foreground tabular-nums">
                    {preview === null ? "Enter quantities and prices" : formatSalesDecimal(preview)}
                </span>
            </p>
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
                    {isSaving ? "Saving..." : order ? "Save changes" : "Create sales order"}
                </Button>
            </DialogFooter>
        </form>
    )
}
export function SalesOrderForm(props: Props) {
    return (
        <Dialog
            open={props.open}
            onOpenChange={(open) => {
                if (!props.isSaving) props.onOpenChange(open)
            }}
        >
            <DialogContent
                className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-4xl"
                showCloseButton={!props.isSaving}
            >
                <DialogHeader>
                    <DialogTitle>
                        {props.order ? "Edit sales order" : "Create sales order"}
                    </DialogTitle>
                    <DialogDescription>
                        Record the customer and finished products to deliver.
                    </DialogDescription>
                </DialogHeader>
                {props.optionsReady ? (
                    <FormContent
                        key={`${props.order?.salesOrderId ?? "new"}-${props.open}`}
                        {...props}
                    />
                ) : (
                    <Alert>
                        <AlertTitle>
                            {props.optionsError
                                ? "Unable to load order options"
                                : "Loading customers and products..."}
                        </AlertTitle>
                        <AlertDescription>
                            {props.optionsError?.message}
                            <Button variant="outline" onClick={props.retryOptions}>
                                Retry options
                            </Button>
                        </AlertDescription>
                    </Alert>
                )}
            </DialogContent>
        </Dialog>
    )
}
