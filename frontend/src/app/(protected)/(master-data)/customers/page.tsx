"use client"

import dynamic from "next/dynamic"
import Link from "next/link"
import { Plus } from "lucide-react"

import { CustomerStatistics } from "@/components/modules/customers/customer-statistics"
import { CustomerTable } from "@/components/modules/customers/customer-table"
import { PageHeader } from "@/components/shared/page-header"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useCustomers } from "@/hooks/modules/customers/use-customers"

const CustomerForm = dynamic(() =>
    import("@/components/modules/customers/customer-form").then((module) => module.CustomerForm),
)

export default function CustomersPage() {
    const {
        customers,
        canManage,
        loadStatus,
        loadError,
        formOpen,
        setFormOpen,
        formRequested,
        editingCustomer,
        deactivatingCustomer,
        setDeactivatingCustomer,
        openAdd,
        openEdit,
        openDeactivate,
        handleSave,
        handleActivate,
        handleDeactivate,
        isSaving,
        isDeactivating,
        isUpdating,
        saveError,
        deactivateError,
        isFetching,
        retry,
    } = useCustomers()

    return (
        <>
            <title>Customers</title>
            <meta name="description" content="Manage customer accounts and contacts." />
            <PageHeader
                title="Customers"
                description="Manage customer accounts and contacts."
                actions={
                    canManage && (
                        <Button className="h-10 gap-2 px-4" onClick={openAdd} disabled={isUpdating}>
                            <Plus />
                            Add customer
                        </Button>
                    )
                }
            />
            {loadStatus === "signed-out" && (
                <Alert>
                    <AlertTitle>Sign in to view customers</AlertTitle>
                    <AlertDescription>
                        <Button className="mt-2" render={<Link href="/" />} nativeButton={false}>
                            Sign in
                        </Button>
                    </AlertDescription>
                </Alert>
            )}
            {loadError && loadStatus !== "signed-out" && (
                <Alert variant="destructive">
                    <AlertTitle>
                        {loadStatus === "ready" ? "Unable to refresh customers" : "Unable to load customers"}
                    </AlertTitle>
                    <AlertDescription>
                        <p>{loadError.message}</p>
                        {loadStatus === "ready" && <p>Showing the last loaded customer records.</p>}
                        <Button variant="outline" className="mt-2" onClick={retry} disabled={isFetching}>
                            {isFetching ? "Retrying..." : "Retry loading customers"}
                        </Button>
                    </AlertDescription>
                </Alert>
            )}
            {loadStatus === "loading" && (
                <div className="space-y-4" aria-busy="true" aria-label="Loading customers">
                    <div className="grid gap-4 sm:grid-cols-3">
                        {[0, 1, 2].map((index) => <Skeleton key={index} className="h-28 rounded-xl" />)}
                    </div>
                    <Skeleton className="h-96 rounded-xl" />
                </div>
            )}
            {loadStatus === "ready" && (
                <>
                    {!canManage && (
                        <Alert>
                            <AlertTitle>View-only access</AlertTitle>
                            <AlertDescription>
                                You can view and export customers. Inventory managers can add or
                                change customer records.
                            </AlertDescription>
                        </Alert>
                    )}
                    <CustomerStatistics customers={customers} />
                    <CustomerTable
                        customers={customers}
                        canManage={canManage}
                        isUpdating={isUpdating}
                        onAdd={openAdd}
                        onEdit={openEdit}
                        onDeactivate={openDeactivate}
                        onActivate={handleActivate}
                    />
                </>
            )}
            {formRequested && (
                <CustomerForm
                    open={formOpen && canManage}
                    onOpenChange={setFormOpen}
                    customer={editingCustomer}
                    onSave={handleSave}
                    isSaving={isSaving}
                    error={saveError}
                />
            )}
            <AlertDialog
                open={canManage && Boolean(deactivatingCustomer)}
                onOpenChange={(open) => {
                    if (!open && !isDeactivating) setDeactivatingCustomer(null)
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Deactivate customer?</AlertDialogTitle>
                        <AlertDialogDescription className="break-words">
                            {deactivatingCustomer?.name} will be marked inactive. Their contact
                            details remain available, and you can reactivate the customer later.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    {deactivateError && (
                        <Alert variant="destructive">
                            <AlertDescription>{deactivateError}</AlertDescription>
                        </Alert>
                    )}
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeactivating}>Cancel</AlertDialogCancel>
                        <AlertDialogAction disabled={isDeactivating} onClick={handleDeactivate}>
                            {isDeactivating ? "Deactivating..." : "Deactivate customer"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
