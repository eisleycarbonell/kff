import assert from "node:assert/strict"
import { test } from "node:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { createDialogStore, createUiStore } from "../src/lib/create-dialog-store.ts"
import { getLoadStatus } from "../src/lib/load-status.ts"

test("opening an edit dialog publishes one complete transition and ignores repeated actions", () => {
    const store = createDialogStore().createStore()
    const record = { itemId: 12, name: "Ground pepper" }
    const transitions = []
    const unsubscribe = store.subscribe((state) => transitions.push(state))

    store.getState().openForm(record)
    assert.equal(transitions.length, 1)
    assert.equal(transitions[0].editing, record)
    assert.equal(transitions[0].formOpen, true)
    assert.equal(transitions[0].formRequested, true)

    store.getState().openForm(record)
    store.getState().setEditing(record)
    store.getState().setFormOpen(true)
    store.getState().setDetailId(null)
    store.getState().patch({ formOpen: true, editing: record })
    assert.equal(transitions.length, 1)
    unsubscribe()
})

test("closing retains the lazy form and its edit snapshot; adding clears only the snapshot", () => {
    const store = createDialogStore().createStore()
    const record = { userId: 8, firstName: "Maria" }
    store.getState().openForm(record)
    store.getState().setFormOpen(false)
    assert.equal(store.getState().formOpen, false)
    assert.equal(store.getState().formRequested, true)
    assert.equal(store.getState().editing, record)

    store.getState().openForm()
    assert.equal(store.getState().editing, null)
    assert.equal(store.getState().formOpen, true)
    assert.equal(store.getState().formRequested, true)
})

test("equivalent bulk selections do not notify; partial failures retain only failed rows", () => {
    const store = createDialogStore().createStore()
    const first = { userId: 1 }
    const second = { userId: 2 }
    const selected = [first, second]
    let notifications = 0
    store.subscribe(() => notifications++)

    store.getState().setTarget(selected)
    store.getState().setTarget([...selected])
    assert.equal(notifications, 1)
    assert.equal(store.getState().target, selected)

    store.getState().setTarget([second])
    assert.equal(notifications, 2)
    assert.deepEqual(store.getState().target, [second])

    const refreshedSecond = { ...second, firstName: "Updated" }
    store.getState().setTarget([refreshedSecond])
    assert.equal(notifications, 3)
    assert.equal(store.getState().target[0], refreshedSecond)
})

test("an old owner's delayed mutation cannot close or replace the new owner's dialog", async () => {
    const useDialogs = createDialogStore()
    const oldOwner = useDialogs.createStore()
    const newOwner = useDialogs.createStore()
    const oldActions = oldOwner.getState()
    const currentUser = { userId: 7 }
    newOwner.getState().openForm(currentUser)
    newOwner.getState().setTarget([currentUser])

    await Promise.resolve().then(() => {
        oldActions.setTarget([{ userId: 3 }])
        oldActions.setFormOpen(false)
        oldActions.reset()
    })

    assert.equal(newOwner.getState().formOpen, true)
    assert.equal(newOwner.getState().editing, currentUser)
    assert.deepEqual(newOwner.getState().target, [currentUser])
    assert.equal(oldOwner.getState().target, null)
    assert.notEqual(oldActions.reset, newOwner.getState().reset)
})

test("refreshing stock leaves the count's original expected balance intact", () => {
    const store = createDialogStore().createStore()
    const selectedStock = Object.freeze({ lotId: 22, locationId: 3, expectedQty: "50.0000" })
    store.getState().openForm(selectedStock)

    // A successful background fetch replaces the query record, not the open count's snapshot.
    const refreshedStock = { ...selectedStock, expectedQty: "40.0000" }
    store.getState().setDetailId(refreshedStock.lotId)
    store.getState().setTarget(refreshedStock)
    assert.equal(store.getState().editing, selectedStock)
    assert.equal(store.getState().editing.expectedQty, "50.0000")
    assert.equal(store.getState().target.expectedQty, "40.0000")
})

test("reset restores fresh extra state atomically and preserves every action identity", () => {
    const useDialogs = createDialogStore(() => ({ lines: [], filter: "active" }))
    const store = useDialogs.createStore()
    const otherStore = useDialogs.createStore()
    const initial = store.getState()
    const actionNames = ["getState", "openForm", "setFormOpen", "setEditing", "setTarget", "setDetailId", "patch", "reset"]
    assert.notEqual(initial.lines, otherStore.getState().lines)

    initial.openForm({ itemId: 1 })
    initial.setTarget({ itemId: 2 })
    initial.setDetailId(3)
    initial.patch({ lines: ["draft"], filter: "all" })
    let notifications = 0
    store.subscribe(() => notifications++)
    initial.reset()

    const reset = store.getState()
    assert.equal(notifications, 1)
    assert.equal(reset.formOpen, false)
    assert.equal(reset.formRequested, false)
    assert.equal(reset.editing, null)
    assert.equal(reset.target, null)
    assert.equal(reset.detailId, null)
    assert.equal(reset.filter, "active")
    assert.deepEqual(reset.lines, [])
    assert.notEqual(reset.lines, initial.lines)
    for (const name of actionNames) assert.equal(reset[name], initial[name], name)
})

