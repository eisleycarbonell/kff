"use client"

import { AccountingProductionView } from "@/components/modules/accounting/accounting-production-view"
import { AccountingShell } from "@/components/modules/accounting/accounting-shell"

export default function ProductionCostingPage() {
    return (
        <>
            <title>Production Costs | Accounting Portal</title>
            <meta
                name="description"
                content="See how much it costs to pack each finished product from bulk spices, containers, and printed labels."
            />
            <AccountingShell
                title="Production Costs"
                description="See the ingredient, packaging, and label cost of each packing run and finished pack."
            >
                {(overview) => <AccountingProductionView overview={overview} />}
            </AccountingShell>
        </>
    )
}
