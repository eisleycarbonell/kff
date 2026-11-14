"use client"

import { useCallback, useRef } from "react"
import { z } from "zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Toast } from "@base-ui/react/toast"
import { createDialogStore } from "@/lib/create-dialog-store"
import { getLoadStatus } from "@/lib/load-status"
import { apiRequest, ApiError } from "@/lib/api-request"
import { useSession, SESSION_QUERY_KEY } from "@/hooks/use-session"
import {
    salesOrderSchema,
    salesOrderOptionsSchema,
    salesMaterialPlanSchema,
    type SalesMaterialPlan,
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
    if (!result.success)
        throw new Error("The sales order API returned an invalid record.")
    return result.data
}
export async function getSalesOrders(
    signal?: AbortSignal,
): Promise<SalesOrder[]> {
    return parse(salesOrderSchema.array(), await apiRequest(PATH, { signal }))
}
export async function getSalesOrder(
    id: number,
    signal?: AbortSignal,
): Promise<SalesOrder> {
    return parse(
        salesOrderSchema,
        await apiRequest(`${PATH}/${id}`, { signal }),
    )
}
export async function getSalesOrderOptions(
    signal?: AbortSignal,
): Promise<SalesOrderOptions> {
    return parse(
        salesOrderOptionsSchema,
        await apiRequest(`${PATH}/options`, { signal }),
    )
}
export async function createSalesOrder(
    input: CreateSalesOrderInput,
): Promise<SalesOrder> {
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
        await apiRequest(`${PATH}/${id}/confirm`, {
            method: "POST",
            body: "{}",
        }),
    )
}
export async function cancelSalesOrder(id: number): Promise<SalesOrder> {
    return parse(
        salesOrderSchema,
        await apiRequest(`${PATH}/${id}/cancel`, {
            method: "POST",
            body: "{}",
        }),
    )
}
export async function getSalesMaterialPlan(
    id: number,
    sourceLocationId: number,
    signal?: AbortSignal,
): Promise<SalesMaterialPlan> {
    return parse(
        salesMaterialPlanSchema,
        await apiRequest(
            PATH +
                "/" +
                id +
                "/material-plan?" +
                new URLSearchParams({
                    sourceLocationId: String(sourceLocationId),
                }),
            { signal },
        ),
    )
}
export const SALES_ORDERS_QUERY_KEY = ["sales-orders"] as const
const EMPTY_ORDERS: SalesOrder[] = []
const EMPTY_OPTIONS: SalesOrderOptions = {
    customers: [],
    items: [],
    sourceLocations: [],
}
type ActionTarget = { order: SalesOrder; action: "confirm" | "cancel" }
const useDialogs = createDialogStore<
    SalesOrder,
    ActionTarget,
    { materialPlanOrderId: number | null; planSourceLocationId: number | null }
>({ materialPlanOrderId: null, planSourceLocationId: null })
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
    const {
        formOpen,
        formRequested,
        editing: editingOrder,
        detailId: viewingOrderId,
        target: actionSelection,
        openForm,
        setFormOpen,
        setDetailId: setViewingOrderId,
        setTarget: setActionSelection,
        materialPlanOrderId,
        planSourceLocationId,
        patch,
    } = useDialogs()
    const writePending = useRef(false)
    const optionsQuery = useQuery({
        queryKey: ["sales-order-options", session.data?.userId],
        enabled:
            Boolean(session.data) &&
            ((canManage && formOpen) || materialPlanOrderId !== null),
        queryFn: ({ signal }) => getSalesOrderOptions(signal),
    })
    const materialPlanQuery = useQuery({
        queryKey: [
            "sales-order-material-plan",
            materialPlanOrderId,
            planSourceLocationId,
            session.data?.userId,
        ],
        enabled:
            Boolean(session.data) &&
            materialPlanOrderId !== null &&
            planSourceLocationId !== null,
        queryFn: ({ signal }) =>
            getSalesMaterialPlan(
                materialPlanOrderId!,
                planSourceLocationId!,
                signal,
            ),
        staleTime: 0,
    })
    const openMaterialPlan = useCallback(
        (order: SalesOrder) =>
            patch({
                materialPlanOrderId: order.salesOrderId,
                planSourceLocationId: null,
            }),
        [patch],
    )
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
            ["sales-order-material-plan"],
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
            if (!canManage)
                throw new Error("Your role cannot manage sales orders.")
            const input = toSalesOrderInput(values)
            return order
                ? updateSalesOrder(order.salesOrderId, input)
                : createSalesOrder(input)
        },
        onSuccess: (saved) => {
            sync(saved)
            showToast({ type: "success", title: "Sales order saved." })
        },
        onError: (error) => reportError(error, "Unable to save sales order"),
    })
    const action = useMutation({
        mutationFn: ({
            order,
            action,
        }: {
            order: SalesOrder
            action: "confirm" | "cancel"
        }) => {
            if (!canManage)
                throw new Error("Your role cannot manage sales orders.")
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
    const {
        reset: resetSave,
        mutateAsync: saveOrder,
        isPending: isSaving,
    } = save
    const {
        reset: resetAction,
        mutateAsync: runAction,
        isPending: isActionPending,
    } = action
    const openAdd = useCallback(() => {
        if (!canManage || writePending.current) return
        resetSave()
        openForm()
    }, [canManage, resetSave, openForm])
    const openEdit = useCallback(
        (order: SalesOrder) => {
            if (!canManage || writePending.current) return
            resetSave()
            openForm(order)
        },
        [canManage, resetSave, openForm],
    )
    const openView = useCallback(
        (order: SalesOrder) => setViewingOrderId(order.salesOrderId),
        [setViewingOrderId],
    )
    const openAction = useCallback(
        (order: SalesOrder, action: "confirm" | "cancel") => {
            if (!canManage || writePending.current) return
            resetAction()
            setActionSelection({ order, action })
        },
        [canManage, resetAction, setActionSelection],
    )
    const handleSave = useCallback(
        async (values: SalesOrderFormValues, order: SalesOrder | null) => {
            if (writePending.current) return false
            writePending.current = true
            try {
                await saveOrder({ values, order })
                return true
            } catch {
                return false
            } finally {
                writePending.current = false
            }
        },
        [saveOrder],
    )
    const loadError = ordersQuery.error ?? session.error
    const loadStatus = getLoadStatus(session, [ordersQuery])
    return {
        materialPlanOrderId,
        planSourceLocationId,
        openMaterialPlan,
        closeMaterialPlan: () =>
            patch({ materialPlanOrderId: null, planSourceLocationId: null }),
        setPlanSourceLocationId: (id: number | null) =>
            patch({ planSourceLocationId: id }),
        materialPlan: materialPlanQuery.data,
        materialPlanError: materialPlanQuery.error,
        materialPlanLoading: materialPlanQuery.isFetching,
        retryMaterialPlan: () => void materialPlanQuery.refetch(),
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
        handleAction: async () => {
            if (writePending.current || !actionSelection) return
            writePending.current = true
            try {
                await runAction(actionSelection)
            } catch {
                /* Keep failed workflow confirmation open. */
            } finally {
                writePending.current = false
            }
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
