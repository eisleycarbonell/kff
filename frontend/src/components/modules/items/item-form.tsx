"use client";

import { useId, useState, type FormEvent } from "react";
import { ChevronDown, ChevronRight, Sparkles } from "lucide-react";
import {
  ITEM_TYPES,
  validateItem,
  type Item,
  type ItemUom,
  type ItemFormValues,
  type ItemFormErrors,
} from "@/components/modules/items/item.schema";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  FieldContent,
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
import { useCompanySettings } from "@/hooks/modules/company-settings/use-company-settings";
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
  item: Item | null;
  items: Item[];
  uoms: ItemUom[];
  canManagePacking?: boolean;
  onOpenFormula?: (item: Item) => void;
  onSave: (values: ItemFormValues, item: Item | null) => Promise<Item | null>;
  isSaving: boolean;
};

const TYPE_DESCRIPTIONS: Record<(typeof ITEM_TYPES)[number], string> = {
  "Raw Material - Bulk": "Bulk ingredients purchased by weight or count (e.g. garlic powder).",
  "Packaging - Hardware": "Pouches, jars, caps, or seals used when packing finished goods.",
  "Packaging - Label": "Printed labels attached to packed finished products.",
  "Finished Good": "Packed product assembled from ingredients and packaging, ready to sell.",
};

const TYPE_PREFIXES: Record<(typeof ITEM_TYPES)[number], string> = {
  "Raw Material - Bulk": "RM",
  "Packaging - Hardware": "PKG",
  "Packaging - Label": "LBL",
  "Finished Good": "FG",
};

const typeItems = ITEM_TYPES.map((value) => ({ value, label: value }));

function defaultUomIdForType(
  itemType: (typeof ITEM_TYPES)[number],
  uoms: ItemUom[],
): number | null {
  const preferredName = itemType === "Raw Material - Bulk" ? "kg" : "pc";
  const match = uoms.find(
    (unit) => unit.name.trim().toLowerCase() === preferredName,
  );
  return match?.uomId ?? uoms[0]?.uomId ?? null;
}

function buildSuggestedSku(
  itemType: (typeof ITEM_TYPES)[number],
  name: string,
): string {
  const prefix = TYPE_PREFIXES[itemType];
  const slug = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 42);
  return slug ? `${prefix}-${slug}`.slice(0, 50) : prefix;
}

