"use client"

import { useCallback, useEffect } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { apiRequest, ApiError } from "@/lib/api-request"
import { useSession, SESSION_QUERY_KEY } from "@/hooks/use-session"
import {
    dashboardDataSchema,
    type DashboardData,
} from "@/components/modules/dashboard/dashboard.schema"

export const DASHBOARD_QUERY_KEY = ["dashboard"] as const

export async function getDashboardData(signal?: AbortSignal): Promise<DashboardData> {
    const raw = await apiRequest("/dashboard", { signal })
    const result = dashboardDataSchema.safeParse(raw)
    if (!result.success) {
        throw new Error("The API returned invalid dashboard metrics.")
    }
    return result.data
}

export function useDashboard() {
    const session = useSession()
    const client = useQueryClient()
    const queryKey = [...DASHBOARD_QUERY_KEY, session.data?.userId]

    const dashboardQuery = useQuery({
        queryKey,
        queryFn: ({ signal }) => getDashboardData(signal),
        enabled: Boolean(session.data),
        refetchInterval: 30_000, // Poll periodically for live overview updates
    })

    const loadError = dashboardQuery.error ?? session.error

    useEffect(() => {
        if (loadError instanceof ApiError && loadError.status === 403) {
            void client.invalidateQueries({ queryKey: SESSION_QUERY_KEY })
        }
    }, [client, loadError])

    const retry = useCallback(() => {
        if (session.isError) void session.refetch()
        if (dashboardQuery.isError) void dashboardQuery.refetch()
    }, [dashboardQuery, session])

    const loadStatus =
        session.isPending
            ? "loading"
            : session.data === undefined
              ? "error"
              : !session.data
                ? "signed-out"
                : dashboardQuery.data !== undefined
                  ? "ready"
                  : dashboardQuery.isError
                    ? "error"
                    : "loading"

    return {
        data: dashboardQuery.data ?? null,
        summary: dashboardQuery.data?.summary ?? null,
        stockByType: dashboardQuery.data?.stockByType ?? [],
        stockByLocation: dashboardQuery.data?.stockByLocation ?? [],
        activePackingOrders: dashboardQuery.data?.activePackingOrders ?? [],
        pendingPurchaseOrders: dashboardQuery.data?.pendingPurchaseOrders ?? [],
        activeTransfers: dashboardQuery.data?.activeTransfers ?? [],
        expiringLots: dashboardQuery.data?.expiringLots ?? [],
        lowStockItems: dashboardQuery.data?.lowStockItems ?? [],
        recentActivity: dashboardQuery.data?.recentActivity ?? [],
        loadStatus,
        loadError,
        isFetching: session.isFetching || dashboardQuery.isFetching,
        retry,
        refetch: dashboardQuery.refetch,
    }
}
