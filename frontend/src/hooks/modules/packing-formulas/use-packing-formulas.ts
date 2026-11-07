"use client"
import { useCallback, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Toast } from "@base-ui/react/toast"
import { apiRequest, ApiError } from "@/lib/api-request"
import { useSession, SESSION_QUERY_KEY } from "@/hooks/use-session"
import {
    formulaSchema,
    formulaOptionsSchema,
    type PackingFormula,
    type FormulaInput,
} from "@/components/modules/packing-formulas/packing-formula.schema"

const PATH = "/packing-formulas"
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
const EMPTY: PackingFormula[] = []
export function usePackingFormulas() {
    const session = useSession()
    const client = useQueryClient()
    const { add: toast } = Toast.useToastManager()
    const canManage = session.data?.permissions.canManagePacking === true
    const query = useQuery({
        queryKey: ["packing-formulas", session.data?.userId],
        queryFn: ({ signal }) => getFormulas(signal),
        enabled: Boolean(session.data),
    })
    const options = useQuery({
        queryKey: ["packing-formula-options", session.data?.userId],
        queryFn: ({ signal }) => getFormulaOptions(signal),
        enabled: Boolean(session.data),
    })
    const [editing, setEditing] = useState<PackingFormula | null>(null)
    const [formRequested, setFormRequested] = useState(false)
    const [formOpen, setFormOpen] = useState(false)
    const [removing, setRemoving] = useState<PackingFormula | null>(null)
    const pending = useRef(false)
    function refresh() {
        for (const key of [
            "packing-formulas",
            "packing-formula-options",
            "packing-options",
            "packing-preview",
            "items",
            "uoms",
        ])
            void client.invalidateQueries({ queryKey: [key] })
    }
    function failure(error: Error) {
        if (error instanceof ApiError && error.status === 403)
            void client.invalidateQueries({ queryKey: SESSION_QUERY_KEY })
        toast({
            type: "error",
            title: "Unable to update packing formulas",
            description: error.message,
        })
    }
    const save = useMutation({
        mutationFn: async ({
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
        onSuccess: () => {
            refresh()
            toast({ type: "success", title: "Packing formula saved." })
        },
        onError: failure,
    })
    const remove = useMutation({
        mutationFn: async (formula: PackingFormula) => {
            if (!canManage) throw new Error("Your role does not allow managing packing formulas.")
            await removeFormula(formula.itemId)
        },
        onSuccess: () => {
            refresh()
            setRemoving(null)
            toast({ type: "success", title: "Packing formula removed." })
        },
        onError: failure,
    })
    const { reset, mutateAsync } = save
    const openAdd = useCallback(() => {
        if (!canManage || pending.current) return
        reset()
        setEditing(null)
        setFormRequested(true)
        setFormOpen(true)
    }, [canManage, reset])
    const openEdit = useCallback(
        (row: PackingFormula) => {
            if (!canManage || pending.current) return
            reset()
            setEditing(row)
            setFormRequested(true)
            setFormOpen(true)
        },
        [canManage, reset],
    )
    const handleSave = useCallback(
        async (input: FormulaInput, formula: PackingFormula | null) => {
            if (pending.current) return false
            pending.current = true
            try {
                await mutateAsync({ input, formula })
                return true
            } catch {
                return false
            } finally {
                pending.current = false
            }
        },
        [mutateAsync],
    )
    async function handleRemove() {
        if (!removing || pending.current) return
        pending.current = true
        try {
            await remove.mutateAsync(removing)
        } catch {
            /* Keep confirmation open for retry. */
        } finally {
            pending.current = false
        }
    }
    return {
        formulas: query.data ?? EMPTY,
        canManage,
        editing,
        formRequested,
        formOpen,
        setFormOpen,
        removing,
        setRemoving,
        openAdd,
        openEdit,
        handleSave,
        handleRemove,
        options: options.data,
        optionsError: options.error?.message,
        optionsLoading: options.isPending,
        retryOptions: () => void options.refetch(),
        error: query.error ?? session.error,
        loading: session.isPending || (Boolean(session.data) && query.isPending),
        signedOut: session.data === null,
        retry: () => {
            void session.refetch()
            if (session.data) void query.refetch()
        },
        isSaving: save.isPending,
        isRemoving: remove.isPending,
        saveError: save.error?.message,
        removeError: remove.error?.message,
    }
}
