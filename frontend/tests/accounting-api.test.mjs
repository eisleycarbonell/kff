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

const api = await import("../src/hooks/modules/accounting/use-accounting.ts")
const schema = await import("../src/components/modules/accounting/accounting.schema.ts")
const engine = await import("../src/components/modules/accounting/accounting-engine.ts")
const { ApiError } = await import("../src/lib/api-request.ts")

const originalFetch = globalThis.fetch

const mockOverview = {
    generatedAt: "2026-11-16T08:00:00.000Z",
    currencyCode: "PHP",
    summary: {
        currencyCode: "PHP",
        totalInventoryAssetValue: "25000.0000",
        rawMaterialAssetValue: "10000.0000",
        packagingAssetValue: "5000.0000",
        finishedGoodsAssetValue: "10000.0000",
        purchaseCommittedValue: "12000.0000",
        purchaseReceivedValue: "8000.0000",
        purchaseOutstandingValue: "4000.0000",
        totalProductionCost: "7500.0000",
        totalBookedRevenue: "18000.0000",
        totalDeliveredRevenue: "14000.0000",
        totalDeliveredCogs: "8500.0000",
        grossProfit: "5500.0000",
        grossMarginPercent: "39.29",
        scrapLossValue: "250.0000",
        adjustmentNetValue: "-100.0000",
        costedLotsCount: 6,
        uncostedLotsCount: 1,
    },
    valuationByCategory: [
        {
            itemType: "Raw Material - Bulk",
            itemCount: 3,
            lotCount: 4,
            assetValue: "10000.0000",
            sharePercent: "40.00",
        },
    ],
    valuationByLocation: [
        {
            locationId: 1,
            locationCode: "WH-MAIN",
            locationName: "Main Warehouse",
            locationType: "Warehouse",
            itemCount: 5,
            lotCount: 6,
            assetValue: "25000.0000",
        },
    ],
    lotCosting: [
        {
            lotId: 10,
            lotNumber: "LOT-PEP-001",
            itemId: 2,
            itemSku: "RM-PEP-25KG",
            itemName: "Whole Black Pepper",
            itemType: "Raw Material - Bulk",
            primaryUomName: "kg",
            sourceType: "Purchase",
            sourceReference: "PO-2026-0001",
            supplierName: "Spice Traders",
            purchaseUnitPrice: "400.0000",
            purchaseUomName: "kg",
            catalogUnitCost: "390.0000",
            lotUnitCost: "400.0000",
            effectiveUnitCost: "400.0000",
            costBasis: "Purchase Actual",
            unitVariance: "10.0000",
            qtyOnHand: "25.0000",
            assetValue: "10000.0000",
            qcStatus: "Approved",
            createdAt: "2026-11-15T10:00:00.000Z",
        },
    ],
    packingCosting: [
        {
            packingOrderId: 5,
            packingOrderNumber: "PCK-2026-0001",
            status: "Completed",
            itemId: 8,
            itemSku: "FG-PEP-100G",
            itemName: "Black Pepper 100g Jar",
            primaryUomName: "pc",
            targetQty: "100.0000",
            actualQty: "100.0000",
            consumedMaterialCost: "7500.0000",
            finishedLotNumber: "FG-LOT-001",
            recordedLotUnitCost: "75.0000",
            computedUnitCost: "75.0000",
            catalogUnitCost: "72.0000",
            unitVariance: "3.0000",
            scheduledDate: "2026-11-15",
            completedAt: "2026-11-15T14:00:00.000Z",
            components: [
                {
                    componentSku: "RM-PEP-25KG",
                    componentName: "Whole Black Pepper",
                    qtyConsumed: "10.0000",
                    uomName: "kg",
                    unitCost: "400.0000",
                    totalCost: "4000.0000",
                },
            ],
        },
    ],
    salesCosting: [
        {
            salesOrderId: 3,
            salesOrderNumber: "SO-2026-0001",
            customerPoNumber: "CUST-PO-99",
            customerName: "Metro Grocer",
            status: "Completed",
            orderDate: "2026-11-15",
            bookedRevenue: "18000.0000",
            deliveredRevenue: "14000.0000",
            deliveredCogs: "8500.0000",
            grossProfit: "5500.0000",
            grossMarginPercent: "39.29",
            deliveryCount: 1,
            completedDeliveryCount: 1,
        },
    ],
    purchasingCosting: [
        {
            poId: 1,
            poNumber: "PO-2026-0001",
            supplierName: "Spice Traders",
            status: "Partially Received",
            orderDate: "2026-11-10T08:00:00.000Z",
            expectedDeliveryDate: "2026-11-20",
            lineCount: 2,
            totalAmount: "12000.0000",
            receivedAmount: "8000.0000",
            outstandingAmount: "4000.0000",
        },
    ],
    costLedger: [
        {
            transactionId: 101,
            createdAt: "2026-11-15T14:00:00.000Z",
            transactionType: "Sale",
            referenceId: "DEL-2026-0001",
            itemSku: "FG-PEP-100G",
            itemName: "Black Pepper 100g Jar",
            lotNumber: "FG-LOT-001",
            locationName: "Main Warehouse",
            primaryUomName: "pc",
            qtyChange: "-100.0000",
            effectiveUnitCost: "85.0000",
            costBasis: "Packing Roll-Up",
            totalCostImpact: "-8500.0000",
            authorizedByName: "Lucia Bautista",
        },
    ],
}

