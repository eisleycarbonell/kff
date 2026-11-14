import assert from "node:assert/strict"
import { test } from "node:test"
import { QueryClient, QueryObserver } from "@tanstack/react-query"
import { invalidateInventoryAvailability } from "../src/lib/inventory-query-cache.ts"

test("committed inventory changes refetch open packing availability and stale a saved customer material plan", async () => {
    const client = new QueryClient({defaultOptions:{queries:{retry:false,staleTime:60000}}})
    let available = "12.0000"
    const previewKey = ["packing-preview", 7, {itemId:3,sourceLocationId:1,targetQty:"20"}]
    const observer = new QueryObserver(client, {queryKey:previewKey,queryFn:async () => ({qtyAvailable:available}),staleTime:60000})
    const unsubscribe = observer.subscribe(() => {})
    await observer.refetch()
    const planKey = ["sales-order-material-plan", 5, 1, 7]
    client.setQueryData(planKey, {qtyAvailable:"12.0000"})
    client.setQueryData(["session"], {userId:7})
    assert.equal(observer.getCurrentResult().data.qtyAvailable,"12.0000")
    available = "5.0000"
    await invalidateInventoryAvailability(client)
    assert.equal(observer.getCurrentResult().data.qtyAvailable,"5.0000")
    assert.equal(client.getQueryState(planKey).isInvalidated,true)
    assert.equal(client.getQueryState(["session"]).isInvalidated,false)
    unsubscribe()
    client.clear()
})
test("stock and master-data changes refresh lot choices and formula/source eligibility for later operations", async () => {
    const client = new QueryClient()
    const keys = [["delivery-order-options",7],["transfer-options",7],["inventory-stock-options",7],["inventory-control-options",7],["packing-options",7],["sales-order-options",7]]
    for(const key of keys) client.setQueryData(key,{current:true})
    await invalidateInventoryAvailability(client)
    for(const key of keys) assert.equal(client.getQueryState(key).isInvalidated,true)
    client.clear()
})
