import { useState, createContext, useContext, useEffect } from "react"
import { useLocation, useNavigate, Outlet } from "react-router-dom"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import {
  LogOut,
  Calendar,
  BarChart3,
  Package,
  Smartphone,
  Monitor,
  Settings,
  Sparkles,
  ClipboardList,
  Menu,
} from "lucide-react"
import { useAuth } from "../contexts/AuthContext"
import { useIsMobile } from "./hooks/use-mobile"

// Mobile View Context
interface MobileViewContextType {
  isMobileView: boolean
  toggleMobileView: () => void
}

const MobileViewContext = createContext<MobileViewContextType>({
  isMobileView: false,
  toggleMobileView: () => {},
})

export const useMobileView = () => useContext(MobileViewContext)

export function Dashboard() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [isMobileView, setIsMobileView] = useState(isMobile)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    setIsMobileView(isMobile)
  }, [isMobile])

  const toggleMobileView = () => {
    setIsMobileView(!isMobileView)
  }

  const handleLogout = async () => {
    await logout()
    navigate("/login")
  }

  const handleTabChange = (value: string) => {
    navigate(`/${value}`)
    setSidebarOpen(false) // Close sidebar when navigating
  }

  const getActiveTab = () => {
    // Default to 'orders' if the path is '/' or '/dashboard'
    const path = location.pathname.substring(1)
    if (path === "" || path === "dashboard") {
      return "orders"
    }
    return path
  }

  if (!user) {
    return null // Should be handled by ProtectedRoute
  }

  const navigationItems = [
    { value: "orders", label: "Orders", icon: ClipboardList },
    { value: "analytics", label: "Analytics", icon: BarChart3 },
    ...(user.role === "admin" ? [
      { value: "products", label: "Products", icon: Package },
      { value: "ai-integration", label: "AI", icon: Sparkles },
      { value: "settings", label: "Settings", icon: Settings },
    ] : [])
  ]

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold">Navigation</h2>
      </div>
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {navigationItems.map((item) => (
            <li key={item.value}>
              <Button
                variant={getActiveTab() === item.value ? "default" : "ghost"}
                className="w-full justify-start"
                onClick={() => handleTabChange(item.value)}
              >
                <item.icon className="h-4 w-4 mr-2" />
                {item.label}
              </Button>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )

  return (
    <MobileViewContext.Provider value={{ isMobileView, toggleMobileView }}>
      <div
        className={`min-h-screen bg-gray-50 ${isMobileView ? "max-w-[440px] mx-auto border-x-4 border-gray-400 shadow-2xl" : ""}`}
      >
        <header className="bg-white shadow-sm border-b">
          <div className={`mx-auto ${isMobileView ? "px-2" : "max-w-7xl px-4 sm:px-6 lg:px-8"}`}>
            <div
              className={`flex justify-between items-center h-16 ${isMobileView ? "gap-2" : ""}`}
            >
              <div className="flex items-center">
                {/* Mobile Sidebar Toggle */}
                {isMobileView && (
                  <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
                    <SheetTrigger asChild>
                      <Button variant="ghost" size="sm" className="mr-2 p-1">
                        <Menu className="h-4 w-4" />
                      </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="w-64 p-0">
                      <SidebarContent />
                    </SheetContent>
                  </Sheet>
                )}
                
                <h1
                  className={`font-semibold text-gray-900 ${isMobileView ? "text-base" : "text-xl"}`}
                >
                  {isMobileView ? "Dashboard" : "Florist Dashboard"}
                </h1>
                <span
                  className={`px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full ${isMobileView ? "ml-2" : "ml-4"}`}
                >
                  {user.role}
                </span>
                {isMobileView && (
                  <span className="ml-1 px-1 py-1 bg-orange-100 text-orange-800 text-[10px] rounded-full">
                    📱
                  </span>
                )}
              </div>
              <div className={`flex items-center ${isMobileView ? "space-x-1" : "space-x-4"}`}>
                {!isMobileView && (
                  <span className="text-sm text-gray-700">Welcome, {user.name}</span>
                )}

                {/* Mobile View Toggle */}
                <Button
                  variant={isMobileView ? "default" : "outline"}
                  size="sm"
                  onClick={toggleMobileView}
                  className={`${isMobileView ? "bg-orange-600 hover:bg-orange-700 text-xs px-2" : ""}`}
                  title={isMobileView ? "Switch to Desktop View" : "Switch to Mobile View"}
                >
                  {isMobileView ? (
                    <>
                      <Monitor className="h-3 w-3 mr-1" />
                      Desktop
                    </>
                  ) : (
                    <>
                      <Smartphone className="h-4 w-4 mr-2" />
                      Mobile
                    </>
                  )}
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLogout}
                  className={isMobileView ? "text-xs px-2" : ""}
                >
                  <LogOut className={`${isMobileView ? "h-3 w-3 mr-1" : "h-4 w-4 mr-2"}`} />
                  {isMobileView ? "Out" : "Logout"}
                </Button>
              </div>
            </div>
          </div>
        </header>

        <main
          className={`mx-auto py-4 ${isMobileView ? "px-2" : "max-w-7xl px-4 sm:px-6 lg:px-8 py-8"}`}
        >
          {isMobileView ? (
            // Mobile: No tabs, just the outlet with sidebar navigation
            <div className="space-y-4">
              <Outlet />
            </div>
          ) : (
            // Desktop: Keep the existing tabs layout
            <Tabs
              value={getActiveTab()}
              onValueChange={handleTabChange}
              className="space-y-6"
            >
              <TabsList className="grid w-full grid-cols-5">
                {navigationItems.map((item) => (
                  <TabsTrigger
                    key={item.value}
                    value={item.value}
                    className="flex items-center gap-2"
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </TabsTrigger>
                ))}
              </TabsList>

              <div className="mt-6">
                <Outlet />
              </div>
            </Tabs>
          )}
        </main>
      </div>
    </MobileViewContext.Provider>
  )
}
