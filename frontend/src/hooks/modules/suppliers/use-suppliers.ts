"use client"

import { useCallback, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Toast } from "@base-ui/react/toast"
import { apiRequest, ApiError } from "@/lib/api-request"
import { SESSION_QUERY_KEY, useSession } from "@/hooks/use-session"
import {
    supplierSchema,
    supplierItemSchema,
    supplierOptionsSchema,
    toSupplierInput,
    toSupplierItemInput,
    type Supplier,
    type SupplierItem,
    type SupplierOptions,
    type CreateSupplierInput,
    type UpdateSupplierInput,
    type CreateSupplierItemInput,
    type UpdateSupplierItemInput,
    type SupplierFormValues,
    type SupplierItemFormValues,
} from "@/components/modules/suppliers/supplier.schema"

function parseSupplier(data: unknown): Supplier {
    const result = supplierSchema.safeParse(data)
    if (!result.success) throw new Error("The supplier API returned an invalid supplier record.")
    return result.data
}
function parseSupplierItem(data: unknown): SupplierItem {
    const result = supplierItemSchema.safeParse(data)
    if (!result.success)
        throw new Error("The supplier API returned an invalid supplier item record.")
    return result.data
}
export async function getSuppliers(signal?: AbortSignal): Promise<Supplier[]> {
    const data = await apiRequest("/suppliers", { signal })
    if (!Array.isArray(data)) throw new Error("The supplier API returned an invalid supplier list.")
    return data.map(parseSupplier)
}
export async function getSupplier(supplierId: number, signal?: AbortSignal): Promise<Supplier> {
    return parseSupplier(await apiRequest(`/suppliers/${supplierId}`, { signal }))
}
export async function getSupplierOptions(signal?: AbortSignal): Promise<SupplierOptions> {
    const result = supplierOptionsSchema.safeParse(
        await apiRequest("/suppliers/options", { signal }),
    )
    if (!result.success) throw new Error("The supplier API returned invalid item and unit options.")
    return result.data
}
export async function createSupplier(input: CreateSupplierInput): Promise<Supplier> {
    return parseSupplier(
        await apiRequest("/suppliers", { method: "POST", body: JSON.stringify(input) }),
    )
}
export async function updateSupplier(
    supplierId: number,
    input: UpdateSupplierInput,
): Promise<Supplier> {
    return parseSupplier(
        await apiRequest(`/suppliers/${supplierId}`, {
            method: "PATCH",
            body: JSON.stringify(input),
        }),
    )
}
export async function getSupplierItems(
    supplierId: number,
    signal?: AbortSignal,
): Promise<SupplierItem[]> {
    const data = await apiRequest(`/suppliers/${supplierId}/items`, { signal })
    if (!Array.isArray(data))
        throw new Error("The supplier API returned an invalid supplier item list.")
    return data.map(parseSupplierItem)
}
export async function createSupplierItem(
    supplierId: number,
    input: CreateSupplierItemInput,
): Promise<SupplierItem> {
    return parseSupplierItem(
        await apiRequest(`/suppliers/${supplierId}/items`, {
            method: "POST",
            body: JSON.stringify(input),
        }),
    )
}
export async function updateSupplierItem(
    supplierId: number,
    supplierItemId: number,
    input: UpdateSupplierItemInput,
): Promise<SupplierItem> {
    return parseSupplierItem(
        await apiRequest(`/suppliers/${supplierId}/items/${supplierItemId}`, {
            method: "PATCH",
            body: JSON.stringify(input),
        }),
    )
}

export const SUPPLIERS_QUERY_KEY = ["suppliers"] as const
export const SUPPLIER_ITEMS_QUERY_KEY = ["supplier-items"] as const
const EMPTY_SUPPLIERS: Supplier[] = []
const EMPTY_ITEMS: SupplierItem[] = []
const EMPTY_OPTIONS: SupplierOptions = { items: [], uoms: [] }

