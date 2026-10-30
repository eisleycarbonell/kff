"use client"

import { useCallback, useEffect, useState } from "react"
import { z } from "zod"
import { apiRequest } from "@/lib/api-request"
import { useSession, SESSION_QUERY_KEY } from "@/hooks/use-session"
import { Toast } from "@base-ui/react/toast"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import {
    userSchema,
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
    const { error: loadError, refetch } = usersQuery

    useEffect(() => {
        if (!loadError) return
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
                },
            },
        })
        return () => closeToast(id)
    }, [loadError, refetch, showToast, closeToast, queryClient])

    const users = usersQuery.data ?? EMPTY_USERS
    const [formOpen, setFormOpen] = useState(false)
    const [formRequested, setFormRequested] = useState(false)
    const [editingUser, setEditingUser] = useState<User | null>(null)
    const [deletingUsers, setDeletingUsers] = useState<User[]>([])

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
            showToast({
                type: "success",
                title: userId === undefined ? "User added." : "User details updated.",
            })
        },
        onError: (error) =>
            showToast({
                type: "error",
                title: "Unable to save user",
                description: error.message,
            }),
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
            setDeletingUsers(failedUsers)

            if (deletedIds.size) {
                queryClient.setQueryData<User[]>(queryKey, (current = []) =>
                    current.filter((user) => !deletedIds.has(user.userId)),
                )
                void queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY })
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
    const { mutate: removeUsers, isPending: isDeleting, reset: resetDelete } = remove

    // Keep cached rows visible when a background refetch fails.
    const loadStatus = session.isPending
        ? "loading"
        : session.data === undefined
          ? "error"
          : !session.data
            ? "signed-out"
            : !canManage
              ? "forbidden"
              : usersQuery.data !== undefined
                ? "ready"
                : usersQuery.isError
                  ? "error"
                  : "loading"

    const openAdd = useCallback(() => {
        resetSave()
        setFormRequested(true)
        setEditingUser(null)
        setFormOpen(true)
    }, [resetSave])

    const openEdit = useCallback((user: User) => {
        resetSave()
        setFormRequested(true)
        setEditingUser(user)
        setFormOpen(true)
    }, [resetSave])

    const openDelete = useCallback((selectedUsers: User[]) => {
        resetDelete()
        setDeletingUsers(selectedUsers)
    }, [resetDelete])

    const handleSave = useCallback(
        async (values: UserFormValues, user: User | null): Promise<boolean> => {
            if (isSaving) return false
            try {
                await saveUser({ values, userId: user?.userId })
                return true
            } catch {
                // onError shows the toast; keep the form open with its current values.
                return false
            }
        },
        [isSaving, saveUser],
    )

    const handleDelete = useCallback(() => {
        if (!isDeleting && deletingUsers.length) {
            removeUsers(deletingUsers)
        }
    }, [isDeleting, deletingUsers, removeUsers])

    const retry = useCallback(() => {
        void session.refetch()
        if (canManage) void refetch()
    }, [session, canManage, refetch])

    return {
        users,
        canManage,
        loadStatus,
        formOpen,
        formRequested,
        editingUser,
        deletingUsers,
        setFormOpen,
        setDeletingUsers,
        openAdd,
        openEdit,
        openDelete,
        handleSave,
        handleDelete,
        retry,
        isFetching: session.isFetching || usersQuery.isFetching,
        isSaving,
        isDeleting,
    }
}
