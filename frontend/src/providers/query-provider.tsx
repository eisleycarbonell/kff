"use client"

import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useState, type ReactNode } from "react"
import { ApiError } from "@/lib/api-request"
import { SESSION_QUERY_KEY } from "@/hooks/use-session"

export function QueryProvider({ children }: { children: ReactNode }) {
    const [queryClient] = useState(() => {
        // An expired session (HTTP 401) from any query or mutation signs the user out once, here.
        const expireSession = (error: Error) => {
            if (error instanceof ApiError && error.status === 401)
                client.setQueryData(SESSION_QUERY_KEY, null)
        }
        const client: QueryClient = new QueryClient({
            queryCache: new QueryCache({ onError: expireSession }),
            mutationCache: new MutationCache({ onError: expireSession }),
            defaultOptions: {
                queries: { staleTime: 60_000, retry: 1 },
            },
        })
        return client
    })

    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
