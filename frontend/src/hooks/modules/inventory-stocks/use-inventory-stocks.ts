"use client"

import { useCallback, useEffect, useState } from "react"
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

export async function getInventoryStocks(signal?: AbortSignal): Promise<Stock[]> {
    const result = stockSchema.array().safeParse(await apiRequest("/inventory/stocks", { signal }))
    if (!result.success) throw new Error("The stock API returned invalid inventory balances.")
    return result.data
}
export async function getStockOptions(signal?: AbortSignal) {
    const result = stockOptionsSchema.safeParse(
        await apiRequest("/inventory/stocks/options", { signal }),
    )
    if (!result.success) throw new Error("The stock API returned invalid adjustment options.")
    return result.data
}
export async function recordStockAdjustment(input: StockAdjustmentInput) {
    const result = adjustmentResultSchema.safeParse(
        await apiRequest("/inventory/stocks/adjustments", {
            method: "POST",
            body: JSON.stringify(input),
        }),
    )
    if (!result.success) throw new Error("The stock API returned an invalid adjustment result.")
    return result.data
}
export const STOCKS_QUERY_KEY = ["inventory-stocks"] as const
const EMPTY_STOCKS: Stock[] = []
export function useInventoryStocks() {
    const session = useSession()
    const client = useQueryClient()
    const { add: showToast } = Toast.useToastManager()
    const canManage = session.data?.permissions.canManageInventory === true
    const queryKey = [...STOCKS_QUERY_KEY, session.data?.userId]
    const stocksQuery = useQuery({
        queryKey,
        queryFn: ({ signal }) => getInventoryStocks(signal),
        enabled: Boolean(session.data),
    })
    const optionsQuery = useQuery({
        queryKey: ["inventory-stock-options", session.data?.userId],
        queryFn: ({ signal }) => getStockOptions(signal),
        enabled: canManage,
    })
    const loadError = stocksQuery.error ?? optionsQuery.error ?? session.error
    useEffect(() => {
        if (loadError instanceof ApiError && loadError.status === 401)
            client.setQueryData(SESSION_QUERY_KEY, null)
        if (loadError instanceof ApiError && loadError.status === 403)
            void client.invalidateQueries({ queryKey: SESSION_QUERY_KEY })
    }, [loadError, client])
    const [formOpen, setFormOpen] = useState(false)
    const [formRequested, setFormRequested] = useState(false)
    const [selectedStock, setSelectedStock] = useState<Stock | null>(null)
    const save = useMutation({
        mutationFn: (values: AdjustmentFormValues) => {
            if (!canManage) throw new Error("Your role does not allow stock adjustments.")
            return recordStockAdjustment(toStockAdjustment(values))
        },
        onSuccess: ({ stock }) => {
            client.setQueryData<Stock[]>(queryKey, (current = []) =>
                current.some((row) => row.stockId === stock.stockId)
                    ? current.map((row) => (row.stockId === stock.stockId ? stock : row))
                    : [...current, stock],
            )
            void client.invalidateQueries({ queryKey: STOCKS_QUERY_KEY })
            showToast({ type: "success", title: "Stock adjustment recorded." })
        },
        onError: (error) => {
            if (error instanceof ApiError && error.status === 401)
                client.setQueryData(SESSION_QUERY_KEY, null)
            if (error instanceof ApiError && error.status === 403)
                void client.invalidateQueries({ queryKey: SESSION_QUERY_KEY })
            if (error instanceof ApiError && error.status === 409) {
                void client.invalidateQueries({ queryKey: STOCKS_QUERY_KEY })
                void client.invalidateQueries({ queryKey: ["inventory-stock-options"] })
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
            setSelectedStock(stock)
            setFormRequested(true)
            setFormOpen(true)
        },
        [reset],
    )
    const loadStatus = session.isPending
        ? "loading"
        : session.data === undefined
          ? "error"
          : !session.data
            ? "signed-out"
            : stocksQuery.data !== undefined
              ? "ready"
              : stocksQuery.isError
                ? "error"
                : "loading"
    const options = optionsQuery.data
    return {
        stocks: stocksQuery.data ?? EMPTY_STOCKS,
        options,
        canManage,
        canAdjust:
            canManage &&
            Boolean(
                options?.lots.length &&
                options.locations.some((location) => location.isActive) &&
                options.reasons.length,
            ),
        loadStatus,
        loadError,
        formOpen,
        setFormOpen,
        formRequested,
        selectedStock,
        openAdjustment,
        isSaving: save.isPending,
        saveError: save.error,
        isFetching: session.isFetching || stocksQuery.isFetching || optionsQuery.isFetching,
        retry: () => {
            void session.refetch()
            if (session.data) void stocksQuery.refetch()
            if (canManage) void optionsQuery.refetch()
        },
        handleSave: async (values: AdjustmentFormValues) => {
            if (save.isPending) return false
            try {
                await save.mutateAsync(values)
                return true
            } catch {
                return false
            }
        },
    }
}
