"use client"

import { useId, useMemo, useRef, useState, type FormEvent } from "react"
import { Plus, RefreshCw, Trash2 } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import {
    formatSalesDecimal,
    formatSalesUnits4,
    parseStockUnits4,
    previewSalesTaxSummary,
    summarizeLineStockCoverage,
    validateSalesOrder,
    type SalesOrder,
    type SalesOrderOptions,
    type SalesOrderFormValues,
    type SalesOrderFormErrors,
} from "@/components/modules/sales-orders/sales-order.schema"
import { Badge } from "@/components/ui/badge"
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
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ComboboxSelect } from "@/components/shared/combobox-select"
import { NumericInput } from "@/components/shared/numeric-input"
import { PriceCurrencyInput } from "@/components/shared/price-currency-input"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useSession } from "@/hooks/use-session"
import {
    getInventoryStocks,
    STOCKS_QUERY_KEY,
} from "@/hooks/modules/inventory-stocks/use-inventory-stocks"
import { useCompanySettings } from "@/hooks/modules/company-settings/use-company-settings"
import {
    convertCurrencyAmount,
    getExchangeRateLabel,
    isForeignCurrency,
    normalizeCurrencyCode,
    resolveBaseEntryCurrency,
    validateExchangeRate,
    type EntryCurrencyCode,
} from "@/lib/price-currency"

type Props = {
    open: boolean
    onOpenChange: (open: boolean) => void
    order: SalesOrder | null
    options: SalesOrderOptions
    optionsReady: boolean
    optionsError: Error | null
    retryOptions: () => void
    onSave: (
        values: SalesOrderFormValues,
        order: SalesOrder | null,
    ) => Promise<boolean>
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
}: Pick<
    Props,
    "order" | "options" | "onSave" | "onOpenChange" | "isSaving" | "saveError"
