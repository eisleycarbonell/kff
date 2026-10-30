"use client"

import { useCallback, useState } from "react"
import { z } from "zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Toast } from "@base-ui/react/toast"
import { apiRequest, ApiError } from "@/lib/api-request"
import { SESSION_QUERY_KEY, useSession } from "@/hooks/use-session"
import {
    packingOrderSchema,
    packingDetailSchema,
    packingOptionsSchema,
    packingPreviewSchema,
    reservationSchema,
    type PackingOrder,
    type PackingDetail,
    type CreatePackingInput,
    type UpdatePackingInput,
    type PreviewPackingInput,
    type CompletePackingInput,
    type PackingFormValues,
    type Reservation,
} from "@/components/modules/packing-orders/packing-order.schema"

export const PACKING_ORDERS_QUERY_KEY = ["packing-orders"] as const
export const PACKING_RESERVATIONS_QUERY_KEY = ["packing-reservations"] as const
const PACKING_PREFIXES = [
    "packing-orders",
    "packing-detail",
    "packing-reservations",
    "packing-preview",
]
const BASE = "/packing-orders"
/** Fetch a packing endpoint and validate the response with its schema. */
async function request<T>(
    schema: z.ZodType<T>,
    path: string,
    label: string,
    init?: RequestInit,
): Promise<T> {
    const result = schema.safeParse(await apiRequest(`${BASE}${path}`, init))
    if (!result.success) throw new Error(`The packing API returned invalid ${label}.`)
    return result.data
}
const send = (method: "POST" | "PATCH", body: unknown): RequestInit => ({
    method,
    body: JSON.stringify(body),
})
export const getPackingOrders = (signal?: AbortSignal) =>
    request(packingOrderSchema.array(), "", "packing orders", { signal })
export const getPackingOptions = (signal?: AbortSignal) =>
    request(packingOptionsSchema, "/options", "packing options", { signal })
export const getPackingOrder = (id: number, signal?: AbortSignal) =>
    request(packingDetailSchema, `/${id}`, "order details", { signal })
export const getPackingReservations = (signal?: AbortSignal) =>
    request(reservationSchema.array(), "/reservations", "reservations", { signal })
export const previewPacking = (input: PreviewPackingInput, signal?: AbortSignal) =>
    request(packingPreviewSchema, "/preview", "material availability", {
        ...send("POST", input),
        signal,
    })
export const createPackingOrder = (input: CreatePackingInput) =>
    request(packingDetailSchema, "", "created order", send("POST", input))
export const updatePackingOrder = (id: number, input: UpdatePackingInput) =>
    request(packingDetailSchema, `/${id}`, "updated order", send("PATCH", input))
export type PackingAction = "plan" | "start" | "cancel" | "complete"
export const runPackingAction = (id: number, action: PackingAction, input?: CompletePackingInput) =>
    request(packingDetailSchema, `/${id}/${action}`, "updated order", send("POST", input ?? {}))
const EMPTY_ORDERS: PackingOrder[] = []
const EMPTY_RESERVATIONS: Reservation[] = []

export function usePackingPreview(input: PreviewPackingInput | null) {
    const session = useSession()
    return useQuery({
        queryKey: ["packing-preview", session.data?.userId, input],
        queryFn: ({ signal }) => previewPacking(input!, signal),
        enabled: Boolean(session.data) && input !== null,
        retry: false,
    })
}

