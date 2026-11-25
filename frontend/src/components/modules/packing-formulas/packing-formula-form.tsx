"use client"
import { useId, useState, type FormEvent } from "react"
import { Calculator, Copy, Plus, Sparkles, Trash2 } from "lucide-react"
import {
    divideBatchByPacks,
    validateFormula,
    type PackingFormula,
    type FormulaInput,
    type FormulaOptions,
} from "@/components/modules/packing-formulas/packing-formula.schema"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { Button } from "@/components/ui/button"
import { ComboboxSelect } from "@/components/shared/combobox-select"
import { NumericInput } from "@/components/shared/numeric-input"

type Props = {
    open: boolean
    onOpenChange: (open: boolean) => void
    formula: PackingFormula | null
    initialProductId?: number | null
    existingFormulas?: PackingFormula[]
    options?: FormulaOptions
    optionsError?: string
    optionsLoading: boolean
    retryOptions: () => void
    isSaving: boolean
    error?: string
    onSave: (input: FormulaInput, formula: PackingFormula | null) => Promise<boolean>
}

type ComponentRow = FormulaInput["components"][number]
type BatchCalc = { batchAmount: string; packCount: string }

function starterComponents(productId: number, options: FormulaOptions): {
    components: ComponentRow[]
    autoLabelId: number | null
} {
    const product = options.products.find((row) => row.itemId === productId)
    const label = product?.labelItemId
        ? options.components.find((row) => row.itemId === product.labelItemId)
        : undefined
    if (!label) {
        return {
            components: [{ componentItemId: 0, quantity: "", uomId: 0 }],
            autoLabelId: null,
        }
    }
    return {
        components: [
            { componentItemId: label.itemId, quantity: "1", uomId: label.primaryUomId },
            { componentItemId: 0, quantity: "", uomId: 0 },
        ],
        autoLabelId: label.itemId,
    }
}

function componentHelper(
    material: FormulaOptions["components"][number] | undefined,
    uomClassId: number | undefined,
    uomName: string | undefined,
) {
    if (!material) return null
    if (material.itemType === "Packaging - Label") return "Printed label · usually 1 per finished pack"
    if (material.itemType === "Packaging - Hardware")
        return "Packaging material · e.g. 1 pouch or 1 seal per pack"
    if (uomName === "kg" && uomClassId)
        return "Tip: switch Unit to g if measuring in grams (e.g. 100 g), or use Batch calc."
    return "Raw ingredient · use the unit most natural for 1 pack."
}