>) {
    const id = useId()
    const nextKey = useRef(0)
    const session = useSession()
    const { settings } = useCompanySettings()
    const stocksQuery = useQuery({
        queryKey: [...STOCKS_QUERY_KEY, session.data?.userId],
        queryFn: ({ signal }) => getInventoryStocks(signal),
        enabled: Boolean(session.data),
        staleTime: 0,
        refetchOnMount: "always",
    })
    const baseCurrency = normalizeCurrencyCode(settings?.currencyCode)
    const defaultCurrency = resolveBaseEntryCurrency(baseCurrency)
    const [exchangeRate, setExchangeRate] = useState("")
    const [exchangeRateError, setExchangeRateError] = useState<string>()
    const [values, setValues] = useState<
        Omit<SalesOrderFormValues, "lines"> & {
            lines: (SalesOrderFormValues["lines"][number] & {
                uiKey: string
                priceCurrency: EntryCurrencyCode | null
            })[]
        }
    >(() => {
        const today = new Date()
        return {
            salesOrderNumber: order?.salesOrderNumber ?? "",
            customerPoNumber: order?.customerPoNumber ?? "",
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
                      vatRatePercent: line.vatRatePercent ?? "0.00",
                      uiKey: `initial-${index}`,
                      priceCurrency: null,
                  }))
                : [
                      {
                          itemId: null,
                          uomId: null,
                          qtyOrdered: "",
                          unitPrice: "",
                          vatRatePercent: "0.00",
                          uiKey: "initial-0",
                          priceCurrency: null,
                      },
                  ],
        }
    })
    const [errors, setErrors] = useState<SalesOrderFormErrors>({})
    const [suppressedSaveError, setSuppressedSaveError] = useState<string | null | undefined>(null)
    const activeSaveError =
        saveError && saveError !== suppressedSaveError ? saveError : undefined
    const orderNumberError = errors.salesOrderNumber || activeSaveError
    const customerItems = options.customers
        .filter(
            (customer) =>
                customer.isActive || customer.customerId === values.customerId,
        )
        .map((customer) => ({
            value: customer.customerId,
            label: customer.name + (customer.isActive ? "" : " (inactive)"),
            disabled: !customer.isActive,
        }))
    const finishedStockByItem = useMemo(() => {
        const totals = new Map<
            number,
            { onHand: bigint; reserved: bigint; available: bigint }
        >()
        const rows = stocksQuery.data
        if (!rows) return totals
        const todayIso = new Date().toISOString().slice(0, 10)
        for (const row of rows) {
            if (
                row.itemType !== "Finished Good" ||
                !row.locationIsActive ||
                !["Warehouse", "Branch", "Store"].includes(row.locationType) ||
                row.qcStatus !== "Approved" ||
                (row.expirationDate !== null && row.expirationDate <= todayIso)
            ) {
                continue
            }
            const rawAvail = parseStockUnits4(row.qtyAvailable)
            const avail = rawAvail > BigInt(0) ? rawAvail : BigInt(0)
            const current = totals.get(row.itemId) ?? {
                onHand: BigInt(0),
                reserved: BigInt(0),
                available: BigInt(0),
            }
            totals.set(row.itemId, {
                onHand: current.onHand + parseStockUnits4(row.qtyOnHand),
                reserved: current.reserved + parseStockUnits4(row.qtyReserved),
                available: current.available + avail,
            })
        }
        return totals
    }, [stocksQuery.data])

    const itemItems = options.items
        .filter(
            (item) =>
                item.isActive ||
                values.lines.some((line) => line.itemId === item.itemId),
        )
        .map((item) => {
            const availUnits = finishedStockByItem.get(item.itemId)?.available
            const availText =
                stocksQuery.isSuccess
                    ? ` · ${formatSalesDecimal(formatSalesUnits4(availUnits ?? BigInt(0)))} ${item.primaryUomName} avail`
                    : ""
            return {
                value: item.itemId,
                label: `${item.sku} - ${item.name}${availText}${item.isActive ? "" : " (inactive)"}`,
                disabled: !item.isActive,
            }
        })
    const foreignCurrencies = values.lines
        .map((line) => line.priceCurrency ?? defaultCurrency)
        .filter((currency) => isForeignCurrency(currency, baseCurrency))
    const hasForeignLine = foreignCurrencies.length > 0
    function resolveLineUnitPrice(
        line: (typeof values.lines)[number],
    ): string | null {
        const lineCurrency = line.priceCurrency ?? defaultCurrency
        if (!isForeignCurrency(lineCurrency, baseCurrency)) {
            return line.unitPrice
        }
        return convertCurrencyAmount({
            amount: line.unitPrice,
            fromCurrency: lineCurrency,
            baseCurrency,
            exchangeRate,
        })
    }
    const preview = previewSalesTaxSummary(
        values.lines.map((line) => ({
            itemId: line.itemId,
            uomId: line.uomId,
            qtyOrdered: line.qtyOrdered,
            unitPrice: resolveLineUnitPrice(line) ?? "",
            vatRatePercent: line.vatRatePercent ?? "0.00",
        })),
    )
    function updateHeader<
        Key extends Exclude<keyof SalesOrderFormValues, "lines">,
    >(key: Key, value: SalesOrderFormValues[Key]) {
        setValues((current) => ({ ...current, [key]: value }))
        setErrors((current) => ({ ...current, [key]: "" }))
        if (saveError) setSuppressedSaveError(saveError)
    }
    function updateLine(
        index: number,
        updates: Partial<(typeof values.lines)[number]>,
    ) {
        setValues((current) => ({
            ...current,
            lines: current.lines.map((line, position) =>
                position === index ? { ...line, ...updates } : line,
            ),
        }))
        setErrors((current) =>
            Object.fromEntries(
                Object.entries(current).filter(
                    ([key]) => !key.startsWith(`lines.${index}.`),
                ),
            ),
        )
        if (saveError) setSuppressedSaveError(saveError)
    }
    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (isSaving) return
        setSuppressedSaveError(null)
        const rateIssue = hasForeignLine
            ? validateExchangeRate(exchangeRate)
            : undefined
        setExchangeRateError(rateIssue)
        const convertedByLine = values.lines.map((line) =>
            resolveLineUnitPrice(line),
        )
        const writable: SalesOrderFormValues = {
            ...values,
            lines: values.lines.map(
                (
                    { itemId, uomId, qtyOrdered, unitPrice, vatRatePercent },
                    index,
                ) => ({
                    itemId,
                    uomId,
                    qtyOrdered,
                    unitPrice: convertedByLine[index] ?? unitPrice,
                    vatRatePercent: vatRatePercent ?? "0.00",
                }),
            ),
        }
        const nextErrors = validateSalesOrder(writable, options)
        if (!rateIssue) {
            values.lines.forEach((line, index) => {
                const lineCurrency = line.priceCurrency ?? defaultCurrency
                if (
                    isForeignCurrency(lineCurrency, baseCurrency) &&
                    convertedByLine[index] === null &&
                    line.unitPrice.trim() !== "" &&
                    !nextErrors[`lines.${index}.unitPrice`]
                ) {
                    nextErrors[`lines.${index}.unitPrice`] =
                        `Converted amount exceeds 10 whole digits in ${baseCurrency}.`
                }
            })
        }
        setErrors(nextErrors)
        if (rateIssue) {
            document.getElementById(`${id}-exchangeRate`)?.focus()
            return
        }
        const first = Object.keys(nextErrors)[0]
        if (first) {
            const element = event.currentTarget.elements.namedItem(first)
            if (element instanceof HTMLElement) element.focus()
            return
        }
        if (await onSave(writable, order)) onOpenChange(false)
    }
    return (
        <form
            onSubmit={submit}
            className="space-y-5"
            aria-busy={isSaving}
            noValidate
        >
            <FieldGroup className="gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                    <Field data-invalid={Boolean(orderNumberError)}>
                        <FieldLabel htmlFor={`${id}-number`}>
                            Sales order number
                        </FieldLabel>
                        <Input
                            id={`${id}-number`}
                            name="salesOrderNumber"
                            maxLength={30}
                            value={values.salesOrderNumber}
                            onChange={(event) =>
                                updateHeader(
                                    "salesOrderNumber",
                                    event.target.value,
                                )
                            }
                            disabled={isSaving}
                            aria-invalid={Boolean(orderNumberError)}
                            aria-describedby={`${id}-number-error`}
                        />
                        <FieldError id={`${id}-number-error`}>
                            {orderNumberError}
                        </FieldError>
                    </Field>
                    <Field data-invalid={Boolean(errors.customerPoNumber)}>
                        <FieldLabel htmlFor={id + "-customer-po"}>
                            Customer PO number (optional)
                        </FieldLabel>
                        <Input
                            id={id + "-customer-po"}
                            name="customerPoNumber"
                            maxLength={100}
                            value={values.customerPoNumber}
                            disabled={isSaving}
                            onChange={(event) =>
                                updateHeader(
                                    "customerPoNumber",
                                    event.target.value,
                                )
                            }
                            aria-invalid={Boolean(errors.customerPoNumber)}
                            aria-describedby={id + "-customer-po-error"}
                        />
                        <FieldError id={id + "-customer-po-error"}>
                            {errors.customerPoNumber}
                        </FieldError>
                    </Field>
                    <Field data-invalid={Boolean(errors.customerId)}>
                        <FieldLabel htmlFor={`${id}-customer`}>
                            Customer
                        </FieldLabel>
                        <ComboboxSelect
                            id={`${id}-customer`}
                            name="customerId"
                            items={customerItems}
                            value={values.customerId}
                            onValueChange={(value) =>
                                updateHeader("customerId", value)
                            }
                            disabled={isSaving}
                            placeholder="Select customer"
                            aria-invalid={Boolean(errors.customerId)}
                            aria-describedby={`${id}-customer-error`}
                            className="w-full"
                        />
                        <FieldError id={`${id}-customer-error`}>
                            {errors.customerId}
                        </FieldError>
                    </Field>
                    {(
                        [
                            ["orderDate", "Order date"],
                            [
                                "requestedDeliveryDate",
                                "Requested delivery date (optional)",
                            ],
                        ] as const
                    ).map(([key, label]) => (
                        <Field key={key} data-invalid={Boolean(errors[key])}>
                            <FieldLabel htmlFor={`${id}-${key}`}>
                                {label}
                            </FieldLabel>
                            <Input
                                id={`${id}-${key}`}
                                name={key}
                                type="date"
                                value={values[key]}
                                onChange={(event) =>
                                    updateHeader(key, event.target.value)
                                }
                                disabled={isSaving}
                                aria-invalid={Boolean(errors[key])}
                                aria-describedby={`${id}-${key}-error`}
                            />
                            <FieldError id={`${id}-${key}-error`}>
                                {errors[key]}
                            </FieldError>
                        </Field>
                    ))}
                </div>
                <Field>
                    <FieldLabel htmlFor={`${id}-notes`}>
                        Notes (optional)
                    </FieldLabel>
                    <Textarea
                        id={`${id}-notes`}
                        name="notes"
                        maxLength={5000}
                        value={values.notes}
                        onChange={(event) =>
                            updateHeader("notes", event.target.value)
                        }
                        disabled={isSaving}
                    />
                    <FieldError>{errors.notes}</FieldError>
                </Field>
            </FieldGroup>
            <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-medium">Finished products</h3>
                    <div className="flex flex-wrap items-center gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={isSaving || stocksQuery.isFetching}
                            onClick={() => void stocksQuery.refetch()}
                        >
                            <RefreshCw
                                className={
                                    stocksQuery.isFetching
                                        ? "animate-spin"
                                        : undefined
                                }
                            />
                            {stocksQuery.isFetching
                                ? "Checking stock..."
                                : "Refresh stock"}
                        </Button>
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
                                            vatRatePercent: "0.00",
                                            uiKey,
                                            priceCurrency: null,
                                        },
                                    ],
                                }))
                            }}
                        >
                            <Plus />
                            Add line
                        </Button>
                    </div>
                </div>
                <p className="text-sm text-muted-foreground">
                    Record the customer’s PO, select finished products, then
                    save to check finished stock and material shortages before
                    purchasing and packing.
                </p>
                {hasForeignLine && (
                    <Field
                        className="max-w-xs"
                        data-invalid={Boolean(exchangeRateError)}
                        data-disabled={isSaving}
                    >
                        <FieldLabel htmlFor={`${id}-exchangeRate`}>
                            {getExchangeRateLabel(baseCurrency, foreignCurrencies)}
                        </FieldLabel>
                        <NumericInput
                            id={`${id}-exchangeRate`}
                            name="exchangeRate"
                            maxWholeDigits={10}
                            maxDecimalPlaces={4}
                            placeholder="58.00"
                            value={exchangeRate}
                            disabled={isSaving}
                            onValueChange={(next) => {
                                setExchangeRate(next)
                                setExchangeRateError(undefined)
                            }}
                            aria-invalid={Boolean(exchangeRateError)}
                            aria-describedby={`${id}-exchangeRate-error`}
                        />
                        <FieldDescription>
                            Converts non-{baseCurrency} line prices to{" "}
                            {baseCurrency}.
                        </FieldDescription>
                        <FieldError id={`${id}-exchangeRate-error`}>
                            {exchangeRateError}
                        </FieldError>
                    </Field>
                )}
                <FieldError>{errors.lines}</FieldError>
                {values.lines.map((line, index) => {
                    const item = options.items.find(
                        (candidate) => candidate.itemId === line.itemId,
                    )
                    const lineCurrency = line.priceCurrency ?? defaultCurrency
                    const resolvedLinePrice = resolveLineUnitPrice(line)
                    return (
                        <fieldset
                            key={line.uiKey}
                            className="rounded-lg border p-4"
                        >
                            <legend className="px-1 text-sm font-medium">
                                Line {index + 1}
                            </legend>
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1.4fr_1.1fr_auto]">
                                <Field
                                    data-invalid={Boolean(
                                        errors[`lines.${index}.itemId`],
                                    )}
                                >
                                    <FieldLabel htmlFor={`${id}-item-${index}`}>
                                        Product
                                    </FieldLabel>
                                    <ComboboxSelect
                                        id={`${id}-item-${index}`}
                                        name={`lines.${index}.itemId`}
                                        items={itemItems}
                                        value={line.itemId}
                                        onValueChange={(value) => {
                                            const selected = options.items.find(
                                                (candidate) =>
                                                    candidate.itemId === value,
                                            )
                                            const masterPrice =
                                                selected?.unitCost &&
                                                /[1-9]/.test(selected.unitCost)
                                                    ? selected.unitCost
                                                    : ""
                                            updateLine(index, {
                                                itemId: value,
                                                uomId:
                                                    selected?.primaryUomId ??
                                                    null,
                                                vatRatePercent: selected
                                                    ? (selected.isVatable ?? true)
                                                        ? (options.defaultVatRatePercent ??
                                                          "12.00")
                                                        : "0.00"
                                                    : "0.00",
                                                ...(masterPrice
                                                    ? {
                                                          unitPrice: masterPrice,
                                                          priceCurrency: null,
                                                      }
                                                    : line.itemId !== value
                                                      ? {
                                                            unitPrice: "",
                                                            priceCurrency: null,
                                                        }
                                                      : {}),
                                            })
                                        }}
                                        disabled={isSaving}
                                        placeholder="Select product"
                                        aria-invalid={Boolean(
                                            errors[`lines.${index}.itemId`],
                                        )}
                                        aria-describedby={`${id}-item-error-${index}`}
                                        className="w-full"
                                    />
                                    <FieldError
                                        id={`${id}-item-error-${index}`}
                                    >
                                        {errors[`lines.${index}.itemId`]}
                                    </FieldError>
                                </Field>
                                <Field
                                    data-invalid={Boolean(
                                        errors[`lines.${index}.qtyOrdered`],
                                    )}
                                >
                                    <FieldLabel htmlFor={`${id}-qty-${index}`}>
                                        Quantity
                                        {item
                                            ? ` (${item.primaryUomName})`
                                            : ""}
                                    </FieldLabel>
                                    <NumericInput
                                        id={`${id}-qty-${index}`}
                                        name={`lines.${index}.qtyOrdered`}
                                        maxWholeDigits={10}
                                        maxDecimalPlaces={4}
                                        value={line.qtyOrdered}
                                        onValueChange={(next) =>
                                            updateLine(index, {
                                                qtyOrdered: next,
                                            })
                                        }
                                        disabled={isSaving}
                                        aria-invalid={Boolean(
                                            errors[`lines.${index}.qtyOrdered`],
                                        )}
                                        aria-describedby={`${id}-qty-error-${index}`}
                                    />
                                    <FieldError id={`${id}-qty-error-${index}`}>
                                        {errors[`lines.${index}.qtyOrdered`]}
                                    </FieldError>
                                </Field>
                                <Field
                                    data-invalid={Boolean(
                                        errors[`lines.${index}.unitPrice`],
                                    )}
                                >
                                    <FieldLabel
                                        htmlFor={`${id}-price-${index}`}
                                    >
                                        Unit price
                                    </FieldLabel>
                                    <PriceCurrencyInput
                                        id={`${id}-price-${index}`}
                                        name={`lines.${index}.unitPrice`}
                                        value={line.unitPrice}
                                        currency={lineCurrency}
                                        baseCurrency={baseCurrency}
                                        convertedValue={resolvedLinePrice}
                                        onValueChange={(nextValue) =>
                                            updateLine(index, {
                                                unitPrice: nextValue,
                                            })
                                        }
                                        onCurrencyChange={(nextCurrency) => {
                                            updateLine(index, {
                                                priceCurrency: nextCurrency,
                                            })
                                            if (
                                                !isForeignCurrency(
                                                    nextCurrency,
                                                    baseCurrency,
                                                )
                                            ) {
                                                const stillForeign =
                                                    values.lines.some(
                                                        (other, pos) =>
                                                            pos !== index &&
                                                            isForeignCurrency(
                                                                other.priceCurrency ??
                                                                    defaultCurrency,
                                                                baseCurrency,
                                                            ),
                                                    )
                                                if (!stillForeign)
                                                    setExchangeRateError(
                                                        undefined,
                                                    )
                                            }
                                        }}
                                        disabled={isSaving}
                                        currencyAriaLabel={`Line ${index + 1} price currency`}
                                        aria-invalid={Boolean(
                                            errors[`lines.${index}.unitPrice`],
                                        )}
                                        aria-describedby={`${id}-price-error-${index}`}
                                    />
                                    <FieldError
                                        id={`${id}-price-error-${index}`}
                                    >
                                        {errors[`lines.${index}.unitPrice`]}
                                    </FieldError>
                                </Field>
                                <Field>
                                    <FieldLabel htmlFor={`${id}-vat-${index}`}>
                                        VAT
                                    </FieldLabel>
                                    <ComboboxSelect
                                        id={`${id}-vat-${index}`}
                                        items={(() => {
                                            const stdRate =
                                                options.defaultVatRatePercent ??
                                                "12.00"
                                            const curRate =
                                                line.vatRatePercent ?? "0.00"
                                            const baseOpts = [
                                                {
                                                    value: "0.00",
                                                    label: "No VAT (0%)",
                                                },
                                                ...(Number(stdRate) > 0
                                                    ? [
                                                          {
                                                              value: stdRate,
                                                              label: `VATable (${stdRate}%)`,
                                                          },
                                                      ]
                                                    : []),
                                            ]
                                            return baseOpts.some(
                                                (opt) => opt.value === curRate,
                                            )
                                                ? baseOpts
                                                : [
                                                      ...baseOpts,
                                                      {
                                                          value: curRate,
                                                          label: `Custom VAT (${curRate}%)`,
                                                      },
                                                  ]
                                        })()}
                                        value={line.vatRatePercent ?? "0.00"}
                                        onValueChange={(val) => {
                                            if (val) {
                                                updateLine(index, {
                                                    vatRatePercent: val,
                                                })
                                            }
                                        }}
                                        disabled={isSaving}
                                        searchable={false}
                                        className="h-9 w-full"
                                    />
                                </Field>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon-sm"
                                    className="sm:mt-6"
                                    aria-label={`Remove line ${index + 1}`}
                                    disabled={
                                        isSaving || values.lines.length === 1
                                    }
                                    onClick={() => {
                                        setValues((current) => ({
                                            ...current,
                                            lines: current.lines.filter(
                                                (_, position) =>
                                                    position !== index,
                                            ),
                                        }))
                                        setErrors({})
                                    }}
                                >
                                    <Trash2 />
                                </Button>
                            </div>
                            {line.itemId !== null && item && (
                                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs">
                                    {stocksQuery.isError ? (
                                        <>
                                            <span className="text-muted-foreground">
                                                Unable to check live finished
                                                stock.
                                            </span>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="xs"
                                                disabled={
                                                    stocksQuery.isFetching
                                                }
                                                onClick={() =>
                                                    void stocksQuery.refetch()
                                                }
                                            >
                                                Retry stock check
                                            </Button>
                                        </>
                                    ) : stocksQuery.isPending ? (
                                        <span className="text-muted-foreground">
                                            Checking live finished stock...
                                        </span>
                                    ) : (
                                        (() => {
                                            const stockTotals =
                                                finishedStockByItem.get(
                                                    item.itemId,
                                                ) ?? {
                                                    onHand: BigInt(0),
                                                    reserved: BigInt(0),
                                                    available: BigInt(0),
                                                }
                                            const coverage =
                                                summarizeLineStockCoverage(
                                                    line.qtyOrdered,
                                                    stockTotals.available,
                                                    stockTotals.onHand,
                                                    stockTotals.reserved,
                                                )
                                            return (
                                                <>
                                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
                                                        <span>
                                                            Live stock:{" "}
                                                            <strong className="text-foreground tabular-nums">
                                                                {
                                                                    coverage.available
                                                                }{" "}
                                                                {
                                                                    item.primaryUomName
                                                                }{" "}
                                                                available
                                                            </strong>
                                                        </span>
                                                        <span className="tabular-nums">
                                                            On hand:{" "}
                                                            {coverage.onHand}{" "}
                                                            {
                                                                item.primaryUomName
                                                            }
                                                        </span>
                                                        <span className="tabular-nums">
                                                            Reserved:{" "}
                                                            {coverage.reserved}{" "}
                                                            {
                                                                item.primaryUomName
                                                            }
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        {coverage.isCovered ===
                                                        true ? (
                                                            <Badge variant="secondary">
                                                                Covered by stock
                                                            </Badge>
                                                        ) : coverage.isCovered ===
                                                          false ? (
                                                            <Badge variant="destructive">
                                                                Need to pack:{" "}
                                                                {
                                                                    coverage.toPack
                                                                }{" "}
                                                                {
                                                                    item.primaryUomName
                                                                }
                                                            </Badge>
                                                        ) : (
                                                            <Badge variant="outline">
                                                                Enter qty to
                                                                check
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </>
                                            )
                                        })()
                                    )}
                                </div>
                            )}
                        </fieldset>
                    )
                })}
            </div>
            <p className="text-right text-sm text-muted-foreground">
                Order total preview:{" "}
                <span className="font-semibold text-foreground tabular-nums">
                    {preview === null
                        ? "Enter quantities and prices"
                        : `Net ${formatSalesDecimal(preview.netAmount)} + VAT ${formatSalesDecimal(preview.vatAmount)} = ${formatSalesDecimal(preview.totalAmount)}`}
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
                    {isSaving
                        ? "Saving..."
                        : order
                          ? "Save changes"
                          : "Create sales order"}
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
                        {props.order
                            ? "Edit sales order"
                            : "Create sales order"}
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
                            <Button
                                variant="outline"
                                onClick={props.retryOptions}
                            >
                                Retry options
                            </Button>
                        </AlertDescription>
                    </Alert>
                )}
            </DialogContent>
        </Dialog>
    )
}
