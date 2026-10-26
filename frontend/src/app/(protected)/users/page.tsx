"use client"

import dynamic from "next/dynamic"
import { Trash2 } from "lucide-react"

import { UserStatistics } from "@/components/modules/users/user-statistics"
import { UserTable } from "@/components/modules/users/user-table"
import { getUserName } from "@/components/modules/users/user.schema"
import { PageHeader } from "@/components/shared/page-header"
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
import { useUsers } from "@/hooks/modules/users/use-users"

const UserForm = dynamic(() =>
    import("@/components/modules/users/user-form").then((module) => module.UserForm),
)

export default function UsersPage() {
    const {
        users,
        loadStatus,
        formOpen,
        formRequested,
        editingUser,
        deletingUsers,
        setFormOpen,
        setDeletingUsers,
        openAdd,
        openEdit,
        openDelete,
        handleSave,
        handleDelete,
        retry,
        isSaving,
        isDeleting,
        isFetching,
    } = useUsers()

    return (
        <>
            <title>Users</title>
            <meta
                name="description"
                content="Manage user accounts and access."
            />
            <PageHeader
                title="Users"
                description="Manage your team, user details, and access roles."
            />
            {loadStatus === "error" && (
                <div className="flex justify-center py-8">
                    <Button
                        variant="outline"
                        onClick={retry}
                        disabled={isFetching}
                    >
                        {isFetching ? "Retrying..." : "Retry loading users"}
                    </Button>
                </div>
            )}
            {loadStatus === "loading" && (
                <div
                    className="space-y-4"
                    aria-busy="true"
                    aria-label="Loading users"
                >
                    <div className="grid gap-4 sm:grid-cols-3">
                        {[0, 1, 2].map((index) => (
                            <Skeleton
                                key={index}
                                className="h-28 rounded-xl"
                            />
                        ))}
                    </div>
                    <Skeleton className="h-96 rounded-xl" />
                </div>
            )}
            {loadStatus === "ready" && (
                <>
                    <UserStatistics users={users} />
                    <UserTable
                        users={users}
                        onAdd={openAdd}
                        onEdit={openEdit}
                        onDelete={openDelete}
                    />
                </>
            )}
            {/* Keep the lazy form mounted after first use for closing animations and focus restoration. */}
            {formRequested && (
                <UserForm
                    open={formOpen}
                    onOpenChange={setFormOpen}
                    user={editingUser}
                    users={users}
                    onSave={handleSave}
                    isSaving={isSaving}
                />
            )}
            <AlertDialog
                open={deletingUsers.length > 0}
                onOpenChange={(open) => {
                    if (!open && !isDeleting) setDeletingUsers([])
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Delete{" "}
                            {deletingUsers.length === 1 ? "user" : `${deletingUsers.length} users`}?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {deletingUsers.length === 1
                                ? `${getUserName(deletingUsers[0])} will be removed from this workspace.`
                                : "The selected users will be removed from this workspace."}{" "}
                            This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            variant="destructive"
                            onClick={handleDelete}
                            disabled={isDeleting}
                        >
                            <Trash2 />
                            {isDeleting
                                ? "Deleting..."
                                : `Delete ${deletingUsers.length === 1 ? "user" : "users"}`}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
