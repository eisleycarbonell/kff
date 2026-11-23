"use client"

import type { ReactNode } from "react"
import { usePathname } from "next/navigation"
import { getModuleGuide } from "@/lib/module-guides"
import { ModuleGuide } from "@/components/shared/module-guide"

type PageHeaderProps = {
    title: string
    description?: string
    /** Optional right-aligned actions, e.g. a "New" button. */
    actions?: ReactNode
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
    const pathname = usePathname()
    const guide = getModuleGuide(pathname)
    const purpose = guide?.purpose ?? description

    return (
        <div className="space-y-2">
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-0.5">
                    <h1 className="text-lg font-semibold tracking-tight sm:text-xl">{title}</h1>
                    {purpose && (
                        <p className="max-w-4xl text-xs leading-snug text-muted-foreground sm:text-sm">
                            {guide && <span className="font-medium text-foreground">Purpose: </span>}
                            {purpose}
                        </p>
                    )}
                </div>
                {actions && (
                    <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:shrink-0 sm:justify-end">
                        {actions}
                    </div>
                )}
            </div>
            {guide && <ModuleGuide key={pathname} guide={guide} />}
        </div>
    )
}
