"use client"
import { useCallback, useRef } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Toast } from "@base-ui/react/toast"
import { ApiError, apiRequest } from "@/lib/api-request"
import { createDialogStore } from "@/lib/create-dialog-store"
import { getLoadStatus } from "@/lib/load-status"
import { SESSION_QUERY_KEY, useSession } from "@/hooks/use-session"
import {
    recordSchema,
    inputSchema,
    optionsSchema,
    type RecordDto,
    type InputDto,
} from "@/components/modules/item-packaging/item-package.schema"
const PATH = "/item-packaging",
    useDialogs = createDialogStore<RecordDto>()
export async function getRecords(signal?: AbortSignal) {
    return recordSchema.array().parse(await apiRequest(PATH, { signal }))
}
export async function getOptions(signal?: AbortSignal) {
    return optionsSchema.parse(await apiRequest("/inventory-controls/options", { signal }))
}
export async function saveRecord(input: InputDto, current: RecordDto | null) {
    const parsed = inputSchema.parse(input)
    const body = parsed
    return recordSchema.parse(
        await apiRequest(current ? PATH + "/" + current.packagingId : PATH, {
            method: current ? "PATCH" : "POST",
            body: JSON.stringify(body),
        }),
    )
}
export async function removeRecord(id: number) {
    await apiRequest(PATH + "/" + id, { method: "DELETE" }, true)
}
const EMPTY_RECORDS: RecordDto[] = []
export function useFeature() {
    const session = useSession()
    const client = useQueryClient()
    const { add: showToast } = Toast.useToastManager()
    const { formOpen, formRequested, editing, target, getState, setFormOpen, openForm, setTarget } = useDialogs()
    const writePending = useRef(false)
    const canManage = session.data?.permissions.canManageInventory === true
    const queryKey = ["item-packaging", session.data?.userId]
    const list = useQuery({
        queryKey,
        queryFn: ({ signal }) => getRecords(signal),
        enabled: Boolean(session.data),
    })
    const options = useQuery({
        queryKey: ["item-packaging-options", session.data?.userId],
        queryFn: ({ signal }) => getOptions(signal),
        enabled: Boolean(session.data) && canManage && formRequested,
    })
    function refreshAffected() {
        for (const key of ["item-packaging", "item-packaging-options", "inventory-control-options", "inventory-reports", "dashboard", "receiving-options", "packing-options", "packing-preview"]) {
            void client.invalidateQueries({ queryKey: [key] })
        }
    }
    function failed(error: Error) {
        if (error instanceof ApiError && error.status === 403)
            void client.invalidateQueries({ queryKey: SESSION_QUERY_KEY })
        showToast({ type: "error", title: "Unable to update item packaging", description: error.message })
    }
    const mutation = useMutation({
        mutationFn: ({ input, current }: { input: InputDto; current: RecordDto | null }) => {
            if (!canManage) throw new Error("Your role does not allow updating these records.")
            return saveRecord(input, current)
        },
        onSuccess: (saved) => {
            client.setQueryData<RecordDto[]>(queryKey, (current = []) =>
                current.some((row) => row.packagingId === saved.packagingId)
                    ? current.map((row) => row.packagingId === saved.packagingId ? saved : row)
                    : [...current, saved])
            refreshAffected()
            showToast({ type: "success", title: "Item packaging saved." })
        },
        onError: failed,
    })
    const removal = useMutation({
        mutationFn: async (id: number) => {
            if (!canManage) throw new Error("Your role does not allow removing these records.")
            await removeRecord(id)
            return id
        },
        onSuccess: (id) => {
            setTarget(null)
            client.setQueryData<RecordDto[]>(queryKey, (current) => current?.filter((row) => row.packagingId !== id))
            refreshAffected()
            showToast({ type: "success", title: "Item packaging removed." })
        },
        onError: failed,
    })
    const { reset: resetRemoval, mutateAsync: removeRecordAsync } = removal
    const selectTarget = useCallback((record: RecordDto | null) => {
        if (writePending.current || (record && !canManage)) return
        resetRemoval()
        setTarget(record)
    }, [canManage, resetRemoval, setTarget])
    const remove = useCallback(async () => {
        const selected = getState().target
        if (!selected || writePending.current) return
        writePending.current = true
        try { await removeRecordAsync(selected.packagingId) }
        finally { writePending.current = false }
    }, [getState, removeRecordAsync])
    const { reset: resetSave, mutateAsync: saveRecordAsync } = mutation
    const showForm = useCallback((record?: RecordDto | null) => {
        if (!canManage || writePending.current) return
        resetSave()
        openForm(record)
    }, [canManage, resetSave, openForm])
    const changeFormOpen = useCallback((open: boolean) => {
        if (!writePending.current) setFormOpen(open)
    }, [setFormOpen])
    const save = useCallback(async (input: InputDto) => {
        if (writePending.current) return false
        writePending.current = true
        try {
            await saveRecordAsync({ input, current: getState().editing })
            setFormOpen(false)
            return true
        } catch {
            return false
        } finally {
            writePending.current = false
        }
    }, [saveRecordAsync, getState, setFormOpen])
    return {
        formOpen, formRequested, editing,
        openForm: showForm,
        setFormOpen: changeFormOpen,
        rows: list.data ?? EMPTY_RECORDS,
        canManage,
        loadStatus: getLoadStatus(session, [list]),
        error: list.error ?? options.error ?? session.error,
        busy: mutation.isPending || removal.isPending,
        mutationError: mutation.error?.message,
        save,
        options: options.data,
        optionsLoading: formRequested && options.isPending,
        target, setTarget: selectTarget, remove,
        removalError: removal.error?.message,
        refresh: () => {
            void session.refetch()
            if (session.data) {
                void list.refetch()
                if (formRequested) void options.refetch()
            }
        },
    }
}
