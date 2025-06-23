import React, { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select"
import { Switch } from "./ui/switch"
import { Badge } from "./ui/badge"
import { Separator } from "./ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./ui/dialog"
import { Textarea } from "./ui/textarea"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./ui/collapsible"
import { Alert, AlertDescription } from "./ui/alert"
import {
  Brain,
  Camera,
  Image,
  ChevronDown,
  Plus,
  Edit,
  Save,
  Trash2,
  Info,
  Loader2,
  Key,
  Sparkles,
  Zap,
  TrendingUp,
} from "lucide-react"
import { useAuth } from "../contexts/AuthContext"
import { useMobileView } from "./Dashboard"
import {
  getTenantSettings,
  updateTenantSettings,
  getAIStyles,
  getAIArrangementTypes,
  getAIOccasions,
  getAIBudgetTiers,
  getAICustomerData,
  getFlowers,
} from "../services/api"
import { toast } from "sonner"
import AITrainingManager from './AITrainingManager'
import PhotoUploadManager from './PhotoUploadManager'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

export const AIIntegration: React.FC = () => {
  const { tenant, user } = useAuth()
  const isMobile = useMobileView()
  const [activeTab, setActiveTab] = useState("training")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setLoading] = useState(true)

  // OpenAI API state
  const [apiKey, setApiKey] = useState("")
  const [isTestingApi, setIsTestingApi] = useState(false)
  const [apiTestResult, setApiTestResult] = useState<{
    success: boolean
    message: string
    usage?: any
  } | null>(null)

  const defaultCameraWidgetFields = {
    flowers: true,
    styles: true,
    types: true,
    occasions: true,
    budget_tiers: true,
    customer_data: false, // Default to false as it might contain sensitive info
  };

  // Camera Widget Settings State
  const [cameraWidgetEnabled, setCameraWidgetEnabled] = useState(false)
  const [isUpdatingMobileCamera, setIsUpdatingMobileCamera] = useState(false)
  const [cameraWidgetFields, setCameraWidgetFields] = useState(
    defaultCameraWidgetFields
  );

  // Quick Templates State
  const [showQuickTemplatesDialog, setShowQuickTemplatesDialog] = useState(false)
  const [quickTemplates, setQuickTemplates] = useState<Array<{
    title: string;
    style: string;
    occasion: string;
    arrangement_type: string;
    difficulty_level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
    price_range: string;
    flowers_used: string[];
    colors: string[];
    special_techniques: string[];
    materials_used: string[];
    tags: string[];
  }>>([
    {
      title: "Wedding Bouquet",
      style: "romantic",
      occasion: "wedding",
      arrangement_type: "bouquet",
      difficulty_level: "intermediate",
      price_range: "premium",
      flowers_used: ["roses", "peonies", "baby's breath"],
      colors: ["white", "ivory", "pink"],
      special_techniques: ["wiring", "taping"],
      materials_used: ["satin ribbon", "pearls"],
      tags: ["romantic", "elegant", "wedding", "bouquet"]
    },
    {
      title: "Birthday Centerpiece",
      style: "modern",
      occasion: "birthday",
      arrangement_type: "centerpiece",
      difficulty_level: "beginner",
      price_range: "mid-range",
      flowers_used: ["lilies", "gerbera daisies", "carnations"],
      colors: ["yellow", "orange", "pink"],
      special_techniques: ["foam arrangement"],
      materials_used: ["vase", "floral foam"],
      tags: ["modern", "colorful", "birthday", "centerpiece"]
    },
    {
      title: "Sympathy Arrangement",
      style: "elegant",
      occasion: "sympathy",
      arrangement_type: "arrangement",
      difficulty_level: "intermediate",
      price_range: "mid-range",
      flowers_used: ["white roses", "lilies", "eucalyptus"],
      colors: ["white", "ivory", "green"],
      special_techniques: ["hand-tied"],
      materials_used: ["vase", "ribbon"],
      tags: ["elegant", "respectful", "sympathy", "white"]
    },
    {
      title: "Anniversary Roses",
      style: "romantic",
      occasion: "anniversary",
      arrangement_type: "bouquet",
      difficulty_level: "beginner",
      price_range: "premium",
      flowers_used: ["red roses", "baby's breath"],
      colors: ["red", "white"],
      special_techniques: ["hand-tied"],
      materials_used: ["satin ribbon", "rose thorns removed"],
      tags: ["romantic", "anniversary", "roses", "red"]
    },
    {
      title: "Everyday Wild Bouquet",
      style: "wild",
      occasion: "everyday",
      arrangement_type: "bouquet",
      difficulty_level: "beginner",
      price_range: "budget",
      flowers_used: ["daisies", "sunflowers", "wildflowers"],
      colors: ["yellow", "white", "purple"],
      special_techniques: ["natural arrangement"],
      materials_used: ["twine", "brown paper"],
      tags: ["wild", "natural", "everyday", "garden"]
    }
  ])
  const [editingTemplate, setEditingTemplate] = useState<{
    index: number;
    template: typeof quickTemplates[0];
  } | null>(null)

  // AI Training Data for field configuration
  const [availableFlowers, setAvailableFlowers] = useState<any[]>([])
  const [availableStyles, setAvailableStyles] = useState<any[]>([])
  const [availableTypes, setAvailableTypes] = useState<any[]>([])
  const [availableOccasions, setAvailableOccasions] = useState<any[]>([])
  const [availableBudgetTiers, setAvailableBudgetTiers] = useState<any[]>([])
  const [availableCustomerData, setAvailableCustomerData] = useState<any[]>([])

  useEffect(() => {
    fetchData()
  }, [tenant])

  useEffect(() => {
    const storedKey = localStorage.getItem('OPENAI_API_KEY')
    if (storedKey) {
      setApiKey(storedKey)
    }
  }, [])

  const fetchData = async () => {
    if (!tenant?.id) return
    setLoading(true)
    try {
      const settingsData = await getTenantSettings(tenant.id)
      
      // Load mobile camera widget setting
      if (settingsData?.mobileCameraWidget !== undefined) {
        setCameraWidgetEnabled(settingsData.mobileCameraWidget.enabled)
      }
      
      // Load API key from settings if available
      if (settingsData?.openaiApiKey) {
        setApiKey(settingsData.openaiApiKey)
      }

      // Load camera widget settings robustly
      if (settingsData?.mobileCameraWidget) {
        setCameraWidgetEnabled(settingsData.mobileCameraWidget.enabled || false);
        
        const savedFields = settingsData.mobileCameraWidget.fields;
        if (savedFields && typeof savedFields === 'object') {
            const newFieldsState = { ...defaultCameraWidgetFields };
            for (const key in newFieldsState) {
                if (Object.prototype.hasOwnProperty.call(savedFields, key)) {
                    (newFieldsState as any)[key] = savedFields[key];
                }
            }
            setCameraWidgetFields(newFieldsState);
        } else {
            setCameraWidgetFields(defaultCameraWidgetFields);
        }
      } else {
        // If no settings are saved at all, use the defaults
        setCameraWidgetFields(defaultCameraWidgetFields);
      }

      // Load AI training data for field configuration
      await loadAITrainingDataForFields()
    } catch (err) {
      console.error("Error fetching AI integration data:", err)
      setError("Failed to fetch AI integration data.")
    } finally {
      setLoading(false)
    }
  }

  const loadAITrainingDataForFields = async () => {
    if (!tenant?.id) return
    try {
      const [flowers, styles, types, occasions, budgetTiers, customerData] = await Promise.all([
        getFlowers(tenant.id),
        getAIStyles(tenant.id),
        getAIArrangementTypes(tenant.id),
        getAIOccasions(tenant.id),
        getAIBudgetTiers(tenant.id),
        getAICustomerData(tenant.id)
      ])
      
      setAvailableFlowers(flowers)
      setAvailableStyles(styles)
      setAvailableTypes(types)
      setAvailableOccasions(occasions)
      setAvailableBudgetTiers(budgetTiers)
      setAvailableCustomerData(customerData)
    } catch (error) {
      console.error("Error loading AI training data:", error)
    }
  }

  const testApiKey = async () => {
    if (!apiKey.trim()) {
      toast.error("Please enter an API key first")
      return
    }

    setIsTestingApi(true)
    setApiTestResult(null)

    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        setApiTestResult({
          success: true,
          message: `API key is valid! Available models: ${data.data.length}`,
          usage: data
        })
        toast.success("API key is valid!")
      } else {
        const errorData = await response.json()
        setApiTestResult({
          success: false,
          message: `API Error: ${errorData.error?.message || 'Unknown error'}`
        })
        toast.error("API key test failed")
      }
    } catch (error) {
      setApiTestResult({
        success: false,
        message: `Network Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      })
      toast.error("Network error during API test")
    } finally {
      setIsTestingApi(false)
    }
  }

  const handleSaveApiKey = () => {
    if (!tenant?.id) return
    
    localStorage.setItem('OPENAI_API_KEY', apiKey)
    updateTenantSettings(tenant.id, { openaiApiKey: apiKey })
      .then(() => {
        toast.success("API key saved successfully")
      })
      .catch((error) => {
        console.error("Error saving API key:", error)
        toast.error("Failed to save API key")
      })
  }

  const removeApiKey = () => {
    setApiKey("")
    localStorage.removeItem('OPENAI_API_KEY')
    if (tenant?.id) {
      updateTenantSettings(tenant.id, { openaiApiKey: "" })
        .then(() => {
          toast.success("API key removed")
        })
        .catch((error) => {
          console.error("Error removing API key:", error)
        })
    }
  }

  const formatUsage = (usage: any) => {
    if (!usage) return "No usage data available"
    
    try {
      return JSON.stringify(usage, null, 2)
    } catch {
      return "Unable to format usage data"
    }
  }

  const handleToggleMobileCamera = async () => {
    if (!tenant?.id) return
    
    const newValue = !cameraWidgetEnabled
    setIsUpdatingMobileCamera(true)
    
    try {
      await updateTenantSettings(tenant.id, {
        mobileCameraWidget: {
          enabled: newValue,
          fields: cameraWidgetFields
        }
      })
      
      setCameraWidgetEnabled(newValue)
      toast.success(`Mobile Camera Widget ${newValue ? "enabled" : "disabled"}`)
    } catch (error) {
      console.error("Error toggling mobile camera widget:", error)
      toast.error("Failed to update mobile camera widget setting")
    } finally {
      setIsUpdatingMobileCamera(false)
    }
  }

  const handleToggleCameraField = async (field: string) => {
    if (!tenant?.id) return
    
    const newFields = { ...cameraWidgetFields }
    newFields[field as keyof typeof cameraWidgetFields] = !newFields[field as keyof typeof cameraWidgetFields]
    
    try {
      await updateTenantSettings(tenant.id, {
        mobileCameraWidget: {
          enabled: cameraWidgetEnabled,
          fields: newFields
        }
      })
      
      setCameraWidgetFields(newFields)
      toast.success(`${field.replace(/_/g, " ")} field ${newFields[field as keyof typeof cameraWidgetFields] ? "enabled" : "disabled"}`)
    } catch (error) {
      console.error("Error toggling camera field:", error)
      toast.error("Failed to update field setting")
    }
  }

  const getFieldDescription = (field: string): string => {
    const descriptions: Record<string, string> = {
      flowers: "Flower types and varieties used in arrangements",
      styles: "Artistic styles and design approaches",
      types: "Arrangement types and forms",
      occasions: "Events and occasions for arrangements",
      budget_tiers: "Price ranges and budget categories",
      customer_data: "Customer preferences and requirements"
    }
    return descriptions[field] || "Field description not available"
  }

  const getFieldOptions = (field: string): { value: string; label: string }[] => {
    const fieldMappings: Record<string, any[]> = {
      flowers: availableFlowers,
      styles: availableStyles,
      types: availableTypes,
      occasions: availableOccasions,
      budget_tiers: availableBudgetTiers,
      customer_data: availableCustomerData
    }
    
    const data = fieldMappings[field] || []
    return data.map((item: any) => ({
      value: item.id || item.name,
      label: item.name || item.title || item.id
    }))
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-6">
        <Sparkles className={`h-6 w-6 ${isMobile ? "h-6 w-6" : ""}`} />
        <h1 className={`font-bold tracking-tight ${isMobile ? "text-xl" : "text-2xl"}`}>
          AI Integration
        </h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="training" className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            AI Training
          </TabsTrigger>
          <TabsTrigger value="camera" className="flex items-center gap-2">
            <Camera className="h-4 w-4" />
            Mobile Camera
          </TabsTrigger>
          <TabsTrigger value="api" className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            API Settings
          </TabsTrigger>
        </TabsList>

        {/* AI Training Manager */}
        <TabsContent value="training" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                AI Training Data Manager
              </CardTitle>
              <CardDescription>
                Manage training data for AI bouquet generation. Upload photos, configure training parameters, and monitor model performance.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {tenant?.id ? (
                <AITrainingManager tenantId={tenant.id} />
              ) : (
                <p>Tenant ID not found. Cannot load AI Training Manager.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Mobile Camera Widget */}
        <TabsContent value="camera" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5" />
                Photo Upload Manager
              </CardTitle>
              <CardDescription>
                Manage uploaded photos, descriptions, and quality assessments for AI training.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {tenant?.id ? (
                <PhotoUploadManager tenantId={tenant.id} />
              ) : (
                <p>Tenant ID not found. Cannot load Photo Manager.</p>
              )}
            </CardContent>
          </Card>

          {/* Mobile Camera Widget Settings */}
          <Collapsible>
            <Card>
              <CardHeader>
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between cursor-pointer">
                    <CardTitle className="flex items-center gap-2">
                      <Camera className="h-5 w-5" />
                      Mobile Camera Widget
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant={cameraWidgetEnabled ? "default" : "secondary"}>
                        {cameraWidgetEnabled ? "Active" : "Disabled"}
                      </Badge>
                      <ChevronDown className="h-4 w-4 transition-transform duration-200" />
                    </div>
                  </div>
                </CollapsibleTrigger>
                <CardDescription>
                  Configure the floating camera widget for mobile devices. This widget allows florists to quickly capture and upload arrangement photos from any page.
                </CardDescription>
              </CardHeader>
              <CollapsibleContent>
                <CardContent>
                  <div className="space-y-6">
                    {/* Widget Toggle */}
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">Enable Mobile Camera Widget</h3>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Shows a floating camera button on mobile devices for quick photo capture
                        </p>
                      </div>
                      <Switch
                        checked={cameraWidgetEnabled}
                        onCheckedChange={handleToggleMobileCamera}
                      />
                    </div>

                    {/* Quick Templates Configuration */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-medium">Quick Templates</h3>
                          <p className="text-sm text-muted-foreground">
                            Configure pre-filled templates for common arrangement types
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowQuickTemplatesDialog(true)}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Configure
                        </Button>
                      </div>

                      {/* Quick Templates Preview */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {quickTemplates.map((template, index) => (
                          <div
                            key={index}
                            className="p-3 border rounded-lg bg-muted/50"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-medium text-sm">{template.title}</h4>
                              <Badge variant="outline" className="text-xs">
                                {template.style}
                              </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground space-y-1">
                              <div>Occasion: {template.occasion}</div>
                              <div>Type: {template.arrangement_type}</div>
                              <div>Price: {template.price_range}</div>
                              <div>Difficulty: {template.difficulty_level}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Feature Overview */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 border rounded-lg">
                        <h4 className="font-medium mb-2">Quick Capture</h4>
                        <p className="text-sm text-muted-foreground">
                          Direct camera access from any page without navigation
                        </p>
                      </div>
                      <div className="p-4 border rounded-lg">
                        <h4 className="font-medium mb-2">Quick Templates</h4>
                        <p className="text-sm text-muted-foreground">
                          Pre-filled forms for common arrangement types
                        </p>
                      </div>
                      <div className="p-4 border rounded-lg">
                        <h4 className="font-medium mb-2">Auto Upload</h4>
                        <p className="text-sm text-muted-foreground">
                          Automatic compression and upload to training data
                        </p>
                      </div>
                      <div className="p-4 border rounded-lg">
                        <h4 className="font-medium mb-2">AI Training</h4>
                        <p className="text-sm text-muted-foreground">
                          Contributes to AI model improvement
                        </p>
                      </div>
                    </div>

                    {/* Mobile Notice */}
                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertDescription>
                        <strong>Mobile-Only Feature:</strong> This widget only appears on devices with screen width ≤768px. 
                        Desktop users can access photo uploads through the Photo Manager above.
                      </AlertDescription>
                    </Alert>

                    {/* Field Configuration */}
                    <div className="space-y-4">
                      <div>
                        <h3 className="font-medium mb-3">
                          Configure AI Training Data Fields
                        </h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          Select which AI Training Data fields to include in the
                          mobile camera widget form. These fields match the
                          Training Data section in the AI Training Manager above.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {Object.entries(cameraWidgetFields).map(
                          ([field, enabled]) => (
                            <div
                              key={field}
                              className="flex items-center justify-between p-3 border rounded-lg"
                            >
                              <div>
                                <Label className="font-medium capitalize">
                                  {field.replace(/_/g, " ")}
                                </Label>
                                <p className="text-xs text-muted-foreground">
                                  {getFieldDescription(field)}
                                </p>
                                {getFieldOptions(field).length > 0 && (
                                  <p className="text-xs text-blue-600 mt-1">
                                    {getFieldOptions(field).length} options available
                                  </p>
                                )}
                              </div>
                              <Switch
                                checked={enabled}
                                onCheckedChange={() => handleToggleCameraField(field)}
                              />
                            </div>
                          )
                        )}
                      </div>

                      {/* Field Mapping Info */}
                      <Alert>
                        <Info className="h-4 w-4" />
                        <AlertDescription>
                          <strong>Field Mapping:</strong> These fields
                          correspond to the Training Data tabs in the AI Training
                          Manager:
                          <br />• <strong>Flowers</strong> → Flowers tab (flower
                          types and varieties)
                          <br />• <strong>Styles</strong> → Styles tab (artistic
                          styles and design approaches)
                          <br />• <strong>Types</strong> → Types tab (arrangement
                          types and forms)
                          <br />• <strong>Occasions</strong> → Occasions tab
                          (events and occasions)
                          <br />• <strong>Budget Tiers</strong> → Budget Tiers tab
                          (price ranges)
                          <br />• <strong>Customer Data</strong> → Customer Data
                          tab (customer preferences)
                        </AlertDescription>
                      </Alert>
                    </div>

                    {/* Usage Guidelines */}
                    <div className="p-4 bg-muted rounded-lg">
                      <h4 className="font-medium mb-2">Usage Guidelines</h4>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        <li>• Capture 3-5 arrangement photos per day for best results</li>
                        <li>• Ensure good lighting and clear composition</li>
                        <li>• Include detailed descriptions for better AI training</li>
                        <li>• Use consistent terminology across uploads</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </TabsContent>

        {/* API Settings */}
        <TabsContent value="api" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                OpenAI API Configuration
              </CardTitle>
              <CardDescription>
                Configure your OpenAI API key for AI bouquet generation. This key is required for the AI Florist feature to work.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* API Key Input */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="api-key">OpenAI API Key</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      id="api-key"
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="sk-..."
                      className="flex-1"
                    />
                    <Button
                      onClick={testApiKey}
                      disabled={isTestingApi || !apiKey.trim()}
                      variant="outline"
                    >
                      {isTestingApi ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Test"
                      )}
                    </Button>
                    <Button
                      onClick={handleSaveApiKey}
                      disabled={!apiKey.trim()}
                    >
                      Save
                    </Button>
                    <Button
                      onClick={removeApiKey}
                      variant="outline"
                    >
                      Remove
                    </Button>
                  </div>
                </div>

                {/* API Test Results */}
                {apiTestResult && (
                  <Alert variant={apiTestResult.success ? "default" : "destructive"}>
                    <AlertDescription>
                      <strong>{apiTestResult.success ? "Success!" : "Error:"}</strong> {apiTestResult.message}
                      {apiTestResult.usage && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-sm">View API Response</summary>
                          <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto">
                            {formatUsage(apiTestResult.usage)}
                          </pre>
                        </details>
                      )}
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              {/* API Information */}
              <div className="space-y-4">
                <h3 className="font-medium">API Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2">Costs</h4>
                    <p className="text-sm text-muted-foreground">
                      OpenAI API charges per token. Typical bouquet generation costs $0.02-$0.05 per request.
                    </p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2">Rate Limits</h4>
                    <p className="text-sm text-muted-foreground">
                      Free tier: 3 requests per minute. Paid tier: Higher limits based on usage.
                    </p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2">Security</h4>
                    <p className="text-sm text-muted-foreground">
                      API keys are encrypted and stored securely. Never share your API key publicly.
                    </p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2">Support</h4>
                    <p className="text-sm text-muted-foreground">
                      For API issues, check OpenAI's status page or contact their support team.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Quick Templates Configuration Dialog */}
      <Dialog open={showQuickTemplatesDialog} onOpenChange={setShowQuickTemplatesDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Configure Quick Templates</DialogTitle>
            <DialogDescription>
              Edit the pre-filled templates that appear in the mobile camera widget for quick photo descriptions.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Template List */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Quick Templates</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditingTemplate({
                      index: quickTemplates.length,
                      template: {
                        title: "",
                        style: "romantic",
                        occasion: "wedding",
                        arrangement_type: "bouquet",
                        difficulty_level: "intermediate",
                        price_range: "mid-range",
                        flowers_used: [],
                        colors: [],
                        special_techniques: [],
                        materials_used: [],
                        tags: []
                      }
                    })
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Template
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {quickTemplates.map((template, index) => (
                  <div
                    key={index}
                    className="p-4 border rounded-lg hover:border-primary/50 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium">{template.title}</h4>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingTemplate({ index, template })}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const newTemplates = [...quickTemplates]
                            newTemplates.splice(index, 1)
                            setQuickTemplates(newTemplates)
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <div className="flex gap-2">
                        <Badge variant="outline">{template.style}</Badge>
                        <Badge variant="outline">{template.occasion}</Badge>
                        <Badge variant="outline">{template.arrangement_type}</Badge>
                      </div>
                      <div>Price: {template.price_range}</div>
                      <div>Difficulty: {template.difficulty_level}</div>
                      {template.flowers_used.length > 0 && (
                        <div>Flowers: {template.flowers_used.slice(0, 3).join(", ")}{template.flowers_used.length > 3 ? "..." : ""}</div>
                      )}
                      {template.colors.length > 0 && (
                        <div>Colors: {template.colors.slice(0, 3).join(", ")}{template.colors.length > 3 ? "..." : ""}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Template Editor */}
            {editingTemplate && (
              <div className="border-t pt-6">
                <h3 className="font-medium mb-4">
                  {editingTemplate.index === quickTemplates.length ? "Add New Template" : "Edit Template"}
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="template-title">Title *</Label>
                    <Input
                      id="template-title"
                      value={editingTemplate.template.title}
                      onChange={(e) => setEditingTemplate(prev => prev ? {
                        ...prev,
                        template: { ...prev.template, title: e.target.value }
                      } : null)}
                      placeholder="e.g., Wedding Bouquet"
                    />
                  </div>

                  <div>
                    <Label htmlFor="template-style">Style</Label>
                    <Select
                      value={editingTemplate.template.style}
                      onValueChange={(value) => setEditingTemplate(prev => prev ? {
                        ...prev,
                        template: { ...prev.template, style: value }
                      } : null)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="romantic">Romantic</SelectItem>
                        <SelectItem value="modern">Modern</SelectItem>
                        <SelectItem value="rustic">Rustic</SelectItem>
                        <SelectItem value="elegant">Elegant</SelectItem>
                        <SelectItem value="wild">Wild & Natural</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="template-occasion">Occasion</Label>
                    <Select
                      value={editingTemplate.template.occasion}
                      onValueChange={(value) => setEditingTemplate(prev => prev ? {
                        ...prev,
                        template: { ...prev.template, occasion: value }
                      } : null)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="wedding">Wedding</SelectItem>
                        <SelectItem value="birthday">Birthday</SelectItem>
                        <SelectItem value="anniversary">Anniversary</SelectItem>
                        <SelectItem value="sympathy">Sympathy</SelectItem>
                        <SelectItem value="everyday">Everyday</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="template-type">Arrangement Type</Label>
                    <Select
                      value={editingTemplate.template.arrangement_type}
                      onValueChange={(value) => setEditingTemplate(prev => prev ? {
                        ...prev,
                        template: { ...prev.template, arrangement_type: value }
                      } : null)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bouquet">Bouquet</SelectItem>
                        <SelectItem value="centerpiece">Centerpiece</SelectItem>
                        <SelectItem value="arrangement">Arrangement</SelectItem>
                        <SelectItem value="wreath">Wreath</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="template-difficulty">Difficulty Level</Label>
                    <Select
                      value={editingTemplate.template.difficulty_level}
                      onValueChange={(value: 'beginner' | 'intermediate' | 'advanced' | 'expert') => setEditingTemplate(prev => prev ? {
                        ...prev,
                        template: { ...prev.template, difficulty_level: value }
                      } : null)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="beginner">Beginner</SelectItem>
                        <SelectItem value="intermediate">Intermediate</SelectItem>
                        <SelectItem value="advanced">Advanced</SelectItem>
                        <SelectItem value="expert">Expert</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="template-price">Price Range</Label>
                    <Select
                      value={editingTemplate.template.price_range}
                      onValueChange={(value) => setEditingTemplate(prev => prev ? {
                        ...prev,
                        template: { ...prev.template, price_range: value }
                      } : null)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="budget">Budget</SelectItem>
                        <SelectItem value="mid-range">Mid-Range</SelectItem>
                        <SelectItem value="premium">Premium</SelectItem>
                        <SelectItem value="luxury">Luxury</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="mt-4 space-y-4">
                  <div>
                    <Label htmlFor="template-flowers">Flowers Used (comma-separated)</Label>
                    <Input
                      id="template-flowers"
                      value={editingTemplate.template.flowers_used.join(", ")}
                      onChange={(e) => setEditingTemplate(prev => prev ? {
                        ...prev,
                        template: { 
                          ...prev.template, 
                          flowers_used: e.target.value.split(",").map(f => f.trim()).filter(f => f)
                        }
                      } : null)}
                      placeholder="e.g., roses, peonies, baby's breath"
                    />
                  </div>

                  <div>
                    <Label htmlFor="template-colors">Colors (comma-separated)</Label>
                    <Input
                      id="template-colors"
                      value={editingTemplate.template.colors.join(", ")}
                      onChange={(e) => setEditingTemplate(prev => prev ? {
                        ...prev,
                        template: { 
                          ...prev.template, 
                          colors: e.target.value.split(",").map(c => c.trim()).filter(c => c)
                        }
                      } : null)}
                      placeholder="e.g., white, ivory, pink"
                    />
                  </div>

                  <div>
                    <Label htmlFor="template-techniques">Special Techniques (comma-separated)</Label>
                    <Input
                      id="template-techniques"
                      value={editingTemplate.template.special_techniques.join(", ")}
                      onChange={(e) => setEditingTemplate(prev => prev ? {
                        ...prev,
                        template: { 
                          ...prev.template, 
                          special_techniques: e.target.value.split(",").map(t => t.trim()).filter(t => t)
                        }
                      } : null)}
                      placeholder="e.g., wiring, taping, hand-tied"
                    />
                  </div>

                  <div>
                    <Label htmlFor="template-materials">Materials Used (comma-separated)</Label>
                    <Input
                      id="template-materials"
                      value={editingTemplate.template.materials_used.join(", ")}
                      onChange={(e) => setEditingTemplate(prev => prev ? {
                        ...prev,
                        template: { 
                          ...prev.template, 
                          materials_used: e.target.value.split(",").map(m => m.trim()).filter(m => m)
                        }
                      } : null)}
                      placeholder="e.g., satin ribbon, vase, floral foam"
                    />
                  </div>

                  <div>
                    <Label htmlFor="template-tags">Tags (comma-separated)</Label>
                    <Input
                      id="template-tags"
                      value={editingTemplate.template.tags.join(", ")}
                      onChange={(e) => setEditingTemplate(prev => prev ? {
                        ...prev,
                        template: { 
                          ...prev.template, 
                          tags: e.target.value.split(",").map(t => t.trim()).filter(t => t)
                        }
                      } : null)}
                      placeholder="e.g., romantic, elegant, wedding"
                    />
                  </div>
                </div>

                <div className="flex gap-2 mt-6">
                  <Button
                    onClick={() => {
                      if (editingTemplate.template.title) {
                        const newTemplates = [...quickTemplates]
                        if (editingTemplate.index === quickTemplates.length) {
                          newTemplates.push(editingTemplate.template)
                        } else {
                          newTemplates[editingTemplate.index] = editingTemplate.template
                        }
                        setQuickTemplates(newTemplates)
                        setEditingTemplate(null)
                      }
                    }}
                    disabled={!editingTemplate.template.title}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Save Template
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setEditingTemplate(null)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowQuickTemplatesDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
} 