export function useSuppliers() {
    const session = useSession()
    const client = useQueryClient()
    const { add: showToast } = Toast.useToastManager()
    const canManage = session.data?.permissions.canManagePurchasing === true
    const queryKey = [...SUPPLIERS_QUERY_KEY, session.data?.userId]
    const suppliersQuery = useQuery({
        queryKey,
        queryFn: ({ signal }) => getSuppliers(signal),
        enabled: Boolean(session.data),
    })
    const [formOpen, setFormOpen] = useState(false)
    const [formRequested, setFormRequested] = useState(false)
    const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
    const [deactivatingSupplier, setDeactivatingSupplier] = useState<Supplier | null>(null)
    const loadError = suppliersQuery.error ?? session.error

    function cacheSupplier(saved: Supplier) {
        client.setQueryData<Supplier[]>(queryKey, (current = []) =>
            current.some((supplier) => supplier.supplierId === saved.supplierId)
                ? current.map((supplier) =>
                      supplier.supplierId === saved.supplierId ? saved : supplier,
                  )
                : [...current, saved],
        )
        if (!saved.isActive)
            client.setQueriesData<SupplierItem[]>(
                { queryKey: [...SUPPLIER_ITEMS_QUERY_KEY, saved.supplierId] },
                (current) =>
                    current?.map((item) => ({ ...item, isActive: false, isPreferred: false })),
            )
        void client.invalidateQueries({ queryKey: SUPPLIERS_QUERY_KEY })
        void client.invalidateQueries({ queryKey: [...SUPPLIER_ITEMS_QUERY_KEY, saved.supplierId] })
    }
    function mutationError(error: Error) {
        if (error instanceof ApiError && error.status === 403)
            void client.invalidateQueries({ queryKey: SESSION_QUERY_KEY })
        showToast({
            type: "error",
            title: "Unable to update suppliers",
            description: error.message,
        })
    }
    const save = useMutation({
        mutationFn: ({
            values,
            supplier,
        }: {
            values: SupplierFormValues
            supplier: Supplier | null
        }) => {
            if (!canManage) throw new Error("Your role does not allow editing suppliers.")
            const input = toSupplierInput(values)
            return supplier ? updateSupplier(supplier.supplierId, input) : createSupplier(input)
        },
        onSuccess: (saved, { supplier }) => {
            cacheSupplier(saved)
            showToast({
                type: "success",
                title: supplier ? "Supplier updated." : "Supplier added.",
            })
        },
        onError: mutationError,
    })
    const deactivate = useMutation({
        mutationFn: (supplier: Supplier) => {
            if (!canManage) throw new Error("Your role does not allow editing suppliers.")
            return updateSupplier(supplier.supplierId, { isActive: false })
        },
        onSuccess: (saved) => {
            cacheSupplier(saved)
            setDeactivatingSupplier(null)
            showToast({ type: "success", title: "Supplier deactivated." })
        },
        onError: mutationError,
    })
    const activate = useMutation({
        mutationFn: (supplier: Supplier) => {
            if (!canManage) throw new Error("Your role does not allow editing suppliers.")
            return updateSupplier(supplier.supplierId, { isActive: true })
        },
        onSuccess: (saved) => {
            cacheSupplier(saved)
            showToast({ type: "success", title: "Supplier reactivated." })
        },
        onError: mutationError,
    })
    const { reset: resetSave } = save
    const { reset: resetDeactivate } = deactivate
    const { mutateAsync: activateSupplier, isPending: isActivating } = activate
    const handleActivate = useCallback(
        async (supplier: Supplier) => {
            if (isActivating) return false
            try {
                await activateSupplier(supplier)
                return true
            } catch {
                return false
            }
        },
        [activateSupplier, isActivating],
    )
    const openAdd = useCallback(() => {
        resetSave()
        setEditingSupplier(null)
        setFormRequested(true)
        setFormOpen(true)
    }, [resetSave])
    const openEdit = useCallback(
        (supplier: Supplier) => {
            resetSave()
            setEditingSupplier(supplier)
            setFormRequested(true)
            setFormOpen(true)
        },
        [resetSave],
    )
    const openDeactivate = useCallback(
        (supplier: Supplier) => {
            resetDeactivate()
            setDeactivatingSupplier(supplier)
        },
        [resetDeactivate],
    )
    const loadStatus = session.isPending
        ? "loading"
        : session.data === undefined
          ? "error"
          : !session.data
            ? "signed-out"
            : suppliersQuery.data !== undefined
              ? "ready"
              : suppliersQuery.isError
                ? "error"
                : "loading"
    return {
        suppliers: suppliersQuery.data ?? EMPTY_SUPPLIERS,
        canManage,
        loadStatus,
        loadError,
        formOpen,
        setFormOpen,
        formRequested,
        editingSupplier,
        deactivatingSupplier,
        setDeactivatingSupplier,
        openAdd,
        openEdit,
        openDeactivate,
        isSaving: save.isPending,
        isDeactivating: deactivate.isPending,
        isActivating,
        saveError: save.error?.message ?? null,
        deactivateError: deactivate.error?.message ?? null,
        isFetching: session.isFetching || suppliersQuery.isFetching,
        retry: () => {
            void session.refetch()
            if (session.data) void suppliersQuery.refetch()
        },
        handleSave: async (values: SupplierFormValues, supplier: Supplier | null) => {
            if (save.isPending) return false
            try {
                await save.mutateAsync({ values, supplier })
                return true
            } catch {
                return false
            }
        },
        handleDeactivate: () => {
            if (!deactivate.isPending && deactivatingSupplier)
                deactivate.mutate(deactivatingSupplier)
        },
        handleActivate,
    }
}

