"use client"

import { useCallback, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Toast } from "@base-ui/react/toast"
import { apiRequest, ApiError } from "@/lib/api-request"
import { SESSION_QUERY_KEY, useSession } from "@/hooks/use-session"
import {
    itemSchema,
    itemUomSchema,
    toItemInput,
    type Item,
    type ItemUom,
    type CreateItemInput,
    type UpdateItemInput,
    type ItemFormValues,
} from "@/components/modules/items/item.schema"

function parseItem(data: unknown): Item {
    const result = itemSchema.safeParse(data)
    if (!result.success) throw new Error("The item API returned an invalid record.")
    return result.data
}
export async function getItems(signal?: AbortSignal): Promise<Item[]> {
    const data = await apiRequest("/items", { signal })
    if (!Array.isArray(data)) throw new Error("The item API returned an invalid item list.")
    return data.map(parseItem)
}
export async function getItemUoms(signal?: AbortSignal): Promise<ItemUom[]> {
    const result = itemUomSchema.array().safeParse(await apiRequest("/items/uoms", { signal }))
    if (!result.success) throw new Error("The item API returned invalid unit options.")
    return result.data
}
export async function createItem(input: CreateItemInput): Promise<Item> {
    return parseItem(await apiRequest("/items", { method: "POST", body: JSON.stringify(input) }))
}
export async function updateItem(itemId: number, input: UpdateItemInput): Promise<Item> {
    return parseItem(
        await apiRequest(`/items/${itemId}`, { method: "PATCH", body: JSON.stringify(input) }),
    )
}
export const ITEMS_QUERY_KEY = ["items"] as const
const EMPTY_ITEMS: Item[] = []
const EMPTY_UOMS: ItemUom[] = []

export function useItems() {
    const session = useSession()
    const client = useQueryClient()
    const { add: showToast } = Toast.useToastManager()
    const queryKey = [...ITEMS_QUERY_KEY, session.data?.userId]
    const itemsQuery = useQuery({
        queryKey,
        queryFn: ({ signal }) => getItems(signal),
        enabled: Boolean(session.data),
    })
    const uomsQuery = useQuery({
        queryKey: ["item-uoms", session.data?.userId],
        queryFn: ({ signal }) => getItemUoms(signal),
        enabled: Boolean(session.data),
    })
    const [formOpen, setFormOpen] = useState(false)
    const [formRequested, setFormRequested] = useState(false)
    const [editingItem, setEditingItem] = useState<Item | null>(null)
    const [deactivatingItems, setDeactivatingItems] = useState<Item[]>([])
    const canManage = session.data?.permissions.canManageInventory === true
    const loadError = itemsQuery.error ?? uomsQuery.error ?? session.error

    function cacheItem(saved: Item) {
        client.setQueryData<Item[]>(queryKey, (current = []) =>
            current.some((item) => item.itemId === saved.itemId)
                ? current.map((item) => (item.itemId === saved.itemId ? saved : item))
                : [...current, saved],
        )
    }
    function mutationError(error: Error) {
        if (error instanceof ApiError && error.status === 403)
            void client.invalidateQueries({ queryKey: SESSION_QUERY_KEY })
        showToast({
            type: "error",
            title: "Unable to update the catalog",
            description: error.message,
        })
    }
    const save = useMutation({
        mutationFn: ({ values, item }: { values: ItemFormValues; item: Item | null }) => {
            if (!canManage) throw new Error("Your role does not allow editing items.")
            const input = toItemInput(values)
            return item ? updateItem(item.itemId, input) : createItem(input)
        },
        onSuccess: (saved, { item }) => {
            cacheItem(saved)
            void client.invalidateQueries({ queryKey: ITEMS_QUERY_KEY })
            showToast({ type: "success", title: item ? "Item updated." : "Item added." })
        },
        onError: mutationError,
    })
    const deactivate = useMutation({
        mutationFn: async (selected: Item[]) => {
            if (!canManage) throw new Error("Your role does not allow editing items.")
            const results = await Promise.allSettled(
                selected.map((item) => updateItem(item.itemId, { isActive: false })),
            )
            const failed = selected.filter((_, index) => results[index].status === "rejected")
            for (const result of results) if (result.status === "fulfilled") cacheItem(result.value)
            setDeactivatingItems(failed)
            void client.invalidateQueries({ queryKey: ITEMS_QUERY_KEY })
            if (failed.length < selected.length)
                showToast({
                    type: "success",
                    title: `${selected.length - failed.length} item(s) deactivated.`,
                })
            if (failed.length) {
                void client.invalidateQueries({ queryKey: SESSION_QUERY_KEY })
                const failure = results.find((result) => result.status === "rejected")
                throw new Error(
                    `${failed.length} item(s) could not be deactivated. ${failure?.reason instanceof Error ? failure.reason.message : "Please retry."}`,
                )
            }
        },
        onError: mutationError,
    })

    const openAdd = useCallback(() => {
        setEditingItem(null)
        setFormRequested(true)
        setFormOpen(true)
    }, [])
    const openEdit = useCallback((item: Item) => {
        setEditingItem(item)
        setFormRequested(true)
        setFormOpen(true)
    }, [])
    const openDeactivate = useCallback(
        (items: Item[]) => setDeactivatingItems(items.filter((item) => item.isActive)),
        [],
    )
    const loadStatus = session.isPending
        ? "loading"
        : session.data === undefined
          ? "error"
          : !session.data
            ? "signed-out"
            : itemsQuery.data !== undefined && uomsQuery.data !== undefined
              ? "ready"
              : itemsQuery.isError || uomsQuery.isError
                ? "error"
                : "loading"
    return {
        items: itemsQuery.data ?? EMPTY_ITEMS,
        uoms: uomsQuery.data ?? EMPTY_UOMS,
        canManage,
        loadStatus,
        loadError,
        formOpen,
        setFormOpen,
        formRequested,
        editingItem,
        deactivatingItems,
        setDeactivatingItems,
        openAdd,
        openEdit,
        openDeactivate,
        isSaving: save.isPending,
        isDeactivating: deactivate.isPending,
        isFetching: session.isFetching || itemsQuery.isFetching || uomsQuery.isFetching,
        retry: () => {
            void session.refetch()
            if (session.data) {
                void itemsQuery.refetch()
                void uomsQuery.refetch()
            }
        },
        handleSave: async (values: ItemFormValues, item: Item | null) => {
            if (save.isPending) return false
            try {
                await save.mutateAsync({ values, item })
                return true
            } catch {
                return false
            }
        },
        handleDeactivate: () => {
            if (!deactivate.isPending && deactivatingItems.length)
                deactivate.mutate(deactivatingItems)
        },
    }
}
