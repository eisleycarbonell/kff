"use client"
import { invalidateInventoryAvailability } from "@/lib/inventory-query-cache"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Toast } from "@base-ui/react/toast"
import { apiRequest, ApiError } from "@/lib/api-request"
import { useSession, SESSION_QUERY_KEY } from "@/hooks/use-session"
import { createDialogStore } from "@/lib/create-dialog-store"
import { getLoadStatus } from "@/lib/load-status"
import {
    controlSchema,
    detailSchema,
    controlOptionsSchema,
    controlInputSchema,
    type Control,
    type ControlKind,
    type ControlInput,
    type ControlAction,
} from "@/components/modules/inventory-controls/inventory-control.schema"
const PATH = "/inventory-controls",
    useDialogs = createDialogStore<Control>()
export async function getControls(kind: ControlKind, signal?: AbortSignal) {
    return controlSchema.array().parse(await apiRequest(PATH + "?kind=" + kind, { signal }))
}
export async function getControl(id: number, signal?: AbortSignal) {
    return detailSchema.parse(await apiRequest(`${PATH}/${id}`, { signal }))
}
export async function getControlOptions(signal?: AbortSignal) {
    return controlOptionsSchema.parse(await apiRequest(PATH + "/options", { signal }))
}
export async function createControl(input: ControlInput) {
    return detailSchema.parse(
        await apiRequest(PATH, {
            method: "POST",
            body: JSON.stringify(controlInputSchema.parse(input)),
        }),
    )
}
export async function actOnControl(id: number, action: ControlAction, reviewNote: string) {
    return detailSchema.parse(
        await apiRequest(`${PATH}/${id}/actions`, {
            method: "POST",
            body: JSON.stringify({ action, reviewNote }),
        }),
    )
}
export async function saveObservations(
    id: number,
    observations: { observationId: number; countedQty: string }[],
) {
    return detailSchema.parse(
        await apiRequest(`${PATH}/${id}/observations`, {
            method: "PATCH",
            body: JSON.stringify({ observations }),
        }),
    )
}
export function useInventoryControls(kind: ControlKind) {
    const session = useSession(),
        dialogs = useDialogs(),
        client = useQueryClient(),
        toast = Toast.useToastManager()
    const permission = kind === "Formula" ? "canManagePacking" : "canManageInventory"
    const canManage = session.data?.permissions[permission] === true
    const canReview = canManage && session.data?.permissions.canManageUsers === true
    const list = useQuery({
        queryKey: ["inventory-controls", kind, session.data?.userId],
        queryFn: ({ signal }) => getControls(kind, signal),
        enabled: Boolean(session.data),
    })
    const options = useQuery({
        queryKey: ["inventory-control-options", session.data?.userId],
        queryFn: ({ signal }) => getControlOptions(signal),
        enabled: Boolean(session.data),
    })
    const detail = useQuery({
        queryKey: ["inventory-control-detail", dialogs.detailId, session.data?.userId],
        queryFn: ({ signal }) => getControl(dialogs.detailId!, signal),
        enabled: Boolean(session.data && dialogs.detailId),
    })
    const mutation = useMutation({
        mutationFn: async (
            task:
                | { type: "create"; input: ControlInput }
                | { type: "action"; id: number; action: ControlAction; note: string }
                | {
                      type: "observe"
                      id: number
                      rows: { observationId: number; countedQty: string }[]
                  },
        ) =>
            task.type === "create"
                ? createControl(task.input)
                : task.type === "action"
                  ? actOnControl(task.id, task.action, task.note)
                  : saveObservations(task.id, task.rows),
        onSuccess: (saved) => {
            void invalidateInventoryAvailability(client)
            client.setQueryData(["inventory-control-detail", saved.requestId, session.data?.userId], saved)
            for (const key of [
                "inventory-controls",
                "inventory-control-options",
                "inventory-stocks",
                "inventory-reports",
                "inventory-movements",
                "dashboard",
                "lots",
                "packing-formulas",
                "packing-formula-options",
                "packing-orders",
                "packing-options",
                "packing-preview",
                "packing-detail",
                "lot-detail",
                "operational-reports",
            ])
                void client.invalidateQueries({ queryKey: [key] })
            toast.add({ type: "success", title: "Request saved." })
        },
        onError: (e: Error) => {
            if (e instanceof ApiError && e.status === 403)
                void client.invalidateQueries({queryKey: SESSION_QUERY_KEY})
            if (e instanceof ApiError && e.status === 409) {
                void client.invalidateQueries({queryKey: ["inventory-control-detail"]})
                void client.invalidateQueries({queryKey: ["inventory-control-options"]})
            }
            toast.add({ type: "error", title: "Unable to save request", description: e.message })
        },
    })
    async function save(input: ControlInput) {
        if (mutation.isPending) return false
        try {
            const saved = await mutation.mutateAsync({ type: "create", input })
            dialogs.setFormOpen(false)
            dialogs.setDetailId(saved.requestId)
            return true
        } catch {
            return false
        }
    }
    return {
        kind,
        session: session.data,
        ...dialogs,
        canManage,
        canReview,
        rows: list.data ?? [],
        options: options.data,
        detail: detail.data,
        loadStatus: getLoadStatus(session, [list, options]),
        error: list.error ?? options.error,
        detailError: detail.error,
        errorMessage: mutation.error?.message,
        busy: mutation.isPending,
        refresh: () => {
            void list.refetch()
            void options.refetch()
            if (dialogs.detailId) void detail.refetch()
        },
        save,
        action: (id: number, action: ControlAction, note: string) =>
            mutation.mutateAsync({ type: "action", id, action, note }),
        observe: (id: number, rows: { observationId: number; countedQty: string }[]) =>
            mutation.mutateAsync({ type: "observe", id, rows }),
    }
}
