"use client"

import { useCallback, useMemo, useRef } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Toast } from "@base-ui/react/toast"
import { ApiError, apiRequest } from "@/lib/api-request"
import { createDialogStore } from "@/lib/create-dialog-store"
import { getLoadStatus } from "@/lib/load-status"
import { SESSION_QUERY_KEY, useSession } from "@/hooks/use-session"
import {
    inputSchema,
    recordSchema,
    type InputDto,
    type RecordDto,
} from "@/components/modules/reason-codes/reason-code.schema"

const PATH = "/reason-codes"
const useDialogs = createDialogStore<RecordDto>()

export async function getRecords(signal?: AbortSignal) {
    return recordSchema.array().parse(await apiRequest(PATH, { signal }))
}

export async function saveRecord(input: InputDto, current: RecordDto | null) {
    const parsed = inputSchema.parse(input)
    return recordSchema.parse(
        await apiRequest(current ? `${PATH}/${current.reasonId}` : PATH, {
            method: current ? "PATCH" : "POST",
            body: JSON.stringify(parsed),
        }),
    )
}

export async function setRecordActiveStatus(reasonId: number, isActive: boolean) {
    return recordSchema.parse(
        await apiRequest(`${PATH}/${reasonId}`, {
            method: "PATCH",
            body: JSON.stringify({ isActive }),
        }),
    )
}

const EMPTY_RECORDS: RecordDto[] = []

const AFFECTED_QUERY_KEYS = [
    "reason-codes",
    "inventory-stock-options",
    "inventory-control-options",
    "inventory-controls",
    "inventory-movements",
    "inventory-reports",
    "inventory-report-options",
    "dashboard",
] as const

export function useFeature() {
    const session = useSession()
    const client = useQueryClient()
    const { add: showToast } = Toast.useToastManager()
    const { formOpen, formRequested, editing, getState, setFormOpen, openForm } = useDialogs()
    const writePending = useRef(false)
    const canManage = session.data?.permissions.canManageInventory === true
    const userId = session.data?.userId
    const queryKey = useMemo(() => ["reason-codes", userId], [userId])

    const list = useQuery({
        queryKey,
        queryFn: ({ signal }) => getRecords(signal),
        enabled: Boolean(session.data),
    })

    const refreshAffected = useCallback(() => {
        for (const key of AFFECTED_QUERY_KEYS) {
            void client.invalidateQueries({ queryKey: [key] })
        }
    }, [client])

    const applySavedRecord = useCallback(
        (saved: RecordDto) => {
            client.setQueryData<RecordDto[]>(queryKey, (current = []) =>
                current.some((row) => row.reasonId === saved.reasonId)
                    ? current.map((row) => (row.reasonId === saved.reasonId ? saved : row))
                    : [...current, saved],
            )
            refreshAffected()
        },
        [client, queryKey, refreshAffected],
    )

    const failed = useCallback(
        (error: Error) => {
            if (error instanceof ApiError && error.status === 403) {
                void client.invalidateQueries({ queryKey: SESSION_QUERY_KEY })
            }
            showToast({
                type: "error",
                title: "Unable to update reason code",
                description: error.message,
            })
        },
        [client, showToast],
    )

    const mutation = useMutation({
        mutationFn: ({ input, current }: { input: InputDto; current: RecordDto | null }) => {
            if (!canManage) throw new Error("Your role does not allow updating reason codes.")
            return saveRecord(input, current)
        },
        onSuccess: (saved) => {
            applySavedRecord(saved)
            showToast({ type: "success", title: "Reason code saved." })
        },
        onError: failed,
    })

    const statusMutation = useMutation({
        mutationFn: ({ reasonId, isActive }: { reasonId: number; isActive: boolean }) => {
            if (!canManage) throw new Error("Your role does not allow updating reason codes.")
            return setRecordActiveStatus(reasonId, isActive)
        },
        onSuccess: (saved) => {
            applySavedRecord(saved)
            showToast({
                type: "success",
                title: saved.isActive ? "Reason code activated." : "Reason code deactivated.",
            })
        },
        onError: failed,
    })

    const { reset: resetSave, mutateAsync: saveRecordAsync } = mutation
    const { mutateAsync: toggleStatusAsync } = statusMutation

    const showForm = useCallback(
        (record?: RecordDto | null) => {
            if (!canManage || writePending.current) return
            resetSave()
            openForm(record)
        },
        [canManage, resetSave, openForm],
    )

    const changeFormOpen = useCallback(
        (open: boolean) => {
            if (!writePending.current) setFormOpen(open)
        },
        [setFormOpen],
    )

    const save = useCallback(
        async (input: InputDto) => {
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
        },
        [saveRecordAsync, getState, setFormOpen],
    )

    const toggleActive = useCallback(
        async (record: RecordDto) => {
            if (!canManage || writePending.current) return false
            writePending.current = true
            try {
                await toggleStatusAsync({ reasonId: record.reasonId, isActive: !record.isActive })
                return true
            } catch {
                return false
            } finally {
                writePending.current = false
            }
        },
        [canManage, toggleStatusAsync],
    )

    const busy = mutation.isPending || statusMutation.isPending

    return {
        formOpen,
        formRequested,
        editing,
        openForm: showForm,
        setFormOpen: changeFormOpen,
        rows: list.data ?? EMPTY_RECORDS,
        canManage,
        loadStatus: getLoadStatus(session, [list]),
        error: list.error ?? session.error,
        isFetching: list.isFetching || session.isFetching,
        busy,
        mutationError: mutation.error?.message,
        save,
        toggleActive,
        refresh: () => {
            void session.refetch()
            if (session.data) {
                void list.refetch()
            }
        },
    }
}
