"use client"

import { useCallback, useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Toast } from "@base-ui/react/toast"
import { apiRequest, ApiError } from "@/lib/api-request"
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

export function useReceiving() {
    const session = useSession()
    const client = useQueryClient()
    const { add: showToast } = Toast.useToastManager()
    const canReceive = session.data?.permissions.canManageInventory === true
    const queryKey = [...RECEIVING_QUERY_KEY, session.data?.userId]
    const [formOpen, setFormOpen] = useState(false)
    const [formRequested, setFormRequested] = useState(false)
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
        if (
            [loadError, optionsError].some(
                (error) => error instanceof ApiError && error.status === 401,
            )
        )
            client.setQueryData(SESSION_QUERY_KEY, null)
        if (optionsError instanceof ApiError && optionsError.status === 403)
            void client.invalidateQueries({ queryKey: SESSION_QUERY_KEY })
    }, [client, loadError, optionsError])
    const receive = useMutation({
        mutationFn: (values: ReceivingFormValues) => {
            if (!canReceive) throw new Error("Your role does not allow receiving inventory.")
            return recordReceipt(toReceivingInput(values))
        },
        onSuccess: (saved) => {
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
                "inventory-stock-options",
                "lots",
                "lot-detail",
                "items",
                "uoms",
                "locations",
            ])
                void client.invalidateQueries({ queryKey: [prefix] })
            showToast({ type: "success", title: `${saved.receipts.length} lot(s) received.` })
        },
        onError: (error) => {
            if (error instanceof ApiError && error.status === 401)
                client.setQueryData(SESSION_QUERY_KEY, null)
            if (error instanceof ApiError && error.status === 403)
                void client.invalidateQueries({ queryKey: SESSION_QUERY_KEY })
            if (error instanceof ApiError && error.status === 409) {
                void client.invalidateQueries({ queryKey: RECEIVING_OPTIONS_QUERY_KEY })
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
        reset()
        setFormRequested(true)
        setFormOpen(true)
    }, [reset])
    const handleReceive = useCallback(
        async (values: ReceivingFormValues) => {
            if (isReceiving) return false
            try {
                await receiveInventory(values)
                return true
            } catch {
                return false
            }
        },
        [isReceiving, receiveInventory],
    )
    const { refetch: refetchSession } = session
    const { refetch: refetchReceipts } = receiptsQuery
    const { refetch: refetchOptions } = optionsQuery
    const signedIn = Boolean(session.data)
    const retry = useCallback(() => {
        void refetchSession()
        if (signedIn) void refetchReceipts()
    }, [refetchReceipts, refetchSession, signedIn])
    const retryOptions = useCallback(() => {
        if (signedIn && canReceive) void refetchOptions()
    }, [canReceive, refetchOptions, signedIn])
    const loadStatus = session.isPending
        ? "loading"
        : session.data === undefined
          ? "error"
          : !session.data
            ? "signed-out"
            : receiptsQuery.data !== undefined
              ? "ready"
              : receiptsQuery.isError
                ? "error"
                : "loading"
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
        isOptionsLoading: optionsQuery.isPending,
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
