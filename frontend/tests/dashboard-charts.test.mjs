import assert from "node:assert/strict"
import { test } from "node:test"
import {
    buildCategoryDistributionChart,
    buildLedgerActivityChart,
    buildLocationChart,
    buildPurchaseOrderChart,
} from "../src/components/modules/dashboard/dashboard-charts.data.ts"

test("buildCategoryDistributionChart maps all four item types cleanly in category order", () => {
    const result = buildCategoryDistributionChart([
        {
            itemType: "Finished Good",
            totalValue: "1500.50",
            itemCount: 4,
            quantities: [],
        },
        {
            itemType: "Raw Material - Bulk",
            totalValue: "4200.00",
            itemCount: 8,
            quantities: [],
        },
    ])

    assert.deepEqual(
        result.map((row) => ({
            category: row.category,
            value: row.value,
            itemCount: row.itemCount,
        })),
        [
            { category: "raw", value: 4200, itemCount: 8 },
            { category: "hardware", value: 0, itemCount: 0 },
            { category: "labels", value: 0, itemCount: 0 },
            { category: "finished", value: 1500.5, itemCount: 4 },
        ],
    )
})

test("buildLocationChart sorts locations by stocked SKU count and truncates long labels", () => {
    const result = buildLocationChart(
        [
            {
                locationId: 1,
                locationCode: "BR-01",
                locationName: "Alpha Branch",
                locationType: "Branch",
                itemCount: 3,
                quantities: [],
            },
            {
                locationId: 2,
                locationCode: "WH-01",
                locationName: "Main Central Warehouse North",
                locationType: "Warehouse",
                itemCount: 12,
                quantities: [],
            },
        ],
        1,
    )

    assert.equal(result.length, 1)
    assert.equal(result[0]?.code, "WH-01")
    assert.equal(result[0]?.itemCount, 12)
    assert.equal(result[0]?.shortName, "Main Central Wa…")
})

test("buildPurchaseOrderChart preserves raw money strings and numeric chart series", () => {
    const result = buildPurchaseOrderChart([
        {
            poId: 5,
            poNumber: "PO-2026-005",
            supplierId: 2,
            supplierName: "Mindanao Spices Inc.",
            status: "Partially Received",
            orderDate: "2026-11-10T00:00:00Z",
            expectedDeliveryDate: null,
            lineCount: 2,
            totalAmount: "10000.00",
            receivedAmount: "6500.00",
            outstandingAmount: "3500.00",
        },
    ])

    assert.equal(result[0]?.receivedAmount, 6500)
    assert.equal(result[0]?.outstandingAmount, 3500)
    assert.equal(result[0]?.receivedRaw, "6500.00")
    assert.equal(result[0]?.outstandingRaw, "3500.00")
})

test("buildLedgerActivityChart aggregates and sorts recent movements by count", () => {
    const result = buildLedgerActivityChart([
        {
            transactionId: 1,
            transactionType: "Receive",
            itemSku: "RM-1",
            itemName: "Pepper",
            lotNumber: "LOT-1",
            locationName: "Main",
            qtyChange: "10",
            primaryUomName: "kg",
            createdAt: "2026-11-15T00:00:00Z",
            referenceId: "PO-1",
        },
        {
            transactionId: 2,
            transactionType: "Produce",
            itemSku: "FG-1",
            itemName: "Pepper Pack",
            lotNumber: "LOT-2",
            locationName: "Main",
            qtyChange: "20",
            primaryUomName: "pack",
            createdAt: "2026-11-15T01:00:00Z",
            referenceId: "PK-1",
        },
        {
            transactionId: 3,
            transactionType: "Receive",
            itemSku: "RM-2",
            itemName: "Garlic",
            lotNumber: "LOT-3",
            locationName: "Main",
            qtyChange: "5",
            primaryUomName: "kg",
            createdAt: "2026-11-15T02:00:00Z",
            referenceId: "PO-2",
        },
    ])

    assert.deepEqual(result, [
        { transactionType: "Receive", count: 2 },
        { transactionType: "Produce", count: 1 },
    ])
})
