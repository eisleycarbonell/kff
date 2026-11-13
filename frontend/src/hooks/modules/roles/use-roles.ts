"use client"

import { useCallback, useEffect } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Toast } from "@base-ui/react/toast"
import { apiRequest, ApiError } from "@/lib/api-request"
import { createDialogStore } from "@/lib/create-dialog-store"
import { getLoadStatus } from "@/lib/load-status"
import { useSession, SESSION_QUERY_KEY } from "@/hooks/use-session"
import {
    roleSchema,
    toRoleInput,
    toRoleUpdate,
    type Role,
    type RoleInput,
    type RoleUpdateInput,
    type RoleFormValues,
} from "@/components/modules/roles/role.schema"

export const ROLES_QUERY_KEY = ["roles"] as const
const EMPTY_ROLES: Role[] = []
function parseRole(data: unknown) {
    const result = roleSchema.safeParse(data)
    if (!result.success) throw new Error("The role API returned an invalid role.")
    return result.data
}
export async function getRoles(signal?: AbortSignal): Promise<Role[]> {
    const result = roleSchema.array().safeParse(await apiRequest("/roles", { signal }))
    if (!result.success) throw new Error("The role API returned invalid roles.")
    return result.data
}
export async function createRole(input: RoleInput) {
    return parseRole(await apiRequest("/roles", { method: "POST", body: JSON.stringify(input) }))
}
export async function updateRole(id: number, input: RoleUpdateInput) {
    return parseRole(
        await apiRequest(`/roles/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    )
}
export async function deleteRole(id: number) {
    await apiRequest(`/roles/${id}`, { method: "DELETE" }, true)
}
const useDialogs = createDialogStore<Role>()

export function useRoles() {
    const session = useSession()
    const client = useQueryClient()
    const { add: showToast } = Toast.useToastManager()
    const canManage = session.data?.permissions.canManageUsers === true
    const queryKey = [...ROLES_QUERY_KEY, session.data?.userId]
    const query = useQuery({
        queryKey,
        queryFn: ({ signal }) => getRoles(signal),
        enabled: canManage,
    })
    const { formOpen, setFormOpen, formRequested, editing: editingRole, target: deletingRole,
        setTarget: setDeletingRole, openForm } = useDialogs()
    const loadError = query.error ?? session.error
    useEffect(() => {
        if (loadError instanceof ApiError && loadError.status === 403)
            void client.invalidateQueries({ queryKey: SESSION_QUERY_KEY })
    }, [loadError, client])
    function refreshAccess() {
        for (const key of [ROLES_QUERY_KEY, ["user-role-options"], ["users"], SESSION_QUERY_KEY])
            void client.invalidateQueries({ queryKey: key })
    }
    function failed(error: Error) {
        if (error instanceof ApiError && error.status === 403)
            void client.invalidateQueries({ queryKey: SESSION_QUERY_KEY })
        showToast({ type: "error", title: "Unable to change role", description: error.message })
    }
    const save = useMutation({
        mutationFn: ({ values, role }: { values: RoleFormValues; role: Role | null }) => {
            if (!canManage) throw new Error("Your role does not allow managing roles.")
            return role
                ? updateRole(role.roleId, toRoleUpdate(values, role))
                : createRole(toRoleInput(values))
        },
        onSuccess: (role) => {
            client.setQueryData<Role[]>(queryKey, (current) =>
                current?.some((row) => row.roleId === role.roleId)
                    ? current.map((row) => (row.roleId === role.roleId ? role : row))
                    : current
                        ? [...current, role]
                        : current,
            )
            refreshAccess()
            showToast({ type: "success", title: "Role saved." })
        },
        onError: failed,
    })
    const remove = useMutation({
        mutationFn: async (role: Role) => {
            if (!canManage) throw new Error("Your role does not allow managing roles.")
            await deleteRole(role.roleId)
            return role.roleId
        },
        onSuccess: (id) => {
            client.setQueryData<Role[]>(queryKey, (current) =>
                current?.filter((role) => role.roleId !== id),
            )
            setDeletingRole(null)
            refreshAccess()
            showToast({ type: "success", title: "Role deleted." })
        },
        onError: failed,
    })
    const { reset: resetSave } = save
    const { reset: resetDelete } = remove
    const openAdd = useCallback(() => {
        resetSave()
        openForm()
    }, [resetSave, openForm])
    const openEdit = useCallback(
        (role: Role) => {
            resetSave()
            openForm(role)
        },
        [resetSave, openForm],
    )
    const openDelete = useCallback(
        (role: Role) => {
            resetDelete()
            setDeletingRole(role)
        },
        [resetDelete, setDeletingRole],
    )
    const loadStatus = getLoadStatus(session, [query], canManage)
    return {
        roles: query.data ?? EMPTY_ROLES,
        canManage,
        loadStatus,
        loadError,
        formOpen,
        setFormOpen,
        formRequested,
        editingRole,
        openAdd,
        openEdit,
        deletingRole,
        setDeletingRole,
        openDelete,
        isSaving: save.isPending,
        isDeleting: remove.isPending,
        saveError: save.error,
        deleteError: remove.error,
        isFetching: query.isFetching || session.isFetching,
        retry: () => {
            void session.refetch()
            if (canManage) void query.refetch()
        },
        handleSave: async (values: RoleFormValues, role: Role | null) => {
            if (save.isPending) return false
            try {
                await save.mutateAsync({ values, role })
                return true
            } catch {
                return false
            }
        },
        handleDelete: () => {
            if (deletingRole && !remove.isPending) remove.mutate(deletingRole)
        },
    }
}
