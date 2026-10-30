"use client"

import { Fragment } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

type BreadcrumbConfig = {
    label: string
    group?: string
}

// Route labels aligned with the sidebar.
const routeConfig: Record<string, BreadcrumbConfig> = {
    // Dashboard
    "/dashboard": { label: "Dashboard" },

    // Inventory Management
    "/items": {
        label: "Items / Products",
        group: "Master Data",
    },
    "/receiving": {
        label: "Receiving",
        group: "Purchasing",
    },
    "/lots": {
        label: "Lots / Batches",
        group: "Purchasing",
    },
    "/inventory": {
        label: "Inventory Stocks",
        group: "Inventory Management",
    },
    "/inventory/locations": {
        label: "Stock by Location",
    },
    "/inventory/lots": {
        label: "Stock by Lot",
    },
    "/inventory/transactions": {
        label: "Transactions",
    },
    "/inventory/adjustments": {
        label: "Adjustments",
    },
    "/transfers": {
        label: "Stock Transfers",
        group: "Transfers",
    },
    "/transfers/in-transit": {
        label: "In Transit",
        group: "Transfers",
    },

    // Orders & Operations
    "/purchase-orders": {
        label: "Purchase Orders",
        group: "Purchasing",
    },
    "/packing-orders": {
        label: "Packing Orders",
        group: "Packing",
    },
    "/packing-orders/reservations": {
        label: "Material Reservations",
        group: "Packing",
    },
    "/sales-orders": {
        label: "Sales Orders",
        group: "Orders & Operations",
    },

    // Master Data
    "/locations": {
        label: "Locations",
        group: "Master Data",
    },
    "/uom": {
        label: "Units of Measure",
        group: "Master Data",
    },
    "/bom": {
        label: "Packing Formulas",
        group: "Master Data",
    },

    // Business Partners
    "/suppliers": {
        label: "Suppliers",
        group: "Master Data",
    },
    "/customers": {
        label: "Customers",
        group: "Business Partners",
    },

    // Reports
    "/reports": {
        label: "Reports & Analytics",
    },
    "/reports/inventory": {
        label: "Inventory Report",
    },
    "/reports/packing": {
        label: "Packing Report",
    },
    "/reports/purchasing": {
        label: "Purchasing Report",
    },
    "/reports/transfers": {
        label: "Transfer Report",
    },

    // Administration
    "/users": {
        label: "Users",
        group: "Administration",
    },
    "/roles": {
        label: "Roles & Permissions",
        group: "Administration",
    },
    "/settings": {
        label: "Settings",
        group: "Administration",
    },
}

// Human-readable fallback for dynamic routes.
function formatLabel(segment: string): string {
    return decodeURIComponent(segment)
        .replace(/[-_]/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase())
}

export function AppBreadcrumb() {
    const pathname = usePathname()

    const currentPath = pathname === "/" ? "/dashboard" : pathname.replace(/\/+$/, "")

    const segments = currentPath.split("/").filter(Boolean)

    // Get parent route paths.
    const parentPaths = segments.slice(0, -1).map((_, index) => {
        return `/${segments.slice(0, index + 1).join("/")}`
    })

    const currentRoute = routeConfig[currentPath]

    // Determine group based on current route or parent routes.
    const group =
        currentRoute?.group ??
        [...parentPaths]
            .reverse()
            .map((path) => routeConfig[path]?.group)
            .find(Boolean) ??
        (segments[0] === "reports" ? "Reports & Analytics" : undefined)

    type BreadcrumbEntry = {
        label: string
        href?: string
    }

    const breadcrumbs: BreadcrumbEntry[] = []

    // Add sidebar group when available.
    if (group) {
        breadcrumbs.push({
            label: group,
        })
    }

    // Add valid parent pages.
    parentPaths.forEach((href) => {
        const parent = routeConfig[href]

        if (!parent) return

        // Avoid duplicating the group name.
        if (parent.label === group) return

        // Avoid showing a parent from another sidebar group.
        if (parent.group && parent.group !== group) return

        breadcrumbs.push({
            label: parent.label,
            href,
        })
    })

    // Add current page.
    breadcrumbs.push({
        label: currentRoute?.label ?? formatLabel(segments[segments.length - 1] ?? "Dashboard"),
    })

    return (
        <Breadcrumb>
            <BreadcrumbList>
                {breadcrumbs.map((item, index) => {
                    const isLast = index === breadcrumbs.length - 1

                    return (
                        <Fragment key={`${index}-${item.label}`}>
                            {index > 0 && <BreadcrumbSeparator />}

                            <BreadcrumbItem>
                                {isLast ? (
                                    <BreadcrumbPage>{item.label}</BreadcrumbPage>
                                ) : item.href ? (
                                    <BreadcrumbLink render={<Link href={item.href} />}>
                                        {item.label}
                                    </BreadcrumbLink>
                                ) : (
                                    <span className="text-muted-foreground">{item.label}</span>
                                )}
                            </BreadcrumbItem>
                        </Fragment>
                    )
                })}
            </BreadcrumbList>
        </Breadcrumb>
    )
}
