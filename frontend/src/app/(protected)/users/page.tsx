import type { Metadata } from "next"
import { UserTable } from "@/components/modules/users/user-table"
import { PageHeader } from "@/components/shared/page-header"

export const metadata: Metadata = {
    title: "Users",
    description: "Manage user accounts and access.",
}

export default function UsersPage() {
    return (
        <>
            <PageHeader
                title="Users"
                description="Manage your team, user details, and access roles."
            />
            <UserTable />
        </>
    )
}