function Content({
    formula,
    initialProductId,
    existingFormulas = [],
    options,
    optionsError,
    isSaving,
    error,
    onSave,
    onOpenChange,
}: Omit<Props, "open" | "options" | "optionsLoading" | "retryOptions"> & {
    options: FormulaOptions
}) {
    const id = useId()
    const eligibleProducts = options.products.filter(
        (row) => !row.hasFormula || row.itemId === formula?.itemId,
    )
    const startingProductId =
        formula?.itemId ??
        (initialProductId && eligibleProducts.some((row) => row.itemId === initialProductId)
            ? initialProductId
            : 0)

    const initialSetup = formula
        ? {
            components: formula.components.map(({ componentItemId, quantity, uomId }) => ({
                componentItemId,
                quantity,
                uomId,
            })),
            autoLabelId: null as number | null,
        }
        : starterComponents(startingProductId, options)

    const [input, setInput] = useState<FormulaInput>({
        itemId: startingProductId,
        components: initialSetup.components,
    })
    const [autoLabelId, setAutoLabelId] = useState<number | null>(initialSetup.autoLabelId)
    const [templateId, setTemplateId] = useState<number | null>(null)
    const [copiedNote, setCopiedNote] = useState<string>()
    const [calcOpen, setCalcOpen] = useState<Record<number, boolean>>({})
    const [calcValues, setCalcValues] = useState<Record<number, BatchCalc>>({})
    const [validation, setValidation] = useState<string>()

    const products = eligibleProducts.map((row) => ({
        value: row.itemId,
        label: `${row.sku} · ${row.name}`,
    }))
    if (formula && !products.some((row) => row.value === formula.itemId))
        products.push({ value: formula.itemId, label: `${formula.itemSku} · ${formula.itemName}` })

    const selectedProduct = options.products.find((row) => row.itemId === input.itemId)
    const unitName = selectedProduct?.primaryUomName ?? formula?.primaryUomName ?? "unit"
    const assignedLabel = selectedProduct?.labelItemId
        ? options.components.find((entry) => entry.itemId === selectedProduct.labelItemId)
        : undefined
    const copyOptions = existingFormulas
        .filter((entry) => entry.itemId !== input.itemId)
        .map((entry) => ({
            value: entry.itemId,
            label: `${entry.itemSku} · ${entry.itemName} (${entry.components.length} items)`,
        }))

    function handleProductChange(nextProductId: number | null) {
        const nextId = nextProductId ?? 0
        setValidation(undefined)
        setCopiedNote(undefined)
        const starter = starterComponents(nextId, options)
        setInput((current) => {
            const customized = current.components.filter(
                (row) =>
                    row.componentItemId !== 0 &&
                    row.componentItemId !== autoLabelId &&
                    (row.quantity.trim() !== "" || row.uomId !== 0),
            )
            if (!customized.length) {
                setAutoLabelId(starter.autoLabelId)
                return { itemId: nextId, components: starter.components }
            }
            const nextLabel = starter.autoLabelId
                ? starter.components.find((row) => row.componentItemId === starter.autoLabelId)
                : undefined
            const withoutOldAutoLabel = current.components.filter(
                (row) => row.componentItemId !== autoLabelId,
            )
            const hasNewLabel =
                nextLabel &&
                withoutOldAutoLabel.some((row) => row.componentItemId === nextLabel.componentItemId)
            const merged =
                nextLabel && !hasNewLabel
                    ? [nextLabel, ...withoutOldAutoLabel]
                    : withoutOldAutoLabel
            setAutoLabelId(starter.autoLabelId)
            return {
                itemId: nextId,
                components: merged.length
                    ? merged
                    : [{ componentItemId: 0, quantity: "", uomId: 0 }],
            }
        })
    }

    function applyTemplate(sourceItemId: number | null) {
        setTemplateId(sourceItemId)
        setValidation(undefined)
        if (!sourceItemId) return
        const source = existingFormulas.find((entry) => entry.itemId === sourceItemId)
        if (!source) return
        const activeIds = new Set(options.components.map((entry) => entry.itemId))
        const copied = source.components
            .filter((row) => activeIds.has(row.componentItemId))
            .map((row) => {
                const material = options.components.find((m) => m.itemId === row.componentItemId)
                if (assignedLabel && material?.itemType === "Packaging - Label") {
                    return {
                        componentItemId: assignedLabel.itemId,
                        quantity: row.quantity,
                        uomId: assignedLabel.primaryUomId,
                    }
                }
                return {
                    componentItemId: row.componentItemId,
                    quantity: row.quantity,
                    uomId: row.uomId,
                }
            })
        // Deduplicate in case both template label and assigned label map to the same item.
        const deduped: ComponentRow[] = []
        const seen = new Set<number>()
        for (const row of copied) {
            if (!seen.has(row.componentItemId)) {
                seen.add(row.componentItemId)
                deduped.push(row)
            }
        }
        if (assignedLabel && !seen.has(assignedLabel.itemId)) {
            deduped.unshift({
                componentItemId: assignedLabel.itemId,
                quantity: "1",
                uomId: assignedLabel.primaryUomId,
            })
        }
        setInput((current) => ({
            ...current,
            components: deduped.length ? deduped : [{ componentItemId: 0, quantity: "", uomId: 0 }],
        }))
        setAutoLabelId(assignedLabel?.itemId ?? null)
        setCalcOpen({})
        setCopiedNote(`Copied ${deduped.length} components from ${source.itemName}.`)
    }

    function change(index: number, values: Partial<ComponentRow>) {
        setInput((current) => ({
            ...current,
            components: current.components.map((row, at) =>
                at === index ? { ...row, ...values } : row,
            ),
        }))
        setValidation(undefined)
    }

    async function submit(event: FormEvent) {
        event.preventDefault()
        if (isSaving) return
        const message = validateFormula(input, options)
        setValidation(message)
        if (!message && (await onSave(input, formula))) onOpenChange(false)
    }

    return (
        <form onSubmit={submit} className="space-y-5" aria-busy={isSaving}>
            <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                    <FieldLabel htmlFor={`${id}-product`}>Finished product</FieldLabel>
                    <ComboboxSelect
                        id={`${id}-product`}
                        items={products}
                        value={input.itemId || null}
                        disabled={isSaving || Boolean(formula)}
                        onValueChange={handleProductChange}
                        placeholder="Select finished product"
                        className="w-full"
                    />
                </Field>
                {copyOptions.length > 0 && (
                    <Field>
                        <FieldLabel htmlFor={`${id}-copy`}>
                            Copy from existing product (optional)
                        </FieldLabel>
                        <ComboboxSelect
                            id={`${id}-copy`}
                            items={[{ value: 0, label: "Start from scratch" }, ...copyOptions]}
                            value={templateId ?? 0}
                            disabled={isSaving}
                            onValueChange={(value) => applyTemplate(value || null)}
                            placeholder="Copy components from another formula..."
                            className="w-full"
                        />
                    </Field>
                )}
            </div>

            {copiedNote && (
                <p className="flex items-center gap-1.5 text-sm text-primary">
                    <Copy className="size-3.5 shrink-0" />
                    {copiedNote}
                </p>
            )}

            {assignedLabel && (
                <p className="flex items-center gap-1.5 rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                    <Sparkles className="size-3.5 shrink-0 text-primary" />
                    <span>
                        Assigned label <strong>{assignedLabel.name}</strong> is pre-included so
                        packing consumes label stock automatically.
                    </span>
                </p>
            )}

            <p className="text-sm text-muted-foreground">
                List everything used to make <strong>1 {unitName}</strong> (e.g. spice weight,
                pouch, seal, and label). Need to split a bulk batch? Use{" "}
                <strong>From batch</strong> on any row.
            </p>

            {!products.length && !formula && (
                <p className="text-sm text-muted-foreground">
                    All active finished products already have a packing formula. Add a new Finished
                    Good in Items / Products first, or edit an existing formula from the table.
                </p>
            )}

            <div className="space-y-3">
                {input.components.map((row, index) => {
                    const material = options.components.find(
                        (entry) => entry.itemId === row.componentItemId,
                    )
                    const selectedUnit = options.uoms.find((entry) => entry.uomId === row.uomId)
                    const units = options.uoms
                        .filter((entry) => entry.uomClassId === material?.uomClassId)
                        .map((entry) => ({ value: entry.uomId, label: entry.name }))
                    const choices = options.components
                        .filter(
                            (entry) =>
                                entry.itemId === row.componentItemId ||
                                !input.components.some(
                                    (other) => other.componentItemId === entry.itemId,
                                ),
                        )
                        .map((entry) => ({
                            value: entry.itemId,
                            label: `${entry.sku} · ${entry.name}`,
                        }))
                    const batch = calcValues[index] ?? { batchAmount: "", packCount: "" }
                    const perPackPreview = divideBatchByPacks(batch.batchAmount, batch.packCount)
                    const helperText = componentHelper(
                        material,
                        material?.uomClassId,
                        selectedUnit?.name,
                    )
                    return (
                        <div key={index} className="min-w-0 space-y-3 rounded-lg border p-3 sm:p-4">
                            <div className="grid gap-3 sm:grid-cols-12 [&>*]:min-w-0">
                                <Field className="min-w-0 sm:col-span-5">
                                    <FieldLabel htmlFor={`${id}-material-${index}`}>
                                        Component {index + 1}
                                    </FieldLabel>
                                    <ComboboxSelect
                                        id={`${id}-material-${index}`}
                                        items={choices}
                                        value={row.componentItemId || null}
                                        disabled={isSaving}
                                        onValueChange={(value) => {
                                            const picked = options.components.find(
                                                (entry) => entry.itemId === value,
                                            )
                                            const autoCountQty =
                                                !row.quantity.trim() &&
                                                    (picked?.itemType === "Packaging - Hardware" ||
                                                        picked?.itemType === "Packaging - Label")
                                                    ? "1"
                                                    : row.quantity
                                            change(index, {
                                                componentItemId: value ?? 0,
                                                uomId: picked?.primaryUomId ?? 0,
                                                quantity: autoCountQty,
                                            })
                                        }}
                                        placeholder="Pick spice, pouch, seal, or label"
                                        className="w-full"
                                    />
                                    {helperText && (
                                        <p className="text-xs text-muted-foreground">
                                            {helperText}
                                        </p>
                                    )}
                                </Field>
                                <Field className="min-w-0 sm:col-span-4">
                                    <FieldLabel htmlFor={`${id}-quantity-${index}`}>
                                        Amount for 1 {unitName}
                                    </FieldLabel>
                                    <NumericInput
                                        id={`${id}-quantity-${index}`}
                                        maxWholeDigits={8}
                                        maxDecimalPlaces={6}
                                        required
                                        placeholder="e.g. 100 or 1"
                                        value={row.quantity}
                                        disabled={isSaving}
                                        onValueChange={(next) => change(index, { quantity: next })}
                                    />
                                </Field>
                                <Field className="min-w-0 sm:col-span-3">
                                    <FieldLabel htmlFor={`${id}-unit-${index}`}>Unit</FieldLabel>
                                    <ComboboxSelect
                                        id={`${id}-unit-${index}`}
                                        items={units}
                                        value={row.uomId || null}
                                        disabled={isSaving || !material}
                                        onValueChange={(value) =>
                                            change(index, { uomId: value ?? 0 })
                                        }
                                        placeholder="Unit"
                                        className="w-full"
                                    />
                                </Field>
                            </div>

                            {calcOpen[index] && (
                                <div className="grid gap-3 rounded-md border bg-muted/30 p-3 sm:grid-cols-3 [&>*]:min-w-0">
                                    <Field className="min-w-0">
                                        <FieldLabel htmlFor={`${id}-batch-${index}`}>
                                            Total batch amount
                                            {selectedUnit ? ` (${selectedUnit.name})` : ""}
                                        </FieldLabel>
                                        <NumericInput
                                            id={`${id}-batch-${index}`}
                                            maxWholeDigits={10}
                                            maxDecimalPlaces={6}
                                            placeholder="e.g. 5"
                                            value={batch.batchAmount}
                                            onValueChange={(next) =>
                                                setCalcValues((prev) => ({
                                                    ...prev,
                                                    [index]: {
                                                        ...batch,
                                                        batchAmount: next,
                                                    },
                                                }))
                                            }
                                        />
                                    </Field>
                                    <Field className="min-w-0">
                                        <FieldLabel htmlFor={`${id}-packs-${index}`}>
                                            Makes how many {unitName}s?
                                        </FieldLabel>
                                        <NumericInput
                                            id={`${id}-packs-${index}`}
                                            maxWholeDigits={10}
                                            maxDecimalPlaces={4}
                                            placeholder="e.g. 50"
                                            value={batch.packCount}
                                            onValueChange={(next) =>
                                                setCalcValues((prev) => ({
                                                    ...prev,
                                                    [index]: {
                                                        ...batch,
                                                        packCount: next,
                                                    },
                                                }))
                                            }
                                        />
                                    </Field>
                                    <div className="flex flex-wrap items-end justify-between gap-2 sm:flex-col sm:items-start">
                                        <p className="text-xs text-muted-foreground">
                                            {perPackPreview
                                                ? `= ${perPackPreview} ${selectedUnit?.name ?? ""} per ${unitName}`
                                                : "Enter batch amount and pack yield"}
                                        </p>
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="secondary"
                                            disabled={!perPackPreview}
                                            onClick={() => {
                                                if (!perPackPreview) return
                                                change(index, { quantity: perPackPreview })
                                                setCalcOpen((prev) => ({ ...prev, [index]: false }))
                                            }}
                                        >
                                            Use {perPackPreview ?? "value"}
                                        </Button>
                                    </div>
                                </div>
                            )}

                            <div className="flex flex-wrap items-center gap-2">
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    disabled={isSaving}
                                    onClick={() =>
                                        setCalcOpen((prev) => ({
                                            ...prev,
                                            [index]: !prev[index],
                                        }))
                                    }
                                >
                                    <Calculator />
                                    {calcOpen[index] ? "Hide batch calc" : "From batch"}
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    disabled={isSaving || input.components.length === 1}
                                    onClick={() => {
                                        setInput({
                                            ...input,
                                            components: input.components.filter(
                                                (_, at) => at !== index,
                                            ),
                                        })
                                        setCalcOpen({})
                                    }}
                                >
                                    <Trash2 />
                                    Remove component {index + 1}
                                </Button>
                            </div>
                        </div>
                    )
                })}
            </div>

            <Button
                type="button"
                variant="outline"
                disabled={isSaving || input.components.length >= 100}
                onClick={() =>
                    setInput({
                        ...input,
                        components: [
                            ...input.components,
                            { componentItemId: 0, quantity: "", uomId: 0 },
                        ],
                    })
                }
            >
                <Plus />
                Add component
            </Button>

            {(validation || error) && (
                <p role="alert" className="text-sm text-destructive">
                    {validation ?? error}
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
                <Button
                    type="submit"
                    disabled={isSaving || Boolean(optionsError) || !input.itemId}
                >
                    {isSaving ? "Saving..." : formula ? "Save formula" : "Save packing formula"}
                </Button>
            </DialogFooter>
        </form>
    )
}

export function PackingFormulaForm(props: Props) {
    return (
        <Dialog
            open={props.open}
            onOpenChange={(value) => {
                if (!props.isSaving) props.onOpenChange(value)
            }}
        >
            <DialogContent
                className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-3xl"
                showCloseButton={!props.isSaving}
            >
                <DialogHeader>
                    <DialogTitle>
                        {props.formula ? "Edit packing formula" : "Set up packing formula"}
                    </DialogTitle>
                    <DialogDescription>
                        Choose the spice, packaging, and label needed per finished unit. Changes
                        apply to future packing orders immediately while keeping past orders
                        unchanged.
                    </DialogDescription>
                </DialogHeader>
                {props.optionsLoading && !props.options && (
                    <p role="status" className="text-sm text-muted-foreground">
                        Loading finished products and components...
                    </p>
                )}
                {props.optionsError && (
                    <div role="alert" className="space-y-3">
                        <p className="text-sm text-destructive">{props.optionsError}</p>
                        <Button variant="outline" onClick={props.retryOptions}>
                            Retry options
                        </Button>
                    </div>
                )}
                {props.open && props.options && (
                    <Content
                        key={`${props.formula?.itemId ?? props.initialProductId ?? "new"}`}
                        formula={props.formula}
                        initialProductId={props.initialProductId}
                        existingFormulas={props.existingFormulas}
                        options={props.options}
                        optionsError={props.optionsError}
                        isSaving={props.isSaving}
                        error={props.error}
                        onSave={props.onSave}
                        onOpenChange={props.onOpenChange}
                    />
                )}
            </DialogContent>
        </Dialog>
    )
}
