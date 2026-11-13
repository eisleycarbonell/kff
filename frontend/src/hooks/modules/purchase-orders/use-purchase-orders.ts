"use client"

import { useCallback } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Toast } from "@base-ui/react/toast"
import { apiRequest, ApiError } from "@/lib/api-request"
import { createDialogStore } from "@/lib/create-dialog-store"
import { getLoadStatus } from "@/lib/load-status"
import { SESSION_QUERY_KEY, useSession } from "@/hooks/use-session"
import {
    purchaseOrderSchema,
    purchaseOrderDetailSchema,
    purchaseOrderOptionsSchema,
    nextPurchaseOrderNumberSchema,
    toPurchaseOrderInput,
    toPurchaseOrderUpdateInput,
    canEditPurchaseOrder,
    canSendPurchaseOrder,
    canCancelPurchaseOrder,
    type PurchaseOrder,
    type PurchaseOrderDetail,
    type PurchaseOrderOptions,
    type CreatePurchaseOrderInput,
    type UpdatePurchaseOrderInput,
    type PurchaseOrderFormValues,
} from "@/components/modules/purchase-orders/purchase-order.schema"

function parseOrder(data: unknown): PurchaseOrderDetail {
    const result = purchaseOrderDetailSchema.safeParse(data)
    if (!result.success) throw new Error("The purchase order API returned an invalid order detail.")
    return result.data
}
export async function getPurchaseOrders(signal?: AbortSignal): Promise<PurchaseOrder[]> {
    const result = purchaseOrderSchema
        .array()
        .safeParse(await apiRequest("/purchase-orders", { signal }))
    if (!result.success) throw new Error("The purchase order API returned an invalid order list.")
    return result.data
}
export async function getPurchaseOrder(
    poId: number,
    signal?: AbortSignal,
): Promise<PurchaseOrderDetail> {
    return parseOrder(await apiRequest(`/purchase-orders/${poId}`, { signal }))
}
export async function getPurchaseOrderOptions(signal?: AbortSignal): Promise<PurchaseOrderOptions> {
    const result = purchaseOrderOptionsSchema.safeParse(
        await apiRequest("/purchase-orders/options", { signal }),
    )
    if (!result.success) throw new Error("The purchase order API returned invalid order options.")
    return result.data
}
export async function requestPurchaseOrderNumber(): Promise<{ poNumber: string }> {
    const result = nextPurchaseOrderNumberSchema.safeParse(
        await apiRequest("/purchase-orders/next-number", { method: "POST", body: "{}" }),
    )
    if (!result.success) throw new Error("The purchase order API returned an invalid PO number.")
    return result.data
}
export async function createPurchaseOrder(
    input: CreatePurchaseOrderInput,
): Promise<PurchaseOrderDetail> {
    return parseOrder(
        await apiRequest("/purchase-orders", { method: "POST", body: JSON.stringify(input) }),
    )
}
export async function updatePurchaseOrder(
    poId: number,
    input: UpdatePurchaseOrderInput,
): Promise<PurchaseOrderDetail> {
    return parseOrder(
        await apiRequest(`/purchase-orders/${poId}`, {
            method: "PATCH",
            body: JSON.stringify(input),
        }),
    )
}
export async function sendPurchaseOrder(poId: number): Promise<PurchaseOrderDetail> {
    return parseOrder(
        await apiRequest(`/purchase-orders/${poId}/send`, { method: "POST", body: "{}" }),
    )
}
export async function cancelPurchaseOrder(poId: number): Promise<PurchaseOrderDetail> {
    return parseOrder(
        await apiRequest(`/purchase-orders/${poId}/cancel`, { method: "POST", body: "{}" }),
    )
}

export const PURCHASE_ORDERS_QUERY_KEY = ["purchase-orders"] as const
export const PURCHASE_ORDER_DETAIL_QUERY_KEY = ["purchase-order-detail"] as const
export const PURCHASE_ORDER_OPTIONS_QUERY_KEY = ["purchase-order-options"] as const
const EMPTY_ORDERS: PurchaseOrder[] = []
const EMPTY_OPTIONS: PurchaseOrderOptions = {
    suppliers: [],
    items: [],
    uoms: [],
    supplierItems: [],
}
export type PurchaseOrderTransitionTarget = { order: PurchaseOrder; action: "send" | "cancel" }
/**
 * Form, send/cancel confirmation, and detail-dialog state for the purchase orders page.
 * `viewingOrder` stays set after closing so the detail dialog can finish its close animation.
 */
const usePurchaseOrderDialogs = createDialogStore<
    PurchaseOrder,
    PurchaseOrderTransitionTarget,
    { viewingOrder: PurchaseOrder | null; detailOpen: boolean; defaultPoNumber: string }
>({ viewingOrder: null, detailOpen: false, defaultPoNumber: "" })

