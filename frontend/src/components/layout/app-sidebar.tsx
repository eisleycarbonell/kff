"use client"

import * as React from "react"
import {
    LayoutDashboard,
    UsersRound,
    ChartNoAxesCombined,
    Command,
    Boxes,
    ClipboardList,
    ShoppingCart,
    Database,
    Settings,
    ArrowLeftRight,
    Truck,
} from "lucide-react"
import { NavMain } from "@/components/layout/nav-main"
import { NavUser } from "@/components/layout/nav-user"
import { useCompanySettings } from "@/hooks/modules/company-settings/use-company-settings"
import { useSession } from "@/hooks/use-session"
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@/components/ui/sidebar"

const data = {
    user: {
        name: "KFF",
        email: "kff@example.com",
        avatar: "/avatars/shadcn.jpg",
    },
    navMain: [
        {
            title: "Dashboard",
            url: "/dashboard",
            icon: LayoutDashboard,
        },
        {
            title: "Inventory",
            url: "#",
            icon: Boxes,
            items: [
                {
                    title: "Inventory Stock",
                    url: "/inventory",
                },
                { title: "Lots / Batches", url: "/inventory/lots" },
                { title: "Stock Movements", url: "/inventory/transactions" },
                { title: "Stock Adjustments", url: "/inventory/adjustments" },
                { title: "Scrap & Disposal", url: "/inventory/scrap" },
            ],
        },
        {
            title: "Purchasing",
            url: "#",
            icon: ShoppingCart,
            items: [
                {
                    title: "Purchase Orders",
                    url: "/purchase-orders",
                },
                {
                    title: "Receiving",
                    url: "/receiving",
                },
            ],
        },
        {
            title: "Packing",
            url: "#",
            icon: ClipboardList,
            items: [
                {
                    title: "Packing Orders",
                    url: "/packing-orders",
                },
                {
                    title: "Material Reservations",
                    url: "/packing-orders/reservations",
                },
            ],
        },
        {
            title: "Transfers",
            url: "#",
            icon: ArrowLeftRight,
            items: [{ title: "Stock Transfers", url: "/transfers" }],
        },
        {
            title: "Sales & Delivery",
            url: "#",
            icon: Truck,
            items: [
                {
                    title: "Sales Orders",
                    url: "/sales-orders",
                },
                { title: "Delivery Orders", url: "/delivery-orders" },
            ],
        },
        {
            title: "Master Data",
            url: "#",
            icon: Database,
            items: [
                {
                    title: "Items / Products",
                    url: "/items",
                },
                { title: "Brands", url: "/brands" },
                { title: "Packing Formulas", url: "/bom" },
                { title: "Formula Revisions", url: "/formula-revisions" },
                { title: "Item Packaging", url: "/item-packaging" },
                { title: "Reorder Levels", url: "/reorder-policies" },
                { title: "Reason Codes", url: "/reason-codes" },
                {
                    title: "Suppliers",
                    url: "/suppliers",
                },
                { title: "Customers", url: "/customers" },
                {
                    title: "Locations",
                    url: "/locations",
                },
                {
                    title: "Units of Measure",
                    url: "/uom",
                },
            ],
        },
        {
            title: "Reports",
            url: "#",
            icon: ChartNoAxesCombined,
            items: [
                { title: "Inventory Reports", url: "/reports/inventory" },
                { title: "Packing Report", url: "/reports/packing" },
                { title: "Purchasing Report", url: "/reports/purchasing" },
                { title: "Transfer Report", url: "/reports/transfers" },
                { title: "Lot Genealogy", url: "/reports/genealogy" },
            ],
        },
        {
            title: "Users & Access",
            url: "#",
            icon: UsersRound,
            items: [
                {
                    title: "Users",
                    url: "/users",
                },
                {
                    title: "Roles & Permissions",
                    url: "/roles",
                },
            ],
        },
        {
            title: "Settings",
            url: "#",
            icon: Settings,
            items: [{ title: "Company Settings", url: "/settings" }],
        },
    ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
    const session = useSession()
    const company = useCompanySettings()
    const items = data.navMain.filter(
        (item) =>
            item.title !== "Users & Access" || session.data?.permissions.canManageUsers === true,
    )
    return (
        <Sidebar variant="inset" {...props}>
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" render={<a href="#" />}>
                            <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                                <Command className="size-4" />
                            </div>
                            <div className="grid flex-1 text-left text-sm leading-tight">
                                <span className="truncate font-medium">
                                    {company.settings?.companyName ?? "Kusina Filipino Food"}
                                </span>
                                <span className="truncate text-xs">Team workspace</span>
                            </div>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>
            <SidebarContent>
                <NavMain items={items} />
                {/* <NavProjects projects={data.projects} />
                <NavSecondary items={data.navSecondary} className="mt-auto" /> */}
            </SidebarContent>
            <SidebarFooter>
                <NavUser user={data.user} />
            </SidebarFooter>
        </Sidebar>
    )
}
