"use client"

import { useQuery } from "@tanstack/react-query"
import { apiRequest } from "@/lib/api-request"
import { getLoadStatus } from "@/lib/load-status"
import { useSession } from "@/hooks/use-session"
import {
    accountingOverviewSchema,
    buildAccountingQueryString,
    type AccountingFilters,
    type AccountingOverview,
} from "@/components/modules/accounting/accounting.schema"

export async function getAccountingOverview(
    filters: AccountingFilters = { fromDate: "", toDate: "" },
    signal?: AbortSignal,
): Promise<AccountingOverview> {
    const queryString = buildAccountingQueryString(filters)
    const raw = await apiRequest(`/accounting${queryString}`, { signal })
    const parsed = accountingOverviewSchema.safeParse(raw)
    if (!parsed.success) {
        throw new Error("The API returned an invalid accounting payload.")
    }
    return parsed.data
}

export function useAccounting(filters: AccountingFilters) {
    const session = useSession()
    const canAccess = session.data?.permissions.canManageAccounting === true

    const query = useQuery({
        queryKey: ["accounting", session.data?.userId, filters.fromDate, filters.toDate],
        queryFn: ({ signal }) => getAccountingOverview(filters, signal),
        enabled: canAccess,
        staleTime: 60_000,
    })

    const loadStatus = getLoadStatus(session, [query], canAccess)

    return {
        overview: query.data ?? null,
        canAccess,
        loadStatus,
        loadError: query.error,
        isFetching: query.isFetching,
        retry: () => void query.refetch(),
        refetch: () => query.refetch(),
    }
}
