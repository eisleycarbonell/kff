"use client"

import dynamic from "next/dynamic"
import { CheckCircle2, Trash2, X } from "lucide-react"

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
        error,
        notice,
        formOpen,
        formRequested,
        editingUser,
        deletingUsers,
        setFormOpen,
        setDeletingUsers,
        dismissError,
        dismissNotice,
        openAdd,
        openEdit,
        openDelete,
        handleSave,
        handleDelete,
        retry,
        isSaving,
        isDeleting,
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
            {error && !formOpen && !deletingUsers.length && (
                <div
                    role="alert"
                    className="flex items-start justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
                >
                    <p>{error}</p>
                    {loadStatus === "error" ? (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={retry}
                        >
                            Retry
                        </Button>
                    ) : (
                        <Button
                            variant="ghost"
                            size="icon-xs"
                            aria-label="Dismiss error"
                            onClick={dismissError}
                        >
                            <X />
                        </Button>
                    )}
                </div>
            )}
            {notice && (
                <div
                    role="status"
                    className="flex items-center justify-between gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm"
                >
                    <span className="flex items-center gap-2">
                        <CheckCircle2 className="size-4 text-primary" />
                        {notice}
                    </span>
                    <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label="Dismiss notification"
                        onClick={dismissNotice}
                    >
                        <X />
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
                    submitError={error}
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
                    {error && (
                        <p
                            role="alert"
                            className="text-sm text-destructive"
                        >
                            {error}
                        </p>
                    )}
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            variant="destructive"
                            onClick={handleDelete}
                            disabled={isDeleting}
                        >
                            <Trash2 />
                            {isDeleting ? "Deleting..." : `Delete ${deletingUsers.length === 1 ? "user" : "users"}`}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
