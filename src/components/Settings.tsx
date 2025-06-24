import React, { useState, useEffect } from "react"
import { Button } from "./ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs"
import { Badge } from "./ui/badge"
import { useParams } from "react-router-dom"
import { useAuth } from "../contexts/AuthContext"
import { getStores, createStore, updateStore, deleteStore } from "../services/api"
import type { Store } from "../types"
import { toast } from "sonner"
import { useNavigate } from "react-router-dom"

type NewStore = {
  name: string
  type: "shopify"
  settings: {
    domain: string
    accessToken: string
    apiSecretKey: string
  }
}

  export const Settings: React.FC = () => {
    const { tenant, user } = useAuth()
    const navigate = useNavigate()
    const { tenantId, tab = "general" } = useParams<{
      tenantId: string
      tab: string
    }>()
    const [activeTab, setActiveTab] = useState(tab)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setLoading] = useState(true)
  
  // Store management state
  const [stores, setStores] = useState<Store[]>([])
  const [isStoreDialogOpen, setIsStoreDialogOpen] = useState(false)
  const [editingStore, setEditingStore] = useState<Store | null>(null)
  const [newStore, setNewStore] = useState<NewStore>({
    name: "",
    type: "shopify",
    settings: {
      domain: "",
      accessToken: "",
      apiSecretKey: "",
    },
  })
  const [isAddingStore, setIsAddingStore] = useState(false)
  const [isRegisteringWebhooks, setIsRegisteringWebhooks] = useState(false)
  const [isTestingConnection, setIsTestingConnection] = useState(false)
  const [copiedWebhookUrl, setCopiedWebhookUrl] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
  }, [tenant])

  useEffect(() => {
    setActiveTab(tab)
  }, [tab])

  const fetchData = async () => {
    if (!tenant?.id) return
    setLoading(true)
    try {
      const [storesData] = await Promise.all([
        getStores(tenant.id),
      ])
      console.log('Fetched stores data:', storesData)
      setStores(storesData)
      console.log("Settings data loaded")
    } catch (err) {
      console.error("Error fetching settings data:", err)
      setError("Failed to fetch settings data.")
    } finally {
      setLoading(false)
    }
  }

  const handleTabChange = (newTab: string) => {
    setActiveTab(newTab)
  }

  // Store management functions
  const handleCreateStore = async () => {
    if (!tenant?.id) return
    
    try {
      const storeData = {
        name: newStore.name,
        type: newStore.type,
        status: "active" as const,
        settings: {
          domain: newStore.settings.domain,
          accessToken: newStore.settings.accessToken,
          apiSecretKey: newStore.settings.apiSecretKey,
          timezone: "UTC",
          currency: "USD",
          businessHours: { start: "09:00", end: "17:00" },
          webhooks: [],
        },
      }
      
      await createStore(tenant.id, storeData)
      toast.success("Store created successfully")
      setIsStoreDialogOpen(false)
      setNewStore({
        name: "",
        type: "shopify",
        settings: {
          domain: "",
          accessToken: "",
          apiSecretKey: "",
        },
      })
      fetchData()
    } catch (error) {
      console.error("Error creating store:", error)
      toast.error("Failed to create store")
    }
  }

  const handleUpdateStore = async () => {
    if (!tenant?.id || !editingStore) return
    
    try {
      await updateStore(tenant.id, editingStore.id, {
        name: editingStore.name,
        settings: editingStore.settings,
      })
      toast.success("Store updated successfully")
      setEditingStore(null)
      fetchData()
    } catch (error) {
      console.error("Error updating store:", error)
      toast.error("Failed to update store")
    }
  }

  const handleDeleteStore = async (storeId: string) => {
    if (!tenant?.id) return
    
    if (!confirm("Are you sure you want to delete this store? This action cannot be undone.")) {
      return
    }
    
    try {
      await deleteStore(tenant.id, storeId)
      toast.success("Store deleted successfully")
      fetchData()
    } catch (error) {
      console.error("Error deleting store:", error)
      toast.error("Failed to delete store")
    }
  }

  const registerWebhooks = async (storeId: string) => {
    if (!tenant?.id) return
  
    setIsRegisteringWebhooks(true)
    try {
      console.log('Starting webhook registration for store:', storeId)
      
      // Get the updated store object from the API response
      const updatedStore = await registerShopifyWebhooks(tenant.id, storeId)
      console.log('Webhook registration response:', updatedStore)
      
      toast.success("Webhooks registered successfully")
  
      // Update the local state for this store only
      setStores((prevStores) => {
        console.log('Previous stores:', prevStores)
        const newStores = prevStores.map((store) =>
          store.id === storeId ? updatedStore : store
        )
        console.log('Updated stores:', newStores)
        return newStores
      })
  
      // Optionally, you can still refetch after a short delay for consistency
      // setTimeout(fetchData, 2000)
    } catch (error) {
      console.error("Failed to register webhooks:", error)
      toast.error("Failed to register webhooks")
    } finally {
      setIsRegisteringWebhooks(false)
    }
  }

  const testStoreConnection = async (storeId: string) => {
    if (!tenant?.id) return
    
    setIsTestingConnection(true)
    try {
      const data = await testShopifyConnection(tenant.id)
      
      if (data.success) {
        toast.success("Store connection test successful")
      } else {
        toast.error(`Connection test failed: ${data.error}`)
      }
    } catch (error: any) {
      console.error("Failed to test connection:", error)
      toast.error(`Failed to test connection: ${error.message}`)
    } finally {
      setIsTestingConnection(false)
    }
  }

  // Copy webhook URL to clipboard
  const copyWebhookUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      setCopiedWebhookUrl(url)
      toast.success("Webhook URL copied to clipboard")
      setTimeout(() => setCopiedWebhookUrl(null), 2000)
    } catch (error) {
      toast.error("Failed to copy webhook URL")
    }
  }

  // Get webhook URL for a store
  const getWebhookUrl = (store: Store) => {
    return `https://order-to-do.stanleytan92.workers.dev/api/webhooks/shopify`
  }

  if (isLoading) return <div>Loading...</div>
  if (error) return <div>{error}</div>

  return (
    <div className={`space-y-6 ${isMobile ? "p-3" : ""}`}>
      <div className={`flex items-center justify-between ${isMobile ? "flex-col gap-3" : ""}`}>
        <h1 className={`font-bold tracking-tight ${isMobile ? "text-2xl" : "text-3xl"}`}>Settings</h1>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
        <ScrollArea className="w-full whitespace-nowrap rounded-md border">
          <TabsList className={`inline-flex h-auto ${isMobile ? "p-1 gap-1" : ""}`}>
            <TabsTrigger value="general" className={isMobile ? "text-xs px-3 py-2 min-h-[40px]" : ""}>
              <SettingsIcon className={`mr-2 ${isMobile ? "h-3 w-3" : "h-4 w-4"}`} />
              {isMobile ? "General" : "General"}
            </TabsTrigger>
            <TabsTrigger value="order-card" className={isMobile ? "text-xs px-3 py-2 min-h-[40px]" : ""}>
              <Layout className={`mr-2 ${isMobile ? "h-3 w-3" : "h-4 w-4"}`} />
              {isMobile ? "Order Card" : "Order Card"}
            </TabsTrigger>
            <TabsTrigger value="users" className={isMobile ? "text-xs px-3 py-2 min-h-[40px]" : ""}>
              <Users className={`mr-2 ${isMobile ? "h-3 w-3" : "h-4 w-4"}`} />
              {isMobile ? "Users" : "User Management"}
            </TabsTrigger>
            <TabsTrigger value="billing" className={isMobile ? "text-xs px-3 py-2 min-h-[40px]" : ""}>
              <CreditCard className={`mr-2 ${isMobile ? "h-3 w-3" : "h-4 w-4"}`} />
              {isMobile ? "Billing" : "Billing"}
            </TabsTrigger>
          </TabsList>
        </ScrollArea>

        <TabsContent value="general">
          <div className="space-y-6">
            {/* Account Information */}
            <Card>
              <CardHeader className={isMobile ? "pb-3" : ""}>
                <CardTitle className={isMobile ? "text-lg" : ""}>Account Information</CardTitle>
                <CardDescription className={isMobile ? "text-sm" : ""}>Your account details and preferences.</CardDescription>
              </CardHeader>
              <CardContent className={isMobile ? "pt-0" : ""}>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="tenant-name">Tenant Name</Label>
                    <Input
                      id="tenant-name"
                      value={tenant?.name || ""}
                      disabled
                      className={isMobile ? "text-sm" : ""}
                    />
                  </div>
                  <div>
                    <Label htmlFor="user-email">Your Email</Label>
                    <Input
                      id="user-email"
                      value={user?.email || ""}
                      disabled
                      className={isMobile ? "text-sm" : ""}
                    />
                  </div>
                  <div>
                    <Label htmlFor="user-role">Your Role</Label>
                    <Input
                      id="user-role"
                      value={user?.role || ""}
                      disabled
                      className={isMobile ? "text-sm" : ""}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Shopify Store Management */}
            <Card>
              <CardHeader className={isMobile ? "pb-3" : ""}>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className={isMobile ? "text-lg" : ""}>Shopify Stores</CardTitle>
                    <CardDescription className={isMobile ? "text-sm" : ""}>
                      Manage your connected Shopify stores and API configurations.
                    </CardDescription>
                  </div>
                  <Dialog open={isStoreDialogOpen} onOpenChange={setIsStoreDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size={isMobile ? "sm" : "default"}>
                        <Plus className={`mr-2 ${isMobile ? "h-3 w-3" : "h-4 w-4"}`} />
                        Add Store
                      </Button>
                    </DialogTrigger>
                    <DialogContent className={isMobile ? "w-[95vw] max-w-[95vw]" : ""}>
                      <DialogHeader>
                        <DialogTitle>Add Shopify Store</DialogTitle>
                        <DialogDescription>
                          Connect a new Shopify store to sync orders and products.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="storeName">Store Name</Label>
                          <Input
                            id="storeName"
                            value={newStore.name}
                            onChange={(e) => setNewStore({ ...newStore, name: e.target.value })}
                            placeholder="My Shopify Store"
                          />
                        </div>
                        <div>
                          <Label htmlFor="storeDomain">Shopify Domain</Label>
                          <Input
                            id="storeDomain"
                            value={newStore.settings.domain}
                            onChange={(e) => setNewStore({ ...newStore, settings: { ...newStore.settings, domain: e.target.value } })}
                            placeholder="your-store.myshopify.com"
                          />
                        </div>
                        <div>
                          <Label htmlFor="accessToken">Access Token</Label>
                          <Input
                            id="accessToken"
                            type="password"
                            value={newStore.settings.accessToken}
                            onChange={(e) => setNewStore({ ...newStore, settings: { ...newStore.settings, accessToken: e.target.value } })}
                            placeholder="shpat_..."
                          />
                        </div>
                        <div>
                          <Label htmlFor="apiSecretKey">API Secret Key</Label>
                          <Input
                            id="apiSecretKey"
                            type="password"
                            value={newStore.settings.apiSecretKey}
                            onChange={(e) => setNewStore({ ...newStore, settings: { ...newStore.settings, apiSecretKey: e.target.value } })}
                            placeholder="shpss_..."
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsStoreDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button onClick={handleCreateStore}>Create Store</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent className={isMobile ? "pt-0" : ""}>
                {stores.length === 0 ? (
                  <Alert>
                    <StoreIcon className="h-4 w-4" />
                    <AlertDescription>
                      No Shopify stores connected. Add your first store to start syncing orders and products.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="space-y-4">
                    {stores.map((store) => (
                      <Card key={store.id} className="border-l-4 border-l-blue-500">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <StoreIcon className="h-5 w-5 text-gray-500" />
                                <span className="font-semibold">{store.name}</span>
                                <Badge variant={store.status === 'active' ? 'default' : 'secondary'}>
                                  {store.status}
                                </Badge>
                              </div>
                              <p className="text-sm text-gray-500">{store.settings.domain}</p>

                              <div className="mt-4">
                                <Label className="text-xs font-semibold uppercase text-gray-400">Webhook URL</Label>
                                <div className="flex items-center gap-2 mt-1">
                                  <Input
                                    readOnly
                                    value={getWebhookUrl(store)}
                                    className="h-8 text-xs bg-gray-50"
                                  />
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => copyWebhookUrl(getWebhookUrl(store))}
                                  >
                                    {copiedWebhookUrl === getWebhookUrl(store) ? (
                                      <Check className="h-4 w-4" />
                                    ) : (
                                      <Copy className="h-4 w-4" />
                                    )}
                                  </Button>
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-2 ml-4">
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size={isMobile ? "sm" : "default"}
                                  onClick={() => registerWebhooks(store.id)}
                                  disabled={isRegisteringWebhooks}
                                >
                                  <TestTube className={`mr-2 ${isMobile ? "h-3 w-3" : "h-4 w-4"}`} />
                                  Register Webhooks
                                </Button>
                                <Button
                                  variant="outline"
                                  size={isMobile ? "sm" : "default"}
                                  onClick={() => testStoreConnection(store.id)}
                                  disabled={isTestingConnection}
                                >
                                  Test Connection
                                </Button>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-10 w-10"
                                  onClick={() => setEditingStore(store)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="icon"
                                  className="h-10 w-10"
                                  onClick={() => handleDeleteStore(store.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                          <Separator className="my-4" />
                          <div className="text-xs text-gray-500 flex items-center justify-between">
                            <span>Last sync: {store.lastSyncAt ? new Date(store.lastSyncAt).toLocaleString() : 'Never'}</span>
                            <div className="flex items-center gap-2">
                              {store.settings.webhooks && store.settings.webhooks.length > 0 ? (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              ) : (
                                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                              )}
                              <span>
                                Webhooks: {Array.isArray(store.settings.webhooks) ? store.settings.webhooks.length : 0} registered
                              </span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* API Configuration Help */}
            <Card>
              <CardHeader>
                <CardTitle>API Configuration Help</CardTitle>
                <CardDescription>
                  Follow these steps to get your Shopify API credentials.
                </CardDescription>
              </CardHeader>
              <CardContent className="text-sm">
                <ol className="list-decimal list-inside space-y-2">
                  <li>Log in to your Shopify admin dashboard.</li>
                  <li>
                    Go to <span className="font-semibold">Apps and sales channels</span> &gt;{" "}
                    <span className="font-semibold">Develop apps</span>.
                  </li>
                  <li>
                    Create a new custom app, give it a name, and configure the{" "}
                    <span className="font-semibold">Admin API scopes</span>.
                  </li>
                  <li>
                    Make sure to grant permissions for{" "}
                    <span className="font-semibold">Orders</span>,{" "}
                    <span className="font-semibold">Products</span>, and{" "}
                    <span className="font-semibold">Inventory</span>.
                  </li>
                  <li>
                    Install the app and reveal the{" "}
                    <span className="font-semibold">Admin API access token</span> and{" "}
                    <span className="font-semibold">API secret key</span>.
                  </li>
                  <li>Copy and paste these credentials when adding a new store.</li>
                </ol>
                <Button variant="outline" size="sm" className="mt-4">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Read Shopify Docs
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="order-card">
          <OrderCardSettings />
        </TabsContent>

        <TabsContent value="users">
          <UsersComponent />
        </TabsContent>

        <TabsContent value="billing">
          <Card>
            <CardHeader className={isMobile ? "pb-3" : ""}>
              <CardTitle className={isMobile ? "text-lg" : ""}>Billing</CardTitle>
              <CardDescription className={isMobile ? "text-sm" : ""}>Manage your subscription and view invoices.</CardDescription>
            </CardHeader>
            <CardContent className={isMobile ? "pt-0" : ""}>
              <p className={isMobile ? "text-sm" : ""}>Billing management is coming soon.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
