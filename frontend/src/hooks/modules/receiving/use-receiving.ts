"use client"
import { invalidateInventoryAvailability } from "@/lib/inventory-query-cache"

import { useCallback, useEffect, useRef } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Toast } from "@base-ui/react/toast"
import { apiRequest, ApiError } from "@/lib/api-request"
import { createDialogStore } from "@/lib/create-dialog-store"
import { getLoadStatus } from "@/lib/load-status"
import { SESSION_QUERY_KEY, useSession } from "@/hooks/use-session"
import {
    receivingReceiptSchema,
    receivingOptionsSchema,
    receivingResultSchema,
    toReceivingInput,
    type ReceivingReceipt,
    type ReceivingOptions,
    type ReceivingResult,
    type ReceivingInput,
    type ReceivingFormValues,
} from "@/components/modules/receiving/receiving.schema"

export async function getReceipts(signal?: AbortSignal): Promise<ReceivingReceipt[]> {
    const result = receivingReceiptSchema
        .array()
        .safeParse(await apiRequest("/receiving", { signal }))
    if (!result.success) throw new Error("The receiving API returned invalid receipt history.")
    return result.data
}
export async function getReceivingOptions(signal?: AbortSignal): Promise<ReceivingOptions> {
    const result = receivingOptionsSchema.safeParse(
        await apiRequest("/receiving/options", { signal }),
    )
    if (!result.success)
        throw new Error("The receiving API returned invalid purchase order and location options.")
    return result.data
}
export async function recordReceipt(input: ReceivingInput): Promise<ReceivingResult> {
    const result = receivingResultSchema.safeParse(
        await apiRequest("/receiving", { method: "POST", body: JSON.stringify(input) }),
    )
    if (!result.success) throw new Error("The receiving API returned an invalid receipt result.")
    return result.data
}
export const RECEIVING_QUERY_KEY = ["receiving"] as const
export const RECEIVING_OPTIONS_QUERY_KEY = ["receiving-options"] as const
const EMPTY_RECEIPTS: ReceivingReceipt[] = []
const EMPTY_OPTIONS: ReceivingOptions = { orders: [], locations: [] }
const useReceivingDialogs = createDialogStore()

export function useReceiving() {
    const session = useSession()
    const client = useQueryClient()
    const { add: showToast } = Toast.useToastManager()
    const canReceive = session.data?.permissions.canManageInventory === true
    const queryKey = [...RECEIVING_QUERY_KEY, session.data?.userId]
    const { formOpen, formRequested, openForm, setFormOpen } = useReceivingDialogs()
    const submissionPending = useRef(false)
    const receiptsQuery = useQuery({
        queryKey,
        queryFn: ({ signal }) => getReceipts(signal),
        enabled: Boolean(session.data),
    })
    const optionsQuery = useQuery({
        queryKey: [...RECEIVING_OPTIONS_QUERY_KEY, session.data?.userId],
        queryFn: ({ signal }) => getReceivingOptions(signal),
        enabled: Boolean(session.data) && canReceive && formOpen,
        staleTime: 0,
    })
    const loadError = receiptsQuery.error ?? session.error
    const optionsError = optionsQuery.error
    useEffect(() => {
        if (optionsError instanceof ApiError && optionsError.status === 403)
            void client.invalidateQueries({ queryKey: SESSION_QUERY_KEY })
    }, [client, optionsError])
    const receive = useMutation({
        mutationFn: (values: ReceivingFormValues) => {
            if (!canReceive) throw new Error("Your role does not allow receiving inventory.")
            return recordReceipt(toReceivingInput(values))
        },
        onSuccess: (saved) => {
            void invalidateInventoryAvailability(client)
            const receivedIds = new Set(saved.receipts.map((receipt) => receipt.transactionId))
            client.setQueryData<ReceivingReceipt[]>(queryKey, (current = []) => [
                ...saved.receipts,
                ...current.filter((receipt) => !receivedIds.has(receipt.transactionId)),
            ])
            for (const prefix of [
                "receiving",
                "receiving-options",
                "purchase-orders",
                "purchase-order-detail",
                "purchase-order-options",
                "suppliers",
                "inventory-stocks",
                "inventory-movements",
                "inventory-reports",
                "inventory-control-options",
                "operational-reports",
                "operational-report-options",
                "packing-preview",
                "transfer-options",
                "delivery-order-options",
                "inventory-stock-options",
                "lots",
                "lot-detail",
                "items",
                "uoms",
                "locations",
                "dashboard",
            ])
                void client.invalidateQueries({ queryKey: [prefix] })
            showToast({ type: "success", title: `${saved.receipts.length} lot(s) received.` })
        },
        onError: (error) => {
            // A response can fail after the server commits. Reconcile before retrying.
            void client.invalidateQueries({ queryKey: RECEIVING_QUERY_KEY })
            void client.invalidateQueries({ queryKey: RECEIVING_OPTIONS_QUERY_KEY })
            if (error instanceof ApiError && error.status === 403)
                void client.invalidateQueries({ queryKey: SESSION_QUERY_KEY })
            if (error instanceof ApiError && error.status === 409) {
                void client.invalidateQueries({ queryKey: ["purchase-orders"] })
                void client.invalidateQueries({ queryKey: ["purchase-order-detail"] })
            }
            showToast({
                type: "error",
                title: "Unable to receive inventory",
                description: error.message,
            })
        },
    })
    const { reset, mutateAsync: receiveInventory, isPending: isReceiving } = receive
    const openAdd = useCallback(() => {
        if (!canReceive || submissionPending.current) return
        reset()
        openForm()
    }, [canReceive, reset, openForm])
    const handleReceive = useCallback(
        async (values: ReceivingFormValues) => {
            if (submissionPending.current) return false
            submissionPending.current = true
            try {
                await receiveInventory(values)
                return true
            } catch {
                return false
            } finally {
                submissionPending.current = false
            }
        },
        [receiveInventory],
    )
    const { refetch: refetchSession } = session
    const { refetch: refetchReceipts } = receiptsQuery
    const { refetch: refetchOptions } = optionsQuery
    const signedIn = Boolean(session.data)
    const retry = useCallback(() => {
        void refetchSession()
        if (signedIn) void refetchReceipts()
    }, [refetchReceipts, refetchSession, signedIn])
    const retryOptions = useCallback(async (): Promise<ReceivingOptions | null> => {
        if (!signedIn || !canReceive) return null
        const result = await refetchOptions()
        return result.isSuccess ? result.data : null
    }, [canReceive, refetchOptions, signedIn])
    const loadStatus = getLoadStatus(session, [receiptsQuery])
    return {
        receipts: receiptsQuery.data ?? EMPTY_RECEIPTS,
        canReceive,
        loadStatus,
        loadError,
        retry,
        isFetching: session.isFetching || receiptsQuery.isFetching,
        options: optionsQuery.data ?? EMPTY_OPTIONS,
        optionsReady: optionsQuery.data !== undefined,
        optionsError,
        isOptionsLoading: optionsQuery.isFetching,
        retryOptions,
        formOpen,
        setFormOpen,
        formRequested,
        openAdd,
        handleReceive,
        isReceiving,
        receiveError: receive.error?.message ?? null,
        receiveConflict: receive.error instanceof ApiError && receive.error.status === 409,
    }
}
