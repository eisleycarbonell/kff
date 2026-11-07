"use client"

import dynamic from "next/dynamic"
import Link from "next/link"
import { PackageCheck } from "lucide-react"

import { ReceivingStatistics } from "@/components/modules/receiving/receiving-statistics"
import { ReceivingTable } from "@/components/modules/receiving/receiving-table"
import { PageHeader } from "@/components/shared/page-header"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useReceiving } from "@/hooks/modules/receiving/use-receiving"

const ReceivingForm = dynamic(() =>
    import("@/components/modules/receiving/receiving-form").then((module) => module.ReceivingForm),
)

export default function ReceivingPage() {
    const {
        receipts,
        canReceive,
        loadStatus,
        loadError,
        retry,
        isFetching,
        options,
        optionsReady,
        optionsError,
        isOptionsLoading,
        retryOptions,
        formOpen,
        setFormOpen,
        formRequested,
        openAdd,
        handleReceive,
        isReceiving,
        receiveError,
        receiveConflict,
    } = useReceiving()

    return (
        <>
            <title>Receiving</title>
            <meta
                name="description"
                content="Receive purchase orders, record lots, and track incoming stock."
            />
            <PageHeader
                title="Receiving"
                description="Receive purchase orders, record lots, and track incoming stock."
                actions={
                    canReceive && (
                        <Button
                            className="h-10 gap-2 px-4"
                            onClick={openAdd}
                            disabled={isReceiving}
                        >
                            <PackageCheck /> Receive stock
                        </Button>
                    )
                }
            />
            {loadStatus === "signed-out" && (
                <Alert>
                    <AlertTitle>Sign in to view receiving</AlertTitle>
                    <AlertDescription>
                        <Button className="mt-2" nativeButton={false} render={<Link href="/" />}>
                            Sign in
                        </Button>
                    </AlertDescription>
                </Alert>
            )}
            {loadError && loadStatus !== "signed-out" && (
                <Alert variant="destructive">
                    <AlertTitle>
                        {loadStatus === "ready"
                            ? "Unable to refresh receiving history"
                            : "Unable to load receiving history"}
                    </AlertTitle>
                    <AlertDescription>
                        <p>{loadError.message}</p>
                        {loadStatus === "ready" && <p>Showing the last loaded receipts.</p>}
                        <Button
                            variant="outline"
                            className="mt-2"
                            onClick={retry}
                            disabled={isFetching}
                        >
                            {isFetching ? "Retrying..." : "Retry loading receipts"}
                        </Button>
                    </AlertDescription>
                </Alert>
            )}
            {loadStatus === "loading" && (
                <div className="space-y-4" aria-busy="true" aria-label="Loading receiving history">
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        {[0, 1, 2, 3].map((index) => (
                            <Skeleton key={index} className="h-28 rounded-xl" />
                        ))}
                    </div>
                    <Skeleton className="h-96 rounded-xl" />
                </div>
            )}
            {loadStatus === "ready" && (
                <>
                    {!canReceive && (
                        <Alert>
                            <AlertTitle>View-only access</AlertTitle>
                            <AlertDescription>
                                You can view and export receipts. Inventory managers can receive
                                stock.
                            </AlertDescription>
                        </Alert>
                    )}
                    <ReceivingStatistics receipts={receipts} />
                    <ReceivingTable
                        receipts={receipts}
                        canReceive={canReceive}
                        isBusy={isReceiving}
                        onAdd={openAdd}
                    />
                </>
            )}
            {formRequested && (
                <ReceivingForm
                    open={formOpen && canReceive}
                    onOpenChange={setFormOpen}
                    options={options}
                    optionsReady={optionsReady}
                    optionsError={optionsError}
                    isOptionsLoading={isOptionsLoading}
                    retryOptions={retryOptions}
                    onReceive={handleReceive}
                    isReceiving={isReceiving}
                    receiveError={receiveError}
                    receiveConflict={receiveConflict}
                />
            )}
        </>
    )
}
