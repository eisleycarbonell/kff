"use client"

import { useCallback, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Toast } from "@base-ui/react/toast"
import { apiRequest, ApiError } from "@/lib/api-request"
import { SESSION_QUERY_KEY, useSession } from "@/hooks/use-session"
import {
    brandSchema,
    toBrandInput,
    type Brand,
    type CreateBrandInput,
    type UpdateBrandInput,
    type BrandFormValues,
} from "@/components/modules/brands/brand.schema"

const BRANDS_PATH = "/brands"

function parseBrand(data: unknown): Brand {
    const result = brandSchema.safeParse(data)
    if (!result.success) throw new Error("The brand API returned an invalid brand record.")
    return result.data
}

export async function getBrands(signal?: AbortSignal): Promise<Brand[]> {
    const result = brandSchema.array().safeParse(await apiRequest(BRANDS_PATH, { signal }))
    if (!result.success) throw new Error("The brand API returned an invalid brand list.")
    return result.data
}

export async function getBrand(brandId: number, signal?: AbortSignal): Promise<Brand> {
    return parseBrand(await apiRequest(`${BRANDS_PATH}/${brandId}`, { signal }))
}

export async function createBrand(input: CreateBrandInput): Promise<Brand> {
    return parseBrand(
        await apiRequest(BRANDS_PATH, { method: "POST", body: JSON.stringify(input) }),
    )
}

export async function updateBrand(brandId: number, input: UpdateBrandInput): Promise<Brand> {
    return parseBrand(
        await apiRequest(`${BRANDS_PATH}/${brandId}`, {
            method: "PATCH",
            body: JSON.stringify(input),
        }),
    )
}

export const BRANDS_QUERY_KEY = ["brands"] as const
const EMPTY_BRANDS: Brand[] = []

export function useBrands() {
    const session = useSession()
    const client = useQueryClient()
    const { add: showToast } = Toast.useToastManager()
    const canManage = session.data?.permissions.canManageInventory === true
    const queryKey = [...BRANDS_QUERY_KEY, session.data?.userId]
    const brandsQuery = useQuery({
        queryKey,
        queryFn: ({ signal }) => getBrands(signal),
        enabled: Boolean(session.data),
    })
    const [formOpen, setFormOpen] = useState(false)
    const [formRequested, setFormRequested] = useState(false)
    const [editingBrand, setEditingBrand] = useState<Brand | null>(null)
    const [deactivatingBrand, setDeactivatingBrand] = useState<Brand | null>(null)
    // Also guard the interval before React renders the pending mutation state.
    const writePending = useRef(false)

    function cacheBrand(saved: Brand) {
        client.setQueryData<Brand[]>(queryKey, (current = []) =>
            current.some((brand) => brand.brandId === saved.brandId)
                ? current.map((brand) => (brand.brandId === saved.brandId ? saved : brand))
                : [...current, saved],
        )
        void client.invalidateQueries({ queryKey: BRANDS_QUERY_KEY })
        for (const key of [
            "items",
            "item-brands",
            "packing-formulas",
            "packing-formula-options",
            "sales-order-options",
            "delivery-order-options",
            "sales-orders",
            "delivery-orders",
        ])
            void client.invalidateQueries({ queryKey: [key] })
    }

    function mutationError(error: Error) {
        if (error instanceof ApiError && error.status === 403)
            void client.invalidateQueries({ queryKey: SESSION_QUERY_KEY })
        showToast({
            type: "error",
            title: "Unable to update brands",
            description: error.message,
        })
    }

    const save = useMutation({
        mutationFn: ({ values, brand }: { values: BrandFormValues; brand: Brand | null }) => {
            if (!canManage) throw new Error("Your role does not allow editing brands.")
            const input = toBrandInput(values)
            return brand ? updateBrand(brand.brandId, input) : createBrand(input)
        },
        onSuccess: (saved, { brand }) => {
            cacheBrand(saved)
            showToast({
                type: "success",
                title: brand ? "Brand updated." : "Brand added.",
            })
        },
        onError: mutationError,
    })

    const changeStatus = useMutation({
        mutationFn: ({ brand, isActive }: { brand: Brand; isActive: boolean }) => {
            if (!canManage) throw new Error("Your role does not allow editing brands.")
            return updateBrand(brand.brandId, { isActive })
        },
        onSuccess: (saved) => {
            cacheBrand(saved)
            setDeactivatingBrand(null)
            showToast({
                type: "success",
                title: saved.isActive ? "Brand reactivated." : "Brand deactivated.",
            })
        },
        onError: mutationError,
    })

    const { reset: resetSave, mutateAsync: saveBrand } = save
    const { reset: resetStatus, mutateAsync: changeBrandStatus } = changeStatus

    const openAdd = useCallback(() => {
        if (!canManage || writePending.current) return
        resetSave()
        setEditingBrand(null)
        setFormRequested(true)
        setFormOpen(true)
    }, [canManage, resetSave])

    const openEdit = useCallback(
        (brand: Brand) => {
            if (!canManage || writePending.current) return
            resetSave()
            setEditingBrand(brand)
            setFormRequested(true)
            setFormOpen(true)
        },
        [canManage, resetSave],
    )

    const openDeactivate = useCallback(
        (brand: Brand) => {
            if (!canManage || writePending.current) return
            resetStatus()
            setDeactivatingBrand(brand)
        },
        [canManage, resetStatus],
    )

    const handleSave = useCallback(
        async (values: BrandFormValues, brand: Brand | null) => {
            if (writePending.current) return false
            writePending.current = true
            try {
                await saveBrand({ values, brand })
                return true
            } catch {
                return false
            } finally {
                writePending.current = false
            }
        },
        [saveBrand],
    )

    const handleActivate = useCallback(
        async (brand: Brand) => {
            if (writePending.current) return false
            writePending.current = true
            try {
                await changeBrandStatus({ brand, isActive: true })
                return true
            } catch {
                return false
            } finally {
                writePending.current = false
            }
        },
        [changeBrandStatus],
    )

    const handleDeactivate = useCallback(async () => {
        if (writePending.current || !deactivatingBrand) return
        writePending.current = true
        try {
            await changeBrandStatus({ brand: deactivatingBrand, isActive: false })
        } catch {
            // Keep the confirmation open so the failed change can be retried.
        } finally {
            writePending.current = false
        }
    }, [changeBrandStatus, deactivatingBrand])

    const loadStatus = session.isPending
        ? "loading"
        : session.data === undefined
          ? "error"
          : !session.data
            ? "signed-out"
            : brandsQuery.data !== undefined
              ? "ready"
              : brandsQuery.isError
                ? "error"
                : "loading"

    return {
        brands: brandsQuery.data ?? EMPTY_BRANDS,
        canManage,
        loadStatus,
        loadError: brandsQuery.error ?? session.error,
        formOpen,
        setFormOpen,
        formRequested,
        editingBrand,
        deactivatingBrand,
        setDeactivatingBrand,
        openAdd,
        openEdit,
        openDeactivate,
        handleSave,
        handleActivate,
        handleDeactivate,
        isSaving: save.isPending,
        isDeactivating: changeStatus.isPending && changeStatus.variables?.isActive === false,
        isUpdating: save.isPending || changeStatus.isPending,
        saveError: save.error?.message ?? null,
        deactivateError: changeStatus.error?.message ?? null,
        isFetching: session.isFetching || brandsQuery.isFetching,
        retry: () => {
            void session.refetch()
            if (session.data) void brandsQuery.refetch()
        },
    }
}