function ItemFormContent({
  onOpenChange,
  item,
  items,
  uoms,
  canManagePacking = false,
  onOpenFormula,
  onSave,
  isSaving,
}: Omit<Props, "open">) {
  const id = useId();
  const { settings } = useCompanySettings();
  const baseCurrency = normalizeCurrencyCode(settings?.currencyCode);
  const defaultCurrency = resolveBaseEntryCurrency(baseCurrency);
  const [priceCurrency, setPriceCurrency] =
    useState<EntryCurrencyCode | null>(null);
  const [exchangeRate, setExchangeRate] = useState("");
  const [exchangeRateError, setExchangeRateError] = useState<string>();
  const activeCurrency = priceCurrency ?? defaultCurrency;
  const foreignPrice = isForeignCurrency(activeCurrency, baseCurrency);

  const initialType = item?.itemType ?? ITEM_TYPES[0];
  const [values, setValues] = useState<ItemFormValues>(() => ({
    sku: item?.sku ?? "",
    name: item?.name ?? "",
    itemType: initialType,
    primaryUomId: item?.primaryUomId ?? defaultUomIdForType(initialType, uoms),
    labelItemId: item?.labelItemId ?? null,
    unitCost: item?.unitCost ?? "0",
    netWeightG: item?.netWeightG ?? "",
    shelfLifeDays: item?.shelfLifeDays?.toString() ?? "",
    requiresQc: item?.requiresQc ?? false,
    isVatable: item?.isVatable ?? true,
    isActive: item?.isActive ?? true,
  }));
  const [uomTouched, setUomTouched] = useState(Boolean(item));
  const [detailsOpen, setDetailsOpen] = useState(Boolean(item));
  const [errors, setErrors] = useState<ItemFormErrors>({});

  const convertedUnitCost = foreignPrice
    ? convertCurrencyAmount({
        amount: values.unitCost,
        fromCurrency: activeCurrency,
        baseCurrency,
        exchangeRate,
      })
    : values.unitCost;
  const uomItems = [
    { value: null, label: "Select a primary UOM" },
    ...uoms.map((unit) => ({
      value: unit.uomId,
      label: `${unit.name} (${unit.uomClassName})`,
    })),
  ];

  function update<Key extends keyof ItemFormValues>(
    name: Key,
    value: ItemFormValues[Key],
  ) {
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => {
      const next = { ...current };
      delete next[name];
      return next;
    });
  }

  async function commit(openFormulaAfterSave: boolean) {
    if (isSaving) return;
    const rateIssue = foreignPrice
      ? validateExchangeRate(exchangeRate)
      : undefined;
    setExchangeRateError(rateIssue);
    const resolvedCost = foreignPrice
      ? (convertedUnitCost ?? (rateIssue ? values.unitCost : "__overflow__"))
      : values.unitCost;
    const candidateValues: ItemFormValues = {
      ...values,
      unitCost:
        resolvedCost === "__overflow__" ? values.unitCost : resolvedCost,
    };
    const next = validateItem(candidateValues, items, uoms, item);
    if (foreignPrice && !rateIssue && convertedUnitCost === null) {
      next.unitCost =
        "Converted amount exceeds 10 whole digits in base currency.";
    }
    setErrors(next);
    if (
      rateIssue ||
      next.unitCost ||
      next.netWeightG ||
      next.shelfLifeDays
    ) {
      setDetailsOpen(true);
    }
    if (rateIssue) {
      document.getElementById(`${id}-exchangeRate`)?.focus();
      return;
    }
    const first = Object.keys(next)[0];
    if (first) {
      document.getElementById(`${id}-${first}`)?.focus();
      return;
    }
    const saved = await onSave(candidateValues, item);
    if (saved) {
      onOpenChange(false);
      if (openFormulaAfterSave) onOpenFormula?.(saved);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void commit(false);
  }

  const isFinished = values.itemType === "Finished Good";
  const canChainFormula =
    !item && isFinished && canManagePacking && Boolean(onOpenFormula);

  return (
    <DialogContent
      className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl"
      showCloseButton={!isSaving}
    >
      <DialogHeader>
        <DialogTitle>{item ? "Edit item" : "Add item or product"}</DialogTitle>
        <DialogDescription>
          {item
            ? "Update catalog details, cost, and availability."
            : "Start with what you are adding, give it a name and SKU, and pick its main unit."}
        </DialogDescription>
      </DialogHeader>
      <form
        onSubmit={submit}
        className="flex flex-col gap-4"
        aria-busy={isSaving}
      >
        <FieldGroup className="grid gap-4 sm:grid-cols-2">
          <Field
            className="sm:col-span-2"
            data-invalid={Boolean(errors.itemType)}
            data-disabled={isSaving || item?.isInUse}
          >
            <FieldLabel htmlFor={`${id}-itemType`}>What are you adding?</FieldLabel>
            <ComboboxSelect
              id={`${id}-itemType`}
              name="itemType"
              items={typeItems}
              value={values.itemType}
              disabled={isSaving || item?.isInUse}
              onValueChange={(value) => {
                if (!value) return;
                update("itemType", value);
                if (value !== "Finished Good") update("labelItemId", null);
                if (!item && !uomTouched) {
                  update("primaryUomId", defaultUomIdForType(value, uoms));
                }
              }}
              aria-invalid={Boolean(errors.itemType)}
              aria-describedby={`${id}-itemType-feedback`}
              className="h-10 w-full"
            />
            <div id={`${id}-itemType-feedback`}>
              <FieldDescription>
                {TYPE_DESCRIPTIONS[values.itemType]}
              </FieldDescription>
              <FieldError>{errors.itemType}</FieldError>
            </div>
          </Field>

          <Field
            data-invalid={Boolean(errors.name)}
            data-disabled={isSaving}
          >
            <FieldLabel htmlFor={`${id}-name`}>
              {isFinished ? "Finished product name" : "Item name"}
            </FieldLabel>
            <Input
              id={`${id}-name`}
              name="name"
              value={values.name}
              maxLength={120}
              required
              placeholder={
                isFinished
                  ? "e.g. Garlic Powder 100g"
                  : "e.g. Garlic Powder Bulk"
              }
              disabled={isSaving}
              onChange={(event) => update("name", event.target.value)}
              aria-invalid={Boolean(errors.name)}
              aria-describedby={`${id}-name-feedback`}
              className="h-10"
            />
            <FieldError id={`${id}-name-feedback`}>{errors.name}</FieldError>
          </Field>

          <Field
            data-invalid={Boolean(errors.sku)}
            data-disabled={isSaving}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <FieldLabel htmlFor={`${id}-sku`}>SKU code</FieldLabel>
              {!item && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  disabled={isSaving || !values.name.trim()}
                  onClick={() =>
                    update(
                      "sku",
                      buildSuggestedSku(values.itemType, values.name),
                    )
                  }
                >
                  <Sparkles className="size-3" />
                  Suggest SKU
                </Button>
              )}
            </div>
            <Input
              id={`${id}-sku`}
              name="sku"
              value={values.sku}
              maxLength={50}
              required
              placeholder={
                isFinished ? "e.g. FG-GARLIC-100G" : "e.g. RM-GARLIC"
              }
              disabled={isSaving}
              onChange={(event) => update("sku", event.target.value)}
              aria-invalid={Boolean(errors.sku)}
              aria-describedby={`${id}-sku-feedback`}
              className="h-10"
            />
            <FieldError id={`${id}-sku-feedback`}>{errors.sku}</FieldError>
          </Field>

          <Field
            data-invalid={Boolean(errors.primaryUomId)}
            data-disabled={isSaving || item?.isInUse}
          >
            <FieldLabel htmlFor={`${id}-primaryUomId`}>
              {isFinished ? "Sold & stocked per" : "Main stock unit"}
            </FieldLabel>
            <ComboboxSelect
              id={`${id}-primaryUomId`}
              name="primaryUomId"
              items={uomItems}
              value={values.primaryUomId}
              disabled={isSaving || item?.isInUse}
              onValueChange={(value) => {
                setUomTouched(true);
                update("primaryUomId", value);
              }}
              aria-invalid={Boolean(errors.primaryUomId)}
              aria-describedby={`${id}-primaryUomId-feedback`}
              className="h-10 w-full"
            />
            <FieldError id={`${id}-primaryUomId-feedback`}>
              {errors.primaryUomId}
            </FieldError>
          </Field>

          {isFinished && (
            <Field data-invalid={Boolean(errors.labelItemId)}>
              <FieldLabel htmlFor={`${id}-labelItemId`}>
                Printed label (optional)
              </FieldLabel>
              <ComboboxSelect
                id={`${id}-labelItemId`}
                value={values.labelItemId ?? 0}
                items={[
                  { value: 0, label: "No label yet" },
                  ...items
                    .filter(
                      (label) =>
                        label.itemType === "Packaging - Label" &&
                        (label.isActive || label.itemId === item?.labelItemId),
                    )
                    .map((label) => ({
                      value: label.itemId,
                      label:
                        label.sku +
                        " · " +
                        label.name +
                        (label.isActive ? "" : " (inactive)"),
                      disabled:
                        !label.isActive && label.itemId !== item?.labelItemId,
                    })),
                ]}
                disabled={isSaving}
                onValueChange={(value) => update("labelItemId", value || null)}
                placeholder="No label yet"
                aria-invalid={Boolean(errors.labelItemId)}
                aria-describedby={`${id}-label-feedback`}
                className="h-10 w-full"
              />
              <div id={`${id}-label-feedback`}>
                <FieldDescription>
                  Pre-added automatically when setting up the packing formula.
                </FieldDescription>
                <FieldError>{errors.labelItemId}</FieldError>
              </div>
            </Field>
          )}
        </FieldGroup>

        {item?.isInUse && (
          <FieldDescription>
            Type and primary unit are locked because this item is already used in
            orders, formulas, or stock records.
          </FieldDescription>
        )}

        <Field orientation="horizontal" className="rounded-lg border p-3.5" data-disabled={isSaving}>
          <Checkbox
            id={`${id}-vatable`}
            name="isVatable"
            checked={values.isVatable ?? true}
            disabled={isSaving}
            onCheckedChange={(checked) => update("isVatable", Boolean(checked))}
            aria-describedby={`${id}-vatable-description`}
          />
          <FieldContent>
            <FieldLabel htmlFor={`${id}-vatable`}>
              Subject to VAT (VATable item)
            </FieldLabel>
            <FieldDescription id={`${id}-vatable-description`}>
              {(values.isVatable ?? true)
                ? `Applies ${settings?.vatRatePercent ?? "12.00"}% default VAT on new purchase & sales orders (editable per line). Uncheck for VAT-exempt items.`
                : "VAT-exempt (0% VAT): new purchase & sales order lines default to 0% VAT unless overridden."}
            </FieldDescription>
          </FieldContent>
        </Field>

        <div className="rounded-lg border">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-medium hover:bg-muted/40"
            aria-expanded={detailsOpen}
            onClick={() => setDetailsOpen((open) => !open)}
          >
            <span className="flex items-center gap-2">
              {detailsOpen ? (
                <ChevronDown className="size-4 shrink-0" />
              ) : (
                <ChevronRight className="size-4 shrink-0" />
              )}
              Cost, weight, shelf life &amp; status (optional)
            </span>
            <span className="text-xs font-normal text-muted-foreground">
              {values.unitCost || "0"} {baseCurrency} ·{" "}
              {values.isActive ? "Active" : "Inactive"}
            </span>
          </button>

          {detailsOpen && (
            <div className="space-y-4 border-t p-4">
              <FieldGroup className="grid gap-4 sm:grid-cols-2">
                <Field
                  data-invalid={Boolean(errors.unitCost)}
                  data-disabled={isSaving}
                >
                  <FieldLabel htmlFor={`${id}-unitCost`}>
                    Reference cost
                  </FieldLabel>
                  <PriceCurrencyInput
                    id={`${id}-unitCost`}
                    name="unitCost"
                    value={values.unitCost}
                    currency={activeCurrency}
                    baseCurrency={baseCurrency}
                    convertedValue={convertedUnitCost}
                    onValueChange={(nextValue) => update("unitCost", nextValue)}
                    onCurrencyChange={(nextCurrency) => {
                      setPriceCurrency(nextCurrency);
                      if (!isForeignCurrency(nextCurrency, baseCurrency)) {
                        setExchangeRateError(undefined);
                      }
                    }}
                    required
                    currencyAriaLabel="Reference cost currency"
                    aria-invalid={Boolean(errors.unitCost)}
                    aria-describedby={`${id}-unitCost-feedback`}
                  />
                  <div id={`${id}-unitCost-feedback`}>
                    <FieldDescription>
                      Cost per primary unit; defaults to 0.
                    </FieldDescription>
                    <FieldError>{errors.unitCost}</FieldError>
                  </div>
                </Field>

                {foreignPrice && (
                  <Field
                    data-invalid={Boolean(exchangeRateError)}
                    data-disabled={isSaving}
                  >
                    <FieldLabel htmlFor={`${id}-exchangeRate`}>
                      {getExchangeRateLabel(baseCurrency, [activeCurrency])}
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
                        setErrors((current) => {
                          const updated = { ...current };
                          delete updated.unitCost;
                          return updated;
                        });
                      }}
                      aria-invalid={Boolean(exchangeRateError)}
                      aria-describedby={`${id}-exchangeRate-feedback`}
                      className="h-10"
                    />
                    <div id={`${id}-exchangeRate-feedback`}>
                      <FieldDescription>
                        Converted value will be saved in {baseCurrency}.
                      </FieldDescription>
                      <FieldError>{exchangeRateError}</FieldError>
                    </div>
                  </Field>
                )}

                <Field
                  data-invalid={Boolean(errors.netWeightG)}
                  data-disabled={isSaving}
                >
                  <FieldLabel htmlFor={`${id}-netWeightG`}>
                    Net weight (g)
                  </FieldLabel>
                  <NumericInput
                    id={`${id}-netWeightG`}
                    name="netWeightG"
                    value={values.netWeightG}
                    maxWholeDigits={8}
                    maxDecimalPlaces={4}
                    placeholder="Optional, e.g. 100"
                    disabled={isSaving}
                    onValueChange={(next) => update("netWeightG", next)}
                    aria-invalid={Boolean(errors.netWeightG)}
                    aria-describedby={`${id}-netWeightG-feedback`}
                    className="h-10"
                  />
                  <div id={`${id}-netWeightG-feedback`}>
                    <FieldError>{errors.netWeightG}</FieldError>
                  </div>
                </Field>

                <Field
                  data-invalid={Boolean(errors.shelfLifeDays)}
                  data-disabled={isSaving}
                >
                  <FieldLabel htmlFor={`${id}-shelfLifeDays`}>
                    Shelf life (days)
                  </FieldLabel>
                  <NumericInput
                    id={`${id}-shelfLifeDays`}
                    name="shelfLifeDays"
                    value={values.shelfLifeDays}
                    allowDecimal={false}
                    maxWholeDigits={10}
                    placeholder="Optional, e.g. 365"
                    disabled={isSaving}
                    onValueChange={(next) => update("shelfLifeDays", next)}
                    aria-invalid={Boolean(errors.shelfLifeDays)}
                    aria-describedby={`${id}-shelfLifeDays-feedback`}
                    className="h-10"
                  />
                  <div id={`${id}-shelfLifeDays-feedback`}>
                    <FieldError>{errors.shelfLifeDays}</FieldError>
                  </div>
                </Field>
              </FieldGroup>

              <FieldSet>
                <FieldLegend variant="label">Availability</FieldLegend>
                <FieldGroup className="gap-3">
                  <Field orientation="horizontal" data-disabled={isSaving}>
                    <Checkbox
                      id={`${id}-active`}
                      name="isActive"
                      checked={values.isActive}
                      disabled={isSaving}
                      onCheckedChange={(checked) => update("isActive", checked)}
                      aria-describedby={`${id}-active-description`}
                    />
                    <FieldContent>
                      <FieldLabel htmlFor={`${id}-active`}>
                        Active item
                      </FieldLabel>
                      <FieldDescription id={`${id}-active-description`}>
                        Enable this item for operational use. Inactive items remain
                        in historical records.
                      </FieldDescription>
                    </FieldContent>
                  </Field>
                </FieldGroup>
              </FieldSet>
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          {isFinished
            ? "Next step: list the spice, pouch, seal, and label needed per pack in Packing Formulas."
            : "For purchased materials, use the Suppliers column after saving to link vendors before ordering."}
        </p>

        <DialogFooter className="flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={isSaving}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          {canChainFormula ? (
            <>
              <Button
                type="submit"
                variant="outline"
                disabled={isSaving}
              >
                {isSaving ? "Saving..." : "Save product only"}
              </Button>
              <Button
                type="button"
                disabled={isSaving}
                onClick={() => void commit(true)}
              >
                {isSaving ? "Saving..." : "Save & add components"}
              </Button>
            </>
          ) : (
            <Button type="submit" disabled={isSaving}>
              {isSaving
                ? "Saving..."
                : item
                  ? "Save changes"
                  : "Create item"}
            </Button>
          )}
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

export function ItemForm({ open, onOpenChange, ...props }: Props) {
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!props.isSaving) onOpenChange(value);
      }}
    >
      {open && (
        <ItemFormContent
          key={props.item?.itemId ?? "new"}
          onOpenChange={onOpenChange}
          {...props}
        />
      )}
    </Dialog>
  );
}
