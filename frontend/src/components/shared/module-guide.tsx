import Link from "next/link"
import { ArrowRight, BookOpen, ChevronDown } from "lucide-react"
import type { ModuleGuide as ModuleGuideContent } from "@/lib/module-guides"

export function ModuleGuide({ guide }: { guide: ModuleGuideContent }) {
    return (
        <details className="group rounded-xl border bg-card" aria-label={`${guide.title} guide`}>
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
                <BookOpen className="size-4 shrink-0 text-primary" aria-hidden="true" />
                <span className="min-w-0 flex-1">How to use this module</span>
                <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
            </summary>
            <div className="space-y-4 border-t px-4 py-4 text-sm">
                <section aria-label={`Steps to use ${guide.title}`}>
                    <h2 className="font-semibold">How to use {guide.title}</h2>
                    <ol className="mt-2 list-decimal space-y-2 pl-5 leading-relaxed text-muted-foreground">
                        {guide.steps.map((step) => <li key={step} className="pl-1">{step}</li>)}
                    </ol>
                </section>
                <nav aria-label={`${guide.title} workflow`}>
                    <h2 className="font-semibold">Where it fits in the flow</h2>
                    <ol className="mt-2 flex flex-wrap items-center gap-2">
                        {guide.workflow.map((step, index) => (
                            <li key={`${step.href}-${step.label}`} className="inline-flex min-w-0 items-center gap-2">
                                {index > 0 && <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />}
                                <Link href={step.href} className="rounded-md border bg-background px-2.5 py-1.5 font-medium text-primary outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                                    {step.label}
                                </Link>
                            </li>
                        ))}
                    </ol>
                </nav>
                {guide.note && <p className="border-l-2 border-primary/40 pl-3 leading-relaxed text-muted-foreground">{guide.note}</p>}
            </div>
        </details>
    )
}
