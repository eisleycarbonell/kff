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
        <div className="space-y-3">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-1">
                    <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
                    {purpose && (
                        <p className="max-w-4xl text-sm leading-relaxed text-muted-foreground">
                            {guide && <span className="font-medium text-foreground">Purpose: </span>}
                            {purpose}
                        </p>
                    )}
                </div>
                {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
            </div>
            {guide && <ModuleGuide key={pathname} guide={guide} />}
        </div>
    )
}
