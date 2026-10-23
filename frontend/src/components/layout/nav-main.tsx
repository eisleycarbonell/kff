
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, type LucideIcon } from "lucide-react";

import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";

import {
    SidebarGroup,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem,
} from "@/components/ui/sidebar";

type NavSubItem = {
    title: string;
    url: string;
};

type NavItem = {
    title: string;
    url: string;
    icon?: LucideIcon;
    isActive?: boolean;
    items?: NavSubItem[];
};

type NavMainProps = {
    items: NavItem[];
};

export function NavMain({ items }: NavMainProps) {
    const pathname = usePathname();

    const isRouteMatch = (url: string) =>
        url !== "#" &&
        (pathname === url || pathname.startsWith(`${url}/`));

    // Find the most specific matching route.
    const activeUrl = items
        .flatMap((item) =>
            item.items?.length ? item.items : [item]
        )
        .filter((item) => isRouteMatch(item.url))
        .sort((a, b) => b.url.length - a.url.length)[0]?.url;

    // Find the dropdown containing the active page.
    const activeGroup = items.find((item) =>
        item.items?.some((subItem) => subItem.url === activeUrl)
    )?.title;

    // Each dropdown maintains its own expanded state.
    const [openGroups, setOpenGroups] = useState<string[]>(
        () => (activeGroup ? [activeGroup] : [])
    );

    // Automatically open the active group without closing others.
    useEffect(() => {
        if (!activeGroup) return;

        setOpenGroups((prev) =>
            prev.includes(activeGroup)
                ? prev
                : [...prev, activeGroup]
        );
    }, [pathname, activeGroup]);

    // Toggle only the selected dropdown.
    const toggleGroup = (title: string, open: boolean) => {
        setOpenGroups((prev) =>
            open
                ? prev.includes(title)
                    ? prev
                    : [...prev, title]
                : prev.filter((group) => group !== title)
        );
    };

    return (
        <SidebarGroup>
            <SidebarGroupLabel>Navigation</SidebarGroupLabel>
            <SidebarMenu>
                {items.map((item) => {
                    const hasSubItems = Boolean(item.items?.length);

                    const isActive = activeUrl === item.url;

                    const isGroupActive =
                        item.title === activeGroup;

                    // Direct navigation links.
                    if (!hasSubItems) {
                        return (
                            <SidebarMenuItem key={item.title}>
                                <SidebarMenuButton
                                    render={<Link href={item.url} />}
                                    tooltip={item.title}
                                    isActive={isActive}
                                >
                                    {item.icon && <item.icon />}
                                    <span>{item.title}</span>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        );
                    }

                    // Independent collapsible dropdowns.
                    return (
                        <Collapsible
                            key={item.title}
                            open={openGroups.includes(item.title)}
                            onOpenChange={(open) =>
                                toggleGroup(item.title, open)
                            }
                            className="group/collapsible"
                            render={<SidebarMenuItem />}
                        >
                            <CollapsibleTrigger
                                render={
                                    <SidebarMenuButton
                                        tooltip={item.title}
                                        isActive={isGroupActive}
                                    />
                                }
                            >
                                {item.icon && <item.icon />}

                                <span>{item.title}</span>

                                <ChevronRight
                                    className="ml-auto transition-transform duration-200 group-data-open/collapsible:rotate-90"
                                />
                            </CollapsibleTrigger>

                            <CollapsibleContent>
                                <SidebarMenuSub>
                                    {item.items?.map((subItem) => {
                                        const isSubActive =
                                            activeUrl === subItem.url;

                                        return (
                                            <SidebarMenuSubItem
                                                key={subItem.url}
                                            >
                                                <SidebarMenuSubButton
                                                    render={
                                                        <Link
                                                            href={subItem.url}
                                                        />
                                                    }
                                                    isActive={isSubActive}
                                                >
                                                    <span>
                                                        {subItem.title}
                                                    </span>
                                                </SidebarMenuSubButton>
                                            </SidebarMenuSubItem>
                                        );
                                    })}
                                </SidebarMenuSub>
                            </CollapsibleContent>
                        </Collapsible>
                    );
                })}
            </SidebarMenu>
        </SidebarGroup>
    );
}
