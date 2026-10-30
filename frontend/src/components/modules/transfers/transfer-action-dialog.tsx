"use client"

import { useId, useState, type FormEvent } from "react"
import {
    decimalUnits,
    formatTransferDecimal,
    type TransferDetail,
    type TransferOptions,
    type DispatchTransferInput,
    type ReceiveTransferInput,
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

type Action = "dispatch" | "receive" | "cancel"
type Props = {
    action: Action | null
    transfer: TransferDetail | undefined
    isLoading: boolean
    loadError?: string
    onRetry: () => void
    options: TransferOptions | undefined
    optionsLoading: boolean
    optionsError?: string
    onRetryOptions: () => void
    isSubmitting: boolean
    error?: string
    onOpenChange: (open: boolean) => void
    onSubmit: (input: DispatchTransferInput | ReceiveTransferInput | undefined) => Promise<boolean>
}
const copy = {
    dispatch: {
        title: "Dispatch stock transfer",
        button: "Confirm dispatch",
        description:
            "Move the shipped quantities from the source warehouse into In Transit. Include every lot; each shipped quantity can be less than its request.",
    },
    receive: {
        title: "Receive stock transfer",
        button: "Confirm receipt",
        description:
            "Enter the quantities arriving now. Partial receipts are supported; use zero for a lot that has not arrived.",
    },
    cancel: {
        title: "Cancel stock transfer",
        button: "Cancel transfer",
        description:
            "Close this draft before dispatch. Its requested quantities have not changed inventory.",
    },
}

function ActionForm({
    action,
    transfer,
    ...props
}: Props & { action: Action; transfer: TransferDetail }) {
    const id = useId()
    const transitOptions =
        props.options?.locations
            .filter((row) => row.locationType === "In Transit")
            .map((row) => ({ value: row.locationId, label: `${row.code} · ${row.name}` })) ?? []
    const [transitId, setTransitId] = useState<number | null>(() =>
        transitOptions.length === 1 ? transitOptions[0].value : null,
    )
    const [quantities, setQuantities] = useState<Record<number, string>>(() =>
        Object.fromEntries(
            transfer.lines.map((line) => [
                line.transferLineId,
                action === "dispatch" ? line.qtyRequested : line.qtyOutstanding,
            ]),
        ),
    )
    const [validationError, setValidationError] = useState<string>()
    const pending = props.isSubmitting || props.isLoading
    const stateValid =
        action === "receive" ? transfer.status === "In Transit" : transfer.status === "Draft"
    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (
            pending ||
            !stateValid ||
            props.loadError ||
            (action === "dispatch" && (props.optionsLoading || props.optionsError))
        )
            return
        setValidationError(undefined)
        if (action === "cancel") {
            if (await props.onSubmit(undefined)) props.onOpenChange(false)
            return
        }
        if (action === "dispatch" && !transitOptions.some((row) => row.value === transitId)) {
            setValidationError("Select an active In Transit location.")
            return
        }
        const entries = transfer.lines.map((line) => ({
            line,
            value:
                action === "receive" && decimalUnits(line.qtyOutstanding) === BigInt(0)
                    ? "0"
                    : (quantities[line.transferLineId]?.trim() ?? ""),
        }))
        for (const { line, value } of entries) {
            const units = decimalUnits(value)
            const maximum = decimalUnits(
                action === "dispatch" ? line.qtyRequested : line.qtyOutstanding,
            )!
            if (
                units === null ||
                units < BigInt(0) ||
                (action === "dispatch" && units === BigInt(0)) ||
                units > maximum
            ) {
                setValidationError(
                    action === "dispatch"
                        ? "Every shipped quantity must be positive and no greater than requested, with up to four decimal places."
                        : "Each receipt quantity must be zero or positive and no greater than the outstanding shipment, with up to four decimal places.",
                )
                return
            }
        }
        if (
            action === "receive" &&
            entries.every(({ value }) => decimalUnits(value) === BigInt(0))
        ) {
            setValidationError("Enter a positive received quantity for at least one lot.")
            return
        }
        const input =
            action === "dispatch"
                ? {
                      transitLocationId: transitId!,
                      lines: entries.map(({ line, value }) => ({
                          transferLineId: line.transferLineId,
                          qtyShipped: value,
                      })),
                  }
                : {
                      lines: entries
                          .filter(({ value }) => decimalUnits(value)! > BigInt(0))
                          .map(({ line, value }) => ({
                              transferLineId: line.transferLineId,
                              qtyReceived: value,
                          })),
                  }
        if (await props.onSubmit(input)) props.onOpenChange(false)
    }
    return (
        <form onSubmit={submit} className="space-y-5" aria-busy={pending}>
            <div className="rounded-lg border bg-muted/20 p-3 text-sm">
                <p className="font-medium">{transfer.transferNumber}</p>
                <p className="mt-1 text-muted-foreground">
                    {transfer.sourceLocationCode} → {transfer.destinationLocationCode}
                </p>
            </div>
            {!stateValid && (
                <p role="alert" className="text-sm text-destructive">
                    This transfer is now {transfer.status}. Close this dialog and review its latest
                    details.
                </p>
            )}
            {action === "dispatch" && (
                <Field>
                    <FieldLabel htmlFor={`${id}-transit`}>In Transit location</FieldLabel>
                    <Select
                        items={transitOptions}
                        value={transitId}
                        disabled={pending || props.optionsLoading}
                        onValueChange={setTransitId}
                    >
                        <SelectTrigger
                            id={`${id}-transit`}
                            className="w-full data-[size=default]:h-10"
                        >
                            <SelectValue placeholder="Select In Transit location" />
                        </SelectTrigger>
                        <SelectContent>
                            {transitOptions.map((row) => (
                                <SelectItem key={row.value} value={row.value}>
                                    {row.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                        Goods remain in company inventory until destination receipt is confirmed.
                    </p>
                    {!props.optionsLoading && !transitOptions.length && (
                        <FieldError>
                            Configure an active In Transit location before dispatching.
                        </FieldError>
                    )}
                </Field>
            )}
            {action !== "cancel" && (
                <div className="space-y-3">
                    {transfer.lines.map((line) => (
                        <Field key={line.transferLineId} className="rounded-lg border p-4">
                            <div>
                                <p className="font-medium">{line.itemName}</p>
                                <p className="text-xs text-muted-foreground">
                                    {line.itemSku} · {line.lotNumber}
                                </p>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                {action === "dispatch"
                                    ? `Requested: ${formatTransferDecimal(line.qtyRequested)}`
                                    : `Shipped: ${formatTransferDecimal(line.qtyShipped)} · Received: ${formatTransferDecimal(line.qtyReceived)} · Outstanding: ${formatTransferDecimal(line.qtyOutstanding)}`}{" "}
                                {line.primaryUomName}
                            </p>
                            <FieldLabel htmlFor={`${id}-qty-${line.transferLineId}`}>
                                {action === "dispatch" ? "Ship" : "Receive now"} (
                                {line.primaryUomName})
                            </FieldLabel>
                            <Input
                                id={`${id}-qty-${line.transferLineId}`}
                                inputMode="decimal"
                                required
                                value={
                                    action === "receive" &&
                                    decimalUnits(line.qtyOutstanding) === BigInt(0)
                                        ? "0"
                                        : (quantities[line.transferLineId] ?? "0")
                                }
                                disabled={
                                    pending ||
                                    !stateValid ||
                                    (action === "receive" &&
                                        decimalUnits(line.qtyOutstanding) === BigInt(0))
                                }
                                onChange={(event) => {
                                    setQuantities((current) => ({
                                        ...current,
                                        [line.transferLineId]: event.target.value,
                                    }))
                                    setValidationError(undefined)
                                }}
                            />
                        </Field>
                    ))}
                </div>
            )}
            {props.isLoading && (
                <p role="status" className="text-sm text-muted-foreground">
                    Refreshing confirmed transfer quantities…
                </p>
            )}
            {validationError && (
                <p role="alert" className="text-sm text-destructive">
                    {validationError}
                </p>
            )}
            {props.error && (
                <div role="alert" className="space-y-2 text-sm">
                    <p className="text-destructive">{props.error}</p>
                    {action === "receive" && (
                        <p className="text-muted-foreground">
                            Review the confirmed received and outstanding quantities above before
                            submitting another receipt.
                        </p>
                    )}
                </div>
            )}
            <DialogFooter>
                <Button
                    type="button"
                    variant="outline"
                    disabled={props.isSubmitting}
                    onClick={() => props.onOpenChange(false)}
                >
                    Back
                </Button>
                <Button
                    type="submit"
                    variant={action === "cancel" ? "destructive" : "default"}
                    disabled={
                        pending ||
                        !stateValid ||
                        Boolean(props.loadError) ||
                        (action === "dispatch" &&
                            (props.optionsLoading ||
                                Boolean(props.optionsError) ||
                                !transitOptions.length))
                    }
                >
                    {props.isSubmitting ? "Saving…" : copy[action].button}
                </Button>
            </DialogFooter>
        </form>
    )
}

function ActionSession(props: Props & { action: Action }) {
    const [initialized, setInitialized] = useState(false)
    // Initialize defaults from the first confirmed read, then preserve edits
    // during refetches after failed or uncertain submissions.
    if (!initialized && props.transfer && !props.isLoading && !props.loadError) setInitialized(true)
    if (!initialized || !props.transfer)
        return props.isLoading ? (
            <p role="status" className="py-6 text-muted-foreground">
                Loading transfer quantities…
            </p>
        ) : null
    return <ActionForm {...props} transfer={props.transfer} action={props.action} />
}

export function TransferActionDialog(props: Props) {
    const action = props.action
    return (
        <Dialog
            open={action !== null}
            onOpenChange={(open) => {
                if (!props.isSubmitting) props.onOpenChange(open)
            }}
        >
            <DialogContent
                className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl"
                showCloseButton={!props.isSubmitting}
            >
                <DialogHeader>
                    <DialogTitle>{action ? copy[action].title : "Stock transfer"}</DialogTitle>
                    <DialogDescription>
                        {action ? copy[action].description : "Review the stock transfer."}
                    </DialogDescription>
                </DialogHeader>
                {props.loadError && (
                    <div role="alert" className="space-y-2">
                        <p className="text-sm text-destructive">{props.loadError}</p>
                        <Button
                            type="button"
                            variant="outline"
                            disabled={props.isLoading || props.isSubmitting}
                            onClick={props.onRetry}
                        >
                            Retry transfer
                        </Button>
                    </div>
                )}
                {action === "dispatch" && props.optionsError && (
                    <div role="alert" className="space-y-2">
                        <p className="text-sm text-destructive">{props.optionsError}</p>
                        <Button
                            type="button"
                            variant="outline"
                            disabled={props.optionsLoading || props.isSubmitting}
                            onClick={props.onRetryOptions}
                        >
                            Retry locations
                        </Button>
                    </div>
                )}
                {action && (
                    <ActionSession
                        key={`${props.transfer?.transferId ?? "loading"}-${action}`}
                        {...props}
                        action={action}
                    />
                )}
            </DialogContent>
        </Dialog>
    )
}
