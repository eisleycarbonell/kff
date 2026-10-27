import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { Separator } from "@/components/ui/separator"
import { AppBreadcrumb } from "@/components/layout/app-breadcrumb";

export default function Layout({ children }: { children: React.ReactNode }) {
    return (
        <SidebarProvider>
            <AppSidebar />
            <SidebarInset className="bg-muted/30">
                <header className="flex h-16 shrink-0 items-center gap-2">
                    <div className="flex items-center gap-2 px-4">
                        <SidebarTrigger className="-ml-1" />
                        <Separator
                            orientation="vertical"
                            className="mr-2 data-[orientation=vertical]:h-4"
                        />
                        <AppBreadcrumb />
                    </div>
                </header>
                <div className="flex min-w-0 flex-1 flex-col gap-5 p-4 pt-0 lg:gap-6 lg:px-6 lg:pb-6">
                    {children}
                </div>
            </SidebarInset>
        </SidebarProvider>
    )
}
