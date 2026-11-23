"use client"

import { create } from "zustand"

export type NotifyTargetMode = "auto" | "custom" | "none"

type NotifyTargetState = {
    mode: NotifyTargetMode
    selectedRoleIds: number[]
    note: string
    clearNoteAfterSend: boolean
    socketId: string | null
    setMode: (mode: NotifyTargetMode) => void
    toggleRoleId: (roleId: number) => void
    setSelectedRoleIds: (roleIds: number[]) => void
    setNote: (note: string) => void
    setClearNoteAfterSend: (value: boolean) => void
    setSocketId: (socketId: string | null) => void
    clearNote: () => void
    resetToAuto: () => void
}

export const useNotifyTargetStore = create<NotifyTargetState>((set) => ({
    mode: "auto",
    selectedRoleIds: [],
    note: "",
    clearNoteAfterSend: true,
    socketId: null,
    setMode: (mode) =>
        set((state) => ({
            mode,
            selectedRoleIds: mode === "none" ? [] : state.selectedRoleIds,
        })),
    toggleRoleId: (roleId) =>
        set((state) => {
            const exists = state.selectedRoleIds.includes(roleId)
            const nextIds = exists
                ? state.selectedRoleIds.filter((id) => id !== roleId)
                : [...state.selectedRoleIds, roleId]
            return {
                selectedRoleIds: nextIds,
                mode: nextIds.length > 0 ? "custom" : "auto",
            }
        }),
    setSelectedRoleIds: (roleIds) =>
        set({
            selectedRoleIds: [...new Set(roleIds)],
            mode: roleIds.length > 0 ? "custom" : "auto",
        }),
    setNote: (note) => set({ note: note.slice(0, 300) }),
    setClearNoteAfterSend: (clearNoteAfterSend) => set({ clearNoteAfterSend }),
    setSocketId: (socketId) => set({ socketId }),
    clearNote: () => set({ note: "" }),
    resetToAuto: () => set({ mode: "auto", selectedRoleIds: [], note: "" }),
}))
