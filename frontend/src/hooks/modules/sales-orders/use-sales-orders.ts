"use client"

import { useCallback, useState } from "react"
import { z } from "zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Toast } from "@base-ui/react/toast"
import { apiRequest, ApiError } from "@/lib/api-request"
import { useSession, SESSION_QUERY_KEY } from "@/hooks/use-session"
import {
    salesOrderSchema,
    salesOrderOptionsSchema,
    toSalesOrderInput,
    type SalesOrder,
    type SalesOrderOptions,
    type CreateSalesOrderInput,
    type UpdateSalesOrderInput,
    type SalesOrderFormValues,
} from "@/components/modules/sales-orders/sales-order.schema"

const PATH = "/sales-orders"
function parse<T>(schema: z.ZodType<T>, data: unknown): T {
    const result = schema.safeParse(data)
    if (!result.success) throw new Error("The sales order API returned an invalid record.")
    return result.data
}
export async function getSalesOrders(signal?: AbortSignal): Promise<SalesOrder[]> {
    return parse(salesOrderSchema.array(), await apiRequest(PATH, { signal }))
}
export async function getSalesOrder(id: number, signal?: AbortSignal): Promise<SalesOrder> {
    return parse(salesOrderSchema, await apiRequest(`${PATH}/${id}`, { signal }))
}
export async function getSalesOrderOptions(signal?: AbortSignal): Promise<SalesOrderOptions> {
    return parse(salesOrderOptionsSchema, await apiRequest(`${PATH}/options`, { signal }))
}
export async function createSalesOrder(input: CreateSalesOrderInput): Promise<SalesOrder> {
    return parse(
        salesOrderSchema,
        await apiRequest(PATH, { method: "POST", body: JSON.stringify(input) }),
    )
}
export async function updateSalesOrder(
    id: number,
    input: UpdateSalesOrderInput,
): Promise<SalesOrder> {
    return parse(
        salesOrderSchema,
        await apiRequest(`${PATH}/${id}`, {
            method: "PATCH",
            body: JSON.stringify(input),
        }),
    )
}
export async function confirmSalesOrder(id: number): Promise<SalesOrder> {
    return parse(
        salesOrderSchema,
        await apiRequest(`${PATH}/${id}/confirm`, { method: "POST", body: "{}" }),
    )
}
export async function cancelSalesOrder(id: number): Promise<SalesOrder> {
    return parse(
        salesOrderSchema,
        await apiRequest(`${PATH}/${id}/cancel`, { method: "POST", body: "{}" }),
    )
}
export const SALES_ORDERS_QUERY_KEY = ["sales-orders"] as const
const EMPTY_ORDERS: SalesOrder[] = []
const EMPTY_OPTIONS: SalesOrderOptions = { customers: [], items: [] }
export function useSalesOrders() {
    const client = useQueryClient()
    const session = useSession()
    const canManage = session.data?.permissions.canManageInventory === true
    const { add: showToast } = Toast.useToastManager()
    const queryKey = [...SALES_ORDERS_QUERY_KEY, session.data?.userId]
    const ordersQuery = useQuery({
        queryKey,
        enabled: Boolean(session.data),
        queryFn: ({ signal }) => getSalesOrders(signal),
    })
    const optionsQuery = useQuery({
        queryKey: ["sales-order-options", session.data?.userId],
        enabled: Boolean(session.data) && canManage,
        queryFn: ({ signal }) => getSalesOrderOptions(signal),
    })
    const [formOpen, setFormOpen] = useState(false)
    const [formRequested, setFormRequested] = useState(false)
    const [editingOrder, setEditingOrder] = useState<SalesOrder | null>(null)
    const [viewingOrderId, setViewingOrderId] = useState<number | null>(null)
    const [actionSelection, setActionSelection] = useState<{
        order: SalesOrder
        action: "confirm" | "cancel"
    } | null>(null)
    const sync = (saved: SalesOrder) => {
        client.setQueryData<SalesOrder[]>(queryKey, (current = []) =>
            current.some((order) => order.salesOrderId === saved.salesOrderId)
                ? current.map((order) =>
                      order.salesOrderId === saved.salesOrderId ? saved : order,
                  )
                : [saved, ...current],
        )
        for (const key of [
            SALES_ORDERS_QUERY_KEY,
            ["delivery-orders"],
            ["delivery-order-options"],
            ["dashboard"],
        ])
            void client.invalidateQueries({ queryKey: key })
    }
    const reportError = (error: Error, title: string) => {
        if (error instanceof ApiError && error.status === 403)
            void client.invalidateQueries({ queryKey: SESSION_QUERY_KEY })
        showToast({ type: "error", title, description: error.message })
    }
    const save = useMutation({
        mutationFn: ({
            values,
            order,
        }: {
            values: SalesOrderFormValues
            order: SalesOrder | null
        }) => {
            if (!canManage) throw new Error("Your role cannot manage sales orders.")
            const input = toSalesOrderInput(values)
            return order ? updateSalesOrder(order.salesOrderId, input) : createSalesOrder(input)
        },
        onSuccess: (saved) => {
            sync(saved)
            showToast({ type: "success", title: "Sales order saved." })
        },
        onError: (error) => reportError(error, "Unable to save sales order"),
    })
    const action = useMutation({
        mutationFn: ({ order, action }: { order: SalesOrder; action: "confirm" | "cancel" }) => {
            if (!canManage) throw new Error("Your role cannot manage sales orders.")
            return action === "confirm"
                ? confirmSalesOrder(order.salesOrderId)
                : cancelSalesOrder(order.salesOrderId)
        },
        onSuccess: (saved) => {
            sync(saved)
            setActionSelection(null)
            showToast({
                type: "success",
                title: `Sales order ${saved.status.toLowerCase()}.`,
            })
        },
        onError: (error) => reportError(error, "Unable to change sales order"),
    })
    const { reset: resetSave, mutateAsync: saveOrder, isPending: isSaving } = save
    const { reset: resetAction, mutate: runAction, isPending: isActionPending } = action
    const openAdd = useCallback(() => {
        resetSave()
        setEditingOrder(null)
        setFormRequested(true)
        setFormOpen(true)
    }, [resetSave])
    const openEdit = useCallback(
        (order: SalesOrder) => {
            resetSave()
            setEditingOrder(order)
            setFormRequested(true)
            setFormOpen(true)
        },
        [resetSave],
    )
    const openView = useCallback((order: SalesOrder) => setViewingOrderId(order.salesOrderId), [])
    const openAction = useCallback(
        (order: SalesOrder, action: "confirm" | "cancel") => {
            resetAction()
            setActionSelection({ order, action })
        },
        [resetAction],
    )
    const handleSave = useCallback(
        async (values: SalesOrderFormValues, order: SalesOrder | null) => {
            if (isSaving) return false
            try {
                await saveOrder({ values, order })
                return true
            } catch {
                return false
            }
        },
        [isSaving, saveOrder],
    )
    const loadError = ordersQuery.error ?? session.error
    const loadStatus = session.isPending
        ? "loading"
        : session.data === undefined
          ? "error"
          : !session.data
            ? "signed-out"
            : ordersQuery.data !== undefined
              ? "ready"
              : ordersQuery.isError
                ? "error"
                : "loading"
    return {
        orders: ordersQuery.data ?? EMPTY_ORDERS,
        options: optionsQuery.data ?? EMPTY_OPTIONS,
        optionsReady: optionsQuery.data !== undefined,
        optionsError: optionsQuery.error,
        canManage,
        loadStatus,
        loadError,
        formOpen,
        formRequested,
        editingOrder,
        viewingOrderId,
        viewingOrder:
            (ordersQuery.data ?? EMPTY_ORDERS).find(
                (order) => order.salesOrderId === viewingOrderId,
            ) ?? null,
        actionSelection,
        setActionSelection,
        setViewingOrderId,
        setFormOpen,
        openAdd,
        openEdit,
        openView,
        openAction,
        handleSave,
        handleAction: () => {
            if (actionSelection && !isActionPending) runAction(actionSelection)
        },
        retry: () => {
            void session.refetch()
            void ordersQuery.refetch()
        },
        retryOptions: () => {
            void optionsQuery.refetch()
        },
        isFetching: ordersQuery.isFetching || session.isFetching,
        isSaving,
        saveError: save.error?.message ?? null,
        isActionPending,
        actionError: action.error?.message ?? null,
    }
}
