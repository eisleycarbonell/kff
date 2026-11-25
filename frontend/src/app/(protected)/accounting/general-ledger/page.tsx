"use client"

import { AccountingGeneralLedgerView } from "@/components/modules/accounting/accounting-general-ledger-view"
import { AccountingShell } from "@/components/modules/accounting/accounting-shell"

export default function GeneralLedgerPage() {
    return (
        <>
            <title>Financial Reports | Accounting Portal</title>
            <meta
                name="description"
                content="Download CSV financial reports, check balanced account totals, and review transaction history."
            />
            <AccountingShell
                title="Financial Reports"
                description="Download CSV financial reports, verify balanced account totals, and check stock & cost transactions."
            >
                {(overview) => <AccountingGeneralLedgerView overview={overview} />}
            </AccountingShell>
        </>
    )
}
