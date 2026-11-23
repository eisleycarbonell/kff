"use client";

import Link from "next/link";
import { useId, useRef, useState, type FormEvent } from "react";
import { Plus, Trash2 } from "lucide-react";

import {
  calculatePurchaseOrderLineVatBreakdown,
  calculatePurchaseOrderTaxSummary,
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
} from "@/components/modules/purchase-orders/purchase-order.schema";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ComboboxSelect } from "@/components/shared/combobox-select";
import { NumericInput } from "@/components/shared/numeric-input";
import { PriceCurrencyInput } from "@/components/shared/price-currency-input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useCompanySettings } from "@/hooks/modules/company-settings/use-company-settings";
import { usePurchaseOrderDetail } from "@/hooks/modules/purchase-orders/use-purchase-orders";
import {
  convertCurrencyAmount,
  getExchangeRateLabel,
  isForeignCurrency,
  normalizeCurrencyCode,
  resolveBaseEntryCurrency,
  validateExchangeRate,
  type EntryCurrencyCode,
} from "@/lib/price-currency";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: PurchaseOrder | null;
  defaultPoNumber: string;
  initialDraft?: Partial<PurchaseOrderFormValues> | null;
  orders: PurchaseOrder[];
  options: PurchaseOrderOptions;
  optionsReady: boolean;
  optionsError: Error | null;
  isOptionsLoading: boolean;
  retryOptions: () => void;
  onSave: (
    values: PurchaseOrderFormValues,
    order: PurchaseOrder | null,
  ) => Promise<boolean>;
  isSaving: boolean;
  saveError: string | null;
};
type DraftLine = PurchaseOrderLineFormValues & {
  uiKey: string;
  priceCurrency: EntryCurrencyCode | null;
};
type DraftValues = Omit<PurchaseOrderFormValues, "lines"> & {
  lines: DraftLine[];
};
type ContentProps = Omit<
  Props,
  | "open"
  | "order"
  | "optionsReady"
  | "optionsError"
  | "isOptionsLoading"
  | "retryOptions"
> & {
  order: PurchaseOrderDetail | null;
  loadError: Error | null;
  isFetching: boolean;
  retry: () => void;
};

