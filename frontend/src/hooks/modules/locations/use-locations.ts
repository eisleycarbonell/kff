"use client"
import { useCallback, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Toast } from "@base-ui/react/toast"
import { apiRequest, ApiError } from "@/lib/api-request"
import { SESSION_QUERY_KEY, useSession } from "@/hooks/use-session"
import {
    locationSchema,
    locationInputSchema,
    type Location,
    type LocationInput,
} from "@/components/modules/locations/location.schema"
function parseLocation(value: unknown): Location {
    const result = locationSchema.safeParse(value)
    if (!result.success) throw new Error("The locations API returned an invalid record.")
    return result.data
}
export async function getLocations(signal?: AbortSignal): Promise<Location[]> {
    const data = await apiRequest("/locations", { signal })
    if (!Array.isArray(data)) throw new Error("The locations API returned an invalid list.")
    return data.map(parseLocation)
}
export async function createLocation(input: LocationInput): Promise<Location> {
    return parseLocation(
        await apiRequest("/locations", { method: "POST", body: JSON.stringify(input) }),
    )
}
export async function updateLocation(id: number, input: Partial<LocationInput>): Promise<Location> {
    return parseLocation(
        await apiRequest("/locations/" + id, { method: "PATCH", body: JSON.stringify(input) }),
    )
}
const EMPTY: Location[] = []
export function useLocations() {
    const session = useSession()
    const client = useQueryClient()
    const { add: showToast } = Toast.useToastManager()
    const queryKey = ["locations", session.data?.userId]
    const query = useQuery({
        queryKey,
        queryFn: ({ signal }) => getLocations(signal),
        enabled: Boolean(session.data),
    })
    const [formOpen, setFormOpen] = useState(false)
    const [formRequested, setFormRequested] = useState(false)
    const [editingLocation, setEditingLocation] = useState<Location | null>(null)
    const [deactivatingLocations, setDeactivatingLocations] = useState<Location[]>([])
    const canManage = session.data?.permissions.canManageInventory === true
    const loadError = query.error ?? session.error
    function cache(saved: Location) {
        client.setQueryData<Location[]>(queryKey, (current = []) =>
            current.some((row) => row.locationId === saved.locationId)
                ? current.map((row) => (row.locationId === saved.locationId ? saved : row))
                : [...current, saved],
        )
    }
    function refresh() {
        for (const key of ["locations", "inventory-stocks", "inventory-stock-options"])
            void client.invalidateQueries({ queryKey: [key] })
    }
    function mutationError(error: Error) {
        if (error instanceof ApiError && (error.status === 403 || error.status === 409)) {
            void client.invalidateQueries({ queryKey: SESSION_QUERY_KEY })
            refresh()
        }
        showToast({
            type: "error",
            title: "Unable to update locations",
            description: error.message,
        })
    }
    const save = useMutation({
        mutationFn: ({
            values,
            location,
        }: {
            values: LocationInput
            location: Location | null
        }) => {
            if (!canManage) throw new Error("Your role does not allow editing locations.")
            const input = locationInputSchema.parse(values)
            return location ? updateLocation(location.locationId, input) : createLocation(input)
        },
        onSuccess: (saved, { location }) => {
            cache(saved)
            refresh()
            showToast({
                type: "success",
                title: location ? "Location updated." : "Location added.",
            })
        },
        onError: mutationError,
    })
    const deactivate = useMutation({
        mutationFn: async (selected: Location[]) => {
            if (!canManage) throw new Error("Your role does not allow editing locations.")
            const results = await Promise.allSettled(
                selected.map((location) =>
                    updateLocation(location.locationId, { isActive: false }),
                ),
            )
            const failed = selected.filter((_, index) => results[index].status === "rejected")
            for (const result of results) if (result.status === "fulfilled") cache(result.value)
            setDeactivatingLocations(failed)
            refresh()
            if (failed.length < selected.length)
                showToast({
                    type: "success",
                    title: selected.length - failed.length + " location(s) deactivated.",
                })
            if (failed.length) {
                const failure = results.find((result) => result.status === "rejected")
                void client.invalidateQueries({ queryKey: SESSION_QUERY_KEY })
                throw new Error(
                    failed.length +
                        " location(s) could not be deactivated. " +
                        (failure?.reason instanceof Error
                            ? failure.reason.message
                            : "Please retry."),
                )
            }
        },
        onError: mutationError,
    })
    const openAdd = useCallback(() => {
        setEditingLocation(null)
        setFormRequested(true)
        setFormOpen(true)
    }, [])
    const openEdit = useCallback((location: Location) => {
        setEditingLocation(location)
        setFormRequested(true)
        setFormOpen(true)
    }, [])
    const openDeactivate = useCallback(
        (locations: Location[]) =>
            setDeactivatingLocations(
                locations.filter(
                    (location) => location.isActive && !location.hasOperationalActivity,
                ),
            ),
        [],
    )
    const loadStatus = session.isPending
        ? "loading"
        : session.data === undefined
          ? "error"
          : !session.data
            ? "signed-out"
            : query.data !== undefined
              ? "ready"
              : query.isError
                ? "error"
                : "loading"
    return {
        locations: query.data ?? EMPTY,
        canManage,
        loadStatus,
        loadError,
        formOpen,
        setFormOpen,
        formRequested,
        editingLocation,
        deactivatingLocations,
        setDeactivatingLocations,
        openAdd,
        openEdit,
        openDeactivate,
        isSaving: save.isPending,
        isDeactivating: deactivate.isPending,
        isFetching: session.isFetching || query.isFetching,
        retry: () => {
            void session.refetch()
            if (session.data) void query.refetch()
        },
        handleSave: async (values: LocationInput, location: Location | null) => {
            if (save.isPending) return false
            try {
                await save.mutateAsync({ values, location })
                return true
            } catch {
                return false
            }
        },
        handleDeactivate: () => {
            if (!deactivate.isPending && deactivatingLocations.length)
                deactivate.mutate(deactivatingLocations)
        },
    }
}