afterEach(() => {
    globalThis.fetch = originalFetch
})

test("getAccountingOverview builds filtered URL, includes credentials and parses response", async () => {
    const calls = []
    globalThis.fetch = async (url, init) => {
        calls.push({ url, init })
        return new Response(JSON.stringify({ success: true, data: mockOverview }), {
            status: 200,
            headers: { "content-type": "application/json" },
        })
    }

    const result = await api.getAccountingOverview({
        fromDate: "2026-11-01",
        toDate: "2026-11-16",
    })
    assert.equal(calls.length, 1)
    assert.equal(
        calls[0].url,
        "https://kff.example.test/api/accounting?fromDate=2026-11-01&toDate=2026-11-16",
    )
    assert.equal(calls[0].init.credentials, "include")
    assert.equal(result.summary.grossProfit, "5500.0000")
    assert.equal(result.packingCosting[0].components.length, 1)
})

test("getAccountingOverview surfaces API permission errors and rejects malformed payloads", async () => {
    globalThis.fetch = async () =>
        new Response(
            JSON.stringify({
                success: false,
                error: { message: "Accounting access required." },
            }),
            {
                status: 403,
                headers: { "content-type": "application/json" },
            },
        )

    await assert.rejects(
        () => api.getAccountingOverview(),
        (err) => err instanceof ApiError && err.status === 403 && err.message.includes("Accounting"),
    )

    globalThis.fetch = async () =>
        new Response(JSON.stringify({ success: true, data: { currencyCode: "PHP" } }), {
            status: 200,
            headers: { "content-type": "application/json" },
        })

    await assert.rejects(() => api.getAccountingOverview(), /invalid accounting payload/i)
})

test("accounting schema validates date ranges and formats signed currency cleanly", () => {
    const badRange = schema.accountingFilterSchema.safeParse({
        fromDate: "2026-11-20",
        toDate: "2026-11-01",
    })
    assert.equal(badRange.success, false)

    assert.equal(schema.buildAccountingQueryString({ fromDate: "", toDate: "" }), "")
    assert.match(schema.formatSignedCurrency("125.5", "PHP"), /^\+/)
    assert.match(schema.formatSignedCurrency("-125.5", "PHP"), /^-/)
})

