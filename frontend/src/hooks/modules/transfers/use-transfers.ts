"use client"
import { invalidateInventoryAvailability } from "@/lib/inventory-query-cache"

import { useCallback, useEffect, useRef } from "react"
import { z } from "zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Toast } from "@base-ui/react/toast"
import { createDialogStore } from "@/lib/create-dialog-store"
import { getLoadStatus } from "@/lib/load-status"
import { apiRequest, ApiError } from "@/lib/api-request"
import { SESSION_QUERY_KEY, useSession } from "@/hooks/use-session"
import {
    transferSchema,
    transferDetailSchema,
    transferOptionsSchema,
    type Transfer,
    type TransferDetail,
    type CreateTransferInput,
    type UpdateTransferInput,
    type DispatchTransferInput,
    type ReceiveTransferInput,
} from "@/components/modules/transfers/transfer.schema"

export const TRANSFERS_QUERY_KEY = ["transfers"] as const
export type TransferAction = "dispatch" | "receive" | "cancel"
async function request<T>(
    schema: z.ZodType<T>,
    path: string,
    label: string,
    init?: RequestInit,
): Promise<T> {
    const parsed = schema.safeParse(await apiRequest(`/transfers${path}`, init))
    if (!parsed.success) throw new Error(`The transfers API returned invalid ${label}.`)
    return parsed.data
}
const send = (method: "POST" | "PATCH", input: unknown): RequestInit => ({
    method,
    body: JSON.stringify(input),
})
export const getTransfers = (signal?: AbortSignal) =>
    request(transferSchema.array(), "", "transfers", { signal })
export const getTransferOptions = (signal?: AbortSignal) =>
    request(transferOptionsSchema, "/options", "transfer options", { signal })
export const getTransfer = (id: number, signal?: AbortSignal) =>
    request(transferDetailSchema, `/${id}`, "transfer details", { signal })
export const createTransfer = (input: CreateTransferInput) =>
    request(transferDetailSchema, "", "created transfer", send("POST", input))
export const updateTransfer = (id: number, input: UpdateTransferInput) =>
    request(transferDetailSchema, `/${id}`, "updated transfer", send("PATCH", input))
export const runTransferAction = (
    id: number,
    action: TransferAction,
    input?: DispatchTransferInput | ReceiveTransferInput,
) =>
    request(transferDetailSchema, `/${id}/${action}`, "updated transfer", send("POST", input ?? {}))
const EMPTY_TRANSFERS: Transfer[] = []

