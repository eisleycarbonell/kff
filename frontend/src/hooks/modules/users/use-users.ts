"use client"

import { useCallback, useEffect, useRef } from "react"
import { z } from "zod"
import { apiRequest, ApiError } from "@/lib/api-request"
import { createDialogStore } from "@/lib/create-dialog-store"
import { getLoadStatus } from "@/lib/load-status"
import { useSession, SESSION_QUERY_KEY } from "@/hooks/use-session"
import { Toast } from "@base-ui/react/toast"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import {
    userSchema,
    userRoleSchema,
    type UserRole,
    type CreateUserInput,
    type UpdateUserInput,
    type User,
    type UserFormValues,
    type UserWriteInput,
} from "@/components/modules/users/user.schema"

const USERS_PATH = "/user"

/** Parse a response with its schema so malformed records never reach components or the cache. */
function parse<T>(schema: z.ZodType<T>, data: unknown): T {
    const result = schema.safeParse(data)
    if (!result.success) throw new Error("The user API returned an invalid user record.")
    return result.data
}

export async function getUsers(signal?: AbortSignal): Promise<User[]> {
    return parse(userSchema.array(), await apiRequest(USERS_PATH, { method: "GET", signal }))
}
export async function getUserRoleOptions(signal?: AbortSignal): Promise<UserRole[]> {
    return parse(userRoleSchema.array(), await apiRequest("/roles", { signal }))
}

export async function createUser(input: CreateUserInput): Promise<User> {
    return parse(
        userSchema,
        await apiRequest(USERS_PATH, { method: "POST", body: JSON.stringify(input) }),
    )
}

export async function updateUser(userId: number, input: UpdateUserInput): Promise<User> {
    return parse(
        userSchema,
        await apiRequest(`${USERS_PATH}/${userId}`, {
            method: "PATCH",
            body: JSON.stringify(input),
        }),
    )
}

export async function deleteUser(userId: number): Promise<void> {
    await apiRequest(`${USERS_PATH}/${userId}`, { method: "DELETE" }, true)
}

export const USERS_QUERY_KEY = ["users"] as const
const EMPTY_USERS: User[] = []
const EMPTY_ROLES: UserRole[] = []
/** Form, edit, and delete-confirmation state for the users page. */
const useUserDialogs = createDialogStore<User, User[]>()

