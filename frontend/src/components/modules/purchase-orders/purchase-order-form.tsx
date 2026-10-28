"use client"

import Link from "next/link"
import { useId, useRef, useState, type FormEvent } from "react"
import { Plus, Trash2 } from "lucide-react"

import {
    calculatePurchaseOrderLineTotal,
    calculatePurchaseOrderTotal,
    createEmptyPurchaseOrderLine,
    formatPurchaseOrderDecimal,
    localTodayDate,
    toPurchaseOrderFormValues,
    validatePurchaseOrder,
    type PurchaseOrder,
    type PurchaseOrderDetail,
    type PurchaseOrderFormErrors,
    type PurchaseOrderFormValues,
    type PurchaseOrderLineFormValues,
    type PurchaseOrderOptions,
} from "@/components/modules/purchase-orders/purchase-order.schema"
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
import {
    Field,
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldLabel,
    FieldLegend,
    FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { usePurchaseOrderDetail } from "@/hooks/modules/purchase-orders/use-purchase-orders"

type Props = {
    open: boolean
    onOpenChange: (open: boolean) => void
    order: PurchaseOrder | null
    orders: PurchaseOrder[]
    options: PurchaseOrderOptions
    optionsReady: boolean
    optionsError: Error | null
    isOptionsLoading: boolean
    retryOptions: () => void
    onSave: (values: PurchaseOrderFormValues, order: PurchaseOrder | null) => Promise<boolean>
    isSaving: boolean
    saveError: string | null
}
type DraftLine = PurchaseOrderLineFormValues & { uiKey: string }
type DraftValues = Omit<PurchaseOrderFormValues, "lines"> & { lines: DraftLine[] }
type ContentProps = Omit<
    Props,
    "open" | "order" | "optionsReady" | "optionsError" | "isOptionsLoading" | "retryOptions"
> & {
    order: PurchaseOrderDetail | null
    loadError: Error | null
    isFetching: boolean
    retry: () => void
}

function PurchaseOrderFormContent({
    onOpenChange,
    order,
    orders,
    options,
    onSave,
    isSaving,
    saveError,
    loadError,
    isFetching,
    retry,
}: ContentProps) {
    const id = useId()
    const nextKey = useRef(0)
    const [values, setValues] = useState<DraftValues>(() => {
        const initial: PurchaseOrderFormValues = order
            ? toPurchaseOrderFormValues(order)
            : {
                  poNumber: "",
                  supplierId: null,
                  orderDate: localTodayDate(),
                  expectedDeliveryDate: "",
                  notes: "",
                  lines: [createEmptyPurchaseOrderLine()],
              }
        return {
            ...initial,
            lines: initial.lines.map((line, index) => ({ ...line, uiKey: `initial-${index}` })),
        }
    })
    const [errors, setErrors] = useState<PurchaseOrderFormErrors>({})
    const supplierItems = options.suppliers
        .filter((supplier) => supplier.isActive || supplier.supplierId === values.supplierId)
        .map((supplier) => ({
            value: supplier.supplierId,
            label: supplier.name + (supplier.isActive ? "" : " (inactive)"),
            isActive: supplier.isActive,
        }))
    const total = calculatePurchaseOrderTotal(values.lines)

    function updateHeader<Key extends keyof Omit<PurchaseOrderFormValues, "lines">>(
        key: Key,
        value: PurchaseOrderFormValues[Key],
    ) {
        setValues((current) => ({ ...current, [key]: value }))
        setErrors((current) => ({ ...current, [key]: undefined }))
    }
    function changeSupplier(supplierId: number | null) {
        if (supplierId === values.supplierId) return
        const uiKey = `new-${nextKey.current++}`
        setValues((current) => ({
            ...current,
            supplierId,
            lines: [{ ...createEmptyPurchaseOrderLine(), uiKey }],
        }))
        setErrors((current) => ({
            ...current,
            supplierId: undefined,
            lines: undefined,
            lineErrors: undefined,
        }))
    }
    function updateLine<Key extends keyof PurchaseOrderLineFormValues>(
        uiKey: string,
        key: Key,
        value: PurchaseOrderLineFormValues[Key],
    ) {
        setValues((current) => ({
            ...current,
            lines: current.lines.map((line) =>
                line.uiKey === uiKey
                    ? {
                          ...line,
                          [key]: value,
                          ...(key === "uomId" && line.uomId !== value ? { unitPrice: "" } : {}),
                      }
                    : line,
            ),
        }))
        setErrors((current) => ({ ...current, lineErrors: undefined }))
    }
    function changeItem(uiKey: string, itemId: number | null) {
        const item = options.items.find((candidate) => candidate.itemId === itemId)
        const quote = options.supplierItems.find(
            (candidate) =>
                candidate.supplierId === values.supplierId &&
                candidate.itemId === itemId &&
                candidate.isActive,
        )
        const quotedUnit = quote?.defaultUomId ?? item?.primaryUomId ?? null
        const compatibleQuote = options.uoms.some(
            (unit) => unit.uomId === quotedUnit && unit.uomClassId === item?.uomClassId,
        )
        setValues((current) => ({
            ...current,
            lines: current.lines.map((line) =>
                line.uiKey === uiKey
                    ? {
                          ...line,
                          itemId,
                          uomId: compatibleQuote ? quotedUnit : (item?.primaryUomId ?? null),
                          qtyOrdered: "",
                          unitPrice: compatibleQuote ? (quote?.defaultPrice ?? "") : "",
                      }
                    : line,
            ),
        }))
        setErrors((current) => ({ ...current, lineErrors: undefined }))
    }
    function addLine() {
        if (isSaving || values.lines.length >= 100) return
        const uiKey = `new-${nextKey.current++}`
        setValues((current) => ({
            ...current,
            lines: [...current.lines, { ...createEmptyPurchaseOrderLine(), uiKey }],
        }))
        setErrors((current) => ({ ...current, lines: undefined }))
    }
    function removeLine(uiKey: string) {
        if (isSaving || values.lines.length <= 1) return
        setValues((current) => ({
            ...current,
            lines: current.lines.filter((line) => line.uiKey !== uiKey),
        }))
        setErrors((current) => ({ ...current, lines: undefined, lineErrors: undefined }))
    }
    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (isSaving) return
        const normalized: PurchaseOrderFormValues = {
            poNumber: values.poNumber.trim().toUpperCase(),
            supplierId: values.supplierId,
            orderDate: values.orderDate,
            expectedDeliveryDate: values.expectedDeliveryDate,
            notes: values.notes.trim(),
            lines: values.lines.map((line) => ({
                itemId: line.itemId,
                uomId: line.uomId,
                qtyOrdered: line.qtyOrdered.trim(),
                unitPrice: line.unitPrice.trim(),
            })),
        }
        const nextErrors = validatePurchaseOrder(normalized, options, orders, order)
        setErrors(nextErrors)
        const headerField = (
            ["poNumber", "supplierId", "orderDate", "expectedDeliveryDate", "notes"] as const
        ).find((field) => nextErrors[field])
        if (headerField) {
            document.getElementById(`${id}-${headerField}`)?.focus()
            return
        }
        const invalidLine =
            nextErrors.lineErrors?.findIndex((line) => line && Object.keys(line).length > 0) ?? -1
        if (invalidLine >= 0) {
            const field = Object.keys(nextErrors.lineErrors![invalidLine])[0]
            document.getElementById(`${id}-${values.lines[invalidLine].uiKey}-${field}`)?.focus()
            return
        }
        if (nextErrors.lines) {
            document.getElementById(`${id}-lines`)?.focus()
            return
        }
        if (await onSave(normalized, order)) onOpenChange(false)
    }

    return (
        <DialogContent
            className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-5xl"
            showCloseButton={!isSaving}
        >
            <DialogHeader>
                <DialogTitle className="break-words pr-6">
                    {order ? `Edit ${order.poNumber}` : "Create purchase order"}
                </DialogTitle>
                <DialogDescription>
                    Prepare a draft purchase from one supplier. Confirm quantities and prices in
                    each line&apos;s purchase unit.
                </DialogDescription>
            </DialogHeader>
            {loadError && (
                <Alert variant="destructive">
                    <AlertTitle>Some order data could not be refreshed</AlertTitle>
                    <AlertDescription>
                        {loadError.message}
                        <Button
                            variant="outline"
                            className="mt-2"
                            disabled={isFetching || isSaving}
                            onClick={retry}
                        >
                            {isFetching ? "Retrying..." : "Retry"}
                        </Button>
                    </AlertDescription>
                </Alert>
            )}
            {!options.suppliers.some((supplier) => supplier.isActive) && (
                <Alert>
                    <AlertTitle>An active supplier is required</AlertTitle>
                    <AlertDescription>
                        Add or reactivate a supplier before creating this order.
                        <Button
                            variant="outline"
                            className="mt-2"
                            disabled={isSaving}
                            render={<Link href="/suppliers" />}
                            nativeButton={false}
                        >
                            View suppliers
                        </Button>
                    </AlertDescription>
                </Alert>
            )}
            <form onSubmit={submit} className="flex flex-col gap-5" aria-busy={isSaving}>
                <FieldGroup className="grid gap-4 sm:grid-cols-2">
                    <Field data-invalid={Boolean(errors.poNumber)} data-disabled={isSaving}>
                        <FieldLabel htmlFor={`${id}-poNumber`}>PO number</FieldLabel>
                        <Input
                            id={`${id}-poNumber`}
                            name="poNumber"
                            required
                            maxLength={30}
                            value={values.poNumber}
                            disabled={isSaving}
                            onChange={(event) =>
                                updateHeader("poNumber", event.target.value.toUpperCase())
                            }
                            className="h-10"
                            aria-invalid={Boolean(errors.poNumber)}
                            aria-describedby={`${id}-poNumber-error`}
                        />
                        <FieldError id={`${id}-poNumber-error`}>{errors.poNumber}</FieldError>
                    </Field>
                    <Field data-invalid={Boolean(errors.supplierId)} data-disabled={isSaving}>
                        <FieldLabel htmlFor={`${id}-supplierId`}>Supplier</FieldLabel>
                        <Select
                            items={supplierItems}
                            value={values.supplierId}
                            disabled={isSaving}
                            onValueChange={changeSupplier}
                        >
                            <SelectTrigger
                                id={`${id}-supplierId`}
                                className="w-full data-[size=default]:h-10"
                                aria-invalid={Boolean(errors.supplierId)}
                                aria-describedby={`${id}-supplier-help`}
                            >
                                <SelectValue className="min-w-0" placeholder="Select a supplier" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    {supplierItems.map((supplier) => (
                                        <SelectItem
                                            key={supplier.value}
                                            value={supplier.value}
                                            disabled={!supplier.isActive}
                                        >
                                            {supplier.label}
                                        </SelectItem>
                                    ))}
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                        <div id={`${id}-supplier-help`}>
                            <FieldDescription>
                                Changing the supplier clears all order lines.
                            </FieldDescription>
                            <FieldError>{errors.supplierId}</FieldError>
                        </div>
                    </Field>
                    <Field data-invalid={Boolean(errors.orderDate)} data-disabled={isSaving}>
                        <FieldLabel htmlFor={`${id}-orderDate`}>Order date</FieldLabel>
                        <Input
                            id={`${id}-orderDate`}
                            name="orderDate"
                            type="date"
                            required
                            value={values.orderDate}
                            disabled={isSaving}
                            onChange={(event) => updateHeader("orderDate", event.target.value)}
                            className="h-10"
                            aria-invalid={Boolean(errors.orderDate)}
                            aria-describedby={`${id}-orderDate-error`}
                        />
                        <FieldError id={`${id}-orderDate-error`}>{errors.orderDate}</FieldError>
                    </Field>
                    <Field
                        data-invalid={Boolean(errors.expectedDeliveryDate)}
                        data-disabled={isSaving}
                    >
                        <FieldLabel htmlFor={`${id}-expectedDeliveryDate`}>
                            Expected delivery{" "}
                            <span className="font-normal text-muted-foreground">(optional)</span>
                        </FieldLabel>
                        <Input
                            id={`${id}-expectedDeliveryDate`}
                            name="expectedDeliveryDate"
                            type="date"
                            min={values.orderDate || undefined}
                            value={values.expectedDeliveryDate}
                            disabled={isSaving}
                            onChange={(event) =>
                                updateHeader("expectedDeliveryDate", event.target.value)
                            }
                            className="h-10"
                            aria-invalid={Boolean(errors.expectedDeliveryDate)}
                            aria-describedby={`${id}-expectedDeliveryDate-error`}
                        />
                        <FieldError id={`${id}-expectedDeliveryDate-error`}>
                            {errors.expectedDeliveryDate}
                        </FieldError>
                    </Field>
                </FieldGroup>
                <section
                    id={`${id}-lines`}
                    tabIndex={-1}
                    className="flex flex-col gap-4 outline-none"
                    aria-labelledby={`${id}-lines-heading`}
                >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h3 id={`${id}-lines-heading`} className="font-medium">
                                Order lines
                            </h3>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Supplier offers can fill the initial unit and price. Changing a unit
                                clears its price.
                            </p>
                        </div>
                        <Button
                            type="button"
                            variant="outline"
                            disabled={isSaving || values.lines.length >= 100 || !values.supplierId}
                            onClick={addLine}
                        >
                            <Plus />
                            Add line
                        </Button>
                    </div>
                    <FieldError>{errors.lines}</FieldError>
                    {values.lines.map((line, index) => {
                        const selected = options.items.find((item) => item.itemId === line.itemId)
                        const itemItems = options.items
                            .filter(
                                (item) =>
                                    (item.isActive && item.itemType !== "Finished Good") ||
                                    item.itemId === line.itemId,
                            )
                            .map((item) => ({
                                value: item.itemId,
                                label: `${item.sku} · ${item.name}${item.isActive && item.itemType !== "Finished Good" ? "" : " (unavailable)"}`,
                                available: item.isActive && item.itemType !== "Finished Good",
                            }))
                        const unitItems = options.uoms
                            .filter((unit) => unit.uomClassId === selected?.uomClassId)
                            .map((unit) => ({ value: unit.uomId, label: unit.name }))
                        const lineErrors = errors.lineErrors?.[index] ?? {}
                        const lineTotal = calculatePurchaseOrderLineTotal(
                            line.qtyOrdered,
                            line.unitPrice,
                        )
                        const prefix = `${id}-${line.uiKey}`
                        return (
                            <FieldSet
                                key={line.uiKey}
                                className="min-w-0 rounded-lg border p-4"
                                disabled={isSaving}
                            >
                                <FieldLegend
                                    variant="label"
                                    className="flex w-full items-center justify-between gap-3"
                                >
                                    <span>Line {index + 1}</span>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        disabled={isSaving || values.lines.length <= 1}
                                        onClick={() => removeLine(line.uiKey)}
                                        aria-label={`Remove line ${index + 1}`}
                                    >
                                        <Trash2 />
                                        Remove
                                    </Button>
                                </FieldLegend>
                                <FieldGroup className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                                    <Field
                                        className="min-w-0 lg:col-span-2"
                                        data-invalid={Boolean(lineErrors.itemId)}
                                        data-disabled={isSaving || !values.supplierId}
                                    >
                                        <FieldLabel htmlFor={`${prefix}-itemId`}>
                                            Material
                                        </FieldLabel>
                                        <Select
                                            items={itemItems}
                                            value={line.itemId}
                                            disabled={isSaving || !values.supplierId}
                                            onValueChange={(value) => changeItem(line.uiKey, value)}
                                        >
                                            <SelectTrigger
                                                id={`${prefix}-itemId`}
                                                className="w-full data-[size=default]:h-10"
                                                aria-invalid={Boolean(lineErrors.itemId)}
                                                aria-describedby={`${prefix}-itemId-error`}
                                            >
                                                <SelectValue
                                                    className="min-w-0"
                                                    placeholder="Select a material"
                                                />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectGroup>
                                                    {itemItems.map((item) => (
                                                        <SelectItem
                                                            key={item.value}
                                                            value={item.value}
                                                            disabled={!item.available}
                                                        >
                                                            {item.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectGroup>
                                            </SelectContent>
                                        </Select>
                                        <FieldError id={`${prefix}-itemId-error`}>
                                            {lineErrors.itemId}
                                        </FieldError>
                                    </Field>
                                    <Field
                                        className="min-w-0"
                                        data-invalid={Boolean(lineErrors.uomId)}
                                        data-disabled={isSaving || !selected}
                                    >
                                        <FieldLabel htmlFor={`${prefix}-uomId`}>
                                            Purchase unit
                                        </FieldLabel>
                                        <Select
                                            items={unitItems}
                                            value={line.uomId}
                                            disabled={isSaving || !selected}
                                            onValueChange={(value) =>
                                                updateLine(line.uiKey, "uomId", value)
                                            }
                                        >
                                            <SelectTrigger
                                                id={`${prefix}-uomId`}
                                                className="w-full data-[size=default]:h-10"
                                                aria-invalid={Boolean(lineErrors.uomId)}
                                                aria-describedby={`${prefix}-uomId-error`}
                                            >
                                                <SelectValue placeholder="Select unit" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectGroup>
                                                    {unitItems.map((unit) => (
                                                        <SelectItem
                                                            key={unit.value}
                                                            value={unit.value}
                                                        >
                                                            {unit.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectGroup>
                                            </SelectContent>
                                        </Select>
                                        <FieldError id={`${prefix}-uomId-error`}>
                                            {lineErrors.uomId}
                                        </FieldError>
                                    </Field>
                                    <Field
                                        data-invalid={Boolean(lineErrors.qtyOrdered)}
                                        data-disabled={isSaving}
                                    >
                                        <FieldLabel htmlFor={`${prefix}-qtyOrdered`}>
                                            Ordered quantity
                                        </FieldLabel>
                                        <Input
                                            id={`${prefix}-qtyOrdered`}
                                            name={`line-${index}-quantity`}
                                            inputMode="decimal"
                                            maxLength={15}
                                            required
                                            value={line.qtyOrdered}
                                            disabled={isSaving}
                                            onChange={(event) =>
                                                updateLine(
                                                    line.uiKey,
                                                    "qtyOrdered",
                                                    event.target.value,
                                                )
                                            }
                                            className="h-10"
                                            aria-invalid={Boolean(lineErrors.qtyOrdered)}
                                            aria-describedby={`${prefix}-qtyOrdered-error`}
                                        />
                                        <FieldError id={`${prefix}-qtyOrdered-error`}>
                                            {lineErrors.qtyOrdered}
                                        </FieldError>
                                    </Field>
                                    <Field
                                        data-invalid={Boolean(lineErrors.unitPrice)}
                                        data-disabled={isSaving}
                                    >
                                        <FieldLabel htmlFor={`${prefix}-unitPrice`}>
                                            Unit price
                                        </FieldLabel>
                                        <Input
                                            id={`${prefix}-unitPrice`}
                                            name={`line-${index}-price`}
                                            inputMode="decimal"
                                            maxLength={15}
                                            required
                                            value={line.unitPrice}
                                            disabled={isSaving}
                                            onChange={(event) =>
                                                updateLine(
                                                    line.uiKey,
                                                    "unitPrice",
                                                    event.target.value,
                                                )
                                            }
                                            className="h-10"
                                            aria-invalid={Boolean(lineErrors.unitPrice)}
                                            aria-describedby={`${prefix}-unitPrice-error`}
                                        />
                                        <FieldError id={`${prefix}-unitPrice-error`}>
                                            {lineErrors.unitPrice}
                                        </FieldError>
                                    </Field>
                                </FieldGroup>
                                <p className="break-words text-right text-sm text-muted-foreground">
                                    Line value{" "}
                                    <span className="ml-2 font-medium text-foreground tabular-nums">
                                        {lineTotal === null
                                            ? "—"
                                            : formatPurchaseOrderDecimal(lineTotal)}
                                    </span>
                                </p>
                            </FieldSet>
                        )
                    })}
                    <p className="text-sm text-muted-foreground" aria-live="polite">
                        {values.lines.length} of 100 lines
                    </p>
                </section>
                <Field data-invalid={Boolean(errors.notes)} data-disabled={isSaving}>
                    <FieldLabel htmlFor={`${id}-notes`}>
                        Notes <span className="font-normal text-muted-foreground">(optional)</span>
                    </FieldLabel>
                    <Textarea
                        id={`${id}-notes`}
                        name="notes"
                        rows={3}
                        maxLength={5000}
                        value={values.notes}
                        disabled={isSaving}
                        onChange={(event) => updateHeader("notes", event.target.value)}
                        aria-invalid={Boolean(errors.notes)}
                        aria-describedby={`${id}-notes-error`}
                    />
                    <FieldError id={`${id}-notes-error`}>{errors.notes}</FieldError>
                </Field>
                {saveError && (
                    <Alert variant="destructive">
                        <AlertDescription>{saveError}</AlertDescription>
                    </Alert>
                )}
                <DialogFooter className="sticky bottom-0 bg-popover">
                    <div className="mr-auto flex min-w-0 items-center gap-3">
                        <span className="text-sm text-muted-foreground">Order value</span>
                        <span
                            className="min-w-0 break-words text-lg font-semibold tabular-nums"
                            aria-live="polite"
                        >
                            {total === null ? "—" : formatPurchaseOrderDecimal(total)}
                        </span>
                    </div>
                    <Button
                        type="button"
                        variant="outline"
                        disabled={isSaving}
                        onClick={() => onOpenChange(false)}
                    >
                        Cancel
                    </Button>
                    <Button type="submit" disabled={isSaving}>
                        {isSaving ? "Saving..." : order ? "Save draft" : "Create draft"}
                    </Button>
                </DialogFooter>
            </form>
        </DialogContent>
    )
}

export function PurchaseOrderForm({
    open,
    onOpenChange,
    order,
    optionsReady,
    optionsError,
    isOptionsLoading,
    retryOptions,
    ...props
}: Props) {
    const detail = usePurchaseOrderDetail(open && order ? order.poId : null)
    const serverOrder = order ? detail.order : null
    const ready = optionsReady && (!order || serverOrder !== null)
    const editable = !serverOrder || (serverOrder.status === "Draft" && !serverOrder.hasReceipts)
    const retry = () => {
        retryOptions()
        if (order) detail.retry()
    }
    const isFetching = isOptionsLoading || detail.isFetching
    const loadError = optionsError ?? (order ? detail.loadError : null)

    return (
        <Dialog
            open={open}
            onOpenChange={(value) => {
                if (!props.isSaving) onOpenChange(value)
            }}
        >
            {open &&
                (ready && editable ? (
                    <PurchaseOrderFormContent
                        key={order?.poId ?? "new"}
                        order={serverOrder}
                        onOpenChange={onOpenChange}
                        loadError={loadError}
                        isFetching={isFetching}
                        retry={retry}
                        {...props}
                    />
                ) : (
                    <DialogContent
                        className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl"
                        showCloseButton={!props.isSaving}
                    >
                        <DialogHeader>
                            <DialogTitle className="break-words pr-6">
                                {order ? `Edit ${order.poNumber}` : "Create purchase order"}
                            </DialogTitle>
                            <DialogDescription>
                                Load supplier and material options before preparing this draft.
                            </DialogDescription>
                        </DialogHeader>
                        {!editable ? (
                            <Alert>
                                <AlertTitle>This order can no longer be edited</AlertTitle>
                                <AlertDescription>
                                    Only draft orders without receipts can be changed. View the
                                    order to review its current status and receiving quantities.
                                </AlertDescription>
                            </Alert>
                        ) : loadError ? (
                            <Alert variant="destructive">
                                <AlertTitle>Unable to load order data</AlertTitle>
                                <AlertDescription>
                                    {loadError.message}
                                    <Button
                                        variant="outline"
                                        className="mt-2"
                                        onClick={retry}
                                        disabled={isFetching || props.isSaving}
                                    >
                                        {isFetching ? "Retrying..." : "Retry"}
                                    </Button>
                                </AlertDescription>
                            </Alert>
                        ) : (
                            <div
                                className="space-y-3"
                                aria-busy="true"
                                aria-label="Loading purchase order form"
                            >
                                <Skeleton className="h-10 rounded-lg" />
                                <Skeleton className="h-52 rounded-lg" />
                            </div>
                        )}
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
                    </DialogContent>
                ))}
        </Dialog>
    )
}
