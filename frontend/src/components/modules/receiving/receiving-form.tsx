"use client"

import Link from "next/link"
import { useId, useRef, useState, type FormEvent } from "react"
import { Plus, RefreshCw, Trash2 } from "lucide-react"

import {
    calculateReceiptPrimaryQuantity,
    calculateReceiptUnitCost,
    compareReceivingDecimals,
    createEmptyReceivingLine,
    formatReceivingDecimal,
    reviewReceivingBalances,
    validateReceipt,
    type ReceivingFormErrors,
    type ReceivingFormValues,
    type ReceivingLineFormValues,
    type ReceivingOptions,
} from "@/components/modules/receiving/receiving.schema"
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
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"

type ReceivingFormProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    options: ReceivingOptions
    optionsReady: boolean
    optionsError: Error | null
    isOptionsLoading: boolean
    retryOptions: () => Promise<ReceivingOptions | null>
    onReceive: (values: ReceivingFormValues) => Promise<boolean>
    isReceiving: boolean
    receiveError: string | null
    receiveConflict: boolean
}

type DraftLine = ReceivingLineFormValues & { uiKey: string }
type Draft = Omit<ReceivingFormValues, "lines"> & { lines: DraftLine[] }
const textFields = [
    { key: "lotNumber", label: "Internal lot number", maxLength: 100, required: true },
    { key: "supplierLotNumber", label: "Supplier lot number (optional)", maxLength: 100 },
    { key: "manufactureDate", label: "Manufacture date (optional)", type: "date" },
    { key: "expirationDate", label: "Expiration date (optional)", type: "date" },
] as const