test("accounting engine derives balanced Trial Balance, double-entry journals, P&L, AR, and AP roll-ups", () => {
    const tb = engine.computeTrialBalance(mockOverview)
    assert.equal(tb.isBalanced, true)
    assert.equal(tb.difference, "0.0000")
    assert.equal(tb.totalDebits, tb.totalCredits)
    assert.ok(tb.accounts.length >= 10)
    const arAcc = tb.accounts.find((a) => a.accountCode === "1100")
    assert.equal(arAcc?.debit, "14000.0000")
    const apAcc = tb.accounts.find((a) => a.accountCode === "2100")
    assert.equal(apAcc?.credit, "8000.0000")

    const journals = engine.computeJournalEntries({
        ...mockOverview,
        costLedger: [
            ...mockOverview.costLedger,
            {
                transactionId: 102,
                createdAt: "2026-11-15T15:00:00.000Z",
                transactionType: "Receive",
                referenceId: "PO-2026-0001",
                itemSku: "RM-PEP-25KG",
                itemName: "Whole Black Pepper",
                lotNumber: "LOT-PEP-001",
                locationName: "Main Warehouse",
                primaryUomName: "kg",
                qtyChange: "25.0000",
                effectiveUnitCost: "400.0000",
                costBasis: "Purchase Actual",
                totalCostImpact: "10000.0000",
                authorizedByName: "Lucia Bautista",
            },
            {
                transactionId: 103,
                createdAt: "2026-11-15T16:00:00.000Z",
                transactionType: "Scrap",
                referenceId: "SCR-2026-001",
                itemSku: "RM-PEP-25KG",
                itemName: "Whole Black Pepper",
                lotNumber: "LOT-PEP-001",
                locationName: "Main Warehouse",
                primaryUomName: "kg",
                qtyChange: "-0.6250",
                effectiveUnitCost: "400.0000",
                costBasis: "Purchase Actual",
                totalCostImpact: "-250.0000",
                authorizedByName: "Lucia Bautista",
            },
        ],
    })
    assert.equal(journals.length, 3)
    assert.equal(journals[0].journalNumber, "JE-00101")
    assert.equal(journals[0].debitAccountCode, "5100")
    assert.equal(journals[0].creditAccountCode, "1230")
    assert.equal(journals[0].amount, "8500.0000")
    assert.equal(journals[1].debitAccountCode, "1210")
    assert.equal(journals[1].creditAccountCode, "2100")
    assert.equal(journals[2].debitAccountCode, "6100")
    assert.equal(journals[2].creditAccountCode, "1210")

    const pnl = engine.computeIncomeStatement(mockOverview)
    assert.equal(pnl.bookedSales, "18000.0000")
    assert.equal(pnl.recognizedRevenue, "14000.0000")
    assert.equal(pnl.unfulfilledBacklog, "4000.0000")
    assert.equal(pnl.grossProfit, "5500.0000")
    assert.equal(pnl.netOperatingIncome, "5150.0000")

    const ar = engine.computeCustomerReceivables([
        ...mockOverview.salesCosting,
        {
            salesOrderId: 4,
            salesOrderNumber: "SO-2026-0002",
            customerPoNumber: null,
            customerName: "Metro Grocer",
            status: "Confirmed",
            orderDate: "2026-11-16",
            bookedRevenue: "2000.0000",
            deliveredRevenue: "0.0000",
            deliveredCogs: "0.0000",
            grossProfit: "0.0000",
            grossMarginPercent: null,
            deliveryCount: 0,
            completedDeliveryCount: 0,
        },
        {
            salesOrderId: 5,
            salesOrderNumber: "SO-2026-0003",
            customerPoNumber: null,
            customerName: "Cancelled Shop",
            status: "Cancelled",
            orderDate: "2026-11-16",
            bookedRevenue: "999.0000",
            deliveredRevenue: "0.0000",
            deliveredCogs: "0.0000",
            grossProfit: "0.0000",
            grossMarginPercent: null,
            deliveryCount: 0,
            completedDeliveryCount: 0,
        },
    ])
    assert.equal(ar.length, 1)
    assert.equal(ar[0].orderCount, 2)
    assert.equal(ar[0].bookedRevenue, "20000.0000")
    assert.equal(ar[0].backlogRevenue, "6000.0000")

    const ap = engine.computeSupplierPayables(mockOverview.purchasingCosting)
    assert.equal(ap.length, 1)
    assert.equal(ap[0].supplierName, "Spice Traders")
    assert.equal(ap.length, 1)
    assert.equal(ap[0].totalCommitted, "12000.0000")
    assert.equal(ap[0].receivedPayable, "8000.0000")
    assert.equal(ap[0].outstandingCommitment, "4000.0000")
    assert.equal(ap[0].receivedPercent, "66.67")
})

