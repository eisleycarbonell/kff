"use client"

import { AccountingShell } from "@/components/modules/accounting/accounting-shell"
import { AccountingValuationView } from "@/components/modules/accounting/accounting-valuation-view"

export default function InventoryValuationPage() {
    return (
        <>
            <title>Stock Value | Accounting Portal</title>
            <meta
                name="description"
                content="Check how much raw spices, packaging, labels, and finished goods are worth across every warehouse and batch."
            />
            <AccountingShell
                title="Stock Value"
                description="See how much your raw spices, packaging, labels, and finished goods are worth across locations and batches."
            >
                {(overview) => <AccountingValuationView overview={overview} />}
            </AccountingShell>
        </>
    )
}
