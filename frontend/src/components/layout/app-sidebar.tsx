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
} from "lucide-react"
import { NavMain } from "@/components/layout/nav-main"
import { NavUser } from "@/components/layout/nav-user"
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
            title: "Inventory Management",
            url: "#",
            icon: Boxes,
            items: [
                {
                    title: "Inventory Stocks",
                    url: "/inventory",
                },
                {
                    title: "Inventory Reservations",
                    url: "/packing-orders/reservations",
                },
                {
                    title: "Stock Transfers",
                    url: "/transfers",
                },
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
                {
                    title: "Lots / Batches",
                    url: "/lots",
                },
            ],
        },
        {
            title: "Orders & Operations",
            url: "#",
            icon: ClipboardList,
            items: [
                {
                    title: "Packing Orders",
                    url: "/packing-orders",
                },
                {
                    title: "Sales Orders",
                    url: "/sales-orders",
                },
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
                {
                    title: "Suppliers",
                    url: "/suppliers",
                },
                {
                    title: "Locations",
                    url: "/locations",
                },
                {
                    title: "Units of Measure",
                    url: "/uom",
                },
                {
                    title: "Packing Formulas",
                    url: "/bom",
                },
            ],
        },
        {
            title: "Business Partners",
            url: "#",
            icon: UsersRound,
            items: [
                {
                    title: "Customers",
                    url: "/customers",
                },
            ],
        },
        {
            title: "Reports & Analytics",
            url: "/reports/inventory",
            icon: ChartNoAxesCombined,
        },
        {
            title: "Administration",
            url: "#",
            icon: Settings,
            items: [
                {
                    title: "Users",
                    url: "/users",
                },
                {
                    title: "Roles & Permissions",
                    url: "/roles",
                },
                {
                    title: "Settings",
                    url: "/settings",
                },
            ],
        },
    ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
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
                                <span className="truncate font-medium">Kusina Filipino Food</span>
                                <span className="truncate text-xs">Admin</span>
                            </div>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>
            <SidebarContent>
                <NavMain items={data.navMain} />
                {/* <NavProjects projects={data.projects} />
                <NavSecondary items={data.navSecondary} className="mt-auto" /> */}
            </SidebarContent>
            <SidebarFooter>
                <NavUser user={data.user} />
            </SidebarFooter>
        </Sidebar>
    )
}
