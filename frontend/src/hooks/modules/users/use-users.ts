"use client"

import { useCallback, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import type {
    CreateUserInput,
    UpdateUserInput,
    User,
    UserFormValues,
    UserWriteInput,
} from "@/components/modules/users/user.schema"

const API_BASE_URL = (
    process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001/api"
).replace(/\/+$/, "")

export const USERS_ENDPOINT = `${API_BASE_URL}/user`

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value)
}

async function request(
    path: string,
    options: RequestInit,
    allowEmpty = false,
): Promise<unknown> {
    let response: Response
    try {
        response = await fetch(`${USERS_ENDPOINT}${path}`, {
            ...options,
            credentials: "include",
            headers: {
                Accept: "application/json",
                ...(options.body ? { "Content-Type": "application/json" } : {}),
            },
        })
        console.log('response', response)
    } catch (cause) {
        if (
            options.signal?.aborted ||
            (cause instanceof Error && cause.name === "AbortError")
        ) {
            throw cause
        }
        throw new Error("Unable to reach the user API. Check your connection and try again.")
    }

    if (response.ok && response.status === 204 && allowEmpty) return

    let payload: unknown
    try {
        payload = await response.json()
    } catch (cause) {
        if (
            options.signal?.aborted ||
            (cause instanceof Error && cause.name === "AbortError")
        ) {
            throw cause
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

function isPositiveId(value: unknown): value is number {
    return typeof value === "number" && Number.isSafeInteger(value) && value > 0
}

function isDateOnly(value: unknown): value is string {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
    const date = new Date(`${value}T00:00:00.000Z`)
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function isTimestamp(value: unknown): value is string {
    return (
        typeof value === "string" &&
        /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(value) &&
        isDateOnly(value.slice(0, 10)) &&
        Number.isFinite(new Date(value).getTime())
    )
}

function parseUser(value: unknown): User {
    if (
        !isRecord(value)
        // ||
        // !isPositiveId(value.userId) ||
        // !isPositiveId(value.roleId) ||
        // typeof value.isEmailVerified !== "boolean" ||
        // !["firstName", "lastName", "email"].every((field) => typeof value[field] === "string") ||
        // !["middleName", "avatarUrl", "mobileNumber", "address"].every(
        //     (field) => value[field] === null || typeof value[field] === "string",
        // ) ||
        // (value.dateOfBirth !== null && !isDateOnly(value.dateOfBirth)) ||
        // !["createdBy", "updatedBy"].every(
        //     (field) => value[field] === null || isPositiveId(value[field]),
        // ) ||
        // !["createdAt", "updatedAt"].every((field) => isTimestamp(value[field])) ||
        // !["lastLoginAt", "deletedAt"].every(
        //     (field) => value[field] === null || isTimestamp(value[field]),
        // )
    ) {
        throw new Error("The user API returned an invalid user record.")
    }

    const user = value as User
    return {
        userId: user.userId,
        firstName: user.firstName,
        middleName: user.middleName,
        lastName: user.lastName,
        dateOfBirth: user.dateOfBirth,
        avatarUrl: user.avatarUrl,
        mobileNumber: user.mobileNumber,
        address: user.address,
        email: user.email,
        roleId: user.roleId,
        isEmailVerified: user.isEmailVerified,
        lastLoginAt: user.lastLoginAt,
        deletedAt: user.deletedAt,
        createdBy: user.createdBy,
        createdAt: user.createdAt,
        updatedBy: user.updatedBy,
        updatedAt: user.updatedAt,
    }
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
    const usersQuery = useQuery({
        queryKey: USERS_QUERY_KEY,
        queryFn: ({ signal }) => getUsers(signal),
    })
    const users = usersQuery.data ?? EMPTY_USERS
    const [mutationError, setMutationError] = useState<string | null>(null)
    const [dismissedQueryError, setDismissedQueryError] = useState<Error | null>(null)
    const [notice, setNotice] = useState<string | null>(null)
    const [formOpen, setFormOpen] = useState(false)
    const [formRequested, setFormRequested] = useState(false)
    const [editingUser, setEditingUser] = useState<User | null>(null)
    const [deletingUsers, setDeletingUsers] = useState<User[]>([])

    const saveMutation = useMutation({
        mutationFn: ({ values, userId }: { values: UserFormValues; userId?: number }) => {
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
        onSuccess: (savedUser) => {
            queryClient.setQueryData<User[]>(USERS_QUERY_KEY, (current = []) =>
                current.some((user) => user.userId === savedUser.userId)
                    ? current.map((user) => user.userId === savedUser.userId ? savedUser : user)
                    : [...current, savedUser],
            )
            void queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY })
        },
    })

    const deleteMutation = useMutation({
        mutationFn: (selectedUsers: User[]) =>
            Promise.allSettled(selectedUsers.map((user) => deleteUser(user.userId))),
    })

    // Keep cached rows visible when a background refetch fails.
    const loadStatus = usersQuery.data !== undefined
        ? "ready"
        : usersQuery.isError ? "error" : "loading"
    const queryError = usersQuery.error !== dismissedQueryError ? usersQuery.error?.message : null
    const error = mutationError ?? (!formOpen && !deletingUsers.length ? queryError : null)

    const openAdd = useCallback(() => {
        setFormRequested(true)
        setEditingUser(null)
        setFormOpen(true)
        setMutationError(null)
    }, [])
    const openEdit = useCallback((user: User) => {
        setFormRequested(true)
        setEditingUser(user)
        setFormOpen(true)
        setMutationError(null)
    }, [])
    const openDelete = useCallback((selectedUsers: User[]) => {
        setDeletingUsers(selectedUsers)
        setMutationError(null)
    }, [])

    async function handleSave(values: UserFormValues, user: User | null): Promise<boolean> {
        if (saveMutation.isPending) return false
        setMutationError(null)
        try {
            await saveMutation.mutateAsync({ values, userId: user?.userId })
            setNotice(user ? "User details updated." : "User added.")
            return true
        } catch (cause) {
            setMutationError(cause instanceof Error ? cause.message : "Unable to save this user.")
            return false
        }
    }

    async function handleDelete() {
        if (deleteMutation.isPending || !deletingUsers.length) return
        setMutationError(null)
        const selectedUsers = deletingUsers
        try {
            const results = await deleteMutation.mutateAsync(selectedUsers)
            const deletedIds = new Set(selectedUsers
                .filter((_, index) => results[index].status === "fulfilled")
                .map((user) => user.userId))
            const failedUsers = selectedUsers.filter((user) => !deletedIds.has(user.userId))

            queryClient.setQueryData<User[]>(USERS_QUERY_KEY, (current = []) =>
                current.filter((user) => !deletedIds.has(user.userId)),
            )
            void queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY })
            setDeletingUsers(failedUsers)

            if (deletedIds.size) {
                setNotice(`${deletedIds.size === 1 ? "User" : `${deletedIds.size} users`} deleted.`)
            }
            if (failedUsers.length) {
                const failure = results.find((result) => result.status === "rejected")
                const message = failure?.reason instanceof Error ? failure.reason.message : "Please try again."
                setMutationError(`${failedUsers.length} user(s) could not be deleted. ${message}`)
            }
        } catch (cause) {
            setMutationError(cause instanceof Error ? cause.message : "Unable to delete users.")
        }
    }

    function retry() {
        setMutationError(null)
        setDismissedQueryError(null)
        void usersQuery.refetch()
    }

    return {
        users,
        loadStatus,
        error,
        notice,
        formOpen,
        formRequested,
        editingUser,
        deletingUsers,
        setFormOpen,
        setDeletingUsers,
        dismissError: () => {
            setMutationError(null)
            setDismissedQueryError(usersQuery.error)
        },
        dismissNotice: () => setNotice(null),
        openAdd,
        openEdit,
        openDelete,
        handleSave,
        handleDelete,
        retry,
        isSaving: saveMutation.isPending,
        isDeleting: deleteMutation.isPending,
    }
}
