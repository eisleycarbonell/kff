"use client"

import { useState } from "react"
import { useStore } from "zustand"
import { createStore, type StateCreator } from "zustand/vanilla"
import { useShallow } from "zustand/react/shallow"
import { shallow } from "zustand/vanilla/shallow"

type Initial<T> = T | (() => T)
type Patch<T> = Partial<T> | ((state: T) => Partial<T>)
const identity = <T,>(state: T) => state

/** Define a reusable hook, not a shared store. Each mounted owner gets its own instance. */
function createScopedHook<T>(initialize: StateCreator<T>) {
    const makeStore = () => createStore<T>()(initialize)
    function useScopedStore<Selected = T>(
        selector: (state: T) => Selected = identity as (state: T) => Selected,
    ): Selected {
        const [store] = useState(makeStore)
        return useStore(store, useShallow(selector))
    }
    // A factory for non-React consumers/tests; it never exposes a module-global state instance.
    return Object.assign(useScopedStore, { createStore: makeStore })
}

export type UiState<T extends object> = T & {
    getState: () => UiState<T>
    patch: (values: Patch<T>) => void
    reset: () => void
}

/** Small page-owned view state, such as report filters. Query results never belong here. */
export function createUiStore<T extends object>(initial: Initial<T>) {
    return createScopedHook<UiState<T>>((set, get) => {
        const fresh = () => (typeof initial === "function" ? initial() : { ...initial })
        const patch = (values: Patch<T>) => {
            const current = get()
            const next = typeof values === "function" ? values(current) : values
            if (Object.keys(next).some((key) => !Object.is(current[key as keyof T], next[key as keyof T])))
                set(next as Partial<UiState<T>>)
        }
        return { ...fresh(), getState: get, patch, reset: () => patch(fresh()) }
    })
}

export type DialogValues<TRecord, Target, Extra extends object> = {
    formOpen: boolean
    formRequested: boolean
    /** A frozen edit/confirmation snapshot, never a duplicate server-data collection. */
    editing: TRecord | null
    target: Target | null
    detailId: number | null
} & Extra

export type DialogState<TRecord, Target = TRecord, Extra extends object = Record<never, never>> =
    DialogValues<TRecord, Target, Extra> & {
        getState: () => DialogState<TRecord, Target, Extra>
        openForm: (record?: TRecord | null) => void
        setFormOpen: (open: boolean) => void
        setEditing: (record: TRecord | null) => void
        setTarget: (target: Target | null) => void
        setDetailId: (id: number | null) => void
        patch: (values: Patch<DialogValues<TRecord, Target, Extra>>) => void
        reset: () => void
    }

/**
 * Declare this factory at module scope and call its returned hook once in the feature hook.
 * Store lifetime follows that hook instance: no shared singleton, persistence, provider, or
 * unmount reset. Late mutation callbacks can only update the old owner's discarded store.
 * Actions are stable and related transitions notify subscribers once. Optional selectors are
 * shallow-compared, so equal selections and no-op updates do not cause extra renders.
 */
export function createDialogStore<
    TRecord,
    TTarget = TRecord,
    TExtra extends object = Record<never, never>,
>(extra?: Initial<TExtra>) {
    type Values = DialogValues<TRecord, TTarget, TExtra>
    type State = DialogState<TRecord, TTarget, TExtra>
    return createScopedHook<State>((set, get) => {
        const fresh = () => ({
            ...(typeof extra === "function" ? extra() : extra),
            formOpen: false,
            formRequested: false,
            editing: null,
            target: null,
            detailId: null,
        }) as Values
        const patch = (values: Patch<Values>) => {
            const current = get()
            const next = typeof values === "function" ? values(current) : values
            if (Object.keys(next).some((key) => !Object.is(current[key as keyof Values], next[key as keyof Values])))
                set(next as Partial<State>)
        }
        return {
            ...fresh(),
            getState: get,
            openForm: (record = null) => patch({ editing: record, formOpen: true, formRequested: true } as Partial<Values>),
            setFormOpen: (open) => patch({ formOpen: open, ...(open ? { formRequested: true } : {}) } as Partial<Values>),
            setEditing: (editing) => patch({ editing } as Partial<Values>),
            setTarget: (target) => {
                // Bulk-selection dialogs frequently receive the same rows in a new array.
                if (!shallow(get().target, target)) patch({ target } as Partial<Values>)
            },
            setDetailId: (detailId) => patch({ detailId } as Partial<Values>),
            patch,
            reset: () => patch(fresh()),
        }
    })
}
