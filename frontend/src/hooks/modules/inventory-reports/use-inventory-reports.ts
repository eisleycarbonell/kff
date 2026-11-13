"use client"
import { useCallback } from "react"
import { useQuery } from "@tanstack/react-query"
import { createUiStore } from "@/lib/create-dialog-store"
import { getLoadStatus } from "@/lib/load-status"
import { apiRequest } from "@/lib/api-request"
import { useSession } from "@/hooks/use-session"
import {
    reportSchema,
    reportOptionsSchema,
    reportQuery,
    type ReportFilters,
    type ReportType,
} from "@/components/modules/inventory-reports/inventory-report.schema"
export async function getInventoryReport(filters: ReportFilters, signal?: AbortSignal) {
    const result = reportSchema.safeParse(
        await apiRequest("/reports/inventory?" + reportQuery(filters), { signal }),
    )
    if (!result.success || result.data.report !== filters.report)
        throw new Error("The reporting API returned an invalid inventory report.")
    return result.data
}
export async function getInventoryReportOptions(signal?: AbortSignal) {
    const result = reportOptionsSchema.safeParse(
        await apiRequest("/reports/inventory/options", { signal }),
    )
    if (!result.success) throw new Error("The reporting API returned invalid filter options.")
    return result.data
}
const useReportState = createUiStore<{ filters: ReportFilters }>(() => ({ filters: { report: "stock-by-location" } }))
export function useInventoryReports() {
    const session = useSession()
    const { filters, patch } = useReportState()
    const setFilters = useCallback((filters: ReportFilters) => patch({ filters }), [patch])
    const query = useQuery({
        queryKey: ["inventory-reports", session.data?.userId, filters],
        queryFn: ({ signal }) => getInventoryReport(filters, signal),
        enabled: Boolean(session.data),
    })
    const options = useQuery({
        queryKey: ["inventory-report-options", session.data?.userId],
        queryFn: ({ signal }) => getInventoryReportOptions(signal),
        enabled: Boolean(session.data),
    })
    const { refetch } = query
    const { refetch: refetchSession } = session
    const signedIn = Boolean(session.data)
    const refresh = useCallback(() => {
        void refetchSession()
        if (signedIn) void refetch()
    }, [refetch, refetchSession, signedIn])
    const switchReport = useCallback((report: ReportType) => {
        patch(({ filters }) => ({ filters: {
            ...filters,
            report,
            fromDate: undefined,
            toDate: undefined,
            transactionType: undefined,
            qcStatus: undefined,
        } }))
    }, [patch])
    const loadStatus = getLoadStatus(session, [query])
    return {
        filters,
        setFilters,
        switchReport,
        report: query.data,
        options: options.data,
        optionsError: options.error,
        retryOptions: () => void options.refetch(),
        loadStatus,
        error: query.error ?? session.error,
        isFetching: query.isFetching,
        refresh,
    }
}
