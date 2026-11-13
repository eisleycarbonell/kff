"use client"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Toast } from "@base-ui/react/toast"
import { apiRequest } from "@/lib/api-request"
import { getLoadStatus } from "@/lib/load-status"
import { useSession } from "@/hooks/use-session"
import {
    settingsSchema,
    settingsInputSchema,
    type SettingsInput,
} from "@/components/modules/company-settings/company-setting.schema"
export async function getSettings(signal?: AbortSignal) {
    return settingsSchema.parse(await apiRequest("/company-settings", { signal }))
}
export async function saveSettings(input: SettingsInput) {
    return settingsSchema.parse(
        await apiRequest("/company-settings", {
            method: "PATCH",
            body: JSON.stringify(settingsInputSchema.parse(input)),
        }),
    )
}
export function useCompanySettings() {
    const session = useSession(),
        client = useQueryClient(),
        toast = Toast.useToastManager()
    const query = useQuery({
        queryKey: ["company-settings", session.data?.userId],
        queryFn: ({ signal }) => getSettings(signal),
        enabled: Boolean(session.data),
    })
    const save = useMutation({
        mutationFn: saveSettings,
        onSuccess: (r) => {
            client.setQueryData(["company-settings", session.data?.userId], r)
            for (const key of ["dashboard", "inventory-reports", "operational-reports"])
                void client.invalidateQueries({ queryKey: [key] })
            toast.add({ type: "success", title: "Company settings saved." })
        },
        onError: (e: Error) =>
            toast.add({ type: "error", title: "Unable to save settings", description: e.message }),
    })
    return {
        settings: query.data,
        loadStatus: getLoadStatus(session, [query]),
        error: query.error,
        canManage: session.data?.permissions.canManageUsers === true,
        busy: save.isPending,
        mutationError: save.error?.message,
        save: save.mutateAsync,
        refresh: () => void query.refetch(),
    }
}