type SupplierItemDialogState = {
    supplierId: number | null
    scope: number
    formOpen: boolean
    formRequested: boolean
    editingItem: SupplierItem | null
    deactivatingItem: SupplierItem | null
}
const emptyItemDialog = (supplierId: number | null, scope = 0): SupplierItemDialogState => ({
    supplierId,
    scope,
    formOpen: false,
    formRequested: false,
    editingItem: null,
    deactivatingItem: null,
})

export function useSupplierItems(supplierId: number | null) {
    const session = useSession()
    const client = useQueryClient()
    const { add: showToast } = Toast.useToastManager()
    const canManage = session.data?.permissions.canManagePurchasing === true
    const queryKey = [...SUPPLIER_ITEMS_QUERY_KEY, supplierId, session.data?.userId]
    const enabled = Boolean(session.data) && supplierId !== null
    const itemsQuery = useQuery({
        queryKey,
        queryFn: ({ signal }) => getSupplierItems(supplierId!, signal),
        enabled,
    })
    const optionsQuery = useQuery({
        queryKey: ["supplier-options", session.data?.userId],
        queryFn: ({ signal }) => getSupplierOptions(signal),
        enabled,
        staleTime: 0,
    })
    const [state, setState] = useState(() => emptyItemDialog(supplierId))
    if (state.supplierId !== supplierId) setState(emptyItemDialog(supplierId, state.scope + 1))
    const loadError = itemsQuery.error ?? optionsQuery.error ?? session.error

    function mutationError(error: Error) {
        if (error instanceof ApiError && error.status === 403)
            void client.invalidateQueries({ queryKey: SESSION_QUERY_KEY })
        showToast({
            type: "error",
            title: "Unable to update supplier items",
            description: error.message,
        })
    }
    function cacheItem(saved: SupplierItem) {
        const savedKey = [...SUPPLIER_ITEMS_QUERY_KEY, saved.supplierId, session.data?.userId]
        client.setQueryData<SupplierItem[]>(savedKey, (current = []) =>
            current.some((item) => item.supplierItemId === saved.supplierItemId)
                ? current.map((item) =>
                      item.supplierItemId === saved.supplierItemId ? saved : item,
                  )
                : [...current, saved],
        )
        void client.invalidateQueries({ queryKey: SUPPLIERS_QUERY_KEY })
        void client.invalidateQueries({ queryKey: SUPPLIER_ITEMS_QUERY_KEY })
    }
    const save = useMutation({
        mutationFn: ({
            values,
            item,
            supplierId: targetId,
        }: {
            values: SupplierItemFormValues
            item: SupplierItem | null
            supplierId: number
            scope: number
        }) => {
            if (!canManage) throw new Error("Your role does not allow editing supplier items.")
            const input = toSupplierItemInput(values)
            if (!item) return createSupplierItem(targetId, input)
            return updateSupplierItem(targetId, item.supplierItemId, {
                supplierItemCode: input.supplierItemCode,
                defaultUomId: input.defaultUomId,
                defaultPrice: input.defaultPrice,
                leadTimeDays: input.leadTimeDays,
                isPreferred: input.isPreferred,
                isActive: input.isActive,
            })
        },
        onSuccess: (saved, { item }) => {
            cacheItem(saved)
            showToast({
                type: "success",
                title: item ? "Supplier item updated." : "Supplier item added.",
            })
        },
        onError: mutationError,
    })
    const deactivate = useMutation({
        mutationFn: ({
            item,
            supplierId: targetId,
        }: {
            item: SupplierItem
            supplierId: number
            scope: number
        }) => {
            if (!canManage) throw new Error("Your role does not allow editing supplier items.")
            return updateSupplierItem(targetId, item.supplierItemId, { isActive: false })
        },
        onSuccess: (saved, variables) => {
            cacheItem(saved)
            setState((current) =>
                current.scope === variables.scope
                    ? { ...current, deactivatingItem: null }
                    : current,
            )
            showToast({ type: "success", title: "Supplier item deactivated." })
        },
        onError: mutationError,
    })
    const { reset: resetSave } = save
    const { reset: resetDeactivate } = deactivate
    const setFormOpen = useCallback(
        (open: boolean) => setState((current) => ({ ...current, formOpen: open })),
        [],
    )
    const setDeactivatingItem = useCallback(
        (item: SupplierItem | null) =>
            setState((current) => ({ ...current, deactivatingItem: item })),
        [],
    )
    const openAdd = useCallback(() => {
        resetSave()
        setState((current) => ({
            ...current,
            editingItem: null,
            formOpen: true,
            formRequested: true,
        }))
    }, [resetSave])
    const openEdit = useCallback(
        (item: SupplierItem) => {
            resetSave()
            setState((current) => ({
                ...current,
                editingItem: item,
                formOpen: true,
                formRequested: true,
            }))
        },
        [resetSave],
    )
    const openDeactivate = useCallback(
        (item: SupplierItem) => {
            resetDeactivate()
            setState((current) => ({ ...current, deactivatingItem: item }))
        },
        [resetDeactivate],
    )
    const loadStatus =
        supplierId === null
            ? "ready"
            : session.isPending
              ? "loading"
              : session.data === undefined
                ? "error"
                : !session.data
                  ? "signed-out"
                  : itemsQuery.data !== undefined
                    ? "ready"
                    : itemsQuery.isError
                      ? "error"
                      : "loading"
    return {
        items: itemsQuery.data ?? EMPTY_ITEMS,
        options: optionsQuery.data ?? EMPTY_OPTIONS,
        optionsReady: optionsQuery.data !== undefined,
        canManage,
        loadStatus,
        loadError,
        formOpen: state.formOpen,
        setFormOpen,
        formRequested: state.formRequested,
        editingItem: state.editingItem,
        deactivatingItem: state.deactivatingItem,
        setDeactivatingItem,
        openAdd,
        openEdit,
        openDeactivate,
        isSaving: save.isPending,
        isDeactivating: deactivate.isPending,
        saveError: save.variables?.scope === state.scope ? (save.error?.message ?? null) : null,
        deactivateError:
            deactivate.variables?.scope === state.scope
                ? (deactivate.error?.message ?? null)
                : null,
        isFetching: session.isFetching || itemsQuery.isFetching || optionsQuery.isFetching,
        retry: () => {
            void session.refetch()
            if (enabled) {
                void itemsQuery.refetch()
                void optionsQuery.refetch()
            }
        },
        handleSave: async (values: SupplierItemFormValues, item: SupplierItem | null) => {
            if (save.isPending || supplierId === null) return false
            try {
                await save.mutateAsync({ values, item, supplierId, scope: state.scope })
                return true
            } catch {
                return false
            }
        },
        handleDeactivate: () => {
            if (!deactivate.isPending && supplierId !== null && state.deactivatingItem)
                deactivate.mutate({ item: state.deactivatingItem, supplierId, scope: state.scope })
        },
    }
}
