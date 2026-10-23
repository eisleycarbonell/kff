"use client"

import { useMemo } from "react"
import {
    columnFilteringFeature,
    columnVisibilityFeature,
    createColumnHelper,
    createFilteredRowModel,
    createPaginatedRowModel,
    createSortedRowModel,
    filterFn_equalsString,
    filterFn_includesString,
    globalFilteringFeature,
    rowPaginationFeature,
    rowSelectionFeature,
    rowSortingFeature,
    sortFn_text,
    tableFeatures,
    useTable,
} from "@tanstack/react-table"
import {
    ArrowDown,
    ArrowUp,
    ArrowUpDown,
    Check,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    Download,
    Ellipsis,
    Pencil,
    Plus,
    Search,
    Settings2,
    ShieldCheck,
    Trash2,
    UsersRound,
    X,
} from "lucide-react"

import { useUsers } from "@/hooks/modules/user/use-users"
import { UserForm } from "@/components/modules/users/user-form"
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    getRoleName,
    getUserName,
    USER_ROLES,
    type User,
} from "@/components/modules/users/user.schema"

const features = tableFeatures({
    columnFilteringFeature,
    globalFilteringFeature,
    filteredRowModel: createFilteredRowModel(),
    filterFns: { includesString: filterFn_includesString, equalsString: filterFn_equalsString },
    rowSortingFeature,
    sortedRowModel: createSortedRowModel(),
    sortFns: { text: sortFn_text },
    rowPaginationFeature,
    paginatedRowModel: createPaginatedRowModel(),
    rowSelectionFeature,
    columnVisibilityFeature,
})

const helper = createColumnHelper<typeof features, User>()
const dateFormat = new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
})
const roleItems = [
    { value: "all", label: "All roles" },
    ...USER_ROLES.map((role) => ({ value: role.name, label: role.name })),
]
const verificationItems = [
    { value: "all", label: "All email statuses" },
    { value: "Verified", label: "Verified" },
    { value: "Unverified", label: "Unverified" },
]
const pageSizeItems = [5, 10, 20, 50].map((size) => ({ value: String(size), label: String(size) }))
const columnLabels: Record<string, string> = {
    name: "Name",
    email: "Email",
    role: "Role",
    verification: "Email status",
    lastLoginAt: "Last sign in",
    createdAt: "Date added",
}

