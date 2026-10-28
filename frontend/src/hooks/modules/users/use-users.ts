"use client"

import { useCallback, useEffect, useState } from "react"
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

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001/api").replace(
    /\/+$/,
    "",
)

export const USERS_ENDPOINT = `${API_BASE_URL}/user`

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value)
}

async function request(path: string, options: RequestInit, allowEmpty = false): Promise<unknown> {
    let response: Response | undefined
    let payload: unknown
    try {
        response = await fetch(`${USERS_ENDPOINT}${path}`, {
            ...options,
            credentials: "include",
            headers: {
                Accept: "application/json",
                ...(options.body ? { "Content-Type": "application/json" } : {}),
            },
        })
        if (response.ok && response.status === 204 && allowEmpty) return
        payload = await response.json()
    } catch (cause) {
        if (options.signal?.aborted || (cause instanceof Error && cause.name === "AbortError")) {
            throw cause
        }
        if (!response) {
            throw new Error("Unable to reach the user API. Check your connection and try again.")
        }
        throw new Error(
            response.ok
                ? "The user API returned invalid JSON."
                : `The user API request failed (HTTP ${response.status}).`,
        )
    }

    if (!response.ok || !isRecord(payload) || payload.success !== true) {
        const message =
            isRecord(payload) &&
            isRecord(payload.error) &&
            typeof payload.error.message === "string"
                ? payload.error.message.trim()
                : ""
        throw new Error(
            message ||
                (response.ok
                    ? "The user API returned an invalid response."
                    : `The user API request failed (HTTP ${response.status}).`),
        )
    }

    if (allowEmpty) return
    if (!("data" in payload) || payload.data === null || payload.data === undefined) {
        throw new Error("The user API returned an invalid response: user data is missing.")
    }
    return payload.data
}

function parseUser(value: unknown): User {
    const result = userSchema.safeParse(value)
    if (!result.success) {
        throw new Error("The user API returned an invalid user record.")
    }
    return result.data
}

export async function getUsers(signal?: AbortSignal): Promise<User[]> {
    const data = await request("", { method: "GET", signal })
    if (!Array.isArray(data)) {
        throw new Error("The user API returned an invalid response: expected a list of users.")
    }
    return data.map(parseUser)
}

export async function createUser(input: CreateUserInput): Promise<User> {
    const data = await request("", {
        method: "POST",
        body: JSON.stringify(input),
    })
    return parseUser(data)
}

export async function updateUser(userId: number, input: UpdateUserInput): Promise<User> {
    const data = await request(`/${userId}`, {
        method: "PATCH",
        body: JSON.stringify(input),
    })
    return parseUser(data)
}

export async function deleteUser(userId: number): Promise<void> {
    await request(`/${userId}`, { method: "DELETE" }, true)
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
