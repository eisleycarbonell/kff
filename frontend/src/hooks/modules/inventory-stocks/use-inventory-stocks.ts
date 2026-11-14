"use client"
import { invalidateInventoryAvailability } from "@/lib/inventory-query-cache"
import { createDialogStore } from "@/lib/create-dialog-store"
import { getLoadStatus } from "@/lib/load-status"

import { useCallback, useEffect, useRef } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Toast } from "@base-ui/react/toast"
import { apiRequest, ApiError } from "@/lib/api-request"
import { useSession, SESSION_QUERY_KEY } from "@/hooks/use-session"
import {
    stockSchema,
    stockOptionsSchema,
    adjustmentResultSchema,
    toStockAdjustment,
    type Stock,
    type StockAdjustmentInput,
    type AdjustmentFormValues,
} from "@/components/modules/inventory-stocks/inventory-stock.schema"

export async function getInventoryStocks(
    signal?: AbortSignal,
): Promise<Stock[]> {
    const result = stockSchema
        .array()
        .safeParse(await apiRequest("/inventory/stocks", { signal }))
    if (!result.success)
        throw new Error("The stock API returned invalid inventory balances.")
    return result.data
}
export async function getStockOptions(signal?: AbortSignal) {
    const result = stockOptionsSchema.safeParse(
        await apiRequest("/inventory/stocks/options", { signal }),
    )
    if (!result.success)
        throw new Error("The stock API returned invalid adjustment options.")
    return result.data
}
export async function recordStockAdjustment(input: StockAdjustmentInput) {
    const result = adjustmentResultSchema.safeParse(
        await apiRequest("/inventory/stocks/adjustments", {
            method: "POST",
            body: JSON.stringify(input),
        }),
    )
    if (!result.success)
        throw new Error("The stock API returned an invalid adjustment result.")
    return result.data
}
export const STOCKS_QUERY_KEY = ["inventory-stocks"] as const
const EMPTY_STOCKS: Stock[] = []
const useModuleDialogs = createDialogStore<Stock>()
export function useInventoryStocks() {
    const session = useSession()
    const client = useQueryClient()
    const { add: showToast } = Toast.useToastManager()
    const canManage = session.data?.permissions.canManageInventory === true
    const { formOpen, formRequested, editing: selectedStock, openForm, setFormOpen, } = useModuleDialogs()
    const writePending = useRef(false)
    const queryKey = [...STOCKS_QUERY_KEY, session.data?.userId]
    const stocksQuery = useQuery({
        queryKey,
        queryFn: ({ signal }) => getInventoryStocks(signal),
        enabled: Boolean(session.data),
    })
    const optionsQuery = useQuery({
        queryKey: ["inventory-stock-options", session.data?.userId],
        queryFn: ({ signal }) => getStockOptions(signal),
        enabled: canManage && formRequested,
        staleTime: 60_000,
    })
    const loadError = stocksQuery.error ?? session.error
    useEffect(() => {
        if (
            (loadError instanceof ApiError && loadError.status === 403) ||
            (optionsQuery.error instanceof ApiError &&
                optionsQuery.error.status === 403)
        )
            void client.invalidateQueries({ queryKey: SESSION_QUERY_KEY })
    }, [loadError, optionsQuery.error, client])
    const save = useMutation({
        mutationFn: (values: AdjustmentFormValues) => {
            if (!canManage)
                throw new Error("Your role does not allow stock adjustments.")
            return recordStockAdjustment(toStockAdjustment(values))
        },
        onSuccess: ({ stock }) => {
            void invalidateInventoryAvailability(client)
            client.setQueryData<Stock[]>(queryKey, (current) => {
                if (!current) return current
                return current.some((row) => row.stockId === stock.stockId)
                    ? current.map((row) =>
                          row.stockId === stock.stockId ? stock : row,
                      )
                    : [...current, stock]
            })
            void client.invalidateQueries({ queryKey: STOCKS_QUERY_KEY })
            void client.invalidateQueries({ queryKey: ["inventory-movements"] })
            void client.invalidateQueries({ queryKey: ["inventory-reports"] })
            void client.invalidateQueries({ queryKey: ["dashboard"] })
            void client.invalidateQueries({ queryKey: ["lots"] })
            void client.invalidateQueries({ queryKey: ["lot-detail"] })
            void client.invalidateQueries({ queryKey: ["operational-reports"] })
            showToast({ type: "success", title: "Stock adjustment recorded." })
        },
        onError: (error) => {
            if (error instanceof ApiError && error.status === 403)
                void client.invalidateQueries({ queryKey: SESSION_QUERY_KEY })
            if (error instanceof ApiError && error.status === 409) {
                void client.invalidateQueries({ queryKey: STOCKS_QUERY_KEY })
                void client.invalidateQueries({
                    queryKey: ["inventory-stock-options"],
                })
            }
            showToast({
                type: "error",
                title: "Unable to adjust stock",
                description: error.message,
            })
        },
    })
    const { reset } = save
    const openAdjustment = useCallback(
        (stock: Stock | null = null) => {
            reset()
            openForm(stock)
        },
        [reset, openForm],
    )
    const openRecord = useCallback(() => openAdjustment(null), [openAdjustment])
    const loadStatus = getLoadStatus(session, [stocksQuery])
    const options = optionsQuery.data
    return {
        stocks: stocksQuery.data ?? EMPTY_STOCKS,
        options,
        optionsError: optionsQuery.error,
        isLoadingOptions: formRequested && optionsQuery.isPending,
        retryOptions: () => void optionsQuery.refetch(),
        canManage,
        canAdjust: canManage && loadStatus === "ready",
        loadStatus,
        loadError,
        formOpen,
        setFormOpen,
        formRequested,
        selectedStock,
        openAdjustment,
        openRecord,
        isSaving: save.isPending,
        saveError: save.error,
        isFetching: session.isFetching || stocksQuery.isFetching,
        retry: () => {
            void session.refetch()
            if (session.data) void stocksQuery.refetch()
            if (formRequested && canManage) void optionsQuery.refetch()
        },
        handleSave: async (values: AdjustmentFormValues) => {
            if (writePending.current) return false
            writePending.current = true
            try {
                await save.mutateAsync(values)
                return true
            } catch {
                return false
            } finally {
                writePending.current = false
            }
        },
    }
}
