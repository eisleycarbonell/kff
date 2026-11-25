import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { ProtectedRouteGuard } from "@/components/layout/protected-route-guard"
import { SessionIdleGuard } from "@/components/layout/session-idle-guard"
import { Separator } from "@/components/ui/separator"
import { AppBreadcrumb } from "@/components/layout/app-breadcrumb"
import { WorkspaceHeaderBadge } from "@/components/layout/workspace-header-badge"
import { RealtimeProvider } from "@/providers/realtime-provider"

export default function Layout({ children }: { children: React.ReactNode }) {
    return (
        <ProtectedRouteGuard>
            <SessionIdleGuard />
            <RealtimeProvider>
                <SidebarProvider>
                    <AppSidebar />
                    <SidebarInset className="min-w-0 max-w-full overflow-x-clip bg-muted/30">
                        <header className="flex h-11 shrink-0 items-center gap-2 sm:h-12">
                            <div className="flex min-w-0 flex-1 items-center justify-between gap-2 px-3 sm:px-4">
                                <div className="flex min-w-0 flex-1 items-center gap-2">
                                    <SidebarTrigger className="-ml-1 shrink-0" />
                                    <Separator
                                        orientation="vertical"
                                        className="mr-1 shrink-0 data-[orientation=vertical]:h-4 sm:mr-2"
                                    />
                                    <AppBreadcrumb />
                                </div>
                                <WorkspaceHeaderBadge />
                            </div>
                        </header>
                        <div className="@container/main flex min-w-0 max-w-full flex-1 flex-col gap-3 p-3 pt-1 sm:gap-4 sm:p-4 sm:pt-1 lg:px-5 lg:pb-5">
                            {children}
                        </div>
                    </SidebarInset>
                </SidebarProvider>
            </RealtimeProvider>
        </ProtectedRouteGuard>
    )
}
