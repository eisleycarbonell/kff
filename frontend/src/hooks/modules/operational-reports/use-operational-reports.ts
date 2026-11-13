"use client"
import { useCallback } from "react"
import { useQuery } from "@tanstack/react-query"
import { createUiStore } from "@/lib/create-dialog-store"
import { apiRequest } from "@/lib/api-request"
import { getLoadStatus } from "@/lib/load-status"
import { useSession } from "@/hooks/use-session"
import {
    reportSchema,
    optionsSchema,
    type ReportKind,
    type Filters,
} from "@/components/modules/operational-reports/operational-report.schema"
export async function getReport(kind: ReportKind, filters: Filters, signal?: AbortSignal) {
    const params = new URLSearchParams({ report: kind })
    for (const [key, v] of Object.entries(filters))
        if (v && (kind === "genealogy" ? key === "lotId" : key !== "lotId")) params.set(key, v)
    return reportSchema.parse(await apiRequest("/reports/operations?" + params, { signal }))
}
export async function getReportOptions(signal?: AbortSignal) {
    return optionsSchema.parse(await apiRequest("/inventory-controls/options", { signal }))
}
const useReportState = createUiStore<{ filters: Filters }>(() => ({ filters: { fromDate: "", toDate: "", lotId: "" } }))
export function useOperationalReports(kind: ReportKind) {
    const session = useSession()
    const { filters, patch } = useReportState()
    const setFilters = useCallback((filters: Filters) => patch({ filters }), [patch])
    const report = useQuery({
        queryKey: ["operational-reports", kind, filters, session.data?.userId],
        queryFn: ({ signal }) => getReport(kind, filters, signal),
        enabled: Boolean(session.data),
    })
    const options = useQuery({
        queryKey: ["operational-report-options", session.data?.userId],
        queryFn: ({ signal }) => getReportOptions(signal),
        enabled: Boolean(session.data) && kind === "genealogy",
    })
    return {
        filters,
        setFilters,
        report: report.data,
        options: options.data,
        loadStatus: getLoadStatus(session, kind === "genealogy" ? [report, options] : [report]),
        error: report.error ?? (kind === "genealogy" ? options.error : null) ?? session.error,
        refresh: () => {
            void report.refetch()
            if (kind === "genealogy") void options.refetch()
        },
        busy: report.isFetching,
    }
}
