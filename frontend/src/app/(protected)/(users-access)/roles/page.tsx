"use client"

import dynamic from "next/dynamic"
import Link from "next/link"
import { Plus, RefreshCw } from "lucide-react"
import { PageHeader } from "@/components/shared/page-header"
import { RoleStatistics } from "@/components/modules/roles/role-statistics"
import { RoleTable } from "@/components/modules/roles/role-table"
import { useRoles } from "@/hooks/modules/roles/use-roles"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
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

const RoleForm = dynamic(() =>
    import("@/components/modules/roles/role-form").then((module) => module.RoleForm),
)

export default function RolesPage() {
    const roles = useRoles()
    return (
        <>
            <title>Roles &amp; Permissions</title>
            <meta name="description" content="Manage team roles and permissions." />
            <PageHeader
                title="Roles & Permissions"
                description="Define what your team can manage and review who has access."
                actions={
                    roles.canManage && (
                        <div className="flex flex-wrap gap-3">
                            <Button
                                variant="outline"
                                className="h-10"
                                onClick={roles.retry}
                                disabled={roles.isFetching}
                            >
                                <RefreshCw />
                                {roles.isFetching ? "Refreshing..." : "Refresh"}
                            </Button>
                            <Button className="h-10" onClick={roles.openAdd}>
                                <Plus />
                                Add role
                            </Button>
                        </div>
                    )
                }
            />
            {roles.loadStatus === "signed-out" && (
                <Alert>
                    <AlertTitle>Sign in to manage roles</AlertTitle>
                    <AlertDescription>
                        <Button className="mt-2" render={<Link href="/" />} nativeButton={false}>
                            Sign in
                        </Button>
                    </AlertDescription>
                </Alert>
            )}
            {roles.loadStatus === "forbidden" && (
                <Alert>
                    <AlertTitle>Access management permission required</AlertTitle>
                    <AlertDescription>
                        Your role does not allow managing users, roles, or permissions.
                    </AlertDescription>
                </Alert>
            )}
            {roles.loadError &&
                roles.loadStatus !== "signed-out" &&
                roles.loadStatus !== "forbidden" && (
                    <Alert variant="destructive">
                        <AlertTitle>Unable to refresh roles</AlertTitle>
                        <AlertDescription>
                            <p>{roles.loadError.message}</p>
                            <Button
                                variant="outline"
                                className="mt-3"
                                onClick={roles.retry}
                                disabled={roles.isFetching}
                            >
                                Retry loading
                            </Button>
                        </AlertDescription>
                    </Alert>
                )}
            {roles.loadStatus === "loading" && (
                <div className="space-y-4" aria-busy="true" aria-label="Loading roles">
                    <div className="grid gap-4 sm:grid-cols-3">
                        {[0, 1, 2].map((index) => (
                            <Skeleton key={index} className="h-32 rounded-xl" />
                        ))}
                    </div>
                    <Skeleton className="h-96 rounded-xl" />
                </div>
            )}
            {roles.loadStatus === "ready" && (
                <>
                    <RoleStatistics roles={roles.roles} />
                    <RoleTable
                        roles={roles.roles}
                        onAdd={roles.openAdd}
                        onEdit={roles.openEdit}
                        onDelete={roles.openDelete}
                    />
                </>
            )}
            {roles.formRequested && (
                <RoleForm
                    open={roles.formOpen && roles.canManage}
                    onOpenChange={roles.setFormOpen}
                    role={roles.editingRole}
                    roles={roles.roles}
                    isSaving={roles.isSaving}
                    saveError={roles.saveError}
                    onSave={roles.handleSave}
                />
            )}
            <AlertDialog
                open={roles.canManage && Boolean(roles.deletingRole)}
                onOpenChange={(open) => {
                    if (!open && !roles.isDeleting) roles.setDeletingRole(null)
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete role?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Delete {roles.deletingRole?.name}? Only roles with no assigned users can
                            be deleted.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    {roles.deleteError && (
                        <Alert variant="destructive">
                            <AlertTitle>Role was not deleted</AlertTitle>
                            <AlertDescription>{roles.deleteError.message}</AlertDescription>
                        </Alert>
                    )}
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={roles.isDeleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            variant="destructive"
                            disabled={roles.isDeleting}
                            onClick={(event) => {
                                event.preventDefault()
                                roles.handleDelete()
                            }}
                        >
                            {roles.isDeleting ? "Deleting..." : "Delete role"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