export function usePackingOrders(reservationsPage = false) {
    const session = useSession()
    const client = useQueryClient()
    const { add: showToast } = Toast.useToastManager()
    const canManage = session.data?.permissions.canManagePacking === true
    const userId = session.data?.userId
    const query = useQuery({
        queryKey: [...PACKING_ORDERS_QUERY_KEY, userId],
        queryFn: ({ signal }) => getPackingOrders(signal),
        enabled: Boolean(session.data) && !reservationsPage,
    })
    const reservations = useQuery({
        queryKey: [...PACKING_RESERVATIONS_QUERY_KEY, userId],
        queryFn: ({ signal }) => getPackingReservations(signal),
        enabled: Boolean(session.data) && reservationsPage,
    })
    const [formOpen, setFormOpen] = useState(false)
    const [formRequested, setFormRequested] = useState(false)
    const [editingOrder, setEditingOrder] = useState<PackingOrder | null>(null)
    const [detailId, setDetailId] = useState<number | null>(null)
    const [actionOrder, setActionOrder] = useState<{
        order: PackingOrder
        action: PackingAction
    } | null>(null)
    const options = useQuery({
        queryKey: ["packing-options", userId],
        queryFn: ({ signal }) => getPackingOptions(signal),
        enabled: Boolean(session.data) && formOpen,
    })
    const detail = useQuery({
        queryKey: ["packing-detail", detailId, userId],
        queryFn: ({ signal }) => getPackingOrder(detailId!, signal),
        enabled: Boolean(session.data) && detailId !== null,
    })
    const activeQuery = reservationsPage ? reservations : query
    const loadError = activeQuery.error ?? session.error
    const refresh = useCallback(
        (saved: PackingDetail, completed = false) => {
            client.setQueryData<PackingOrder[]>(
                [...PACKING_ORDERS_QUERY_KEY, userId],
                (current = []) => {
                    const row = packingOrderSchema.parse(saved)
                    return current.some((order) => order.packingOrderId === saved.packingOrderId)
                        ? current.map((order) =>
                              order.packingOrderId === saved.packingOrderId ? row : order,
                          )
                        : [...current, row]
                },
            )
            client.setQueryData(["packing-detail", saved.packingOrderId, userId], saved)
            // Planning/cancelling changes reservations; only completion creates a lot and moves stock.
            for (const prefix of [
                ...PACKING_PREFIXES,
                "packing-options",
                "inventory-stocks",
                "dashboard",
                ...(completed ? ["inventory-stock-options", "lots", "lot-detail"] : []),
            ])
                void client.invalidateQueries({ queryKey: [prefix] })
        },
        [client, userId],
    )
    const onError = useCallback(
        (error: Error) => {
            if (error instanceof ApiError && error.status === 403)
                void client.invalidateQueries({ queryKey: SESSION_QUERY_KEY })
            if (error instanceof ApiError && error.status === 409)
                for (const prefix of [...PACKING_PREFIXES, "inventory-stocks"])
                    void client.invalidateQueries({ queryKey: [prefix] })
            showToast({
                type: "error",
                title: "Unable to update packing order",
                description: error.message,
            })
        },
        [client, showToast],
    )
    const save = useMutation({
        mutationFn: ({
            values,
            order,
        }: {
            values: PackingFormValues
            order: PackingOrder | null
        }) => {
            if (!canManage) throw new Error("Your role does not allow managing packing orders.")
            const metadata: UpdatePackingInput = {
                packingOrderNumber: values.packingOrderNumber.trim(),
                destinationLocationId: values.destinationLocationId!,
                scheduledDate: values.scheduledDate || null,
                notes: values.notes.trim() || null,
            }
            return order
                ? updatePackingOrder(order.packingOrderId, metadata)
                : createPackingOrder({
                      ...metadata,
                      itemId: values.itemId!,
                      sourceLocationId: values.sourceLocationId!,
                      targetQty: values.targetQty.trim(),
                  })
        },
        onSuccess: (saved, { order }) => {
            refresh(saved)
            showToast({
                type: "success",
                title: order ? "Packing order updated." : "Packing order created.",
            })
        },
        onError,
    })
    const action = useMutation({
        mutationFn: ({
            order,
            action,
            input,
        }: {
            order: PackingOrder
            action: PackingAction
            input?: CompletePackingInput
        }) => {
            if (!canManage) throw new Error("Your role does not allow managing packing orders.")
            return runPackingAction(order.packingOrderId, action, input)
        },
        onSuccess: (saved) => {
            refresh(saved, saved.status === "Completed")
            setActionOrder(null)
            showToast({ type: "success", title: `Packing order ${saved.status.toLowerCase()}.` })
        },
        onError,
    })
    const { reset: resetSave, mutateAsync: saveAsync, isPending: isSaving } = save
    const { reset: resetAction, mutateAsync: actionAsync, isPending: isActing } = action
    const openAdd = useCallback(() => {
        resetSave()
        setEditingOrder(null)
        setFormRequested(true)
        setFormOpen(true)
    }, [resetSave])
    const openEdit = useCallback(
        (order: PackingOrder) => {
            resetSave()
            setEditingOrder(order)
            setFormRequested(true)
            setFormOpen(true)
        },
        [resetSave],
    )
    const openAction = useCallback(
        (order: PackingOrder, next: PackingAction) => {
            resetAction()
            setActionOrder({ order, action: next })
        },
        [resetAction],
    )
    const handleSave = useCallback(
        async (values: PackingFormValues, order: PackingOrder | null) => {
            if (isSaving) return false
            try {
                await saveAsync({ values, order })
                return true
            } catch {
                return false
            }
        },
        [isSaving, saveAsync],
    )
    const handleAction = useCallback(
        async (input?: CompletePackingInput) => {
            if (isActing || !actionOrder) return false
            try {
                await actionAsync({ ...actionOrder, input })
                return true
            } catch {
                return false
            }
        },
        [isActing, actionOrder, actionAsync],
    )
    const loadStatus = session.isPending
        ? "loading"
        : session.data === undefined
          ? "error"
          : !session.data
            ? "signed-out"
            : activeQuery.data !== undefined
              ? "ready"
              : activeQuery.isError
                ? "error"
                : "loading"
    return {
        orders: query.data ?? EMPTY_ORDERS,
        reservations: reservations.data ?? EMPTY_RESERVATIONS,
        canManage,
        loadStatus,
        loadError,
        retry: () => {
            void session.refetch()
            void activeQuery.refetch()
        },
        isFetching: session.isFetching || activeQuery.isFetching,
        formOpen,
        setFormOpen,
        formRequested,
        editingOrder,
        openAdd,
        openEdit,
        handleSave,
        isSaving,
        saveError: save.error?.message,
        options: options.data,
        optionsError: options.error?.message,
        optionsLoading: options.isPending,
        retryOptions: () => void options.refetch(),
        detailId,
        setDetailId,
        detail: detail.data,
        detailLoading: detail.isPending,
        detailError: detail.error?.message,
        retryDetail: () => void detail.refetch(),
        actionOrder,
        setActionOrder,
        openAction,
        handleAction,
        isActing,
        actionError: action.error?.message,
    }
}
