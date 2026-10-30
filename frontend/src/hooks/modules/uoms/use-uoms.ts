"use client"
import { useCallback, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Toast } from "@base-ui/react/toast"
import { apiRequest, ApiError } from "@/lib/api-request"
import { SESSION_QUERY_KEY, useSession } from "@/hooks/use-session"
import {
    uomSchema,
    uomClassSchema,
    uomInputSchema,
    uomClassInputSchema,
    type Uom,
    type UomClass,
    type UomInput,
    type UomFormValues,
} from "@/components/modules/uoms/uom.schema"
function parseUom(value: unknown): Uom {
    const parsed = uomSchema.safeParse(value)
    if (!parsed.success) throw new Error("The UOM API returned an invalid unit.")
    return parsed.data
}
function parseClass(value: unknown): UomClass {
    const parsed = uomClassSchema.safeParse(value)
    if (!parsed.success) throw new Error("The UOM API returned an invalid class.")
    return parsed.data
}
export async function getUoms(signal?: AbortSignal): Promise<Uom[]> {
    const data = await apiRequest("/uoms", { signal })
    if (!Array.isArray(data)) throw new Error("The UOM API returned an invalid list.")
    return data.map(parseUom)
}
export async function getUomClasses(signal?: AbortSignal): Promise<UomClass[]> {
    const data = await apiRequest("/uoms/classes", { signal })
    if (!Array.isArray(data)) throw new Error("The UOM API returned an invalid class list.")
    return data.map(parseClass)
}
export async function createUom(input: UomInput): Promise<Uom> {
    return parseUom(await apiRequest("/uoms", { method: "POST", body: JSON.stringify(input) }))
}
export async function updateUom(id: number, input: Partial<UomInput>): Promise<Uom> {
    return parseUom(
        await apiRequest("/uoms/" + id, { method: "PATCH", body: JSON.stringify(input) }),
    )
}
export async function deleteUom(id: number): Promise<void> {
    await apiRequest("/uoms/" + id, { method: "DELETE" }, true)
}
export async function createUomClass(input: { name: string }): Promise<UomClass> {
    return parseClass(
        await apiRequest("/uoms/classes", { method: "POST", body: JSON.stringify(input) }),
    )
}
export async function updateUomClass(id: number, input: { name: string }): Promise<UomClass> {
    return parseClass(
        await apiRequest("/uoms/classes/" + id, { method: "PATCH", body: JSON.stringify(input) }),
    )
}
export async function deleteUomClass(id: number): Promise<void> {
    await apiRequest("/uoms/classes/" + id, { method: "DELETE" }, true)
}
const EMPTY_UNITS: Uom[] = []
const EMPTY_CLASSES: UomClass[] = []
export function useUoms() {
    const session = useSession()
    const client = useQueryClient()
    const { add: showToast } = Toast.useToastManager()
    const queryKey = ["uoms", session.data?.userId]
    const classKey = ["uom-classes", session.data?.userId]
    const query = useQuery({
        queryKey,
        queryFn: ({ signal }) => getUoms(signal),
        enabled: Boolean(session.data),
    })
    const classesQuery = useQuery({
        queryKey: classKey,
        queryFn: ({ signal }) => getUomClasses(signal),
        enabled: Boolean(session.data),
    })
    const [formOpen, setFormOpen] = useState(false)
    const [formRequested, setFormRequested] = useState(false)
    const [editingUnit, setEditingUnit] = useState<Uom | null>(null)
    const [deletingUnit, setDeletingUnit] = useState<Uom | null>(null)
    const [classesOpen, setClassesOpen] = useState(false)
    const [deletingClass, setDeletingClass] = useState<UomClass | null>(null)
    const canManage = session.data?.permissions.canManageInventory === true
    const loadError = query.error ?? classesQuery.error ?? session.error
    function refresh() {
        for (const key of [
            "uoms",
            "uom-classes",
            "item-uoms",
            "items",
            "inventory-stocks",
            "inventory-stock-options",
        ])
            void client.invalidateQueries({ queryKey: [key] })
    }
    function mutationError(error: Error) {
        if (error instanceof ApiError && error.status === 403)
            void client.invalidateQueries({ queryKey: SESSION_QUERY_KEY })
        if (error instanceof ApiError && error.status === 409) refresh()
        showToast({
            type: "error",
            title: "Unable to update units of measure",
            description: error.message,
        })
    }
    const save = useMutation({
        mutationFn: ({ values, unit }: { values: UomFormValues; unit: Uom | null }) => {
            if (!canManage) throw new Error("Your role does not allow editing units.")
            const input = uomInputSchema.parse(values)
            return unit ? updateUom(unit.uomId, input) : createUom(input)
        },
        onSuccess: (saved, { unit }) => {
            client.setQueryData<Uom[]>(queryKey, (current = []) =>
                current.some((row) => row.uomId === saved.uomId)
                    ? current.map((row) => (row.uomId === saved.uomId ? saved : row))
                    : [...current, saved],
            )
            refresh()
            showToast({ type: "success", title: unit ? "Unit updated." : "Unit added." })
        },
        onError: mutationError,
    })
    const remove = useMutation({
        mutationFn: (unit: Uom) => {
            if (!canManage) throw new Error("Your role does not allow deleting units.")
            return deleteUom(unit.uomId)
        },
        onSuccess: (_, { uomId }) => {
            client.setQueryData<Uom[]>(queryKey, (current = []) =>
                current.filter((row) => row.uomId !== uomId),
            )
            setDeletingUnit(null)
            refresh()
            showToast({ type: "success", title: "Unit deleted." })
        },
        onError: mutationError,
    })
    const saveClass = useMutation({
        mutationFn: ({ name, group }: { name: string; group: UomClass | null }) => {
            if (!canManage) throw new Error("Your role does not allow editing unit classes.")
            const input = uomClassInputSchema.parse({ name })
            return group ? updateUomClass(group.uomClassId, input) : createUomClass(input)
        },
        onSuccess: (saved, { group }) => {
            client.setQueryData<UomClass[]>(classKey, (current = []) =>
                current.some((row) => row.uomClassId === saved.uomClassId)
                    ? current.map((row) => (row.uomClassId === saved.uomClassId ? saved : row))
                    : [...current, saved],
            )
            refresh()
            showToast({ type: "success", title: group ? "Class updated." : "Class added." })
        },
        onError: mutationError,
    })
    const removeClass = useMutation({
        mutationFn: (group: UomClass) => {
            if (!canManage) throw new Error("Your role does not allow deleting unit classes.")
            return deleteUomClass(group.uomClassId)
        },
        onSuccess: (_, { uomClassId }) => {
            client.setQueryData<UomClass[]>(classKey, (current = []) =>
                current.filter((row) => row.uomClassId !== uomClassId),
            )
            setDeletingClass(null)
            refresh()
            showToast({ type: "success", title: "Class deleted." })
        },
        onError: mutationError,
    })
    const openAdd = useCallback(() => {
        setEditingUnit(null)
        setFormRequested(true)
        setFormOpen(true)
    }, [])
    const openEdit = useCallback((unit: Uom) => {
        setEditingUnit(unit)
        setFormRequested(true)
        setFormOpen(true)
    }, [])
    const openDelete = useCallback((unit: Uom) => {
        if (!unit.isInUse && !unit.isClassAnchor) setDeletingUnit(unit)
    }, [])
    const loadStatus = session.isPending
        ? "loading"
        : session.data === undefined
          ? "error"
          : !session.data
            ? "signed-out"
            : query.data !== undefined && classesQuery.data !== undefined
              ? "ready"
              : query.isError || classesQuery.isError
                ? "error"
                : "loading"
    return {
        units: query.data ?? EMPTY_UNITS,
        classes: classesQuery.data ?? EMPTY_CLASSES,
        canManage,
        loadStatus,
        loadError,
        formOpen,
        setFormOpen,
        formRequested,
        editingUnit,
        deletingUnit,
        setDeletingUnit,
        classesOpen,
        setClassesOpen,
        deletingClass,
        setDeletingClass,
        openAdd,
        openEdit,
        openDelete,
        isSaving: save.isPending,
        isDeleting: remove.isPending,
        isSavingClass: saveClass.isPending,
        isDeletingClass: removeClass.isPending,
        isFetching: session.isFetching || query.isFetching || classesQuery.isFetching,
        retry: () => {
            void session.refetch()
            if (session.data) {
                void query.refetch()
                void classesQuery.refetch()
            }
        },
        handleSave: async (values: UomFormValues, unit: Uom | null) => {
            if (save.isPending) return false
            try {
                await save.mutateAsync({ values, unit })
                return true
            } catch {
                return false
            }
        },
        handleDelete: () => {
            if (deletingUnit && !remove.isPending) remove.mutate(deletingUnit)
        },
        handleSaveClass: async (name: string, group: UomClass | null) => {
            if (saveClass.isPending) return false
            try {
                await saveClass.mutateAsync({ name, group })
                return true
            } catch {
                return false
            }
        },
        handleDeleteClass: () => {
            if (deletingClass && !removeClass.isPending) removeClass.mutate(deletingClass)
        },
    }
}
