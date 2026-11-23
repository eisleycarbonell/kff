"use client"
import { useCallback, useRef } from "react"
import { Toast } from "@base-ui/react/toast"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiRequest, ApiError } from "@/lib/api-request"
import { createDialogStore } from "@/lib/create-dialog-store"
import { invalidateInventoryAvailability } from "@/lib/inventory-query-cache"
import { getLoadStatus } from "@/lib/load-status"
import { useSession, SESSION_QUERY_KEY } from "@/hooks/use-session"
import {
    formulaSchema,
    formulaOptionsSchema,
    type PackingFormula,
    type FormulaInput,
} from "@/components/modules/packing-formulas/packing-formula.schema"

const PATH = "/packing-formulas"
const EMPTY: PackingFormula[] = []
const useDialogs = createDialogStore<
    PackingFormula,
    PackingFormula,
    { initialProductId: number | null }
>({ initialProductId: null })

function parseFormula(data: unknown) {
    const result = formulaSchema.safeParse(data)
    if (!result.success) throw new Error("The API returned an invalid packing formula.")
    return result.data
}
export async function getFormulas(signal?: AbortSignal) {
    const result = formulaSchema.array().safeParse(await apiRequest(PATH, { signal }))
    if (!result.success) throw new Error("The API returned invalid packing formulas.")
    return result.data
}
export async function getFormulaOptions(signal?: AbortSignal) {
    const result = formulaOptionsSchema.safeParse(await apiRequest(`${PATH}/options`, { signal }))
    if (!result.success) throw new Error("The API returned invalid packing formula options.")
    return result.data
}
export async function createFormula(input: FormulaInput) {
    return parseFormula(await apiRequest(PATH, { method: "POST", body: JSON.stringify(input) }))
}
export async function updateFormula(itemId: number, input: Omit<FormulaInput, "itemId">) {
    return parseFormula(
        await apiRequest(`${PATH}/${itemId}`, { method: "PATCH", body: JSON.stringify(input) }),
    )
}
export async function removeFormula(itemId: number) {
    await apiRequest(`${PATH}/${itemId}`, { method: "DELETE" }, true)
}

