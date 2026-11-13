"use client"
import { useId, useState, type FormEvent } from "react"
import { Plus, Trash2 } from "lucide-react"
import {
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
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from "@/components/ui/select"
type Props = {
    open: boolean
    onOpenChange: (open: boolean) => void
    formula: PackingFormula | null
    options?: FormulaOptions
    optionsError?: string
    optionsLoading: boolean
    retryOptions: () => void
    isSaving: boolean
    error?: string
    onSave: (input: FormulaInput, formula: PackingFormula | null) => Promise<boolean>
}
function Content({
    formula,
    options,
    optionsError,
    optionsLoading,
    retryOptions,
    isSaving,
    error,
    onSave,
    onOpenChange,
}: Props) {
    const id = useId()
    const [input, setInput] = useState<FormulaInput>({
        itemId: formula?.itemId ?? 0,
        components: formula?.components.map(({ componentItemId, quantity, uomId }) => ({
            componentItemId,
            quantity,
            uomId,
        })) ?? [{ componentItemId: 0, quantity: "", uomId: 0 }],
    })
    const [validation, setValidation] = useState<string>()
    const products = (options?.products ?? [])
        .filter((row) => !row.hasFormula || row.itemId === formula?.itemId)
        .map((row) => ({ value: row.itemId, label: `${row.sku} · ${row.name}` }))
    if (formula && !products.some((row) => row.value === formula.itemId))
        products.push({ value: formula.itemId, label: `${formula.itemSku} · ${formula.itemName}` })
    const unitName =
        options?.products.find((row) => row.itemId === input.itemId)?.primaryUomName ??
        formula?.primaryUomName
    function change(index: number, values: Partial<FormulaInput["components"][number]>) {
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
        if (isSaving || !options) return
        const message = validateFormula(input, options)
        setValidation(message)
        if (!message && (await onSave(input, formula))) onOpenChange(false)
    }
    return (
        <DialogContent
            className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-3xl"
            showCloseButton={!isSaving}
        >
            <DialogHeader>
                <DialogTitle>
                    {formula ? "Edit packing formula" : "Create packing formula"}
                </DialogTitle>
                <DialogDescription>
                    Define the materials needed for one finished unit. Existing packing orders keep
                    their saved requirements.
                </DialogDescription>
            </DialogHeader>
            {optionsLoading && !options && <p role="status">Loading products and materials...</p>}
            {optionsError && (
                <div role="alert">
                    <p className="text-destructive">{optionsError}</p>
                    <Button variant="outline" onClick={retryOptions}>
                        Retry options
                    </Button>
                </div>
            )}
            {options && (
                <form onSubmit={submit} className="space-y-5" aria-busy={isSaving}>
                    <Field>
                        <FieldLabel htmlFor={`${id}-product`}>Finished product</FieldLabel>
                        <Select
                            items={products}
                            value={input.itemId || null}
                            disabled={isSaving || Boolean(formula)}
                            onValueChange={(value) => {
                                setInput({ ...input, itemId: value ?? 0 })
                                setValidation(undefined)
                            }}
                        >
                            <SelectTrigger id={`${id}-product`} className="w-full">
                                <SelectValue placeholder="Select finished product" />
                            </SelectTrigger>
                            <SelectContent>
                                {products.map((row) => (
                                    <SelectItem key={row.value} value={row.value}>
                                        {row.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </Field>
                    <p className="text-sm text-muted-foreground">
                        Quantities below are per 1 {unitName ?? "finished unit"}. Use each
                        material&apos;s compatible unit, with up to six decimal places.
                    </p>
                    {!products.length && (
                        <p className="text-sm">
                            Create an active finished product without a formula in Items / Products
                            first.
                        </p>
                    )}
                    {input.components.map((row, index) => {
                        const material = options.components.find(
                            (entry) => entry.itemId === row.componentItemId,
                        )
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
                        return (
                            <div
                                key={index}
                                className="grid gap-3 rounded-lg border p-4 sm:grid-cols-6"
                            >
                                <Field className="sm:col-span-3">
                                    <FieldLabel htmlFor={`${id}-material-${index}`}>
                                        Material {index + 1}
                                    </FieldLabel>
                                    <Select
                                        items={choices}
                                        value={row.componentItemId || null}
                                        disabled={isSaving}
                                        onValueChange={(value) =>
                                            change(index, {
                                                componentItemId: value ?? 0,
                                                uomId:
                                                    options.components.find(
                                                        (entry) => entry.itemId === value,
                                                    )?.primaryUomId ?? 0,
                                            })
                                        }
                                    >
                                        <SelectTrigger
                                            id={`${id}-material-${index}`}
                                            className="w-full"
                                        >
                                            <SelectValue placeholder="Select material" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {choices.map((choice) => (
                                                <SelectItem key={choice.value} value={choice.value}>
                                                    {choice.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </Field>
                                <Field className="sm:col-span-2">
                                    <FieldLabel htmlFor={`${id}-quantity-${index}`}>
                                        Quantity per finished unit
                                    </FieldLabel>
                                    <Input
                                        id={`${id}-quantity-${index}`}
                                        inputMode="decimal"
                                        required
                                        value={row.quantity}
                                        disabled={isSaving}
                                        onChange={(e) =>
                                            change(index, { quantity: e.target.value })
                                        }
                                    />
                                </Field>
                                <Field>
                                    <FieldLabel htmlFor={`${id}-unit-${index}`}>Unit</FieldLabel>
                                    <Select
                                        items={units}
                                        value={row.uomId || null}
                                        disabled={isSaving || !material}
                                        onValueChange={(value) =>
                                            change(index, { uomId: value ?? 0 })
                                        }
                                    >
                                        <SelectTrigger
                                            id={`${id}-unit-${index}`}
                                            className="w-full"
                                        >
                                            <SelectValue placeholder="Unit" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {units.map((unit) => (
                                                <SelectItem key={unit.value} value={unit.value}>
                                                    {unit.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </Field>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    className="justify-self-start"
                                    disabled={isSaving || input.components.length === 1}
                                    onClick={() =>
                                        setInput({
                                            ...input,
                                            components: input.components.filter(
                                                (_, at) => at !== index,
                                            ),
                                        })
                                    }
                                >
                                    <Trash2 />
                                    Remove material {index + 1}
                                </Button>
                            </div>
                        )
                    })}
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
                        Add material
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
                            {isSaving ? "Saving..." : formula ? "Save formula" : "Create formula"}
                        </Button>
                    </DialogFooter>
                </form>
            )}
        </DialogContent>
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
            {props.open && <Content key={props.formula?.itemId ?? "new"} {...props} />}
        </Dialog>
    )
}