function PurchaseOrderFormContent({
  onOpenChange,
  order,
  defaultPoNumber,
  initialDraft,
  orders,
  options,
  onSave,
  isSaving,
  saveError,
  loadError,
  isFetching,
  retry,
}: ContentProps) {
  const id = useId();
  const nextKey = useRef(0);
  const { settings } = useCompanySettings();
  const baseCurrency = normalizeCurrencyCode(settings?.currencyCode);
  const defaultCurrency = resolveBaseEntryCurrency(baseCurrency);
  const [exchangeRate, setExchangeRate] = useState("");
  const [exchangeRateError, setExchangeRateError] = useState<string>();
  const [values, setValues] = useState<DraftValues>(() => {
    const resolvedDraftLines = initialDraft?.lines?.length
      ? initialDraft.lines.map((draftLine) => {
        const item = options.items.find(
          (candidate) => candidate.itemId === draftLine.itemId,
        );
        const quote = options.supplierItems.find(
          (candidate) =>
            candidate.supplierId === (initialDraft.supplierId ?? null) &&
            candidate.itemId === draftLine.itemId &&
            candidate.isActive,
        );
        const hasQty = draftLine.qtyOrdered.trim() !== "";
        const quotedUnit = quote?.defaultUomId ?? item?.primaryUomId ?? null;
        const compatibleQuote = options.uoms.some(
          (unit) =>
            unit.uomId === quotedUnit && unit.uomClassId === item?.uomClassId,
        );
        const resolvedUomId =
          draftLine.uomId ??
          (hasQty
            ? (item?.primaryUomId ?? null)
            : compatibleQuote
              ? quotedUnit
              : (item?.primaryUomId ?? null));
        const quoteMatchesResolvedUnit =
          Boolean(quote) &&
          (quote?.defaultUomId ?? item?.primaryUomId ?? null) === resolvedUomId;
        const fallbackCost =
          item?.unitCost && /[1-9]/.test(item.unitCost) ? item.unitCost : "";
        return {
          itemId: draftLine.itemId,
          uomId: resolvedUomId,
          qtyOrdered: draftLine.qtyOrdered,
          unitPrice:
            draftLine.unitPrice ||
            (quoteMatchesResolvedUnit
              ? (quote?.defaultPrice ?? fallbackCost)
              : fallbackCost),
          vatRatePercent: item
            ? (item.isVatable ?? true)
              ? (options.defaultVatRatePercent ?? "12.00")
              : "0.00"
            : "0.00",
        };
      })
      : [createEmptyPurchaseOrderLine()];
    const initial: PurchaseOrderFormValues = order
      ? toPurchaseOrderFormValues(order)
      : {
        poNumber: initialDraft?.poNumber ?? defaultPoNumber,
        supplierId: initialDraft?.supplierId ?? null,
        orderDate: initialDraft?.orderDate ?? localTodayDate(),
        expectedDeliveryDate: initialDraft?.expectedDeliveryDate ?? "",
        notes: initialDraft?.notes ?? "",
        lines: resolvedDraftLines,
      };
    return {
      ...initial,
      lines: initial.lines.map((line, index) => ({
        ...line,
        uiKey: `initial-${index}`,
        priceCurrency: null,
      })),
    };
  });
  const [errors, setErrors] = useState<PurchaseOrderFormErrors>({});
  const [suppressedSaveError, setSuppressedSaveError] = useState<string | null | undefined>(null);
  const activeSaveError =
    saveError && saveError !== suppressedSaveError ? saveError : undefined;
  const poNumberError = errors.poNumber ?? activeSaveError;
  const supplierItems = options.suppliers
    .filter(
      (supplier) =>
        supplier.isActive || supplier.supplierId === values.supplierId,
    )
    .map((supplier) => ({
      value: supplier.supplierId,
      label: supplier.name + (supplier.isActive ? "" : " (inactive)"),
      isActive: supplier.isActive,
    }));
  const foreignCurrencies = values.lines
    .map((line) => line.priceCurrency ?? defaultCurrency)
    .filter((currency) => isForeignCurrency(currency, baseCurrency));
  const hasForeignLine = foreignCurrencies.length > 0;
  function resolveLineUnitPrice(line: DraftLine): string | null {
    const lineCurrency = line.priceCurrency ?? defaultCurrency;
    if (!isForeignCurrency(lineCurrency, baseCurrency)) {
      return line.unitPrice;
    }
    return convertCurrencyAmount({
      amount: line.unitPrice,
      fromCurrency: lineCurrency,
      baseCurrency,
      exchangeRate,
    });
  }
  const taxSummary = calculatePurchaseOrderTaxSummary(
    values.lines.map((line) => ({
      qtyOrdered: line.qtyOrdered,
      unitPrice: resolveLineUnitPrice(line) ?? "",
      vatRatePercent: line.vatRatePercent ?? "0.00",
    })),
  );

  function clearSaveError() {
    if (saveError) setSuppressedSaveError(saveError);
  }
  function updateHeader<
    Key extends keyof Omit<PurchaseOrderFormValues, "lines">,
  >(key: Key, value: PurchaseOrderFormValues[Key]) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
    clearSaveError();
  }
  function changeSupplier(supplierId: number | null) {
    if (supplierId === values.supplierId) return;
    const uiKey = `new-${nextKey.current++}`;
    setValues((current) => ({
      ...current,
      supplierId,
      lines: [
        { ...createEmptyPurchaseOrderLine(), uiKey, priceCurrency: null },
      ],
    }));
    setErrors((current) => ({
      ...current,
      supplierId: undefined,
      lines: undefined,
      lineErrors: undefined,
    }));
    clearSaveError();
  }
  function updateLine<
    Key extends keyof Pick<
      DraftLine,
      "itemId" | "uomId" | "qtyOrdered" | "unitPrice" | "vatRatePercent" | "priceCurrency"
    >,
  >(uiKey: string, key: Key, value: DraftLine[Key]) {
    setValues((current) => ({
      ...current,
      lines: current.lines.map((line) =>
        line.uiKey === uiKey
          ? {
            ...line,
            [key]: value,
            ...(key === "uomId" && line.uomId !== value
              ? { unitPrice: "", priceCurrency: null }
              : {}),
          }
          : line,
      ),
    }));
    setErrors((current) => ({ ...current, lineErrors: undefined }));
    clearSaveError();
  }
  function changeItem(uiKey: string, itemId: number | null) {
    const item = options.items.find((candidate) => candidate.itemId === itemId);
    const quote = options.supplierItems.find(
      (candidate) =>
        candidate.supplierId === values.supplierId &&
        candidate.itemId === itemId &&
        candidate.isActive,
    );
    const quotedUnit = quote?.defaultUomId ?? item?.primaryUomId ?? null;
    const compatibleQuote = options.uoms.some(
      (unit) =>
        unit.uomId === quotedUnit && unit.uomClassId === item?.uomClassId,
    );
    const fallbackCost =
      item?.unitCost && /[1-9]/.test(item.unitCost) ? item.unitCost : "";
    setValues((current) => ({
      ...current,
      lines: current.lines.map((line) =>
        line.uiKey === uiKey
          ? {
            ...line,
            itemId,
            uomId: compatibleQuote
              ? quotedUnit
              : (item?.primaryUomId ?? null),
            qtyOrdered: "",
            unitPrice: compatibleQuote
              ? (quote?.defaultPrice ?? fallbackCost)
              : fallbackCost,
            vatRatePercent: item
              ? (item.isVatable ?? true)
                ? (options.defaultVatRatePercent ?? "12.00")
                : "0.00"
              : "0.00",
            priceCurrency: null,
          }
          : line,
      ),
    }));
    setErrors((current) => ({ ...current, lineErrors: undefined }));
    clearSaveError();
  }
  function addLine() {
    if (isSaving || values.lines.length >= 100) return;
    const uiKey = `new-${nextKey.current++}`;
    setValues((current) => ({
      ...current,
      lines: [
        ...current.lines,
        { ...createEmptyPurchaseOrderLine(), uiKey, priceCurrency: null },
      ],
    }));
    setErrors((current) => ({ ...current, lines: undefined }));
    clearSaveError();
  }
  function removeLine(uiKey: string) {
    if (isSaving || values.lines.length <= 1) return;
    setValues((current) => ({
      ...current,
      lines: current.lines.filter((line) => line.uiKey !== uiKey),
    }));
    setErrors((current) => ({
      ...current,
      lines: undefined,
      lineErrors: undefined,
    }));
    clearSaveError();
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;
    setSuppressedSaveError(null);
    const rateIssue = hasForeignLine
      ? validateExchangeRate(exchangeRate)
      : undefined;
    setExchangeRateError(rateIssue);
    const convertedByLine = values.lines.map((line) =>
      resolveLineUnitPrice(line),
    );
    const normalized: PurchaseOrderFormValues = {
      poNumber: values.poNumber.trim().toUpperCase(),
      supplierId: values.supplierId,
      orderDate: values.orderDate,
      expectedDeliveryDate: values.expectedDeliveryDate,
      notes: values.notes.trim(),
      lines: values.lines.map((line, index) => ({
        itemId: line.itemId,
        uomId: line.uomId,
        qtyOrdered: line.qtyOrdered.trim(),
        unitPrice: (convertedByLine[index] ?? line.unitPrice).trim(),
        vatRatePercent: line.vatRatePercent ?? "0.00",
      })),
    };
    const nextErrors = validatePurchaseOrder(
      normalized,
      options,
      orders,
      order,
    );
    if (!rateIssue) {
      values.lines.forEach((line, index) => {
        const lineCurrency = line.priceCurrency ?? defaultCurrency;
        if (
          isForeignCurrency(lineCurrency, baseCurrency) &&
          convertedByLine[index] === null &&
          line.unitPrice.trim() !== "" &&
          !nextErrors.lineErrors?.[index]?.unitPrice
        ) {
          const lineErrors = nextErrors.lineErrors ? [...nextErrors.lineErrors] : [];
          lineErrors[index] = {
            ...lineErrors[index],
            unitPrice: `Converted amount exceeds 10 whole digits in ${baseCurrency}.`,
          };
          nextErrors.lineErrors = lineErrors;
        }
      });
    }
    setErrors(nextErrors);
    if (rateIssue) {
      document.getElementById(`${id}-exchangeRate`)?.focus();
      return;
    }
    const headerField = (
      [
        "poNumber",
        "supplierId",
        "orderDate",
        "expectedDeliveryDate",
        "notes",
      ] as const
    ).find((field) => nextErrors[field]);
    if (headerField) {
      document.getElementById(`${id}-${headerField}`)?.focus();
      return;
    }
    const invalidLine =
      nextErrors.lineErrors?.findIndex(
        (line) => line && Object.keys(line).length > 0,
      ) ?? -1;
    if (invalidLine >= 0) {
      const field = Object.keys(nextErrors.lineErrors![invalidLine])[0];
      document
        .getElementById(`${id}-${values.lines[invalidLine].uiKey}-${field}`)
        ?.focus();
      return;
    }
    if (nextErrors.lines) {
      document.getElementById(`${id}-lines`)?.focus();
      return;
    }
    if (await onSave(normalized, order)) onOpenChange(false);
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
          Prepare a draft purchase from one supplier. Confirm quantities and
          prices in each line&apos;s purchase unit.
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
      <form
        onSubmit={submit}
        className="flex flex-col gap-5"
        aria-busy={isSaving}
      >
        <FieldGroup className="grid gap-4 sm:grid-cols-2">
          <Field
            data-invalid={Boolean(poNumberError)}
            data-disabled={isSaving}
          >
            <FieldLabel htmlFor={`${id}-poNumber`}>PO number</FieldLabel>
            <Input
              id={`${id}-poNumber`}
              name="poNumber"
              readOnly={Boolean(order)}
              value={values.poNumber}
              placeholder="PO number"
              maxLength={30}
              onChange={(event) => updateHeader("poNumber", event.target.value)}
              disabled={isSaving}
              className="h-10"
              aria-invalid={Boolean(poNumberError)}
              aria-describedby={`${id}-poNumber-help ${id}-poNumber-error`}
            />
            <FieldDescription id={`${id}-poNumber-help`}>
              {order
                ? "The number stays fixed after this order is created."
                : "Use the generated number or enter your own unique PO number."}
            </FieldDescription>
            <FieldError id={`${id}-poNumber-error`}>
              {poNumberError}
            </FieldError>
          </Field>
          <Field
            data-invalid={Boolean(errors.supplierId)}
            data-disabled={isSaving}
          >
            <FieldLabel htmlFor={`${id}-supplierId`}>Supplier</FieldLabel>
            <ComboboxSelect
              id={`${id}-supplierId`}
              items={supplierItems.map((supplier) => ({
                ...supplier,
                disabled: !supplier.isActive,
              }))}
              value={values.supplierId}
              disabled={isSaving}
              onValueChange={changeSupplier}
              placeholder="Select a supplier"
              aria-invalid={Boolean(errors.supplierId)}
              aria-describedby={`${id}-supplier-help`}
              className="h-10 w-full"
            />
            <div id={`${id}-supplier-help`}>
              <FieldDescription>
                Changing the supplier clears all order lines.
              </FieldDescription>
              <FieldError>{errors.supplierId}</FieldError>
            </div>
          </Field>
          <Field
            data-invalid={Boolean(errors.orderDate)}
            data-disabled={isSaving}
          >
            <FieldLabel htmlFor={`${id}-orderDate`}>Order date</FieldLabel>
            <Input
              id={`${id}-orderDate`}
              name="orderDate"
              type="date"
              required
              value={values.orderDate}
              disabled={isSaving}
              onChange={(event) =>
                updateHeader("orderDate", event.target.value)
              }
              className="h-10"
              aria-invalid={Boolean(errors.orderDate)}
              aria-describedby={`${id}-orderDate-error`}
            />
            <FieldError id={`${id}-orderDate-error`}>
              {errors.orderDate}
            </FieldError>
          </Field>
          <Field
            data-invalid={Boolean(errors.expectedDeliveryDate)}
            data-disabled={isSaving}
          >
            <FieldLabel htmlFor={`${id}-expectedDeliveryDate`}>
              Expected delivery{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
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
                Only materials linked to the selected supplier are available.
                Supplier terms fill the initial unit and price.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={
                isSaving || values.lines.length >= 100 || !values.supplierId
              }
              onClick={addLine}
            >
              <Plus />
              Add line
            </Button>
          </div>
          {values.supplierId &&
            !options.supplierItems.some(
              (offer) =>
                offer.supplierId === values.supplierId &&
                offer.isActive &&
                options.items.some(
                  (item) =>
                    item.itemId === offer.itemId &&
                    item.isActive &&
                    item.itemType !== "Finished Good",
                ),
            ) && (
              <Alert>
                <AlertTitle>No materials linked to this supplier</AlertTitle>
                <AlertDescription>
                  Link active materials in{" "}
                  <Link className="underline" href="/suppliers">
                    Suppliers
                  </Link>{" "}
                  or{" "}
                  <Link className="underline" href="/items">
                    Items / Products
                  </Link>
                  , then return to this order.
                </AlertDescription>
              </Alert>
            )}
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
                  setExchangeRate(next);
                  setExchangeRateError(undefined);
                }}
                className="h-10"
                aria-invalid={Boolean(exchangeRateError)}
                aria-describedby={`${id}-exchangeRate-error`}
              />
              <FieldDescription>
                Converts non-{baseCurrency} line prices to {baseCurrency}.
              </FieldDescription>
              <FieldError id={`${id}-exchangeRate-error`}>
                {exchangeRateError}
              </FieldError>
            </Field>
          )}
          <FieldError>{errors.lines}</FieldError>
          {values.lines.map((line, index) => {
            const selected = options.items.find(
              (item) => item.itemId === line.itemId,
            );
            const itemItems = options.items
              .filter(
                (item) =>
                  (item.isActive &&
                    item.itemType !== "Finished Good" &&
                    options.supplierItems.some(
                      (offer) =>
                        offer.supplierId === values.supplierId &&
                        offer.itemId === item.itemId &&
                        offer.isActive,
                    )) ||
                  item.itemId === line.itemId,
              )
              .map((item) => ({
                value: item.itemId,
                label: `${item.sku} · ${item.name}${item.isActive && item.itemType !== "Finished Good" ? "" : " (unavailable)"}`,
                available:
                  item.isActive &&
                  item.itemType !== "Finished Good" &&
                  options.supplierItems.some(
                    (offer) =>
                      offer.supplierId === values.supplierId &&
                      offer.itemId === item.itemId &&
                      offer.isActive,
                  ),
              }));
            const unitItems = options.uoms
              .filter((unit) => unit.uomClassId === selected?.uomClassId)
              .map((unit) => ({ value: unit.uomId, label: unit.name }));
            const lineErrors = errors.lineErrors?.[index] ?? {};
            const lineCurrency = line.priceCurrency ?? defaultCurrency;
            const resolvedLineUnitPrice = resolveLineUnitPrice(line);
            const lineTax = calculatePurchaseOrderLineVatBreakdown(
              line.qtyOrdered,
              resolvedLineUnitPrice ?? "",
              line.vatRatePercent ?? "0.00",
            );
            const lineTotal = lineTax?.lineTotal ?? null;
            const prefix = `${id}-${line.uiKey}`;
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
                <FieldGroup className="grid gap-4 sm:grid-cols-2 lg:grid-cols-7">
                  <Field
                    className="min-w-0 lg:col-span-2"
                    data-invalid={Boolean(lineErrors.itemId)}
                    data-disabled={isSaving || !values.supplierId}
                  >
                    <FieldLabel htmlFor={`${prefix}-itemId`}>
                      Material
                    </FieldLabel>
                    <ComboboxSelect
                      id={`${prefix}-itemId`}
                      items={itemItems.map((item) => ({
                        ...item,
                        disabled: !item.available,
                      }))}
                      value={line.itemId}
                      disabled={isSaving || !values.supplierId}
                      onValueChange={(value) => changeItem(line.uiKey, value)}
                      placeholder="Select a material"
                      aria-invalid={Boolean(lineErrors.itemId)}
                      aria-describedby={`${prefix}-itemId-error`}
                      className="h-10 w-full"
                    />
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
                    <ComboboxSelect
                      id={`${prefix}-uomId`}
                      items={unitItems}
                      value={line.uomId}
                      disabled={isSaving || !selected}
                      onValueChange={(value) =>
                        updateLine(line.uiKey, "uomId", value)
                      }
                      placeholder="Select unit"
                      aria-invalid={Boolean(lineErrors.uomId)}
                      aria-describedby={`${prefix}-uomId-error`}
                      className="h-10 w-full"
                    />
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
                    <NumericInput
                      id={`${prefix}-qtyOrdered`}
                      name={`line-${index}-quantity`}
                      maxWholeDigits={10}
                      maxDecimalPlaces={4}
                      maxLength={15}
                      required
                      value={line.qtyOrdered}
                      disabled={isSaving}
                      onValueChange={(next) =>
                        updateLine(line.uiKey, "qtyOrdered", next)
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
                    className="min-w-0 sm:col-span-2"
                    data-invalid={Boolean(lineErrors.unitPrice)}
                    data-disabled={isSaving}
                  >
                    <FieldLabel htmlFor={`${prefix}-unitPrice`}>
                      Unit price
                    </FieldLabel>
                    <PriceCurrencyInput
                      id={`${prefix}-unitPrice`}
                      name={`line-${index}-price`}
                      value={line.unitPrice}
                      currency={lineCurrency}
                      baseCurrency={baseCurrency}
                      convertedValue={resolvedLineUnitPrice}
                      onValueChange={(nextValue) =>
                        updateLine(line.uiKey, "unitPrice", nextValue)
                      }
                      onCurrencyChange={(nextCurrency) => {
                        updateLine(line.uiKey, "priceCurrency", nextCurrency);
                        if (!isForeignCurrency(nextCurrency, baseCurrency)) {
                          const stillForeign = values.lines.some(
                            (other) =>
                              other.uiKey !== line.uiKey &&
                              isForeignCurrency(
                                other.priceCurrency ?? defaultCurrency,
                                baseCurrency,
                              ),
                          );
                          if (!stillForeign) setExchangeRateError(undefined);
                        }
                      }}
                      disabled={isSaving}
                      required
                      maxLength={15}
                      currencyAriaLabel={`Line ${index + 1} price currency`}
                      aria-invalid={Boolean(lineErrors.unitPrice)}
                      aria-describedby={`${prefix}-unitPrice-error`}
                    />
                    <FieldError id={`${prefix}-unitPrice-error`}>
                      {lineErrors.unitPrice}
                    </FieldError>
                  </Field>
                  <Field className="min-w-0">
                    <FieldLabel htmlFor={`${prefix}-vatRate`}>VAT</FieldLabel>
                    <ComboboxSelect
                      id={`${prefix}-vatRate`}
                      items={(() => {
                        const stdRate = options.defaultVatRatePercent ?? "12.00";
                        const curRate = line.vatRatePercent ?? "0.00";
                        const baseOpts = [
                          { value: "0.00", label: "No VAT (0%)" },
                          ...(Number(stdRate) > 0
                            ? [{ value: stdRate, label: `VATable (${stdRate}%)` }]
                            : []),
                        ];
                        return baseOpts.some((opt) => opt.value === curRate)
                          ? baseOpts
                          : [...baseOpts, { value: curRate, label: `Custom VAT (${curRate}%)` }];
                      })()}
                      value={line.vatRatePercent ?? "0.00"}
                      onValueChange={(value) => {
                        if (value) updateLine(line.uiKey, "vatRatePercent", value);
                      }}
                      disabled={isSaving}
                      searchable={false}
                      className="h-10 w-full"
                    />
                  </Field>
                </FieldGroup>
                <p className="flex flex-wrap items-center justify-between gap-2 break-words text-sm text-muted-foreground">
                  <span>
                    {lineTax
                      ? `Net ${formatPurchaseOrderDecimal(lineTax.netAmount)} + Input VAT ${formatPurchaseOrderDecimal(lineTax.vatAmount)}`
                      : ""}
                  </span>
                  <span>
                    Line value{" "}
                    <span className="ml-2 font-medium text-foreground tabular-nums">
                      {lineTotal === null
                        ? "—"
                        : formatPurchaseOrderDecimal(lineTotal)}
                    </span>
                  </span>
                </p>
              </FieldSet>
            );
          })}
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {values.lines.length} of 100 lines
          </p>
        </section>
        <Field data-invalid={Boolean(errors.notes)} data-disabled={isSaving}>
          <FieldLabel htmlFor={`${id}-notes`}>
            Notes{" "}
            <span className="font-normal text-muted-foreground">
              (optional)
            </span>
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
        <DialogFooter className="sticky bottom-0 bg-popover">
          <div className="mr-auto flex min-w-0 items-center gap-3">
            <span className="text-sm text-muted-foreground">Order value</span>
            <span
              className="min-w-0 break-words text-lg font-semibold tabular-nums"
              aria-live="polite"
            >
              {taxSummary === null
                ? "—"
                : `Net ${formatPurchaseOrderDecimal(taxSummary.netAmount)} + Input VAT ${formatPurchaseOrderDecimal(taxSummary.vatAmount)} = ${formatPurchaseOrderDecimal(taxSummary.totalAmount)}`}
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
  );
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
  const detail = usePurchaseOrderDetail(open && order ? order.poId : null);
  const serverOrder = order ? detail.order : null;
  const ready = optionsReady && (!order || serverOrder !== null);
  const editable =
    !serverOrder ||
    (serverOrder.status === "Draft" && !serverOrder.hasReceipts);
  const retry = () => {
    retryOptions();
    if (order) detail.retry();
  };
  const isFetching = isOptionsLoading || detail.isFetching;
  const loadError = optionsError ?? (order ? detail.loadError : null);

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!props.isSaving) onOpenChange(value);
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
  );
}
