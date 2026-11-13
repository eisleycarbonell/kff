"use client"

import { useCallback, useEffect, useRef } from "react"
import { z } from "zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Toast } from "@base-ui/react/toast"
import { createDialogStore } from "@/lib/create-dialog-store"
import { getLoadStatus } from "@/lib/load-status"
import { apiRequest, ApiError } from "@/lib/api-request"
import { SESSION_QUERY_KEY, useSession } from "@/hooks/use-session"
import {
    deliveryOrderSchema,
    deliveryOrderOptionsSchema,
    type DeliveryOrder,
    type CreateDeliveryOrderInput,
    type UpdateDeliveryOrderInput,
} from "@/components/modules/delivery-orders/delivery-order.schema"

const PATH = "/delivery-orders"
export const DELIVERY_ORDERS_QUERY_KEY = ["delivery-orders"] as const
export type DeliveryOrderAction = "dispatch" | "complete" | "cancel"
function parse<T>(schema: z.ZodType<T>, data: unknown): T {
    const parsed = schema.safeParse(data)
    if (!parsed.success) throw new Error("The delivery orders API returned invalid data.")
    return parsed.data
}
export async function getDeliveryOrders(signal?: AbortSignal) {
    return parse(deliveryOrderSchema.array(), await apiRequest(PATH, { signal }))
}
export async function getDeliveryOrder(id: number, signal?: AbortSignal) {
    return parse(deliveryOrderSchema, await apiRequest(`${PATH}/${id}`, { signal }))
}
export async function getDeliveryOrderOptions(signal?: AbortSignal) {
    return parse(deliveryOrderOptionsSchema, await apiRequest(`${PATH}/options`, { signal }))
}
export async function createDeliveryOrder(input: CreateDeliveryOrderInput) {
    return parse(
        deliveryOrderSchema,
        await apiRequest(PATH, { method: "POST", body: JSON.stringify(input) }),
    )
}
export async function updateDeliveryOrder(id: number, input: UpdateDeliveryOrderInput) {
    return parse(
        deliveryOrderSchema,
        await apiRequest(`${PATH}/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    )
}
export async function runDeliveryOrderAction(
    id: number,
    action: DeliveryOrderAction,
    input: { transitLocationId: number } | Record<string, never> = {},
) {
    return parse(
        deliveryOrderSchema,
        await apiRequest(`${PATH}/${id}/${action}`, {
            method: "POST",
            body: JSON.stringify(input),
        }),
    )
}
const EMPTY_ORDERS: DeliveryOrder[] = []

type ActionTarget = { order: DeliveryOrder; action: DeliveryOrderAction }
const useDialogs = createDialogStore<DeliveryOrder, ActionTarget, { isOpeningEdit: boolean }>({ isOpeningEdit: false })
export function useDeliveryOrders() {
    const session = useSession()
    const client = useQueryClient()
    const { add: showToast } = Toast.useToastManager()
    const userId = session.data?.userId
    const canManage = session.data?.permissions.canManageTransfers === true
    const query = useQuery({
        queryKey: [...DELIVERY_ORDERS_QUERY_KEY, userId],
        queryFn: ({ signal }) => getDeliveryOrders(signal),
        enabled: Boolean(session.data),
    })
    const { formOpen, formRequested, editing: editingOrder, detailId, target: actionSelection,
        isOpeningEdit, openForm, setFormOpen, setDetailId, setTarget: setActionSelection, patch } = useDialogs()
    const setIsOpeningEdit = useCallback((isOpeningEdit: boolean) => patch({ isOpeningEdit }), [patch])
    const editRequest = useRef(0)
    const writePending = useRef(false)
    useEffect(() => {
        const requests = editRequest
        requests.current++
        return () => {
            requests.current++
        }
    }, [userId])
    const options = useQuery({
        queryKey: ["delivery-order-options", userId],
        queryFn: ({ signal }) => getDeliveryOrderOptions(signal),
        enabled: Boolean(session.data) && (formOpen || actionSelection?.action === "dispatch"),
        staleTime: 0,
    })
    const detail = useQuery({
        queryKey: ["delivery-order-detail", detailId, userId],
        queryFn: ({ signal }) => getDeliveryOrder(detailId!, signal),
        enabled: Boolean(session.data) && detailId !== null,
    })
    const refresh = useCallback(
        (saved: DeliveryOrder) => {
            client.setQueryData<DeliveryOrder[]>(
                [...DELIVERY_ORDERS_QUERY_KEY, userId],
                (current = []) =>
                    current.some((row) => row.deliveryOrderId === saved.deliveryOrderId)
                        ? current.map((row) =>
                            row.deliveryOrderId === saved.deliveryOrderId ? saved : row,
                        )
                        : [saved, ...current],
            )
            client.setQueryData(["delivery-order-detail", saved.deliveryOrderId, userId], saved)
            for (const key of [
                "delivery-orders",
                "delivery-order-detail",
                "delivery-order-options",
                "sales-orders",
                "sales-order-detail",
                "sales-order-options",
                "inventory-stocks",
                "inventory-stock-options",
                "inventory-movements",
                "inventory-reports",
                "operational-report-options",
                "operational-reports",
                "inventory-control-options",
                "transfer-options",
                "packing-options",
                "packing-preview",
                "dashboard",
                "lots",
            ])
                void client.invalidateQueries({ queryKey: [key] })
        },
        [client, userId],
    )
    const onError = useCallback(
        (error: Error) => {
            if (error instanceof ApiError && error.status === 403)
                void client.invalidateQueries({ queryKey: SESSION_QUERY_KEY })
            for (const key of [
                "delivery-orders",
                "delivery-order-options",
                "sales-orders",
                "inventory-stocks",
            ])
                void client.invalidateQueries({ queryKey: [key] })
            showToast({
                type: "error",
                title: "Unable to update delivery order",
                description: error.message,
            })
        },
        [client, showToast],
    )
    const save = useMutation({
        mutationFn: (input: CreateDeliveryOrderInput) => {
            if (!canManage) throw new Error("Your role does not allow managing delivery orders.")
            return editingOrder
                ? updateDeliveryOrder(editingOrder.deliveryOrderId, input)
                : createDeliveryOrder(input)
        },
        onSuccess: (saved) => {
            refresh(saved)
            showToast({
                type: "success",
                title: editingOrder ? "Delivery order updated." : "Delivery order created.",
            })
        },
        onError,
        retry: false,
    })
    const action = useMutation({
        mutationFn: (input: { transitLocationId: number } | Record<string, never>) => {
            if (!canManage || !actionSelection)
                throw new Error("Your role does not allow managing delivery orders.")
            return runDeliveryOrderAction(
                actionSelection.order.deliveryOrderId,
                actionSelection.action,
                input,
            )
        },
        onSuccess: (saved) => {
            refresh(saved)
            setActionSelection(null)
            showToast({
                type: "success",
                title:
                    saved.status === "In Transit"
                        ? "Delivery dispatched."
                        : `Delivery ${saved.status.toLowerCase()}.`,
            })
        },
        onError,
        retry: false,
    })
    const { reset: resetSave, mutateAsync: saveAsync, isPending: isSaving } = save
    const { reset: resetAction, mutateAsync: actionAsync, isPending: isActing } = action
    const openAdd = useCallback(() => {
        if (!canManage || writePending.current) return
        editRequest.current++
        resetSave()
        patch({ editing: null, formOpen: true, formRequested: true, isOpeningEdit: false })
    }, [canManage, resetSave, patch])
    const openEdit = useCallback(
        async (order: DeliveryOrder) => {
            if (!canManage || writePending.current) return
            const request = ++editRequest.current
            resetSave()
            setIsOpeningEdit(true)
            try {
                const loaded = await client.fetchQuery({
                    queryKey: ["delivery-order-detail", order.deliveryOrderId, userId],
                    queryFn: ({ signal }) => getDeliveryOrder(order.deliveryOrderId, signal),
                    staleTime: 0,
                })
                if (request !== editRequest.current) return
                if (loaded.status !== "Draft")
                    throw new Error("Only draft delivery orders can be edited. Refresh the orders.")
                openForm(loaded)
            } catch (error) {
                if (request !== editRequest.current) return
                onError(
                    error instanceof Error ? error : new Error("Unable to load delivery order."),
                )
            } finally {
                if (request === editRequest.current) setIsOpeningEdit(false)
            }
        },
        [canManage, client, userId, resetSave, onError, openForm, setIsOpeningEdit],
    )
    const openAction = useCallback(
        (order: DeliveryOrder, next: DeliveryOrderAction) => {
            if (!canManage || writePending.current) return
            editRequest.current++
            setIsOpeningEdit(false)
            resetAction()
            setActionSelection({ order, action: next })
        },
        [canManage, resetAction, setActionSelection, setIsOpeningEdit],
    )
    const handleSave = useCallback(
        async (input: CreateDeliveryOrderInput) => {
            if (writePending.current) return false
            writePending.current = true
            try {
                await saveAsync(input)
                return true
            } catch {
                return false
            } finally {
                writePending.current = false
            }
        },
        [saveAsync],
    )
    const handleAction = useCallback(
        async (input: { transitLocationId: number } | Record<string, never> = {}) => {
            if (writePending.current) return false
            writePending.current = true
            try {
                await actionAsync(input)
                return true
            } catch {
                return false
            } finally {
                writePending.current = false
            }
        },
        [actionAsync],
    )
    const loadStatus = getLoadStatus(session, [query])
    return {
        orders: query.data ?? EMPTY_ORDERS,
        canManage,
        loadStatus,
        loadError: query.error ?? session.error,
        isFetching: session.isFetching || query.isFetching,
        retry: () => {
            void session.refetch()
            void query.refetch()
        },
        formOpen,
        setFormOpen,
        formRequested,
        editingOrder,
        openAdd,
        openEdit,
        handleSave,
        isSaving,
        isOpeningEdit,
        saveError: save.error?.message,
        options: options.data,
        optionsLoading: options.isPending,
        optionsError: options.error?.message,
        retryOptions: () => void options.refetch(),
        detailId,
        setDetailId,
        detail: detail.data,
        detailLoading: detail.isPending,
        detailError: detail.error?.message,
        retryDetail: () => void detail.refetch(),
        actionSelection,
        setActionSelection,
        openAction,
        handleAction,
        isActing,
        actionError: action.error?.message,
    }
}
