import assert from "node:assert/strict"
import { registerHooks } from "node:module"
import { afterEach, test } from "node:test"

registerHooks({
    resolve(specifier, context, nextResolve) {
        return nextResolve(
            specifier.startsWith("@/")
                ? new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href
                : specifier,
            context,
        )
    },
})

process.env.NEXT_PUBLIC_API_BASE_URL = "https://kff.example.test/api///"

const api = await import("../src/hooks/modules/dashboard/use-dashboard.ts")
const schema = await import("../src/components/modules/dashboard/dashboard.schema.ts")

const originalFetch = globalThis.fetch

const mockDashboard = {
    summary: {
        totalInventoryValue: "125000.0000",
        rawMaterialValue: "50000.0000",
        packagingValue: "15000.0000",
        finishedGoodsValue: "60000.0000",
        totalItemsCount: 42,
        rawMaterialsOnHand: "500.0000",
        rawMaterialsReserved: "100.0000",
        rawMaterialsAvailable: "400.0000",
        finishedGoodsOnHand: "250.0000",
        finishedGoodsReserved: "50.0000",
        finishedGoodsAvailable: "200.0000",
        activePackingOrdersCount: 2,
        pendingPurchaseOrdersCount: 1,
        activeTransfersCount: 1,
        lowStockItemsCount: 1,
        expiringLotsCount: 1,
    },
    stockByType: [
        {
            itemType: "Raw Material - Bulk",
            totalOnHand: "500.0000",
            totalReserved: "100.0000",
            totalAvailable: "400.0000",
            totalValue: "50000.0000",
            itemCount: 12,
        },
    ],
    stockByLocation: [
        {
            locationId: 1,
            locationCode: "WH-01",
            locationName: "Main Warehouse",
            locationType: "Warehouse",
            totalOnHand: "500.0000",
            totalReserved: "100.0000",
            totalAvailable: "400.0000",
            itemCount: 12,
        },
    ],
    activePackingOrders: [
        {
            packingOrderId: 10,
            packingOrderNumber: "PO-2026-001",
            itemId: 5,
            itemSku: "FG-GARLIC-100G",
            itemName: "Garlic Powder 100g",
            targetQty: "50.0000",
            actualQty: "0.0000",
            primaryUomName: "pouch",
            status: "Planned",
            scheduledDate: "2026-11-01",
            sourceLocationName: "Main Warehouse",
            destinationLocationName: "Packing Station",
        },
    ],
    pendingPurchaseOrders: [
        {
            poId: 20,
            poNumber: "PO-SP-001",
            supplierId: 2,
            supplierName: "Spice Supplier Co.",
            status: "Sent",
            orderDate: "2026-10-25T08:00:00Z",
            expectedDeliveryDate: "2026-11-05",
            lineCount: 3,
            totalAmount: "45000.00000000",
            receivedAmount: "0.00000000",
            outstandingAmount: "45000.00000000",
        },
    ],
    activeTransfers: [
        {
            transferId: 30,
            transferNumber: "TR-2026-001",
            sourceLocationName: "Main Warehouse",
            destinationLocationName: "Branch North",
            status: "In Transit",
            requestedAt: "2026-10-28T09:00:00Z",
            dispatchedAt: "2026-10-28T14:00:00Z",
            lineCount: 2,
        },
    ],
    expiringLots: [
        {
            lotId: 50,
            lotNumber: "LOT-CHILI-01",
            itemId: 3,
            itemSku: "RM-CHILI",
            itemName: "Chili Powder",
            itemType: "Raw Material - Bulk",
            primaryUomName: "kg",
            locationName: "Main Warehouse",
            qtyOnHand: "25.0000",
            expirationDate: "2026-11-10",
            daysUntilExpiry: 11,
            qcStatus: "Approved",
        },
    ],
    lowStockItems: [
        {
            itemId: 4,
            itemSku: "RM-PEPPER",
            itemName: "Black Pepper",
            itemType: "Raw Material - Bulk",
            primaryUomName: "kg",
            qtyOnHand: "5.0000",
            qtyReserved: "3.0000",
            qtyAvailable: "2.0000",
        },
    ],
    recentActivity: [
        {
            transactionId: 100,
            transactionType: "Receive",
            itemSku: "RM-GARLIC",
            itemName: "Garlic Powder",
            lotNumber: "LOT-GARLIC-02",
            locationName: "Main Warehouse",
            qtyChange: "100.0000",
            primaryUomName: "kg",
            createdAt: "2026-10-29T10:00:00Z",
            referenceId: "PO-SP-001",
        },
    ],
}

const response = (data, status = 200) =>
    new Response(JSON.stringify({ success: true, data }), {
        status,
        headers: { "Content-Type": "application/json" },
    })

afterEach(() => {
    globalThis.fetch = originalFetch
})

test("getDashboardData fetches from configured endpoint with credentials and parses DTO", async () => {
    let capturedUrl = ""
    let capturedOptions = null

    globalThis.fetch = async (url, options) => {
        capturedUrl = String(url)
        capturedOptions = options
        return response(mockDashboard)
    }

    const controller = new AbortController()
    const data = await api.getDashboardData(controller.signal)

    assert.equal(capturedUrl, "https://kff.example.test/api/dashboard")
    assert.equal(capturedOptions?.credentials, "include")
    assert.equal(capturedOptions?.signal, controller.signal)
    assert.equal(data.summary.totalInventoryValue, "125000.0000")
    assert.equal(data.stockByType.length, 1)
    assert.equal(data.activePackingOrders.length, 1)
    assert.equal(data.pendingPurchaseOrders.length, 1)
    assert.equal(data.activeTransfers.length, 1)
    assert.equal(data.expiringLots.length, 1)
    assert.equal(data.lowStockItems.length, 1)
    assert.equal(data.recentActivity.length, 1)
})

test("getDashboardData throws error when response data fails schema validation", async () => {
    globalThis.fetch = async () => response({ summary: { totalInventoryValue: 123 } })

    await assert.rejects(
        () => api.getDashboardData(),
        /The API returned invalid dashboard metrics\./,
    )
})

test("formatCurrency correctly formats values into PHP currency string", () => {
    assert.equal(schema.formatCurrency("125000.0000"), "₱125,000.00")
    assert.equal(schema.formatCurrency("0.0000"), "₱0.00")
    assert.equal(schema.formatCurrency(null), "₱0.00")
    assert.equal(schema.formatCurrency("invalid"), "₱0.00")
})

test("formatQuantity removes trailing zeros while preserving formatting", () => {
    assert.equal(schema.formatQuantity("1250.0000"), "1,250")
    assert.equal(schema.formatQuantity("1250.5000"), "1,250.5")
    assert.equal(schema.formatQuantity("0.0000"), "0")
    assert.equal(schema.formatQuantity(null), "0")
})

test("formatDate handles ISO strings and YYYY-MM-DD cleanly", () => {
    assert.equal(schema.formatDate("2026-11-01"), "Nov 1, 2026")
    assert.equal(schema.formatDate("2026-10-25T08:00:00Z"), "Oct 25, 2026")
    assert.equal(schema.formatDate(null), "—")
})
