"use client"

import { useCallback, useEffect } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { getLoadStatus } from "@/lib/load-status"
import { apiRequest, ApiError } from "@/lib/api-request"
import { useNotifyTargetStore } from "@/lib/realtime-notify-store"
import { useSession, SESSION_QUERY_KEY } from "@/hooks/use-session"
import {
    dashboardDataSchema,
    type DashboardData,
} from "@/components/modules/dashboard/dashboard.schema"

export const DASHBOARD_QUERY_KEY = ["dashboard"] as const

const EMPTY_STOCK_BY_TYPE: DashboardData["stockByType"] = []
const EMPTY_STOCK_BY_LOCATION: DashboardData["stockByLocation"] = []
const EMPTY_PACKING_ORDERS: DashboardData["activePackingOrders"] = []
const EMPTY_PURCHASE_ORDERS: DashboardData["pendingPurchaseOrders"] = []
const EMPTY_TRANSFERS: DashboardData["activeTransfers"] = []
const EMPTY_EXPIRING_LOTS: DashboardData["expiringLots"] = []
const EMPTY_LOW_STOCK: DashboardData["lowStockItems"] = []
const EMPTY_RECENT_ACTIVITY: DashboardData["recentActivity"] = []

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
    const socketConnected = useNotifyTargetStore((state) => state.socketId !== null)
    const queryKey = [...DASHBOARD_QUERY_KEY, session.data?.userId]

    const dashboardQuery = useQuery({
        queryKey,
        queryFn: ({ signal }) => getDashboardData(signal),
        enabled: Boolean(session.data),
        refetchInterval: socketConnected ? false : 30_000,
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

    const loadStatus = getLoadStatus(session, [dashboardQuery])

    return {
        data: dashboardQuery.data ?? null,
        summary: dashboardQuery.data?.summary ?? null,
        stockByType: dashboardQuery.data?.stockByType ?? EMPTY_STOCK_BY_TYPE,
        stockByLocation: dashboardQuery.data?.stockByLocation ?? EMPTY_STOCK_BY_LOCATION,
        activePackingOrders: dashboardQuery.data?.activePackingOrders ?? EMPTY_PACKING_ORDERS,
        pendingPurchaseOrders:
            dashboardQuery.data?.pendingPurchaseOrders ?? EMPTY_PURCHASE_ORDERS,
        activeTransfers: dashboardQuery.data?.activeTransfers ?? EMPTY_TRANSFERS,
        expiringLots: dashboardQuery.data?.expiringLots ?? EMPTY_EXPIRING_LOTS,
        lowStockItems: dashboardQuery.data?.lowStockItems ?? EMPTY_LOW_STOCK,
        recentActivity: dashboardQuery.data?.recentActivity ?? EMPTY_RECENT_ACTIVITY,
        loadStatus,
        loadError,
        isFetching: session.isFetching || dashboardQuery.isFetching,
        retry,
        refetch: dashboardQuery.refetch,
    }
}