type ActionTarget = { transfer: Transfer; action: TransferAction }
const useDialogs = createDialogStore<TransferDetail, ActionTarget, { isOpeningEdit: boolean }>({ isOpeningEdit: false })
export function useTransfers() {
    const session = useSession()
    const client = useQueryClient()
    const { add: showToast } = Toast.useToastManager()
    const userId = session.data?.userId
    const canManage = session.data?.permissions.canManageTransfers === true
    const query = useQuery({
        queryKey: [...TRANSFERS_QUERY_KEY, userId],
        queryFn: ({ signal }) => getTransfers(signal),
        enabled: Boolean(session.data),
    })
    const { formOpen, formRequested, editing: editingTransfer, detailId, target: actionSelection,
        isOpeningEdit, getState, openForm, setFormOpen, setDetailId, setTarget: setActionSelection, patch } = useDialogs()
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
        queryKey: ["transfer-options", userId],
        queryFn: ({ signal }) => getTransferOptions(signal),
        staleTime: 0,
        enabled: Boolean(session.data) && (formOpen || actionSelection?.action === "dispatch"),
    })
    const detail = useQuery({
        queryKey: ["transfer-detail", detailId, userId],
        queryFn: ({ signal }) => getTransfer(detailId!, signal),
        enabled: Boolean(session.data) && detailId !== null,
    })
    const actionDetail = useQuery({
        queryKey: ["transfer-detail", actionSelection?.transfer.transferId, userId],
        queryFn: ({ signal }) => getTransfer(actionSelection!.transfer.transferId, signal),
        enabled: Boolean(session.data) && actionSelection !== null,
        staleTime: 0,
    })
    const refresh = useCallback(
        (saved: TransferDetail) => {
            void invalidateInventoryAvailability(client)
            client.setQueryData<Transfer[]>([...TRANSFERS_QUERY_KEY, userId], (current = []) => {
                const header = transferSchema.parse(saved)
                return current.some((row) => row.transferId === saved.transferId)
                    ? current.map((row) => (row.transferId === saved.transferId ? header : row))
                    : [header, ...current]
            })
            client.setQueryData(["transfer-detail", saved.transferId, userId], saved)
            for (const key of [
                "transfers",
                "transfer-detail",
                "transfer-options",
                "inventory-stocks",
                "inventory-reports",
                "operational-report-options",
                "operational-reports",
                "inventory-control-options",
                "inventory-stock-options",
                "lots",
                "lot-detail",
                "packing-preview",
                "dashboard",
            ])
                void client.invalidateQueries({ queryKey: [key] })
        },
        [client, userId],
    )
    const onError = useCallback(
        (error: Error) => {
            if (error instanceof ApiError && error.status === 403)
                void client.invalidateQueries({ queryKey: SESSION_QUERY_KEY })
            // The server may have committed a receipt before a network failure. Reload its
            // outstanding quantities before a user confirms another receipt.
            for (const key of [
                "transfers",
                "transfer-detail",
                "transfer-options",
                "inventory-stocks",
            ])
                void client.invalidateQueries({ queryKey: [key] })
            showToast({
                type: "error",
                title: "Unable to update transfer",
                description: error.message,
            })
        },
        [client, showToast],
    )
    const save = useMutation({
        mutationFn: (input: CreateTransferInput | UpdateTransferInput) => {
            if (!canManage) throw new Error("Your role does not allow managing stock transfers.")
            return editingTransfer
                ? updateTransfer(editingTransfer.transferId, input)
                : createTransfer(input as CreateTransferInput)
        },
        onSuccess: (saved) => {
            refresh(saved)
            showToast({
                type: "success",
                title: editingTransfer ? "Transfer updated." : "Transfer created.",
            })
        },
        onError,
    })
    const action = useMutation({
        mutationFn: (input?: DispatchTransferInput | ReceiveTransferInput) => {
            if (!canManage || !actionSelection)
                throw new Error("Your role does not allow managing stock transfers.")
            return runTransferAction(
                actionSelection.transfer.transferId,
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
                        ? "Transfer updated in transit."
                        : `Transfer ${saved.status.toLowerCase()}.`,
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
        async (transfer: Transfer) => {
            if (!canManage || writePending.current) return
            const request = ++editRequest.current
            resetSave()
            setIsOpeningEdit(true)
            try {
                const loaded = await client.fetchQuery({
                    queryKey: ["transfer-detail", transfer.transferId, userId],
                    queryFn: ({ signal }) => getTransfer(transfer.transferId, signal),
                    staleTime: 0,
                })
                if (request !== editRequest.current) return
                if (loaded.status !== "Draft")
                    throw new Error("Only draft transfers can be edited. Reload the transfer.")
                openForm(loaded)
            } catch (error) {
                if (request !== editRequest.current) return
                onError(error instanceof Error ? error : new Error("Unable to load transfer."))
            } finally {
                if (request === editRequest.current) setIsOpeningEdit(false)
            }
        },
        [canManage, client, userId, resetSave, onError, openForm, setIsOpeningEdit],
    )
    const openAction = useCallback(
        (transfer: Transfer, next: TransferAction) => {
            if (!canManage || writePending.current) return
            editRequest.current++
            setIsOpeningEdit(false)
            resetAction()
            setActionSelection({ transfer, action: next })
        },
        [canManage, resetAction, setActionSelection, setIsOpeningEdit],
    )
    const handleSave = useCallback(
        async (input: CreateTransferInput | UpdateTransferInput) => {
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
        async (input?: DispatchTransferInput | ReceiveTransferInput) => {
            if (writePending.current || !getState().target) return false
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
        [getState, actionAsync],
    )
    const loadStatus = getLoadStatus(session, [query])
    return {
        transfers: query.data ?? EMPTY_TRANSFERS,
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
        editingTransfer,
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
        actionDetail: actionDetail.data,
        actionLoading: actionDetail.isPending || actionDetail.isFetching,
        actionLoadError: actionDetail.error?.message,
        retryActionDetail: () => void actionDetail.refetch(),
    }
}
