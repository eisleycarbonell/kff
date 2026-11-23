"use client"

import { AccountingShell } from "@/components/modules/accounting/accounting-shell"
import { AccountingValuationView } from "@/components/modules/accounting/accounting-valuation-view"

export default function InventoryValuationPage() {
    return (
        <>
            <title>Inventory &amp; Lot Valuation | Accounting</title>
            <meta
                name="description"
                content="Perpetual inventory asset valuation by category, warehouse location, and specific batch cost."
            />
            <AccountingShell
                title="Inventory & Lot Valuation"
                description="Inspect batch asset valuation across warehouses, raw spices, packaging, labels, and finished goods."
            >
                {(overview) => <AccountingValuationView overview={overview} />}
            </AccountingShell>
        </>
    )
}
