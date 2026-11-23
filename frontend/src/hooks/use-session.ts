"use client"

import { z } from "zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Toast } from "@base-ui/react/toast"
import { apiRequest, ApiError } from "@/lib/api-request"
import { useNotifyTargetStore } from "@/lib/realtime-notify-store"

export const sessionSchema = z.object({
    userId: z.int().positive(),
    firstName: z.string(),
    lastName: z.string(),
    email: z.string(),
    roleId: z.int().positive(),
    permissions: z.object({
        canManageInventory: z.boolean().optional(),
        canManagePurchasing: z.boolean().optional(),
        canManagePacking: z.boolean().optional(),
        canManageTransfers: z.boolean().optional(),
        canManageUsers: z.boolean().optional(),
        canManageAccounting: z.boolean().optional(),
        notifyInventory: z.boolean().optional(),
        notifyPurchasing: z.boolean().optional(),
        notifyPacking: z.boolean().optional(),
        notifyTransfers: z.boolean().optional(),
        notifySales: z.boolean().optional(),
        notifyAccounting: z.boolean().optional(),
        notifyUsers: z.boolean().optional(),
    }),
})
export type Session = z.output<typeof sessionSchema>
export const SESSION_QUERY_KEY = ["session"] as const

function parseSession(data: unknown): Session {
    const result = sessionSchema.safeParse(data)
    if (!result.success) throw new Error("The API returned an invalid session.")
    return result.data
}
export async function getSession(signal?: AbortSignal): Promise<Session | null> {
    try {
        return parseSession(await apiRequest("/auth/session", { signal }))
    } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null
        throw error
    }
}
export async function loginSession(username: string, password: string): Promise<Session> {
    return parseSession(
        await apiRequest("/auth/login", {
            method: "POST",
            body: JSON.stringify({ username: username.trim().toLowerCase(), password }),
        }),
    )
}
function resetRealtimeSessionState() {
    const notifyStore = useNotifyTargetStore.getState()
    notifyStore.resetToAuto()
    notifyStore.setSocketId(null)
}
export async function logoutSession(): Promise<void> {
    try {
        await apiRequest("/auth/logout", { method: "POST" }, true)
    } catch (error) {
        if (error instanceof ApiError && error.status === 401) return
        throw error
    }
}
export function useSession() {
    return useQuery({
        queryKey: SESSION_QUERY_KEY,
        queryFn: ({ signal }) => getSession(signal),
        retry: false,
        staleTime: 30_000,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
    })
}
export function useLogin() {
    const client = useQueryClient()
    const { add: showToast } = Toast.useToastManager()
    return useMutation({
        mutationFn: ({ username, password }: { username: string; password: string }) =>
            loginSession(username, password),
        onSuccess: (session) => {
            client.clear()
            resetRealtimeSessionState()
            client.setQueryData(SESSION_QUERY_KEY, session)
        },
        onError: (error) =>
            showToast({ type: "error", title: "Unable to sign in", description: error.message }),
    })
}
export function useLogout() {
    const client = useQueryClient()
    const { add: showToast } = Toast.useToastManager()
    return useMutation({
        mutationFn: logoutSession,
        onSuccess: () => {
            client.clear()
            resetRealtimeSessionState()
            client.setQueryData(SESSION_QUERY_KEY, null)
        },
        onError: (error) =>
            showToast({ type: "error", title: "Unable to sign out", description: error.message }),
    })
}
