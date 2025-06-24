import { useState, createContext, useContext, useEffect } from "react"
import { useLocation, useNavigate, Outlet } from "react-router-dom"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import {
  LogOut,
  Calendar,
  BarChart3,
  Package,
  Smartphone,
  Monitor,
  Settings,
  Sparkles,
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
  }

  const getActiveTab = () => {
    // Default to 'dashboard' if the path is '/' or '/dashboard'
    const path = location.pathname.substring(1)
    if (path === "" || path === "dashboard") {
      return "dashboard"
    }
    return path
  }

  if (!user) {
    return null // Should be handled by ProtectedRoute
  }

  return (
    <MobileViewContext.Provider value={{ isMobileView, toggleMobileView }}>
      <div
        className={`min-h-screen bg-gray-50 ${isMobileView ? "max-w-[393px] mx-auto border-x-4 border-gray-400 shadow-2xl" : ""}`}
      >
        <header className="bg-white shadow-sm border-b">
          <div className={`mx-auto ${isMobileView ? "px-3" : "max-w-7xl px-4 sm:px-6 lg:px-8"}`}>
            <div
              className={`flex justify-between items-center h-16 ${isMobileView ? "gap-2" : ""}`}
            >
              <div className="flex items-center">
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
          className={`mx-auto py-4 ${isMobileView ? "px-3" : "max-w-7xl px-4 sm:px-6 lg:px-8 py-8"}`}
        >
          <Tabs
            value={getActiveTab()}
            onValueChange={handleTabChange}
            className={`${isMobileView ? "space-y-4" : "space-y-6"}`}
          >
            <TabsList
              className={`grid w-full ${isMobileView ? "grid-cols-2 h-10" : "grid-cols-5"}`}
            >
              <TabsTrigger
                value="dashboard"
                className={`flex items-center gap-2 ${isMobileView ? "text-xs px-2" : ""}`}
              >
                <BarChart3 className={`${isMobileView ? "h-3 w-3" : "h-4 w-4"}`} />
                Dashboard
              </TabsTrigger>
              <TabsTrigger
                value="analytics"
                className={`flex items-center gap-2 ${isMobileView ? "text-xs px-2" : ""}`}
              >
                <BarChart3 className={`${isMobileView ? "h-3 w-3" : "h-4 w-4"}`} />
                Analytics
              </TabsTrigger>
              {user.role === "admin" && (
                <TabsTrigger
                  value="products"
                  className={`flex items-center gap-2 ${isMobileView ? "text-xs px-2" : ""}`}
                >
                  <Package className="h-4 w-4" />
                  Products
                </TabsTrigger>
              )}
              {user.role === "admin" && (
                <TabsTrigger
                  value="ai-integration"
                  className={`flex items-center gap-2 ${
                    isMobile ? "flex-1 justify-center" : ""
                  }`}
                >
                  <Sparkles className="h-4 w-4" />
                  AI
                </TabsTrigger>
              )}
              {user.role === "admin" && (
                <TabsTrigger
                  value="settings"
                  className={`flex items-center gap-2 ${isMobileView ? "text-xs px-2" : ""}`}
                >
                  <Settings className="h-4 w-4" />
                  Settings
                </TabsTrigger>
              )}
            </TabsList>

            <div className="mt-6">
              <Outlet />
            </div>
          </Tabs>
        </main>
      </div>
    </MobileViewContext.Provider>
  )
}
