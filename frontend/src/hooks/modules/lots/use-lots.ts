"use client"

import { useCallback, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Toast } from "@base-ui/react/toast"
import { apiRequest, ApiError } from "@/lib/api-request"
import { SESSION_QUERY_KEY, useSession } from "@/hooks/use-session"
import {
    lotSchema,
    lotDetailSchema,
    toLotInput,
    type Lot,
    type LotDetail,
    type UpdateLotInput,
    type LotFormValues,
} from "@/components/modules/lots/lot.schema"

export async function getLots(signal?: AbortSignal): Promise<Lot[]> {
    const result = lotSchema.array().safeParse(await apiRequest("/lots", { signal }))
    if (!result.success) throw new Error("The lot API returned invalid lot records.")
    return result.data
}
export async function getLot(lotId: number, signal?: AbortSignal): Promise<LotDetail> {
    const result = lotDetailSchema.safeParse(await apiRequest(`/lots/${lotId}`, { signal }))
    if (!result.success) throw new Error("The lot API returned an invalid lot detail.")
    return result.data
}
export async function updateLot(lotId: number, input: UpdateLotInput): Promise<LotDetail> {
    const result = lotDetailSchema.safeParse(
        await apiRequest(`/lots/${lotId}`, { method: "PATCH", body: JSON.stringify(input) }),
    )
    if (!result.success) throw new Error("The lot API returned an invalid updated lot.")
    return result.data
}
export const LOTS_QUERY_KEY = ["lots"] as const
export const LOT_DETAIL_QUERY_KEY = ["lot-detail"] as const
const EMPTY_LOTS: Lot[] = []

export function useLotDetail(lotId: number | null) {
    const session = useSession()
    const query = useQuery({
        queryKey: [...LOT_DETAIL_QUERY_KEY, lotId, session.data?.userId],
        queryFn: ({ signal }) => getLot(lotId!, signal),
        enabled: Boolean(session.data) && lotId !== null,
        staleTime: 0,
    })
    const loadError = query.error ?? session.error
    const { refetch } = query,
        { refetch: refetchSession } = session
    const signedIn = Boolean(session.data)
    const retry = useCallback(() => {
        void refetchSession()
        if (signedIn && lotId !== null) void refetch()
    }, [lotId, refetch, refetchSession, signedIn])
    const loadStatus =
        lotId === null
            ? "ready"
            : session.isPending
              ? "loading"
              : session.data === undefined
                ? "error"
                : !session.data
                  ? "signed-out"
                  : query.data !== undefined
                    ? "ready"
                    : query.isError
                      ? "error"
                      : "loading"
    return {
        lot: lotId === null ? null : (query.data ?? null),
        loadStatus,
        loadError,
        retry,
        isFetching: session.isFetching || query.isFetching,
    }
}
export function useLots() {
    const session = useSession()
    const client = useQueryClient()
    const { add: showToast } = Toast.useToastManager()
    const canManage = session.data?.permissions.canManageInventory === true
    const queryKey = [...LOTS_QUERY_KEY, session.data?.userId]
    const query = useQuery({
        queryKey,
        queryFn: ({ signal }) => getLots(signal),
        enabled: Boolean(session.data),
    })
    const [formOpen, setFormOpen] = useState(false),
        [formRequested, setFormRequested] = useState(false)
    const [editingLot, setEditingLot] = useState<Lot | null>(null)
    const loadError = query.error ?? session.error
    const save = useMutation({
        mutationFn: ({ values, lot }: { values: LotFormValues; lot: Lot | null }) => {
            if (!canManage) throw new Error("Your role does not allow editing lot details.")
            if (!lot) throw new Error("Select an existing lot to edit.")
            return updateLot(lot.lotId, toLotInput(values, lot))
        },
        onSuccess: (saved) => {
            const row = lotSchema.parse(saved)
            client.setQueryData<Lot[]>(queryKey, (current = []) =>
                current.map((lot) => (lot.lotId === saved.lotId ? row : lot)),
            )
            client.setQueryData([...LOT_DETAIL_QUERY_KEY, saved.lotId, session.data?.userId], saved)
            for (const prefix of [
                "lots",
                "lot-detail",
                "inventory-stocks",
                "inventory-stock-options",
                "receiving",
                "receiving-options",
            ])
                void client.invalidateQueries({ queryKey: [prefix] })
            showToast({ type: "success", title: "Lot details updated." })
        },
        onError: (error) => {
            if (error instanceof ApiError && error.status === 403)
                void client.invalidateQueries({ queryKey: SESSION_QUERY_KEY })
            if (error instanceof ApiError && error.status === 409) {
                void client.invalidateQueries({ queryKey: LOTS_QUERY_KEY })
                void client.invalidateQueries({ queryKey: LOT_DETAIL_QUERY_KEY })
            }
            showToast({
                type: "error",
                title: "Unable to update lot details",
                description: error.message,
            })
        },
    })
    const { reset, mutateAsync: saveLot, isPending: isSaving } = save
    const openEdit = useCallback(
        (lot: Lot) => {
            reset()
            setEditingLot(lot)
            setFormRequested(true)
            setFormOpen(true)
        },
        [reset],
    )
    const handleSave = useCallback(
        async (values: LotFormValues, lot: Lot | null) => {
            if (isSaving) return false
            try {
                if (canManage && lot && Object.keys(toLotInput(values, lot)).length === 0)
                    return true
                await saveLot({ values, lot })
                return true
            } catch {
                return false
            }
        },
        [canManage, isSaving, saveLot],
    )
    const { refetch } = query,
        { refetch: refetchSession } = session
    const signedIn = Boolean(session.data)
    const retry = useCallback(() => {
        void refetchSession()
        if (signedIn) void refetch()
    }, [refetch, refetchSession, signedIn])
    const loadStatus = session.isPending
        ? "loading"
        : session.data === undefined
          ? "error"
          : !session.data
            ? "signed-out"
            : query.data !== undefined
              ? "ready"
              : query.isError
                ? "error"
                : "loading"
    return {
        lots: query.data ?? EMPTY_LOTS,
        canManage,
        loadStatus,
        loadError,
        retry,
        isFetching: session.isFetching || query.isFetching,
        formOpen,
        setFormOpen,
        formRequested,
        editingLot,
        openEdit,
        handleSave,
        isSaving,
        saveError: save.error?.message ?? null,
    }
}