test("trial balance accounts for 1150 Input VAT Receivable and 2200 Output VAT Payable and remains balanced", () => {
    const overviewWithVat = {
        generatedAt: "2026-11-19T12:00:00.000Z",
        currencyCode: "PHP",
        summary: {
            vatRatePercent: "12.00",
            totalInventoryAssetValue: "1000.0000",
            rawMaterialAssetValue: "1000.0000",
            packagingAssetValue: "0.0000",
            finishedGoodsAssetValue: "0.0000",
            purchaseCommittedNetValue: "1000.0000",
            purchaseCommittedVatValue: "120.0000",
            purchaseCommittedValue: "1120.0000",
            purchaseReceivedNetValue: "1000.0000",
            totalInputVat: "120.0000",
            purchaseReceivedValue: "1120.0000",
            purchaseOutstandingValue: "0.0000",
            totalProductionCost: "0.0000",
            totalBookedRevenue: "1500.0000",
            totalBookedOutputVat: "180.0000",
            totalBookedBilling: "1680.0000",
            totalDeliveredRevenue: "1500.0000",
            totalOutputVat: "180.0000",
            totalDeliveredBilling: "1680.0000",
            netVatPayable: "60.0000",
            totalDeliveredCogs: "800.0000",
            grossProfit: "700.0000",
            grossMarginPercent: "46.67",
            scrapLossValue: "0.0000",
            adjustmentNetValue: "0.0000",
            costedLotsCount: 1,
            uncostedLotsCount: 0,
        },
        valuationByCategory: [],
        valuationByLocation: [],
        lotCosting: [],
        packingCosting: [],
        salesCosting: [],
        purchasingCosting: [],
        costLedger: [],
    }
    const tb = engine.computeTrialBalance(overviewWithVat)
    assert.equal(tb.isBalanced, true)
    assert.equal(tb.difference, "0.0000")
    assert.equal(tb.accounts.find((a) => a.accountCode === "1100")?.debit, "1680.0000")
    assert.equal(tb.accounts.find((a) => a.accountCode === "1150")?.debit, "120.0000")
    assert.equal(tb.accounts.find((a) => a.accountCode === "2100")?.credit, "1120.0000")
    assert.equal(tb.accounts.find((a) => a.accountCode === "2200")?.credit, "180.0000")
    assert.equal(tb.accounts.find((a) => a.accountCode === "4100")?.credit, "1500.0000")
})

test("computeSimpleAccountingSummary derives Total Sales - Total Expenses = Net Profit and counts", () => {
    const simple = engine.computeSimpleAccountingSummary(mockOverview)
    assert.equal(simple.totalSales, "14000.0000")
    assert.equal(simple.pendingSales, "4000.0000")
    assert.equal(simple.costOfGoodsSold, "8500.0000")
    assert.equal(simple.scrapLoss, "250.0000")
    assert.equal(simple.adjustmentNet, "-100.0000")
    assert.equal(simple.totalExpenses, "8850.0000")
    assert.equal(simple.netProfit, "5150.0000")
    assert.equal(simple.totalSupplierBills, "8000.0000")
    assert.equal(simple.openSupplierBills, "4000.0000")
    assert.equal(simple.activeCustomersCount, 1)
    assert.equal(simple.invoicedOrdersCount, 1)
    assert.equal(simple.pendingOrdersCount, 0)
    assert.equal(simple.activeSuppliersCount, 1)
})