function exportUsers(users: User[]) {
    const escape = (value: string) =>
        `"${(/^[\s]*[=+\-@]/.test(value) ? "'" + value : value).replaceAll('"', '""')}"`
    const rows = [
        ["First name", "Last name", "Email", "Mobile number", "Role", "Email status", "Date added"],
        ...users.map((user) => [
            user.firstName,
            user.lastName,
            user.email,
            user.mobileNumber,
            getRoleName(user.roleId),
            user.isEmailVerified ? "Verified" : "Unverified",
            user.createdAt.slice(0, 10),
        ]),
    ]
    const url = URL.createObjectURL(
        new Blob(["\uFEFF" + rows.map((row) => row.map(escape).join(",")).join("\r\n")], {
            type: "text/csv;charset=utf-8;",
        }),
    )
    const link = document.createElement("a")
    link.href = url
    link.download = "kff-users.csv"
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function UserTable() {
    const {
        users,
        loadStatus,
        error,
        notice,
        formOpen,
        editingUser,
        deletingUsers,
        setFormOpen,
        setDeletingUsers,
        dismissError,
        dismissNotice,
        openAdd: onAdd,
        openEdit: onEdit,
        openDelete: onDelete,
        handleSave,
        handleDelete,
        retry,
    } = useUsers()
    const columns = useMemo(
        () =>
            helper.columns([
                helper.display({
                    id: "select",
                    enableHiding: false,
                    header: ({ table }) => (
                        <Checkbox
                            aria-label="Select all users on this page"
                            checked={table.getIsAllPageRowsSelected()}
                            indeterminate={
                                table.getIsSomePageRowsSelected() &&
                                !table.getIsAllPageRowsSelected()
                            }
                            onCheckedChange={(checked) => table.toggleAllPageRowsSelected(checked)}
                        />
                    ),
                    cell: ({ row }) => (
                        <Checkbox
                            aria-label={`Select ${getUserName(row.original)}`}
                            checked={row.getIsSelected()}
                            onCheckedChange={(checked) => row.toggleSelected(checked)}
                        />
                    ),
                }),
                helper.accessor((user) => getUserName(user), {
                    id: "name",
                    header: "Name",
                    enableHiding: false,
                    sortFn: "text",
                    filterFn: "includesString",
                    cell: ({ row }) => (
                        <div className="flex items-center gap-3 py-1">
                            <Avatar>
                                <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
                                    {row.original.firstName[0]}
                                    {row.original.lastName[0]}
                                </AvatarFallback>
                            </Avatar>
                            <div>
                                <button
                                    type="button"
                                    className="rounded-sm text-left font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                                    onClick={() => onEdit(row.original)}
                                >
                                    {getUserName(row.original)}
                                </button>
                                <div className="text-xs text-muted-foreground">
                                    {row.original.mobileNumber || "No mobile number"}
                                </div>
                            </div>
                        </div>
                    ),
                }),
                helper.accessor("email", {
                    header: "Email",
                    sortFn: "text",
                    filterFn: "includesString",
                    cell: ({ getValue }) => (
                        <span className="text-muted-foreground">{getValue()}</span>
                    ),
                }),
                helper.accessor((user) => getRoleName(user.roleId), {
                    id: "role",
                    header: "Role",
                    sortFn: "text",
                    filterFn: "equalsString",
                    cell: ({ getValue }) => <Badge variant="outline">{getValue()}</Badge>,
                }),
                helper.accessor((user) => (user.isEmailVerified ? "Verified" : "Unverified"), {
                    id: "verification",
                    header: "Email status",
                    sortFn: "text",
                    filterFn: "equalsString",
                    enableGlobalFilter: false,
                    cell: ({ row }) =>
                        row.original.isEmailVerified ? (
                            <Badge
                                variant="secondary"
                                className="gap-1 bg-primary/10 text-primary"
                            >
                                <Check className="size-3" />
                                Verified
                            </Badge>
                        ) : (
                            <Badge
                                variant="secondary"
                                className="text-muted-foreground"
                            >
                                Unverified
                            </Badge>
                        ),
                }),
                helper.accessor("lastLoginAt", {
                    header: "Last sign in",
                    sortFn: "text",
                    sortUndefined: "last",
                    enableGlobalFilter: false,
                    cell: ({ getValue }) => (
                        <span className="text-muted-foreground">
                            {getValue()
                                ? dateFormat.format(new Date(getValue()!))
                                : "Never signed in"}
                        </span>
                    ),
                }),
                helper.accessor("createdAt", {
                    header: "Date added",
                    sortFn: "text",
                    enableGlobalFilter: false,
                    cell: ({ getValue }) => (
                        <span className="text-muted-foreground">
                            {dateFormat.format(new Date(getValue()))}
                        </span>
                    ),
                }),
                helper.display({
                    id: "actions",
                    enableHiding: false,
                    header: () => <span className="sr-only">Actions</span>,
                    cell: ({ row }) => (
                        <DropdownMenu>
                            <DropdownMenuTrigger
                                render={
                                    <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        aria-label={`Actions for ${getUserName(row.original)}`}
                                    />
                                }
                            >
                                <Ellipsis />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                                align="end"
                                className="w-40"
                            >
                                <DropdownMenuGroup>
                                    <DropdownMenuLabel>Manage user</DropdownMenuLabel>
                                    <DropdownMenuItem onClick={() => onEdit(row.original)}>
                                        <Pencil />
                                        Edit user
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        variant="destructive"
                                        onClick={() => onDelete([row.original])}
                                    >
                                        <Trash2 />
                                        Delete user
                                    </DropdownMenuItem>
                                </DropdownMenuGroup>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    ),
                }),
            ]),
        [onEdit, onDelete],
    )

    const table = useTable({
        features,
        data: users,
        columns,
        getRowId: (user) => String(user.userId),
        globalFilterFn: "includesString",
        initialState: {
            pagination: { pageIndex: 0, pageSize: 10 },
            columnVisibility: { createdAt: false },
            sorting: [{ id: "name", desc: false }],
        },
    })

    const filteredRows = table.getFilteredRowModel().rows
    const selectedRows = table.getFilteredSelectedRowModel().rows
    const hasFilters = Boolean(table.state.globalFilter) || table.state.columnFilters.length > 0
    const { pageIndex, pageSize } = table.state.pagination
    const pageCount = Math.max(table.getPageCount(), 1)

    function clearFilters() {
        table.setGlobalFilter("")
        table.resetColumnFilters()
        table.resetRowSelection()
        table.setPageIndex(0)
    }

    const statistics = [
        {
            label: "Total users",
            value: users.length,
            description: "People in your workspace",
            icon: UsersRound,
        },
        {
            label: "Verified emails",
            value: users.filter((user) => user.isEmailVerified).length,
            description: "Users with a verified email",
            icon: CheckCircle2,
        },
        {
            label: "Administrators",
            value: users.filter((user) => user.roleId === 1).length,
            description: "Users with administrator access",
            icon: ShieldCheck,
        },
    ]

    return (
        <>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge
                    variant="outline"
                    className="text-muted-foreground"
                >
                    Demo data
                </Badge>
                <span>
                    Changes are saved in this browser. Accounts are not connected to sign in.
                </span>
            </div>
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
            {loadStatus === "loading" ? (
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
            ) : (
                loadStatus === "ready" && (
                    <>
                        <div className="grid gap-4 sm:grid-cols-3">
                            {statistics.map(({ label, value, description, icon: Icon }) => (
                                <Card key={label}>
                                    <CardContent>
                                        <div className="flex items-center justify-between text-sm text-muted-foreground">
                                            <span>{label}</span>
                                            <Icon className="size-4" />
                                        </div>
                                        <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">
                                            {value}
                                        </p>
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            {description}
                                        </p>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                        <div className="min-w-0 overflow-hidden rounded-xl border bg-card">
                            <div className="flex flex-col gap-4 p-4">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                        <h2 className="font-semibold">All users</h2>
                                        <Badge variant="secondary">{users.length}</Badge>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            onClick={() =>
                                                exportUsers(
                                                    (selectedRows.length
                                                        ? selectedRows
                                                        : filteredRows
                                                    ).map((row) => row.original),
                                                )
                                            }
                                            disabled={!filteredRows.length}
                                        >
                                            <Download />
                                            {selectedRows.length ? "Export selected" : "Export CSV"}
                                        </Button>
                                        <Button onClick={onAdd}>
                                            <Plus />
                                            Add user
                                        </Button>
                                    </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <div className="relative w-full sm:max-w-72">
                                        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                                        <Input
                                            aria-label="Search users"
                                            placeholder="Search name, email, or role..."
                                            value={table.state.globalFilter ?? ""}
                                            onChange={(event) => {
                                                table.setGlobalFilter(event.target.value)
                                                table.resetRowSelection()
                                                table.setPageIndex(0)
                                            }}
                                            className="pl-8"
                                        />
                                    </div>
                                    <Select
                                        items={roleItems}
                                        value={
                                            (table.getColumn("role")?.getFilterValue() as string) ??
                                            "all"
                                        }
                                        onValueChange={(value) => {
                                            table
                                                .getColumn("role")
                                                ?.setFilterValue(
                                                    value === "all" ? undefined : value,
                                                )
                                            table.resetRowSelection()
                                            table.setPageIndex(0)
                                        }}
                                    >
                                        <SelectTrigger
                                            aria-label="Filter by role"
                                            className="min-w-36"
                                        >
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {roleItems.map((item) => (
                                                <SelectItem
                                                    key={item.value}
                                                    value={item.value}
                                                >
                                                    {item.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Select
                                        items={verificationItems}
                                        value={
                                            (table
                                                .getColumn("verification")
                                                ?.getFilterValue() as string) ?? "all"
                                        }
                                        onValueChange={(value) => {
                                            table
                                                .getColumn("verification")
                                                ?.setFilterValue(
                                                    value === "all" ? undefined : value,
                                                )
                                            table.resetRowSelection()
                                            table.setPageIndex(0)
                                        }}
                                    >
                                        <SelectTrigger
                                            aria-label="Filter by email status"
                                            className="min-w-40"
                                        >
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {verificationItems.map((item) => (
                                                <SelectItem
                                                    key={item.value}
                                                    value={item.value}
                                                >
                                                    {item.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {hasFilters && (
                                        <Button
                                            variant="ghost"
                                            onClick={clearFilters}
                                        >
                                            <X />
                                            Reset
                                        </Button>
                                    )}
                                    <DropdownMenu>
                                        <DropdownMenuTrigger
                                            render={
                                                <Button
                                                    variant="outline"
                                                    className="sm:ml-auto"
                                                />
                                            }
                                        >
                                            <Settings2 />
                                            Columns
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent
                                            align="end"
                                            className="w-44"
                                        >
                                            <DropdownMenuGroup>
                                                <DropdownMenuLabel>
                                                    Visible columns
                                                </DropdownMenuLabel>
                                                {table
                                                    .getAllLeafColumns()
                                                    .filter((column) => column.getCanHide())
                                                    .map((column) => (
                                                        <DropdownMenuCheckboxItem
                                                            key={column.id}
                                                            checked={column.getIsVisible()}
                                                            onCheckedChange={(checked) =>
                                                                column.toggleVisibility(checked)
                                                            }
                                                            closeOnClick={false}
                                                        >
                                                            {columnLabels[column.id] ?? column.id}
                                                        </DropdownMenuCheckboxItem>
                                                    ))}
                                            </DropdownMenuGroup>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                                {selectedRows.length > 0 && (
                                    <div className="flex flex-wrap items-center gap-3 rounded-lg bg-muted/60 px-3 py-2 text-sm">
                                        <span className="font-medium">
                                            {selectedRows.length} user
                                            {selectedRows.length === 1 ? "" : "s"} selected
                                        </span>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => table.resetRowSelection()}
                                        >
                                            Clear selection
                                        </Button>
                                        <Button
                                            variant="destructive"
                                            size="sm"
                                            className="ml-auto"
                                            onClick={() =>
                                                onDelete(selectedRows.map((row) => row.original))
                                            }
                                        >
                                            <Trash2 />
                                            Delete selected
                                        </Button>
                                    </div>
                                )}
                            </div>
                            <Table>
                                <TableHeader className="bg-muted/40">
                                    {table.getHeaderGroups().map((group) => (
                                        <TableRow key={group.id}>
                                            {group.headers.map((header) => (
                                                <TableHead
                                                    key={header.id}
                                                    className={
                                                        header.column.id === "select"
                                                            ? "w-12 pl-4"
                                                            : header.column.id === "actions"
                                                              ? "w-12 pr-4"
                                                              : "px-3"
                                                    }
                                                    aria-sort={
                                                        header.column.getCanSort()
                                                            ? header.column.getIsSorted() === "asc"
                                                                ? "ascending"
                                                                : header.column.getIsSorted() ===
                                                                    "desc"
                                                                  ? "descending"
                                                                  : "none"
                                                            : undefined
                                                    }
                                                >
                                                    {header.isPlaceholder ? null : header.column.getCanSort() ? (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="-ml-2"
                                                            onClick={header.column.getToggleSortingHandler()}
                                                        >
                                                            <table.FlexRender header={header} />
                                                            {header.column.getIsSorted() ===
                                                            "asc" ? (
                                                                <ArrowUp className="size-3.5" />
                                                            ) : header.column.getIsSorted() ===
                                                              "desc" ? (
                                                                <ArrowDown className="size-3.5" />
                                                            ) : (
                                                                <ArrowUpDown className="size-3.5 text-muted-foreground" />
                                                            )}
                                                        </Button>
                                                    ) : (
                                                        <table.FlexRender header={header} />
                                                    )}
                                                </TableHead>
                                            ))}
                                        </TableRow>
                                    ))}
                                </TableHeader>
                                <TableBody>
                                    {table.getRowModel().rows.length ? (
                                        table.getRowModel().rows.map((row) => (
                                            <TableRow
                                                key={row.id}
                                                data-state={
                                                    row.getIsSelected() ? "selected" : undefined
                                                }
                                            >
                                                {row.getVisibleCells().map((cell) => (
                                                    <TableCell
                                                        key={cell.id}
                                                        className={
                                                            cell.column.id === "select"
                                                                ? "pl-4"
                                                                : cell.column.id === "actions"
                                                                  ? "pr-4 text-right"
                                                                  : "px-3 py-3"
                                                        }
                                                    >
                                                        <table.FlexRender cell={cell} />
                                                    </TableCell>
                                                ))}
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell
                                                colSpan={table.getVisibleLeafColumns().length}
                                                className="h-64 text-center"
                                            >
                                                <UsersRound className="mx-auto mb-3 size-8 text-muted-foreground" />
                                                <p className="font-medium">
                                                    {hasFilters
                                                        ? "No users match your filters"
                                                        : "No users yet"}
                                                </p>
                                                <p className="mt-1 text-muted-foreground">
                                                    {hasFilters
                                                        ? "Try a different search or clear your filters."
                                                        : "Add your first user to get started."}
                                                </p>
                                                <Button
                                                    variant="outline"
                                                    className="mt-4"
                                                    onClick={hasFilters ? clearFilters : onAdd}
                                                >
                                                    {hasFilters ? "Clear filters" : "Add user"}
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                            <div className="flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                                <p
                                    className="text-sm text-muted-foreground"
                                    aria-live="polite"
                                >
                                    {filteredRows.length
                                        ? `${pageIndex * pageSize + 1}–${Math.min((pageIndex + 1) * pageSize, filteredRows.length)}`
                                        : "0"}{" "}
                                    of {filteredRows.length} users
                                </p>
                                <div className="flex flex-wrap items-center gap-4">
                                    <div className="flex items-center gap-2 text-sm">
                                        <span className="text-muted-foreground">Rows per page</span>
                                        <Select
                                            items={pageSizeItems}
                                            value={String(pageSize)}
                                            onValueChange={(value) => {
                                                if (value) table.setPageSize(Number(value))
                                            }}
                                        >
                                            <SelectTrigger
                                                aria-label="Rows per page"
                                                className="w-16"
                                            >
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {pageSizeItems.map((item) => (
                                                    <SelectItem
                                                        key={item.value}
                                                        value={item.value}
                                                    >
                                                        {item.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <span className="text-sm tabular-nums">
                                        Page {pageIndex + 1} of {pageCount}
                                    </span>
                                    <div className="flex items-center gap-1">
                                        <Button
                                            variant="outline"
                                            size="icon-sm"
                                            aria-label="First page"
                                            disabled={!table.getCanPreviousPage()}
                                            onClick={() => table.firstPage()}
                                        >
                                            <ChevronsLeft />
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="icon-sm"
                                            aria-label="Previous page"
                                            disabled={!table.getCanPreviousPage()}
                                            onClick={() => table.previousPage()}
                                        >
                                            <ChevronLeft />
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="icon-sm"
                                            aria-label="Next page"
                                            disabled={!table.getCanNextPage()}
                                            onClick={() => table.nextPage()}
                                        >
                                            <ChevronRight />
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="icon-sm"
                                            aria-label="Last page"
                                            disabled={!table.getCanNextPage()}
                                            onClick={() => table.lastPage()}
                                        >
                                            <ChevronsRight />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                )
            )}
            <UserForm
                open={formOpen}
                onOpenChange={setFormOpen}
                user={editingUser}
                users={users}
                onSave={handleSave}
                submitError={error}
            />
            <AlertDialog
                open={deletingUsers.length > 0}
                onOpenChange={(open) => {
                    if (!open) setDeletingUsers([])
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
                                ? `${getUserName(deletingUsers[0])} will be removed from this demo workspace.`
                                : "The selected users will be removed from this demo workspace."}{" "}
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
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            variant="destructive"
                            onClick={handleDelete}
                        >
                            <Trash2 />
                            Delete {deletingUsers.length === 1 ? "user" : "users"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
