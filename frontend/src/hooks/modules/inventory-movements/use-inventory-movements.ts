"use client"

import { useCallback } from "react"
import { useQuery } from "@tanstack/react-query"
import { getLoadStatus } from "@/lib/load-status"
import { apiRequest } from "@/lib/api-request"
import { useSession } from "@/hooks/use-session"
import {
    inventoryMovementSchema,
    type InventoryMovement,
    type MovementType,
} from "@/components/modules/inventory-movements/inventory-movement.schema"

export const INVENTORY_MOVEMENTS_QUERY_KEY = ["inventory-movements"] as const
const EMPTY_MOVEMENTS: InventoryMovement[] = []

export async function getInventoryMovements(
    transactionType?: MovementType,
    signal?: AbortSignal,
): Promise<InventoryMovement[]> {
    const path = transactionType
        ? `/inventory/movements?transactionType=${encodeURIComponent(transactionType)}`
        : "/inventory/movements"
    const result = inventoryMovementSchema.array().safeParse(await apiRequest(path, { signal }))
    if (!result.success) throw new Error("The inventory API returned invalid stock movements.")
    return result.data
}

export function useInventoryMovements(transactionType?: MovementType) {
    const session = useSession()
    const query = useQuery({
        queryKey: [
            ...INVENTORY_MOVEMENTS_QUERY_KEY,
            transactionType ?? "all",
            session.data?.userId,
        ],
        queryFn: ({ signal }) => getInventoryMovements(transactionType, signal),
        enabled: Boolean(session.data),
    })
    const { refetch } = query
    const { refetch: refetchSession } = session
    const signedIn = Boolean(session.data)
    const retry = useCallback(() => {
        void refetchSession()
        if (signedIn) void refetch()
    }, [refetch, refetchSession, signedIn])
    const loadStatus = getLoadStatus(session, [query])

    return {
        movements: query.data ?? EMPTY_MOVEMENTS,
        loadStatus,
        loadError: query.error ?? session.error,
        isFetching: session.isFetching || query.isFetching,
        retry,
    }
}
