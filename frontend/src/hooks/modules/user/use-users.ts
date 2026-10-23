"use client"

import { useCallback, useEffect, useState } from "react"

import { createUser, readUsers, saveUsers } from "@/components/modules/users/user.api"
import type { User, UserFormValues } from "@/components/modules/users/user.schema"

export function useUsers() {
    const [users, setUsers] = useState<User[]>([])
    const [loadStatus, setLoadStatus] = useState<"loading" | "ready" | "error">("loading")
    const [attempt, setAttempt] = useState(0)
    const [error, setError] = useState<string | null>(null)
    const [notice, setNotice] = useState<string | null>(null)
    const [formOpen, setFormOpen] = useState(false)
    const [editingUser, setEditingUser] = useState<User | null>(null)
    const [deletingUsers, setDeletingUsers] = useState<User[]>([])

    useEffect(() => {
        let cancelled = false
        Promise.resolve().then(readUsers).then((savedUsers) => {
            if (!cancelled) {
                setUsers(savedUsers)
                setLoadStatus("ready")
                setError(null)
            }
        }).catch((cause: unknown) => {
            if (!cancelled) {
                setLoadStatus("error")
                setError(cause instanceof Error ? cause.message : "Unable to load users from this browser.")
            }
        })
        return () => { cancelled = true }
    }, [attempt])

    const openAdd = useCallback(() => { setEditingUser(null); setFormOpen(true); setError(null) }, [])
    const openEdit = useCallback((user: User) => { setEditingUser(user); setFormOpen(true); setError(null) }, [])
    const openDelete = useCallback((selectedUsers: User[]) => { setDeletingUsers(selectedUsers); setError(null) }, [])

    function commitUsers(nextUsers: User[], message: string) {
        try {
            saveUsers(nextUsers)
            setUsers(nextUsers)
            setError(null)
            setNotice(message)
            return true
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Unable to save users. Please try again.")
            return false
        }
    }

    function handleSave(values: UserFormValues, user: User | null) {
        const nextUsers = user ? users.map((current) => current.userId === user.userId ? { ...current, ...values } : current) : [...users, createUser(values)]
        return commitUsers(nextUsers, user ? "User details updated." : "User added.")
    }

    function handleDelete() {
        const ids = new Set(deletingUsers.map((user) => user.userId))
        if (commitUsers(users.filter((user) => !ids.has(user.userId)), `${ids.size === 1 ? "User" : `${ids.size} users`} deleted.`)) setDeletingUsers([])
    }

    function retry() {
        setLoadStatus("loading")
        setAttempt((value) => value + 1)
    }

    return {
        users,
        loadStatus,
        error,
        notice,
        formOpen,
        editingUser,
        deletingUsers,
        setFormOpen,
        setDeletingUsers,
        dismissError: () => setError(null),
        dismissNotice: () => setNotice(null),
        openAdd,
        openEdit,
        openDelete,
        handleSave,
        handleDelete,
        retry,
    }
}