export function usePurchaseOrderDetail(poId: number | null) {
    const session = useSession()
    const query = useQuery({
        queryKey: [...PURCHASE_ORDER_DETAIL_QUERY_KEY, poId, session.data?.userId],
        queryFn: ({ signal }) => getPurchaseOrder(poId!, signal),
        enabled: Boolean(session.data) && poId !== null,
        staleTime: 0,
    })
    const loadError = query.error ?? session.error
    const { refetch } = query
    const { refetch: refetchSession } = session
    const signedIn = Boolean(session.data)
    const retry = useCallback(() => {
        void refetchSession()
        if (signedIn && poId !== null) void refetch()
    }, [poId, refetch, refetchSession, signedIn])
    return {
        order: poId === null ? null : (query.data ?? null),
        loadStatus: poId === null ? "ready" : getLoadStatus(session, [query]),
        loadError,
        retry,
        isFetching: session.isFetching || query.isFetching,
    }
}

export function usePurchaseOrders() {
    const session = useSession()
    const client = useQueryClient()
    const { add: showToast } = Toast.useToastManager()
    const canManage = session.data?.permissions.canManagePurchasing === true
    const queryKey = [...PURCHASE_ORDERS_QUERY_KEY, session.data?.userId]
    const {
        formOpen,
        formRequested,
        editing: editingOrder,
        target: transitionTarget,
        viewingOrder,
        detailOpen,
        defaultPoNumber,
        getState,
        openForm,
        setFormOpen,
        setTarget: setTransitionTarget,
        patch,
    } = usePurchaseOrderDialogs()
    const ordersQuery = useQuery({
        queryKey,
        queryFn: ({ signal }) => getPurchaseOrders(signal),
        enabled: Boolean(session.data),
    })
    // Options are only needed by the form, so they load when it opens.
    const optionsQuery = useQuery({
        queryKey: [...PURCHASE_ORDER_OPTIONS_QUERY_KEY, session.data?.userId],
        queryFn: ({ signal }) => getPurchaseOrderOptions(signal),
        enabled: Boolean(session.data) && canManage && formOpen,
        staleTime: 0,
    })
    // Expired sessions (HTTP 401) are signed out once by QueryProvider.
    const loadError = ordersQuery.error ?? session.error
    const optionsError = optionsQuery.error

    function cacheOrder(saved: PurchaseOrderDetail) {
        const row = purchaseOrderSchema.parse(saved)
        client.setQueryData<PurchaseOrder[]>(queryKey, (current = []) =>
            current.some((order) => order.poId === saved.poId)
                ? current.map((order) => (order.poId === saved.poId ? row : order))
                : [...current, row],
        )
        client.setQueryData(
            [...PURCHASE_ORDER_DETAIL_QUERY_KEY, saved.poId, session.data?.userId],
            saved,
        )
        void client.invalidateQueries({ queryKey: PURCHASE_ORDERS_QUERY_KEY })
        void client.invalidateQueries({
            queryKey: [...PURCHASE_ORDER_DETAIL_QUERY_KEY, saved.poId],
        })
        void client.invalidateQueries({ queryKey: ["suppliers"] })
        void client.invalidateQueries({ queryKey: ["items"] })
        void client.invalidateQueries({ queryKey: ["uoms"] })
    }
    function mutationError(error: Error) {
        if (error instanceof ApiError && error.status === 403)
            void client.invalidateQueries({ queryKey: SESSION_QUERY_KEY })
        if (error instanceof ApiError && error.status === 409) {
            void client.invalidateQueries({ queryKey: PURCHASE_ORDERS_QUERY_KEY })
            void client.invalidateQueries({ queryKey: PURCHASE_ORDER_DETAIL_QUERY_KEY })
        }
        showToast({
            type: "error",
            title: "Unable to update purchase orders",
            description: error.message,
        })
    }
    const prepareNumber = useMutation({
        mutationFn: () => {
            if (!canManage) throw new Error("Your role does not allow creating purchase orders.")
            return requestPurchaseOrderNumber()
        },
        retry: false,
        onSuccess: ({ poNumber }) => {
            const current = getState()
            if (current.formOpen || current.detailOpen) return
            patch({ defaultPoNumber: poNumber, detailOpen: false })
            openForm(null)
        },
        onError: mutationError,
    })
    const save = useMutation({
        mutationFn: ({
            values,
            order,
        }: {
            values: PurchaseOrderFormValues
            order: PurchaseOrder | null
        }) => {
            if (!canManage) throw new Error("Your role does not allow editing purchase orders.")
            if (order && !canEditPurchaseOrder(order))
                throw new Error("Only unreceived draft purchase orders can be edited.")
            return order
                ? updatePurchaseOrder(order.poId, toPurchaseOrderUpdateInput(values))
                : createPurchaseOrder(toPurchaseOrderInput(values))
        },
        onSuccess: (saved, { order }) => {
            cacheOrder(saved)
            showToast({
                type: "success",
                title: order ? "Purchase order updated." : "Purchase order created.",
            })
        },
        onError: mutationError,
    })
    const transition = useMutation({
        mutationFn: ({ order, action }: PurchaseOrderTransitionTarget) => {
            if (!canManage) throw new Error("Your role does not allow updating purchase orders.")
            if (action === "send") {
                if (!canSendPurchaseOrder(order))
                    throw new Error("Only unreceived draft purchase orders can be sent.")
                return sendPurchaseOrder(order.poId)
            }
            if (!canCancelPurchaseOrder(order))
                throw new Error("Only unreceived draft or sent purchase orders can be cancelled.")
            return cancelPurchaseOrder(order.poId)
        },
        onSuccess: (saved, { action }) => {
            cacheOrder(saved)
            setTransitionTarget(null)
            showToast({
                type: "success",
                title:
                    action === "send"
                        ? "Purchase order marked as sent."
                        : "Purchase order cancelled.",
            })
        },
        onError: mutationError,
    })
    const { reset: resetSave, mutateAsync: saveOrder, isPending: isSaving } = save
    const {
        reset: resetTransition,
        mutate: transitionOrder,
        isPending: isTransitioning,
    } = transition
    const { mutate: prepareOrderNumber, isPending: isPreparingNumber } = prepareNumber

    // Store actions and mutation resets are stable, so memoized table columns stay stable too.
    const openAdd = useCallback(() => {
        if (isPreparingNumber || isSaving || isTransitioning) return
        resetSave()
        prepareOrderNumber()
    }, [isPreparingNumber, isSaving, isTransitioning, resetSave, prepareOrderNumber])
    const openEdit = useCallback(
        (order: PurchaseOrder) => {
            resetSave()
            // Editing from the detail dialog closes it before the form opens.
            patch({ detailOpen: false })
            openForm(order)
        },
        [resetSave, patch, openForm],
    )
    const openDetail = useCallback(
        (order: PurchaseOrder) => patch({ viewingOrder: order, detailOpen: true }),
        [patch],
    )
    const setDetailOpen = useCallback((open: boolean) => patch({ detailOpen: open }), [patch])
    const openSend = useCallback(
        (order: PurchaseOrder) => {
            resetTransition()
            setTransitionTarget({ order, action: "send" })
        },
        [resetTransition, setTransitionTarget],
    )
    const openCancel = useCallback(
        (order: PurchaseOrder) => {
            resetTransition()
            setTransitionTarget({ order, action: "cancel" })
        },
        [resetTransition, setTransitionTarget],
    )
    const handleSave = useCallback(
        async (values: PurchaseOrderFormValues, order: PurchaseOrder | null) => {
            if (isSaving || isTransitioning) return false
            try {
                await saveOrder({ values, order })
                return true
            } catch {
                return false
            }
        },
        [isSaving, isTransitioning, saveOrder],
    )
    const handleTransition = useCallback(() => {
        const target = getState().target
        if (!isSaving && !isTransitioning && target) transitionOrder(target)
    }, [getState, isSaving, isTransitioning, transitionOrder])
    const { refetch: refetchOrders } = ordersQuery
    const { refetch: refetchSession } = session
    const { refetch: refetchOptions } = optionsQuery
    const signedIn = Boolean(session.data)
    const retry = useCallback(() => {
        void refetchSession()
        if (signedIn) void refetchOrders()
    }, [refetchOrders, refetchSession, signedIn])
    const retryOptions = useCallback(() => {
        if (signedIn && canManage) void refetchOptions()
    }, [canManage, refetchOptions, signedIn])
    return {
        orders: ordersQuery.data ?? EMPTY_ORDERS,
        canManage,
        loadStatus: getLoadStatus(session, [ordersQuery]),
        loadError,
        formOpen,
        setFormOpen,
        formRequested,
        editingOrder,
        defaultPoNumber,
        isPreparingNumber,
        openAdd,
        openEdit,
        viewingOrder,
        detailOpen,
        setDetailOpen,
        openDetail,
        options: optionsQuery.data ?? EMPTY_OPTIONS,
        optionsReady: optionsQuery.data !== undefined,
        optionsError,
        isOptionsLoading: optionsQuery.isPending,
        retryOptions,
        handleSave,
        isSaving,
        saveError: save.error?.message ?? null,
        transitionTarget,
        setTransitionTarget,
        openSend,
        openCancel,
        handleTransition,
        isTransitioning,
        transitionError: transition.error?.message ?? null,
        isFetching: session.isFetching || ordersQuery.isFetching,
        retry,
    }
}