export function usePackingFormulas() {
    const session = useSession()
    const dialogs = useDialogs()
    const client = useQueryClient()
    const { add: showToast } = Toast.useToastManager()
    const writePending = useRef(false)
    const userId = session.data?.userId
    const canManage = session.data?.permissions.canManagePacking === true
    const formulasKey = ["packing-formulas", userId] as const
    const optionsKey = ["packing-formula-options", userId] as const

    const query = useQuery({
        queryKey: formulasKey,
        queryFn: ({ signal }) => getFormulas(signal),
        enabled: Boolean(session.data),
    })
    const optionsQuery = useQuery({
        queryKey: optionsKey,
        queryFn: ({ signal }) => getFormulaOptions(signal),
        enabled: Boolean(session.data) && (dialogs.formRequested || dialogs.formOpen),
    })

    function invalidateRelated() {
        void invalidateInventoryAvailability(client)
        for (const key of [
            "packing-formulas",
            "packing-formula-options",
            "packing-options",
            "packing-preview",
            "sales-order-options",
            "sales-order-material-plan",
            "items",
            "item-packaging",
            "item-packaging-options",
            "uoms",
            "inventory-controls",
            "operational-reports",
            "dashboard",
        ])
            void client.invalidateQueries({ queryKey: [key] })
    }

    function mutationError(title: string) {
        return (error: Error) => {
            if (error instanceof ApiError && error.status === 403)
                void client.invalidateQueries({ queryKey: SESSION_QUERY_KEY })
            showToast({
                type: "error",
                title,
                description: error.message,
            })
        }
    }

    const save = useMutation({
        mutationFn: ({
            input,
            formula,
        }: {
            input: FormulaInput
            formula: PackingFormula | null
        }) => {
            if (!canManage) throw new Error("Your role does not allow managing packing formulas.")
            return formula
                ? updateFormula(formula.itemId, { components: input.components })
                : createFormula(input)
        },
        onSuccess: (saved, { formula }) => {
            client.setQueryData<PackingFormula[]>(formulasKey, (current = []) =>
                formula
                    ? current.map((row) => (row.itemId === saved.itemId ? saved : row))
                    : [saved, ...current.filter((row) => row.itemId !== saved.itemId)],
            )
            dialogs.patch({ initialProductId: null })
            invalidateRelated()
            showToast({
                type: "success",
                title: formula ? "Packing formula updated." : "Packing formula created.",
            })
        },
        onError: mutationError("Unable to save packing formula"),
    })

    const remove = useMutation({
        mutationFn: (formula: PackingFormula) => {
            if (!canManage) throw new Error("Your role does not allow managing packing formulas.")
            return removeFormula(formula.itemId)
        },
        onSuccess: (_, formula) => {
            client.setQueryData<PackingFormula[]>(formulasKey, (current = []) =>
                current.filter((row) => row.itemId !== formula.itemId),
            )
            dialogs.setTarget(null)
            invalidateRelated()
            showToast({
                type: "success",
                title: "Packing formula removed.",
            })
        },
        onError: mutationError("Unable to remove packing formula"),
    })

    const openAdd = useCallback(
        (productId?: number | null) => {
            if (!canManage) return
            save.reset()
            dialogs.patch({
                editing: null,
                initialProductId: productId ?? null,
                formOpen: true,
                formRequested: true,
            })
        },
        [canManage, dialogs, save],
    )

    const openEdit = useCallback(
        (formula: PackingFormula) => {
            if (!canManage) return
            save.reset()
            dialogs.patch({
                editing: formula,
                initialProductId: null,
                formOpen: true,
                formRequested: true,
            })
        },
        [canManage, dialogs, save],
    )

    const openRemove = useCallback(
        (formula: PackingFormula) => {
            if (!canManage) return
            remove.reset()
            dialogs.setTarget(formula)
        },
        [canManage, dialogs, remove],
    )

    const setFormOpen = useCallback(
        (open: boolean) => {
            dialogs.patch({
                formOpen: open,
                ...(open ? {} : { initialProductId: null }),
            })
        },
        [dialogs],
    )

    const loadStatus = getLoadStatus(session, [query])
    return {
        formulas: query.data ?? EMPTY,
        options: optionsQuery.data,
        optionsError: optionsQuery.error?.message,
        optionsLoading: optionsQuery.isLoading,
        canManage,
        error: query.error ?? session.error,
        loading: loadStatus === "loading",
        signedOut: loadStatus === "signed-out",
        formOpen: dialogs.formOpen,
        setFormOpen,
        formRequested: dialogs.formRequested,
        editingFormula: dialogs.editing,
        initialProductId: dialogs.initialProductId,
        removingFormula: dialogs.target,
        setRemovingFormula: (formula: PackingFormula | null) => dialogs.setTarget(formula),
        openAdd,
        openEdit,
        openRemove,
        isSaving: save.isPending,
        isRemoving: remove.isPending,
        busy: save.isPending || remove.isPending,
        saveError: save.error?.message,
        retry: () => {
            void session.refetch()
            if (session.data) void query.refetch()
        },
        retryOptions: () => {
            if (session.data) void optionsQuery.refetch()
        },
        handleSave: async (input: FormulaInput, formula: PackingFormula | null) => {
            if (writePending.current) return false
            writePending.current = true
            try {
                await save.mutateAsync({ input, formula })
                return true
            } catch {
                return false
            } finally {
                writePending.current = false
            }
        },
        handleRemove: async () => {
            const target = dialogs.target
            if (writePending.current || !target) return
            writePending.current = true
            try {
                await remove.mutateAsync(target)
            } catch {
                /* Keep dialog state for retry or cancel. */
            } finally {
                writePending.current = false
            }
        },
    }
}
