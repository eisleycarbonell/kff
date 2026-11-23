"use client"

import { AccountingProductionView } from "@/components/modules/accounting/accounting-production-view"
import { AccountingShell } from "@/components/modules/accounting/accounting-shell"

export default function ProductionCostingPage() {
    return (
        <>
            <title>Production Cost Roll-Up | Accounting</title>
            <meta
                name="description"
                content="Finished goods packing order BOM cost roll-ups and component unit cost breakdown."
            />
            <AccountingShell
                title="Production Cost Roll-Up"
                description="Audit BOM material costs absorbed into each packing run and compare rolled-up unit costs against catalog reference."
            >
                {(overview) => <AccountingProductionView overview={overview} />}
            </AccountingShell>
        </>
    )
}