export function useUsers() {
    const queryClient = useQueryClient()
    const session = useSession()
    const canManage = session.data?.permissions.canManageUsers === true
    const { add: showToast, close: closeToast } = Toast.useToastManager()
    const queryKey = [...USERS_QUERY_KEY, session.data?.userId]
    const usersQuery = useQuery({
        queryKey,
        enabled: canManage,
        queryFn: ({ signal }) => getUsers(signal),
    })
    const rolesQuery = useQuery({
        queryKey: ["user-role-options", session.data?.userId],
        enabled: canManage,
        queryFn: ({ signal }) => getUserRoleOptions(signal),
    })
    const { refetch } = usersQuery
    const { refetch: refetchRoles } = rolesQuery
    const { refetch: refetchSession } = session
    const writePending = useRef(false)
    const loadError = usersQuery.error ?? rolesQuery.error ?? session.error

    useEffect(() => {
        if (!loadError) return
        if (loadError instanceof ApiError && loadError.status === 403)
            void queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY })
        const id = "users-load-error"
        showToast({
            id,
            type: "error",
            title: "Unable to load users",
            description: loadError.message,
            timeout: 0,
            actionProps: {
                children: "Retry",
                onClick: () => {
                    closeToast(id)
                    void refetch()
                    void refetchRoles()
                    void refetchSession()
                },
            },
        })
        return () => closeToast(id)
    }, [loadError, refetch, refetchRoles, refetchSession, showToast, closeToast, queryClient])

    const users = usersQuery.data ?? EMPTY_USERS
    const {
        formOpen,
        formRequested,
        editing,
        target,
        getState,
        openForm,
        setFormOpen,
        setTarget,
    } = useUserDialogs()
    const deletingUsers = target ?? EMPTY_USERS

    const save = useMutation({
        mutationFn: ({ values, userId }: { values: UserFormValues; userId?: number }) => {
            if (!canManage) throw new Error("Your role does not allow managing users.")
            const input: UserWriteInput = {
                firstName: values.firstName.trim(),
                lastName: values.lastName.trim(),
                email: values.email.trim().toLowerCase(),
                mobileNumber: values.mobileNumber.trim() || null,
                roleId: values.roleId,
                isEmailVerified: values.isEmailVerified,
            }
            return userId === undefined
                ? createUser({ ...input, password: values.password })
                : updateUser(userId, input)
        },
        onSuccess: (savedUser, { userId }) => {
            queryClient.setQueryData<User[]>(queryKey, (current = []) =>
                current.some((user) => user.userId === savedUser.userId)
                    ? current.map((user) => (user.userId === savedUser.userId ? savedUser : user))
                    : [...current, savedUser],
            )
            void queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY })
            void queryClient.invalidateQueries({ queryKey: ["roles"] })
            void queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY })
            showToast({
                type: "success",
                title: userId === undefined ? "User added." : "User details updated.",
            })
        },
        onError: (error) => {
            if (error instanceof ApiError && error.status === 403)
                void queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY })
            showToast({
                type: "error",
                title: "Unable to save user",
                description: error.message,
            })
        },
    })
    const { mutateAsync: saveUser, isPending: isSaving, reset: resetSave } = save

    const remove = useMutation({
        mutationFn: async (selectedUsers: User[]) => {
            if (!canManage) throw new Error("Your role does not allow managing users.")
            const results = await Promise.allSettled(
                selectedUsers.map((user) => deleteUser(user.userId)),
            )
            const deletedIds = new Set(
                selectedUsers
                    .filter((_, index) => results[index].status === "fulfilled")
                    .map((user) => user.userId),
            )
            const failedUsers = selectedUsers.filter((user) => !deletedIds.has(user.userId))
            setTarget(failedUsers)

            if (deletedIds.size) {
                queryClient.setQueryData<User[]>(queryKey, (current = []) =>
                    current.filter((user) => !deletedIds.has(user.userId)),
                )
                void queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY })
                void queryClient.invalidateQueries({ queryKey: ["roles"] })
                void queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY })
                showToast({
                    type: "success",
                    title: `${deletedIds.size === 1 ? "User" : `${deletedIds.size} users`} deleted.`,
                })
            }
            if (failedUsers.length) {
                const failure = results.find((result) => result.status === "rejected")
                const message =
                    failure?.reason instanceof Error ? failure.reason.message : "Please try again."
                throw new Error(`${failedUsers.length} user(s) could not be deleted. ${message}`)
            }
        },
        onError: (error) =>
            showToast({
                type: "error",
                title: "Unable to delete users",
                description: error.message,
            }),
    })
    const { mutateAsync: removeUsers, isPending: isDeleting, reset: resetDelete } = remove

    const loadStatus = getLoadStatus(session, [usersQuery, rolesQuery], canManage)

    // Store actions and mutation resets are stable, so memoized table columns stay stable too.
    const openAdd = useCallback(() => {
        if (!canManage || writePending.current) return
        resetSave()
        openForm(null)
    }, [canManage, resetSave, openForm])

    const openEdit = useCallback(
        (user: User) => {
            if (!canManage || writePending.current) return
            resetSave()
            openForm(user)
        },
        [canManage, resetSave, openForm],
    )

    const openDelete = useCallback(
        (selectedUsers: User[]) => {
            if (!canManage || writePending.current) return
            resetDelete()
            setTarget(selectedUsers)
        },
        [canManage, resetDelete, setTarget],
    )

    const handleSave = useCallback(
        async (values: UserFormValues, user: User | null): Promise<boolean> => {
            if (writePending.current) return false
            writePending.current = true
            try {
                await saveUser({ values, userId: user?.userId })
                return true
            } catch {
                // Keep failed form input intact.
                return false
            } finally {
                writePending.current = false
            }
        },
        [saveUser],
    )

    const handleDelete = useCallback(async () => {
        const selected = getState().target
        if (writePending.current || !selected?.length) return
        writePending.current = true
        try { await removeUsers(selected) }
        catch { /* Failed rows stay selected for retry. */ }
        finally { writePending.current = false }
    }, [getState, removeUsers])

    const retry = useCallback(() => {
        void refetchSession()
        if (canManage) {
            void refetch()
            void refetchRoles()
        }
    }, [refetchSession, canManage, refetch, refetchRoles])

    return {
        users,
        roles: rolesQuery.data ?? EMPTY_ROLES,
        canManage,
        loadStatus,
        formOpen,
        formRequested,
        editingUser: editing,
        deletingUsers,
        setFormOpen,
        setDeletingUsers: setTarget,
        openAdd,
        openEdit,
        openDelete,
        handleSave,
        handleDelete,
        retry,
        isFetching: session.isFetching || usersQuery.isFetching || rolesQuery.isFetching,
        isSaving,
        isDeleting,
    }
}