function ReceivingFormContent({
    onOpenChange,
    options,
    optionsReady,
    optionsError,
    isOptionsLoading,
    retryOptions,
    onReceive,
    isReceiving,
    receiveError,
    receiveConflict,
}: Omit<ReceivingFormProps, "open">) {
    const id = useId()
    const nextKey = useRef(1)
    const [values, setValues] = useState<Draft>({
        poId: null,
        lines: [{ ...createEmptyReceivingLine(), uiKey: "lot-0" }],
    })
    const [errors, setErrors] = useState<ReceivingFormErrors>({})
    const [isReviewing, setIsReviewing] = useState(false)
    const [reviewed, setReviewed] = useState(false)
    const order = options.orders.find((candidate) => candidate.poId === values.poId)
    const activeLocations = options.locations.filter(
        (location) =>
            location.isActive && ["Warehouse", "Quarantine"].includes(location.locationType),
    )
    const orderItems = options.orders.map((candidate) => ({
        value: candidate.poId,
        label: `${candidate.poNumber} - ${candidate.supplierName}`,
    }))
    if (values.poId !== null && !order)
        orderItems.push({ value: values.poId, label: "Purchase order no longer available" })
    const locationItems = options.locations
        .filter((location) => ["Warehouse", "Quarantine"].includes(location.locationType))
        .map((location) => ({
            value: location.locationId,
            label: `${location.code} - ${location.name}${location.isActive ? "" : " (inactive)"}`,
            disabled: !location.isActive,
        }))
    const hasStaleBalances =
        optionsReady &&
        values.poId !== null &&
        (!order ||
            values.lines.some((line) => {
                if (line.poLineId === null) return false
                const source = order.lines.find((candidate) => candidate.poLineId === line.poLineId)
                return (
                    !source ||
                    compareReceivingDecimals(line.expectedQtyReceived, source.qtyReceived) !== 0
                )
            }))
    const busy = isReceiving || isReviewing

    function changeOrder(poId: number | null) {
        if (poId === values.poId) return
        const uiKey = `lot-${nextKey.current++}`
        setValues({ poId, lines: [{ ...createEmptyReceivingLine(), uiKey }] })
        setErrors({})
        setReviewed(false)
    }

    function updateLine<Key extends keyof ReceivingLineFormValues>(
        uiKey: string,
        key: Key,
        value: ReceivingLineFormValues[Key],
    ) {
        setValues((current) => ({
            ...current,
            lines: current.lines.map((line) =>
                line.uiKey === uiKey ? { ...line, [key]: value } : line,
            ),
        }))
        setErrors({})
        setReviewed(false)
    }

    function changeMaterial(uiKey: string, poLineId: number | null) {
        const source = order?.lines.find((line) => line.poLineId === poLineId)
        setValues((current) => {
            const snapshot =
                current.lines.find((line) => line.uiKey !== uiKey && line.poLineId === poLineId)
                    ?.expectedQtyReceived ??
                source?.qtyReceived ??
                ""
            return {
                ...current,
                lines: current.lines.map((line) =>
                    line.uiKey === uiKey
                        ? { ...line, poLineId, qtyReceived: "", expectedQtyReceived: snapshot }
                        : line,
                ),
            }
        })
        setErrors({})
        setReviewed(false)
    }

    function addLot() {
        const uiKey = `lot-${nextKey.current++}`
        setValues((current) => {
            const previous = current.lines.at(-1)
            return {
                ...current,
                lines: [
                    ...current.lines,
                    {
                        ...createEmptyReceivingLine(),
                        uiKey,
                        poLineId: previous?.poLineId ?? null,
                        expectedQtyReceived: previous?.expectedQtyReceived ?? "",
                        locationId: previous?.locationId ?? null,
                    },
                ],
            }
        })
        setErrors({})
    }

    async function reviewBalances() {
        if (busy || isOptionsLoading) return
        setIsReviewing(true)
        try {
            const latest = await retryOptions()
            if (latest) {
                setValues((current) => reviewReceivingBalances(current, latest))
                setErrors({})
                setReviewed(true)
            }
        } finally {
            setIsReviewing(false)
        }
    }

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (busy || !optionsReady || isOptionsLoading || optionsError) return
        const nextErrors = validateReceipt(values, options)
        setErrors(nextErrors)
        if (Object.keys(nextErrors).length) {
            const index = nextErrors.lineErrors?.findIndex(
                (fields) => fields && Object.keys(fields).length,
            )
            const key =
                index !== undefined && index >= 0
                    ? Object.keys(nextErrors.lineErrors![index])[0]
                    : null
            const fieldId = nextErrors.poId
                ? `${id}-order`
                : key && index !== undefined
                  ? `${id}-${values.lines[index].uiKey}-${key}`
                  : `${id}-lots`
            document.getElementById(fieldId)?.focus()
            return
        }
        if (await onReceive(values)) onOpenChange(false)
    }

    return (
        <DialogContent
            className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-3xl"
            showCloseButton={!busy}
        >
            <DialogHeader>
                <DialogTitle>Receive stock</DialogTitle>
                <DialogDescription>
                    Receive a supplier purchase order into storage. Each entry creates a traceable
                    lot.
                </DialogDescription>
            </DialogHeader>
            <form onSubmit={submit} className="space-y-5" noValidate aria-busy={busy}>
                {!optionsReady && !optionsError && (
                    <Skeleton
                        className="h-24 rounded-lg"
                        aria-label="Loading purchase orders and locations"
                    />
                )}
                {optionsError && (
                    <Alert variant="destructive">
                        <AlertTitle>Unable to load receiving options</AlertTitle>
                        <AlertDescription>
                            <p>{optionsError.message}</p>
                            <Button
                                type="button"
                                variant="outline"
                                className="mt-2"
                                onClick={() => void retryOptions()}
                                disabled={busy || isOptionsLoading}
                            >
                                {isOptionsLoading ? "Loading..." : "Retry loading options"}
                            </Button>
                        </AlertDescription>
                    </Alert>
                )}
                {optionsReady && !options.orders.length && (
                    <Alert>
                        <AlertTitle>No purchase orders ready to receive</AlertTitle>
                        <AlertDescription>
                            Send a purchase order with outstanding material quantities before
                            receiving stock.
                            <Button
                                type="button"
                                variant="link"
                                className="h-auto p-0"
                                nativeButton={false}
                                render={<Link href="/purchase-orders" />}
                            >
                                View purchase orders
                            </Button>
                        </AlertDescription>
                    </Alert>
                )}
                {optionsReady && !activeLocations.length && (
                    <Alert>
                        <AlertTitle>No receiving destination available</AlertTitle>
                        <AlertDescription>
                            Activate a warehouse or quarantine location before receiving stock.
                            <Button
                                type="button"
                                variant="link"
                                className="h-auto p-0"
                                nativeButton={false}
                                render={<Link href="/locations" />}
                            >
                                View locations
                            </Button>
                        </AlertDescription>
                    </Alert>
                )}
                <Field data-invalid={Boolean(errors.poId)}>
                    <FieldLabel htmlFor={`${id}-order`}>Purchase order</FieldLabel>
                    <Select
                        items={orderItems}
                        value={values.poId}
                        onValueChange={changeOrder}
                        disabled={busy || !optionsReady}
                    >
                        <SelectTrigger
                            id={`${id}-order`}
                            className="w-full data-[size=default]:h-10"
                            aria-invalid={Boolean(errors.poId)}
                            aria-describedby={errors.poId ? `${id}-order-error` : undefined}
                        >
                            <SelectValue placeholder="Select a sent purchase order" />
                        </SelectTrigger>
                        <SelectContent>
                            {orderItems.map((item) => (
                                <SelectItem
                                    key={item.value}
                                    value={item.value}
                                    disabled={
                                        !options.orders.some(
                                            (candidate) => candidate.poId === item.value,
                                        )
                                    }
                                >
                                    {item.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <FieldError id={`${id}-order-error`}>{errors.poId}</FieldError>
                    {order && (
                        <FieldDescription>
                            {order.status} · {order.supplierName}
                        </FieldDescription>
                    )}
                </Field>
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 id={`${id}-lots`} tabIndex={-1} className="font-medium">
                        Lots to receive
                    </h3>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={reviewBalances}
                        disabled={busy || isOptionsLoading || !optionsReady}
                    >
                        <RefreshCw />
                        {isReviewing ? "Refreshing..." : "Review latest balances"}
                    </Button>
                </div>
                {(hasStaleBalances || receiveConflict) && (
                    <Alert>
                        <AlertTitle>Review the latest purchase order balances</AlertTitle>
                        <AlertDescription>
                            Refresh and review outstanding quantities before trying again. Your
                            entered lot details are preserved.
                        </AlertDescription>
                    </Alert>
                )}
                {reviewed && (
                    <p className="text-sm text-muted-foreground" role="status">
                        Balances refreshed. Review your quantities against the remaining amounts
                        below.
                    </p>
                )}
                {errors.lines && (
                    <p className="text-sm text-destructive" role="alert">
                        {errors.lines}
                    </p>
                )}
                <div className="space-y-4">
                    {values.lines.map((line, index) => {
                        const source = order?.lines.find(
                            (candidate) => candidate.poLineId === line.poLineId,
                        )
                        const lineErrors = errors.lineErrors?.[index] ?? {}
                        const materialItems = (order?.lines ?? []).map((material) => ({
                            value: material.poLineId,
                            label: `${material.itemSku} - ${material.itemName} (${material.uomName})`,
                            disabled:
                                !material.itemIsActive || material.itemType === "Finished Good",
                        }))
                        if (line.poLineId !== null && !source)
                            materialItems.push({
                                value: line.poLineId,
                                label: "Material no longer receivable",
                                disabled: true,
                            })
                        const primaryQuantity = source
                            ? calculateReceiptPrimaryQuantity(
                                  line.qtyReceived,
                                  source.purchaseUomFactor,
                                  source.primaryUomFactor,
                              )
                            : null
                        const unitCost = source
                            ? calculateReceiptUnitCost(
                                  source.unitPrice,
                                  source.purchaseUomFactor,
                                  source.primaryUomFactor,
                              )
                            : null
                        const lineId = `${id}-${line.uiKey}`
                        return (
                            <fieldset
                                key={line.uiKey}
                                className="min-w-0 space-y-4 rounded-xl border p-4"
                                disabled={busy}
                            >
                                <legend className="px-1 text-sm font-medium">
                                    Lot {index + 1}
                                </legend>
                                <div className="flex justify-end">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        disabled={busy || values.lines.length === 1}
                                        onClick={() => {
                                            setValues((current) => ({
                                                ...current,
                                                lines: current.lines.filter(
                                                    (candidate) => candidate.uiKey !== line.uiKey,
                                                ),
                                            }))
                                            setErrors({})
                                        }}
                                        aria-label={`Remove lot ${index + 1}`}
                                    >
                                        <Trash2 /> Remove lot
                                    </Button>
                                </div>
                                <Field data-invalid={Boolean(lineErrors.poLineId)}>
                                    <FieldLabel htmlFor={`${lineId}-poLineId`}>Material</FieldLabel>
                                    <Select
                                        items={materialItems}
                                        value={line.poLineId}
                                        disabled={busy || !order}
                                        onValueChange={(value) => changeMaterial(line.uiKey, value)}
                                    >
                                        <SelectTrigger
                                            id={`${lineId}-poLineId`}
                                            className="w-full data-[size=default]:h-10"
                                            aria-invalid={Boolean(lineErrors.poLineId)}
                                            aria-describedby={
                                                lineErrors.poLineId
                                                    ? `${lineId}-material-error`
                                                    : undefined
                                            }
                                        >
                                            <SelectValue placeholder="Select a purchase order line" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {materialItems.map((item) => (
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
                                    <FieldError id={`${lineId}-material-error`}>
                                        {lineErrors.poLineId}
                                    </FieldError>
                                </Field>
                                {source && (
                                    <div className="grid gap-3 rounded-lg bg-muted/40 p-3 text-sm min-[420px]:grid-cols-3">
                                        {[
                                            { label: "Ordered", quantity: source.qtyOrdered },
                                            {
                                                label: "Already received",
                                                quantity: source.qtyReceived,
                                            },
                                            { label: "Remaining", quantity: source.qtyRemaining },
                                        ].map(({ label, quantity }) => (
                                            <div key={label}>
                                                <p className="text-muted-foreground">{label}</p>
                                                <p className="mt-1 font-medium tabular-nums">
                                                    {formatReceivingDecimal(quantity)}{" "}
                                                    {source.uomName}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {lineErrors.expectedQtyReceived && (
                                    <p
                                        id={`${lineId}-expectedQtyReceived`}
                                        tabIndex={-1}
                                        className="text-sm text-destructive"
                                        role="alert"
                                    >
                                        {lineErrors.expectedQtyReceived}
                                    </p>
                                )}
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <Field data-invalid={Boolean(lineErrors.qtyReceived)}>
                                        <FieldLabel htmlFor={`${lineId}-qtyReceived`}>
                                            Receive quantity{source ? ` (${source.uomName})` : ""}
                                        </FieldLabel>
                                        <Input
                                            id={`${lineId}-qtyReceived`}
                                            name={`quantity-${line.uiKey}`}
                                            inputMode="decimal"
                                            value={line.qtyReceived}
                                            onChange={(event) =>
                                                updateLine(
                                                    line.uiKey,
                                                    "qtyReceived",
                                                    event.target.value,
                                                )
                                            }
                                            required
                                            disabled={busy || !source}
                                            className="h-10"
                                            aria-invalid={Boolean(lineErrors.qtyReceived)}
                                            aria-describedby={`${lineId}-quantity-help ${lineErrors.qtyReceived ? `${lineId}-quantity-error` : ""}`}
                                        />
                                        <FieldDescription id={`${lineId}-quantity-help`}>
                                            Enter this lot&apos;s quantity. Several lots may share
                                            one PO line.
                                        </FieldDescription>
                                        <FieldError id={`${lineId}-quantity-error`}>
                                            {lineErrors.qtyReceived}
                                        </FieldError>
                                    </Field>
                                    <Field data-invalid={Boolean(lineErrors.locationId)}>
                                        <FieldLabel htmlFor={`${lineId}-locationId`}>
                                            Receiving destination
                                        </FieldLabel>
                                        <Select
                                            items={locationItems}
                                            value={line.locationId}
                                            disabled={busy || !optionsReady}
                                            onValueChange={(value) =>
                                                updateLine(line.uiKey, "locationId", value)
                                            }
                                        >
                                            <SelectTrigger
                                                id={`${lineId}-locationId`}
                                                className="w-full data-[size=default]:h-10"
                                                aria-invalid={Boolean(lineErrors.locationId)}
                                                aria-describedby={
                                                    lineErrors.locationId
                                                        ? `${lineId}-location-error`
                                                        : undefined
                                                }
                                            >
                                                <SelectValue placeholder="Select storage location" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {locationItems.map((item) => (
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
                                        <FieldError id={`${lineId}-location-error`}>
                                            {lineErrors.locationId}
                                        </FieldError>
                                    </Field>
                                    {textFields.map((field) => (
                                        <Field
                                            key={field.key}
                                            data-invalid={Boolean(lineErrors[field.key])}
                                        >
                                            <FieldLabel htmlFor={`${lineId}-${field.key}`}>
                                                {field.label}
                                            </FieldLabel>
                                            <Input
                                                id={`${lineId}-${field.key}`}
                                                name={`${field.key}-${line.uiKey}`}
                                                type={"type" in field ? field.type : "text"}
                                                maxLength={
                                                    "maxLength" in field
                                                        ? field.maxLength
                                                        : undefined
                                                }
                                                required={"required" in field && field.required}
                                                value={line[field.key]}
                                                onChange={(event) =>
                                                    updateLine(
                                                        line.uiKey,
                                                        field.key,
                                                        event.target.value,
                                                    )
                                                }
                                                disabled={busy}
                                                className="h-10"
                                                aria-invalid={Boolean(lineErrors[field.key])}
                                                aria-describedby={
                                                    lineErrors[field.key]
                                                        ? `${lineId}-${field.key}-error`
                                                        : undefined
                                                }
                                            />
                                            <FieldError id={`${lineId}-${field.key}-error`}>
                                                {lineErrors[field.key]}
                                            </FieldError>
                                        </Field>
                                    ))}
                                </div>
                                {source && (
                                    <div className="space-y-1 text-sm text-muted-foreground">
                                        <p>
                                            Inventory quantity:{" "}
                                            <span className="font-medium text-foreground tabular-nums">
                                                {primaryQuantity
                                                    ? `${formatReceivingDecimal(primaryQuantity)} ${source.primaryUomName}`
                                                    : "Enter a valid purchase quantity"}
                                            </span>
                                        </p>
                                        <p>
                                            Unit cost:{" "}
                                            {unitCost !== null
                                                ? `${formatReceivingDecimal(unitCost)} / ${source.primaryUomName}`
                                                : "Unavailable"}
                                        </p>
                                        <p>
                                            Quality status on receipt:{" "}
                                            <span className="font-medium text-foreground">
                                                {source.requiresQc ? "Quarantine" : "Approved"}
                                            </span>
                                        </p>
                                    </div>
                                )}
                            </fieldset>
                        )
                    })}
                </div>
                <Button
                    type="button"
                    variant="outline"
                    onClick={addLot}
                    disabled={busy || !order || values.lines.length >= 100}
                >
                    <Plus /> Add lot
                </Button>
                {receiveError && (
                    <Alert variant="destructive">
                        <AlertTitle>Unable to confirm receipt</AlertTitle>
                        <AlertDescription>{receiveError}</AlertDescription>
                    </Alert>
                )}
                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={busy}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        disabled={
                            busy ||
                            !optionsReady ||
                            isOptionsLoading ||
                            Boolean(optionsError) ||
                            hasStaleBalances ||
                            !activeLocations.length
                        }
                    >
                        {isReceiving ? "Receiving..." : "Receive stock"}
                    </Button>
                </DialogFooter>
            </form>
        </DialogContent>
    )
}

export function ReceivingForm({ open, onOpenChange, ...props }: ReceivingFormProps) {
    return (
        <Dialog
            open={open}
            onOpenChange={(nextOpen) => {
                if (!props.isReceiving) onOpenChange(nextOpen)
            }}
        >
            {open && <ReceivingFormContent onOpenChange={onOpenChange} {...props} />}
        </Dialog>
    )
}