test("a functional patch reads the latest state and publishes related fields together", () => {
    const store = createDialogStore(() => ({ page: 0, filter: "" })).createStore()
    const transitions = []
    store.subscribe((state) => transitions.push([state.page, state.filter]))

    store.getState().patch(({ page }) => ({ page: page + 1, filter: "pepper" }))
    store.getState().patch(({ page }) => ({ page: page + 1, filter: "cloves" }))
    store.getState().patch(({ page, filter }) => ({ page, filter }))
    assert.deepEqual(transitions, [[1, "pepper"], [2, "cloves"]])
})

test("report view state is independent, suppresses no-op updates and resets stable actions", () => {
    const useFilters = createUiStore({ itemId: null, period: "month" })
    const store = useFilters.createStore()
    const otherStore = useFilters.createStore()
    const { patch, reset } = store.getState()
    let notifications = 0
    store.subscribe(() => notifications++)

    patch({ period: "month" })
    assert.equal(notifications, 0)
    patch({ itemId: 4, period: "year" })
    patch((current) => ({ itemId: current.itemId + 1 }))
    assert.equal(notifications, 2)
    assert.equal(store.getState().itemId, 5)
    assert.equal(otherStore.getState().itemId, null)
    assert.equal(otherStore.getState().period, "month")

    reset()
    reset()
    assert.equal(notifications, 3)
    assert.equal(store.getState().itemId, null)
    assert.equal(store.getState().period, "month")
    assert.equal(store.getState().patch, patch)
    assert.equal(store.getState().reset, reset)
})

test("view-state initializers create fresh nested values for each owner and reset", () => {
    const useFilters = createUiStore(() => ({ selectedIds: [] }))
    const store = useFilters.createStore()
    const otherStore = useFilters.createStore()
    const initialIds = store.getState().selectedIds
    assert.notEqual(initialIds, otherStore.getState().selectedIds)
    store.getState().patch({ selectedIds: [1, 2] })
    store.getState().reset()
    assert.deepEqual(store.getState().selectedIds, [])
    assert.notEqual(store.getState().selectedIds, initialIds)
})

test("the React hook isolates owners and fresh server renders from previous actions", () => {
    const useDialogs = createDialogStore()
    const owners = []
    function DialogOwner() {
        const state = useDialogs((current) => ({ open: current.formOpen, openForm: current.openForm }))
        owners.push(state)
        return createElement("span", null, state.open ? "open" : "closed")
    }

    assert.equal(
        renderToStaticMarkup(createElement("div", null, createElement(DialogOwner), createElement(DialogOwner))),
        "<div><span>closed</span><span>closed</span></div>",
    )
    assert.notEqual(owners[0].openForm, owners[1].openForm)
    owners[0].openForm({ userId: 9 })
    assert.equal(renderToStaticMarkup(createElement(DialogOwner)), "<span>closed</span>")
    assert.notEqual(owners[2].openForm, owners[0].openForm)
})

test("load status preserves cached rows while respecting session and permission boundaries", () => {
    const signedIn = { isPending: false, data: { userId: 1 } }
    const cached = { data: [], isError: false }
    const cachedFailure = { data: [{ userId: 1 }], isError: true }
    const waiting = { data: undefined, isError: false }
    const failed = { data: undefined, isError: true }
    const cases = [
        ["pending session", { isPending: true, data: undefined }, [cached], true, "loading"],
        ["failed session", { isPending: false, data: undefined }, [cached], true, "error"],
        ["signed out", { isPending: false, data: null }, [cached], true, "signed-out"],
        ["forbidden cached query", signedIn, [cachedFailure], false, "forbidden"],
        ["forbidden unloaded query", signedIn, [waiting], false, "forbidden"],
        ["cached background failure", signedIn, [cached, cachedFailure], true, "ready"],
        ["initial load", signedIn, [cached, waiting], true, "loading"],
        ["initial failure", signedIn, [cached, failed], true, "error"],
        ["failure with another pending query", signedIn, [waiting, failed], true, "error"],
        ["no required queries", signedIn, [], true, "ready"],
    ]
    for (const [label, session, queries, allowed, expected] of cases) {
        assert.equal(getLoadStatus(session, queries, allowed), expected, label)
    }
})
