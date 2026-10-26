import type { LucideIcon } from "lucide-react"

type PagePlaceholderProps = {
    icon: LucideIcon
    title?: string
    description?: string
}

/** Temporary empty state for routes whose module UI hasn't been built yet. */
export function PagePlaceholder({
    icon: Icon,
    title = "Coming soon",
    description = "This module is not built yet.",
}: PagePlaceholderProps) {
    return (
        <div className="flex min-h-[50vh] flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-muted/30 p-8 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                <Icon className="size-6 text-muted-foreground" />
            </div>
            <div className="space-y-1">
                <h2 className="text-base font-medium">{title}</h2>
                <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
            </div>
        </div>
    )
}
