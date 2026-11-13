"use client"
import { useQuery } from "@tanstack/react-query"
import { apiRequest } from "@/lib/api-request"
import { getLoadStatus } from "@/lib/load-status"
import { useSession } from "@/hooks/use-session"
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
    const query = useQuery({
        queryKey: ["packing-formulas", session.data?.userId],
        queryFn: ({ signal }) => getFormulas(signal),
        enabled: Boolean(session.data),
    })
    const loadStatus = getLoadStatus(session, [query])
    return {
        formulas: query.data ?? EMPTY,
        error: query.error ?? session.error,
        loading: loadStatus === "loading",
        signedOut: loadStatus === "signed-out",
        retry: () => {
            void session.refetch()
            if (session.data) void query.refetch()
        },
    }
}
