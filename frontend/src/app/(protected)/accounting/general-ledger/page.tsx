"use client"

import { AccountingGeneralLedgerView } from "@/components/modules/accounting/accounting-general-ledger-view"
import { AccountingShell } from "@/components/modules/accounting/accounting-shell"

export default function GeneralLedgerPage() {
    return (
        <>
            <title>General Ledger &amp; Trial Balance | Accounting</title>
            <meta
                name="description"
                content="Chart of Accounts, balanced Trial Balance, and Double-Entry Journal Cost Ledger."
            />
            <AccountingShell
                title="General Ledger & Trial Balance"
                description="Audit the Chart of Accounts, verify Trial Balance equilibrium, and inspect double-entry journal postings."
            >
                {(overview) => <AccountingGeneralLedgerView overview={overview} />}
            </AccountingShell>
        </>
    )
}
