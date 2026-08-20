import { useState } from "react"
import { Outlet } from "react-router-dom"

import { Footer } from "@/components/layout/Footer"
import { Header } from "@/components/layout/Header"
import { MobileDrawer } from "@/components/layout/MobileDrawer"
import { Sidebar } from "@/components/layout/Sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"

export function AppLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex min-h-screen bg-background">
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed((c) => !c)}
        />
        <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Header onMenuClick={() => setDrawerOpen(true)} />
          <main className="mx-auto w-full max-w-[1600px] flex-1 p-4 sm:p-6 lg:p-8">
            <Outlet />
          </main>
          <Footer />
        </div>
      </div>
    </TooltipProvider>
  )
}
