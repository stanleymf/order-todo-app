import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Progress } from './ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { 
  Database, 
  Brain, 
  BarChart3, 
  Settings, 
  Upload, 
  Download, 
  Play, 
  Pause, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  TrendingUp,
  Sparkles,
  Palette,
  FileText,
  Users,
  Zap,
  Target,
  Activity,
  RefreshCw,
  Plus,
  Trash2,
  MessageSquare,
  Calendar,
  DollarSign
} from 'lucide-react';
import { createAITrainingService, type TrainingDataStats } from '../services/aiTrainingService';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import { getPromptTemplates, createPromptTemplate, deletePromptTemplate, getModelConfigs, createModelConfig, deleteModelConfig, getAIStyles, createAIStyle, deleteAIStyle, getAIArrangementTypes, createAIArrangementType, deleteAIArrangementType, getAIOccasions, createAIOccasion, deleteAIOccasion, getAIBudgetTiers, createAIBudgetTier, deleteAIBudgetTier, getAICustomerData, createAICustomerData, deleteAICustomerData, getShopifyAnalytics, createTrainingSessionFromAnalytics, getStores } from '../services/api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { Checkbox } from './ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from './ui/dialog';

interface AITrainingManagerProps {
  tenantId: string;
}

const AITrainingManager: React.FC<AITrainingManagerProps> = ({ tenantId }) => {
  const { user } = useAuth();
  const [mainTab, setMainTab] = useState('overview');
  const [trainingDataSubTab, setTrainingDataSubTab] = useState('flowers');
  const [aiConfigSubTab, setAiConfigSubTab] = useState('prompts');
  
  const [isLoading, setIsLoading] = useState(false);
  const [trainingStats, setTrainingStats] = useState<TrainingDataStats | null>(null);
  const [styleTemplates, setStyleTemplates] = useState<any[]>([]);
  const [promptTemplates, setPromptTemplates] = useState<any[]>([]);
  const [modelConfigs, setModelConfigs] = useState<any[]>([]);
  const [styles, setStyles] = useState<any[]>([]);
  const [types, setTypes] = useState<any[]>([]);
  const [occasions, setOccasions] = useState<any[]>([]);
  const [generatedDesigns, setGeneratedDesigns] = useState<any[]>([]);
  const [flowers, setFlowers] = useState<any[]>([]);
  const [budgetTiers, setBudgetTiers] = useState<any[]>([]);
  const [customerData, setCustomerData] = useState<any[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [shopifyAnalytics, setShopifyAnalytics] = useState<any>(null);
  const [analyticsFilters, setAnalyticsFilters] = useState({
    dateRange: '30d',
    compareWith: 'previous',
    storeId: ''
  });
  const [showTrainingSessionModal, setShowTrainingSessionModal] = useState(false);
  const [selectedAnalyticsData, setSelectedAnalyticsData] = useState({
    selectedProducts: [] as string[],
    selectedOccasions: [] as string[],
    selectedStyles: [] as string[],
    sessionName: '',
    priority: 'medium' as 'high' | 'medium' | 'low'
  });
  const [showAddFlower, setShowAddFlower] = useState(false);
  const [showAddPrompt, setShowAddPrompt] = useState(false);
  const [showAddModel, setShowAddModel] = useState(false);
  const [showAddStyle, setShowAddStyle] = useState(false);
  const [showAddType, setShowAddType] = useState(false);
  const [showAddOccasion, setShowAddOccasion] = useState(false);
  const [showAddBudgetTier, setShowAddBudgetTier] = useState(false);
  const [showAddCustomerData, setShowAddCustomerData] = useState(false);
  const [newFlower, setNewFlower] = useState({
    name: "",
    variety: "",
    color: "",
    seasonality: "",
    availability: true,
    price_range: "",
    description: "",
    image_url: "",
    is_active: true
  });
  const [newPrompt, setNewPrompt] = useState({
    name: "",
    template: "",
    variables: [],
    category: "custom",
    is_active: true
  });
  const [newModel, setNewModel] = useState({
    name: "",
    model_type: "dalle3",
    config_data: {},
    is_active: false
  });
  const [newStyle, setNewStyle] = useState({
    name: "",
    description: "",
    color_palette: [],
    mood: "",
    arrangement_style: "",
    flair_elements: [],
    is_active: true
  });
  const [newType, setNewType] = useState({
    name: "",
    description: "",
    category: "",
    typical_size: "",
    typical_flowers: "",
    price_range: "",
    is_active: true
  });
  const [newOccasion, setNewOccasion] = useState({
    name: "",
    description: "",
    typical_flowers: "",
    typical_colors: "",
    seasonal_preferences: "",
    price_sensitivity: "",
    is_active: true
  });
  const [newBudgetTier, setNewBudgetTier] = useState({
    name: "",
    min_price: "",
    max_price: "",
    description: "",
    typical_flowers: "",
    typical_arrangements: "",
    is_active: true
  });
  const [newCustomerData, setNewCustomerData] = useState({
    customer_id: "",
    recipient_name: "",
    birthday: "",
    anniversary: "",
    special_dates: "",
    preferences: "",
    allergies: "",
    favorite_flowers: "",
    favorite_colors: "",
    budget_preference: "",
    is_active: true
  });

  const aiTrainingService = createAITrainingService(tenantId);

  useEffect(() => {
    loadTrainingData();
  }, [tenantId]);

  useEffect(() => {
    if (mainTab === 'overview') {
      loadTrainingData();
    } else if (mainTab === 'training-data') {
      switch (trainingDataSubTab) {
        case 'flowers':
          loadFlowers();
          break;
        case 'styles':
          loadStyles();
          break;
        case 'types':
          loadTypes();
          break;
        case 'occasions':
          loadOccasions();
          break;
        case 'budget-tiers':
          loadBudgetTiers();
          break;
        case 'customer-data':
          loadCustomerData();
          break;
      }
    } else if (mainTab === 'ai-config') {
      switch (aiConfigSubTab) {
        case 'prompts':
          loadPromptTemplates();
          break;
        case 'models':
          loadModelConfigs();
          break;
      }
    } else if (mainTab === 'analytics') {
      loadStores();
    }
  }, [mainTab, trainingDataSubTab, aiConfigSubTab, tenantId]);

  const loadTrainingData = async () => {
    setIsLoading(true);
    try {
      const [stats, styles, prompts, configs, designs] = await Promise.all([
        aiTrainingService.getTrainingDataStats(),
        aiTrainingService.getStyleTemplates(),
        aiTrainingService.getPromptTemplates(),
        aiTrainingService.getModelConfigs(),
        aiTrainingService.getGeneratedDesigns()
      ]);

      setTrainingStats(stats);
      setStyleTemplates(styles);
      setPromptTemplates(prompts);
      setModelConfigs(configs);
      setGeneratedDesigns(designs);
    } catch (error) {
      console.error('Error loading training data:', error);
      toast.error('Failed to load training data');
    } finally {
      setIsLoading(false);
    }
  };

  const extractTrainingDataFromProducts = async () => {
    setIsLoading(true);
    try {
      const extractedData = await aiTrainingService.extractTrainingDataFromProducts();
      toast.success(`Successfully extracted ${extractedData.length} training examples from products`);
      await loadTrainingData(); // Reload stats
    } catch (error) {
      console.error('Error extracting training data:', error);
      toast.error('Failed to extract training data from products');
    } finally {
      setIsLoading(false);
    }
  };

  const createTrainingSession = async () => {
    try {
      const session = await aiTrainingService.createTrainingSession({
        model_config_id: modelConfigs[0]?.id || 'default-dalle3',
        session_name: `Training Session ${new Date().toLocaleDateString()}`,
        status: 'pending',
        training_data_count: trainingStats?.total_products || 0,
        training_progress: 0
      });
      toast.success('Training session created successfully');
      await loadTrainingData();
    } catch (error) {
      console.error('Error creating training session:', error);
      toast.error('Failed to create training session');
    }
  };

  const loadFlowers = async () => {
    try {
      const data = await aiTrainingService.getFlowers();
      setFlowers(data);
    } catch (error) {
      toast.error('Failed to load flowers');
    }
  };

  const loadPromptTemplates = async () => {
    try {
      const data = await aiTrainingService.getPromptTemplates();
      setPromptTemplates(data);
    } catch (error) {
      toast.error('Failed to load prompt templates');
    }
  };

  const loadModelConfigs = async () => {
    try {
      const data = await getModelConfigs(tenantId);
      setModelConfigs(data);
    } catch (error) {
      toast.error('Failed to load model configs');
    }
  };

  const loadStyles = async () => {
    try {
      const data = await getAIStyles(tenantId);
      setStyles(data);
    } catch (error) {
      toast.error('Failed to load styles');
    }
  };

  const loadTypes = async () => {
    try {
      const data = await getAIArrangementTypes(tenantId);
      setTypes(data);
    } catch (error) {
      toast.error('Failed to load arrangement types');
    }
  };

  const loadOccasions = async () => {
    try {
      const data = await getAIOccasions(tenantId);
      setOccasions(data);
    } catch (error) {
      toast.error('Failed to load occasions');
    }
  };

  const loadBudgetTiers = async () => {
    try {
      const data = await getAIBudgetTiers(tenantId);
      setBudgetTiers(data);
    } catch (error) {
      toast.error('Failed to load budget tiers');
    }
  };

  const loadCustomerData = async () => {
    try {
      const data = await getAICustomerData(tenantId);
      setCustomerData(data);
    } catch (error) {
      toast.error('Failed to load customer data');
    }
  };

  const loadStores = async () => {
    try {
      const data = await getStores(tenantId);
      setStores(data);
    } catch (error) {
      toast.error('Failed to load stores');
    }
  };

  const loadShopifyAnalytics = async () => {
    setLoading(true);
    try {
      const data = await getShopifyAnalytics(tenantId, analyticsFilters);
      setShopifyAnalytics(data);
    } catch (error) {
      toast.error('Failed to load Shopify analytics');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTrainingSessionFromAnalytics = async () => {
    try {
      const session = await createTrainingSessionFromAnalytics(tenantId, selectedAnalyticsData);
      toast.success('Training session created successfully from analytics data');
      setShowTrainingSessionModal(false);
      setSelectedAnalyticsData({
        selectedProducts: [],
        selectedOccasions: [],
        selectedStyles: [],
        sessionName: '',
        priority: 'medium'
      });
      await loadTrainingData(); // Reload training data
    } catch (error) {
      toast.error('Failed to create training session from analytics');
    }
  };

  const handleAddFlower = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await aiTrainingService.createFlower(newFlower);
      setNewFlower({
        name: "",
        variety: "",
        color: "",
        seasonality: "",
        availability: true,
        price_range: "",
        description: "",
        image_url: "",
        is_active: true
      });
      toast.success('Flower added');
      loadFlowers();
    } catch (error) {
      toast.error('Failed to add flower');
    }
  };

  const handleDeleteFlower = async (id: string) => {
    if (!window.confirm('Delete this flower?')) return;
    try {
      await aiTrainingService.deleteFlower(id);
      toast.success('Flower deleted');
      loadFlowers();
    } catch (error) {
      toast.error('Failed to delete flower');
    }
  };

  const handleAddPrompt = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createPromptTemplate(tenantId, newPrompt);
      setNewPrompt({
        name: "",
        template: "",
        variables: [],
        category: "custom",
        is_active: true
      });
      toast.success('Prompt template added');
      loadPromptTemplates();
    } catch (error) {
      toast.error('Failed to add prompt template');
    }
  };

  const handleDeletePrompt = async (id: string) => {
    if (!window.confirm('Delete this prompt template?')) return;
    try {
      await deletePromptTemplate(tenantId, id);
      toast.success('Prompt template deleted');
      loadPromptTemplates();
    } catch (error) {
      toast.error('Failed to delete prompt template');
    }
  };

  const handleAddModel = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createModelConfig(tenantId, newModel);
      setNewModel({
        name: "",
        model_type: "dalle3",
        config_data: {},
        is_active: false
      });
      toast.success('Model config added');
      loadModelConfigs();
    } catch (error) {
      toast.error('Failed to add model config');
    }
  };

  const handleDeleteModel = async (id: string) => {
    if (!window.confirm('Delete this model config?')) return;
    try {
      await deleteModelConfig(tenantId, id);
      toast.success('Model config deleted');
      loadModelConfigs();
    } catch (error) {
      toast.error('Failed to delete model config');
    }
  };

  const handleAddStyle = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createAIStyle(tenantId, newStyle);
      setNewStyle({
        name: "",
        description: "",
        color_palette: [],
        mood: "",
        arrangement_style: "",
        flair_elements: [],
        is_active: true
      });
      toast.success('Style added');
      loadStyles();
    } catch (error) {
      toast.error('Failed to add style');
    }
  };

  const handleDeleteStyle = async (id: string) => {
    if (!window.confirm('Delete this style?')) return;
    try {
      await deleteAIStyle(tenantId, id);
      toast.success('Style deleted');
      loadStyles();
    } catch (error) {
      toast.error('Failed to delete style');
    }
  };

  const handleAddType = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createAIArrangementType(tenantId, newType);
      setNewType({
        name: "",
        description: "",
        category: "",
        typical_size: "",
        typical_flowers: "",
        price_range: "",
        is_active: true
      });
      toast.success('Arrangement type added');
      loadTypes();
    } catch (error) {
      toast.error('Failed to add arrangement type');
    }
  };

  const handleDeleteType = async (id: string) => {
    if (!window.confirm('Delete this arrangement type?')) return;
    try {
      await deleteAIArrangementType(tenantId, id);
      toast.success('Arrangement type deleted');
      loadTypes();
    } catch (error) {
      toast.error('Failed to delete arrangement type');
    }
  };

  const handleAddOccasion = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createAIOccasion(tenantId, newOccasion);
      setNewOccasion({
        name: "",
        description: "",
        typical_flowers: "",
        typical_colors: "",
        seasonal_preferences: "",
        price_sensitivity: "",
        is_active: true
      });
      toast.success('Occasion added');
      loadOccasions();
    } catch (error) {
      toast.error('Failed to add occasion');
    }
  };

  const handleDeleteOccasion = async (id: string) => {
    try {
      await deleteAIOccasion(tenantId, id);
      toast.success('Occasion deleted successfully');
      loadOccasions();
    } catch (error) {
      toast.error('Failed to delete occasion');
    }
  };

  const handleAddBudgetTier = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const budgetTierData = {
        ...newBudgetTier,
        min_price: newBudgetTier.min_price ? parseFloat(newBudgetTier.min_price) : null,
        max_price: newBudgetTier.max_price ? parseFloat(newBudgetTier.max_price) : null,
        typical_flowers: newBudgetTier.typical_flowers ? newBudgetTier.typical_flowers.split(',').map(f => f.trim()) : [],
        typical_arrangements: newBudgetTier.typical_arrangements ? newBudgetTier.typical_arrangements.split(',').map(a => a.trim()) : []
      };
      await createAIBudgetTier(tenantId, budgetTierData);
      toast.success('Budget tier added successfully');
      setNewBudgetTier({
        name: "",
        min_price: "",
        max_price: "",
        description: "",
        typical_flowers: "",
        typical_arrangements: "",
        is_active: true
      });
      setShowAddBudgetTier(false);
      loadBudgetTiers();
    } catch (error) {
      toast.error('Failed to add budget tier');
    }
  };

  const handleDeleteBudgetTier = async (id: string) => {
    try {
      await deleteAIBudgetTier(tenantId, id);
      toast.success('Budget tier deleted successfully');
      loadBudgetTiers();
    } catch (error) {
      toast.error('Failed to delete budget tier');
    }
  };

  const handleAddCustomerData = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const customerDataData = {
        ...newCustomerData,
        special_dates: newCustomerData.special_dates ? newCustomerData.special_dates.split(',').map(d => d.trim()) : [],
        preferences: newCustomerData.preferences ? JSON.parse(newCustomerData.preferences) : {},
        allergies: newCustomerData.allergies ? newCustomerData.allergies.split(',').map(a => a.trim()) : [],
        favorite_flowers: newCustomerData.favorite_flowers ? newCustomerData.favorite_flowers.split(',').map(f => f.trim()) : [],
        favorite_colors: newCustomerData.favorite_colors ? newCustomerData.favorite_colors.split(',').map(c => c.trim()) : []
      };
      await createAICustomerData(tenantId, customerDataData);
      toast.success('Customer data added successfully');
      setNewCustomerData({
        customer_id: "",
        recipient_name: "",
        birthday: "",
        anniversary: "",
        special_dates: "",
        preferences: "",
        allergies: "",
        favorite_flowers: "",
        favorite_colors: "",
        budget_preference: "",
        is_active: true
      });
      setShowAddCustomerData(false);
      loadCustomerData();
    } catch (error) {
      toast.error('Failed to add customer data');
    }
  };

  const handleDeleteCustomerData = async (id: string) => {
    try {
      await deleteAICustomerData(tenantId, id);
      toast.success('Customer data deleted successfully');
      loadCustomerData();
    } catch (error) {
      toast.error('Failed to delete customer data');
    }
  };

  const renderOverviewTab = () => (
    <div className="space-y-6">
      {/* Training Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Training Data Overview
          </CardTitle>
          <CardDescription>
            Current state of your AI training data and models
          </CardDescription>
        </CardHeader>
        <CardContent>
          {trainingStats ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{trainingStats.total_products}</div>
                <div className="text-sm text-blue-600">Products</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{trainingStats.total_prompts}</div>
                <div className="text-sm text-green-600">Prompts</div>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">{trainingStats.total_images}</div>
                <div className="text-sm text-purple-600">Images</div>
              </div>
              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <div className="text-2xl font-bold text-orange-600">{trainingStats.total_feedback}</div>
                <div className="text-sm text-orange-600">Feedback</div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              {isLoading ? 'Loading training data...' : 'No training data available'}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>
            Common training data management tasks
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button 
              onClick={extractTrainingDataFromProducts}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              <Upload className="h-4 w-4" />
              Extract from Products
            </Button>
            <Button 
              onClick={createTrainingSession}
              disabled={isLoading || !trainingStats?.total_products}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Play className="h-4 w-4" />
              Start Training
            </Button>
            <Button 
              variant="outline"
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Export Data
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {generatedDesigns.slice(0, 5).map((design) => (
              <div key={design.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Sparkles className="h-4 w-4 text-purple-600" />
                  <div>
                    <div className="font-medium text-sm">{design.prompt.substring(0, 50)}...</div>
                    <div className="text-xs text-gray-500">
                      {new Date(design.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <Badge variant={design.is_approved ? "default" : "secondary"}>
                  {design.is_approved ? "Approved" : "Pending"}
                </Badge>
              </div>
            ))}
            {generatedDesigns.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No recent activity
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderStyleTemplatesTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Style Templates</h3>
        <Button onClick={() => setShowAddStyle(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Style
        </Button>
      </div>

      {showAddStyle && (
        <Card>
          <CardHeader>
            <CardTitle>Add New Style</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddStyle} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="style-name">Name</Label>
                  <Input
                    id="style-name"
                    value={newStyle.name}
                    onChange={(e) => setNewStyle({...newStyle, name: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="style-mood">Mood</Label>
                  <Input
                    id="style-mood"
                    value={newStyle.mood}
                    onChange={(e) => setNewStyle({...newStyle, mood: e.target.value})}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="style-description">Description</Label>
                <Textarea
                  id="style-description"
                  value={newStyle.description}
                  onChange={(e) => setNewStyle({...newStyle, description: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="style-arrangement">Arrangement Style</Label>
                  <Input
                    id="style-arrangement"
                    value={newStyle.arrangement_style}
                    onChange={(e) => setNewStyle({...newStyle, arrangement_style: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="style-active">Active</Label>
                  <Select
                    value={newStyle.is_active ? "true" : "false"}
                    onValueChange={(value) => setNewStyle({...newStyle, is_active: value === "true"})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Active</SelectItem>
                      <SelectItem value="false">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit">Add Style</Button>
                <Button type="button" variant="outline" onClick={() => setShowAddStyle(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Styles ({styles.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Mood</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Arrangement Style</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Usage</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {styles.map((style) => (
                <TableRow key={style.id}>
                  <TableCell className="font-medium">{style.name}</TableCell>
                  <TableCell>{style.mood || '-'}</TableCell>
                  <TableCell className="max-w-xs truncate">{style.description || '-'}</TableCell>
                  <TableCell>{style.arrangement_style || '-'}</TableCell>
                  <TableCell>
                    <Badge variant={style.is_active ? "default" : "secondary"}>
                      {style.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>{style.usage_count || 0}</TableCell>
                  <TableCell>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteStyle(style.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {styles.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No styles found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );

  const renderPromptTemplatesTab = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Prompt Templates
          </CardTitle>
          <CardDescription>
            Manage AI prompt templates for consistent bouquet generation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium">Prompt Templates ({promptTemplates.length})</h3>
            <Button onClick={() => setShowAddPrompt(true)} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add Template
            </Button>
          </div>

          {showAddPrompt && (
            <Card className="mb-4">
              <CardHeader>
                <CardTitle>Add New Prompt Template</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAddPrompt} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="prompt-name">Name</Label>
                      <Input
                        id="prompt-name"
                        value={newPrompt.name}
                        onChange={(e) => setNewPrompt({...newPrompt, name: e.target.value})}
                        placeholder="e.g., Romantic Rose Bouquet"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="prompt-category">Category</Label>
                      <Select value={newPrompt.category} onValueChange={(value) => setNewPrompt({...newPrompt, category: value})}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="custom">Custom</SelectItem>
                          <SelectItem value="romantic">Romantic</SelectItem>
                          <SelectItem value="casual">Casual</SelectItem>
                          <SelectItem value="formal">Formal</SelectItem>
                          <SelectItem value="seasonal">Seasonal</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="prompt-template">Template</Label>
                    <Textarea
                      id="prompt-template"
                      value={newPrompt.template}
                      onChange={(e) => setNewPrompt({...newPrompt, template: e.target.value})}
                      placeholder="Create a beautiful bouquet with {flowers} in {style} style for {occasion}..."
                      rows={4}
                      required
                    />
                    <p className="text-sm text-gray-500 mt-1">
                      Use variables like {"{flowers}"}, {"{style}"}, {"{occasion}"}, {"{budget}"}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="prompt-active"
                      checked={newPrompt.is_active}
                      onCheckedChange={(checked) => setNewPrompt({...newPrompt, is_active: checked as boolean})}
                    />
                    <Label htmlFor="prompt-active">Active</Label>
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit">Add Template</Button>
                    <Button type="button" variant="outline" onClick={() => setShowAddPrompt(false)}>
                      Cancel
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4">
            {promptTemplates.map((prompt) => (
              <div key={prompt.id} className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium">{prompt.name}</h4>
                  <div className="flex items-center gap-2">
                    <Badge variant={prompt.is_active ? "default" : "secondary"}>
                      {prompt.is_active ? "Active" : "Inactive"}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeletePrompt(prompt.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mb-2">{prompt.template}</p>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span>Category: {prompt.category}</span>
                  <span>Usage: {prompt.usage_count || 0}</span>
                  <span>Created: {new Date(prompt.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
            {promptTemplates.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No prompt templates available
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderModelConfigsTab = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Model Configurations
          </CardTitle>
          <CardDescription>
            Configure your AI models and their parameters for bouquet generation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium">Model Configs ({modelConfigs.length})</h3>
            <Button onClick={() => setShowAddModel(true)} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add Model
            </Button>
          </div>

          {showAddModel && (
            <Card className="mb-4">
              <CardHeader>
                <CardTitle>Add New Model Configuration</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAddModel} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="model-name">Name</Label>
                      <Input
                        id="model-name"
                        value={newModel.name}
                        onChange={(e) => setNewModel({...newModel, name: e.target.value})}
                        placeholder="e.g., DALL-E 3 Floral"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="model-type">Model Type</Label>
                      <Select value={newModel.model_type} onValueChange={(value) => setNewModel({...newModel, model_type: value})}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="dalle3">DALL-E 3</SelectItem>
                          <SelectItem value="dalle2">DALL-E 2</SelectItem>
                          <SelectItem value="midjourney">Midjourney</SelectItem>
                          <SelectItem value="stable-diffusion">Stable Diffusion</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="model-config">Configuration (JSON)</Label>
                    <Textarea
                      id="model-config"
                      value={JSON.stringify(newModel.config_data, null, 2)}
                      onChange={(e) => {
                        try {
                          const config = JSON.parse(e.target.value);
                          setNewModel({...newModel, config_data: config});
                        } catch (error) {
                          // Invalid JSON, keep as is
                        }
                      }}
                      placeholder='{"quality": "hd", "style": "natural", "size": "1024x1024"}'
                      rows={4}
                    />
                    <p className="text-sm text-gray-500 mt-1">
                      Enter model-specific configuration parameters
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="model-active"
                      checked={newModel.is_active}
                      onCheckedChange={(checked) => setNewModel({...newModel, is_active: checked as boolean})}
                    />
                    <Label htmlFor="model-active">Set as Active</Label>
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit">Add Model</Button>
                    <Button type="button" variant="outline" onClick={() => setShowAddModel(false)}>
                      Cancel
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4">
            {modelConfigs.map((config) => (
              <div key={config.id} className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium">{config.name}</h4>
                  <div className="flex items-center gap-2">
                    <Badge variant={config.is_active ? "default" : "secondary"}>
                      {config.model_type}
                    </Badge>
                    {config.is_active && (
                      <Badge variant="outline" className="text-green-600">
                        Active
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteModel(config.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="text-sm text-gray-600 mb-2">
                  <pre className="bg-gray-50 p-2 rounded text-xs overflow-x-auto">
                    {JSON.stringify(config.config_data, null, 2)}
                  </pre>
                </div>
                <div className="text-xs text-gray-500">
                  Updated: {new Date(config.updated_at).toLocaleDateString()}
                </div>
              </div>
            ))}
            {modelConfigs.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No model configurations available
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderAnalyticsTab = () => (
    <div className="space-y-6">
      {/* Training Analytics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Training Analytics
          </CardTitle>
          <CardDescription>
            Performance metrics for your AI training data and models
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{trainingStats?.total_products || 0}</div>
              <div className="text-sm text-blue-600">Training Products</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{trainingStats?.total_prompts || 0}</div>
              <div className="text-sm text-green-600">Training Prompts</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">{trainingStats?.total_images || 0}</div>
              <div className="text-sm text-purple-600">Generated Images</div>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">{trainingStats?.total_feedback || 0}</div>
              <div className="text-sm text-orange-600">Feedback Items</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Shopify Analytics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Shopify Store Analytics
          </CardTitle>
          <CardDescription>
            Real-time analytics from your Shopify store to inform AI training
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-wrap items-end gap-4 mb-6">
            <div>
              <Label htmlFor="date-range">Date Range</Label>
              <Select
                value={analyticsFilters.dateRange}
                onValueChange={(value) => setAnalyticsFilters({...analyticsFilters, dateRange: value})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="90d">Last 90 days</SelectItem>
                  <SelectItem value="1y">Last year</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="compare-with">Compare With</Label>
              <Select
                value={analyticsFilters.compareWith}
                onValueChange={(value) => setAnalyticsFilters({...analyticsFilters, compareWith: value})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="previous">Previous period</SelectItem>
                  <SelectItem value="same_period_last_year">Same period last year</SelectItem>
                  <SelectItem value="none">No comparison</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="store-id">Store</Label>
              <Select
                value={analyticsFilters.storeId}
                onValueChange={(value) => setAnalyticsFilters({...analyticsFilters, storeId: value})}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select a store" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Stores</SelectItem>
                  {stores.map((store) => (
                    <SelectItem key={store.id} value={store.id}>
                      {store.name || store.shopify_domain}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Button onClick={loadShopifyAnalytics} disabled={loading}>
                {loading ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Fetching...
                  </>
                ) : (
                  'Fetch Analytics'
                )}
              </Button>
            </div>
          </div>

          {shopifyAnalytics ? (
            <div className="space-y-6">
              {/* Key Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    ${shopifyAnalytics.metrics.average_order_value?.toFixed(2) || '0.00'}
                  </div>
                  <div className="text-sm text-blue-600">Avg Order Value</div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {shopifyAnalytics.metrics.returning_customer_rate?.toFixed(1) || '0'}%
                  </div>
                  <div className="text-sm text-green-600">Returning Customers</div>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">
                    {shopifyAnalytics.metrics.conversion_rate?.toFixed(1) || '0'}%
                  </div>
                  <div className="text-sm text-purple-600">Conversion Rate</div>
                </div>
                <div className="text-center p-4 bg-orange-50 rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">
                    {shopifyAnalytics.metrics.total_orders || 0}
                  </div>
                  <div className="text-sm text-orange-600">Total Orders</div>
                </div>
              </div>

              {/* Top Products */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Top Products by Sales</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product</TableHead>
                          <TableHead>Sales</TableHead>
                          <TableHead>Orders</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {shopifyAnalytics.top_products_by_sales?.slice(0, 5).map((product: any, index: number) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{product.product_title}</TableCell>
                            <TableCell>${product.total_sales?.toFixed(2)}</TableCell>
                            <TableCell>{product.order_count}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Top Occasions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Occasion</TableHead>
                          <TableHead>Orders</TableHead>
                          <TableHead>Sales</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {shopifyAnalytics.top_occasions?.slice(0, 5).map((occasion: any, index: number) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{occasion.occasion}</TableCell>
                            <TableCell>{occasion.order_count}</TableCell>
                            <TableCell>${occasion.total_sales?.toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>

              {/* Customer Segments */}
              <Card>
                <CardHeader>
                  <CardTitle>Customer Segments</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Segment</TableHead>
                        <TableHead>Customers</TableHead>
                        <TableHead>Avg Spent</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {shopifyAnalytics.customer_segments?.map((segment: any, index: number) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{segment.segment}</TableCell>
                          <TableCell>{segment.customer_count}</TableCell>
                          <TableCell>${segment.avg_spent?.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Start Training Session Button */}
              <div className="flex justify-center">
                <Button 
                  onClick={() => setShowTrainingSessionModal(true)}
                  className="flex items-center gap-2"
                  size="lg"
                >
                  <Play className="h-4 w-4" />
                  Start Training Session from Analytics
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              {loading ? 'Loading analytics...' : 'No analytics data available. Click "Fetch Analytics" to load data.'}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Training Session Modal */}
      {showTrainingSessionModal && (
        <Card className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <CardContent className="w-full max-w-md p-6">
            <CardHeader>
              <CardTitle>Create Training Session from Analytics</CardTitle>
              <CardDescription>
                Select data from your analytics to create a targeted training session
              </CardDescription>
            </CardHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="session-name">Session Name</Label>
                <Input
                  id="session-name"
                  value={selectedAnalyticsData.sessionName}
                  onChange={(e) => setSelectedAnalyticsData({...selectedAnalyticsData, sessionName: e.target.value})}
                  placeholder="Analytics-based training session"
                />
              </div>
              <div>
                <Label htmlFor="priority">Priority</Label>
                <Select
                  value={selectedAnalyticsData.priority}
                  onValueChange={(value: 'high' | 'medium' | 'low') => setSelectedAnalyticsData({...selectedAnalyticsData, priority: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleCreateTrainingSessionFromAnalytics}>
                  Create Session
                </Button>
                <Button variant="outline" onClick={() => setShowTrainingSessionModal(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderFlowersTab = () => (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Flowers</CardTitle>
            <CardDescription>Manage your flower catalog for AI training.</CardDescription>
          </div>
          <Dialog open={showAddFlower} onOpenChange={setShowAddFlower}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Flower
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Flower</DialogTitle>
                <DialogDescription>
                  Add a new flower to your catalog for AI training.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddFlower} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="flower-name">Name</Label>
                  <Input
                    id="flower-name"
                    value={newFlower.name}
                    onChange={(e) => setNewFlower({ ...newFlower, name: e.target.value })}
                    placeholder="Rose"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="flower-variety">Variety</Label>
                  <Input
                    id="flower-variety"
                    value={newFlower.variety}
                    onChange={(e) => setNewFlower({ ...newFlower, variety: e.target.value })}
                    placeholder="Red Rose"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="flower-color">Color</Label>
                  <Input
                    id="flower-color"
                    value={newFlower.color}
                    onChange={(e) => setNewFlower({ ...newFlower, color: e.target.value })}
                    placeholder="Red"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="flower-description">Description</Label>
                  <Textarea
                    id="flower-description"
                    value={newFlower.description}
                    onChange={(e) => setNewFlower({ ...newFlower, description: e.target.value })}
                    placeholder="Description of the flower..."
                  />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setShowAddFlower(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Add Flower</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {flowers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No flowers added yet. Add your first flower to get started.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Variety</TableHead>
                <TableHead>Color</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {flowers.map((flower) => (
                <TableRow key={flower.id}>
                  <TableCell className="font-medium">{flower.name}</TableCell>
                  <TableCell>{flower.variety}</TableCell>
                  <TableCell>{flower.color}</TableCell>
                  <TableCell>
                    <Badge variant={flower.is_active ? "default" : "secondary"}>
                      {flower.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteFlower(flower.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );

  const renderTypesTab = () => (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Arrangement Types</CardTitle>
            <CardDescription>Manage arrangement types for AI training.</CardDescription>
          </div>
          <Dialog open={showAddType} onOpenChange={setShowAddType}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Type
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Arrangement Type</DialogTitle>
                <DialogDescription>
                  Add a new arrangement type for AI training.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddType} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="type-name">Name</Label>
                  <Input
                    id="type-name"
                    value={newType.name}
                    onChange={(e) => setNewType({ ...newType, name: e.target.value })}
                    placeholder="Bouquet"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type-description">Description</Label>
                  <Textarea
                    id="type-description"
                    value={newType.description}
                    onChange={(e) => setNewType({ ...newType, description: e.target.value })}
                    placeholder="Description of the arrangement type..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type-category">Category</Label>
                  <Input
                    id="type-category"
                    value={newType.category}
                    onChange={(e) => setNewType({ ...newType, category: e.target.value })}
                    placeholder="Traditional"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type-size">Typical Size</Label>
                  <Input
                    id="type-size"
                    value={newType.typical_size}
                    onChange={(e) => setNewType({ ...newType, typical_size: e.target.value })}
                    placeholder="Medium"
                  />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setShowAddType(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Add Type</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {types.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No arrangement types added yet. Add your first type to get started.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {types.map((type) => (
                <TableRow key={type.id}>
                  <TableCell className="font-medium">{type.name}</TableCell>
                  <TableCell>{type.category}</TableCell>
                  <TableCell>{type.typical_size}</TableCell>
                  <TableCell>
                    <Badge variant={type.is_active ? "default" : "secondary"}>
                      {type.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteType(type.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );

  const renderOccasionsTab = () => (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Occasions</CardTitle>
            <CardDescription>Manage occasions for AI training.</CardDescription>
          </div>
          <Dialog open={showAddOccasion} onOpenChange={setShowAddOccasion}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Occasion
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Occasion</DialogTitle>
                <DialogDescription>
                  Add a new occasion for AI training.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddOccasion} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="occasion-name">Name</Label>
                  <Input
                    id="occasion-name"
                    value={newOccasion.name}
                    onChange={(e) => setNewOccasion({ ...newOccasion, name: e.target.value })}
                    placeholder="Birthday"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="occasion-description">Description</Label>
                  <Textarea
                    id="occasion-description"
                    value={newOccasion.description}
                    onChange={(e) => setNewOccasion({ ...newOccasion, description: e.target.value })}
                    placeholder="Description of the occasion..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="occasion-colors">Typical Colors</Label>
                  <Input
                    id="occasion-colors"
                    value={newOccasion.typical_colors}
                    onChange={(e) => setNewOccasion({ ...newOccasion, typical_colors: e.target.value })}
                    placeholder="Pink, Red, White"
                  />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setShowAddOccasion(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Add Occasion</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {occasions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No occasions added yet. Add your first occasion to get started.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Colors</TableHead>
                <TableHead>Seasonal Preferences</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {occasions.map((occasion) => (
                <TableRow key={occasion.id}>
                  <TableCell className="font-medium">{occasion.name}</TableCell>
                  <TableCell>{occasion.typical_colors}</TableCell>
                  <TableCell>{occasion.seasonal_preferences}</TableCell>
                  <TableCell>
                    <Badge variant={occasion.is_active ? "default" : "secondary"}>
                      {occasion.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteOccasion(occasion.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );

  const renderBudgetTiersTab = () => (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Budget Tiers</CardTitle>
            <CardDescription>Manage budget tiers for AI training.</CardDescription>
          </div>
          <Dialog open={showAddBudgetTier} onOpenChange={setShowAddBudgetTier}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Budget Tier
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Budget Tier</DialogTitle>
                <DialogDescription>
                  Add a new budget tier for AI training.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddBudgetTier} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="budget-name">Name</Label>
                  <Input
                    id="budget-name"
                    value={newBudgetTier.name}
                    onChange={(e) => setNewBudgetTier({ ...newBudgetTier, name: e.target.value })}
                    placeholder="Premium"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="budget-min">Min Price</Label>
                    <Input
                      id="budget-min"
                      value={newBudgetTier.min_price}
                      onChange={(e) => setNewBudgetTier({ ...newBudgetTier, min_price: e.target.value })}
                      placeholder="50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="budget-max">Max Price</Label>
                    <Input
                      id="budget-max"
                      value={newBudgetTier.max_price}
                      onChange={(e) => setNewBudgetTier({ ...newBudgetTier, max_price: e.target.value })}
                      placeholder="100"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="budget-description">Description</Label>
                  <Textarea
                    id="budget-description"
                    value={newBudgetTier.description}
                    onChange={(e) => setNewBudgetTier({ ...newBudgetTier, description: e.target.value })}
                    placeholder="Description of the budget tier..."
                  />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setShowAddBudgetTier(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Add Budget Tier</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {budgetTiers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No budget tiers added yet. Add your first budget tier to get started.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Price Range</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {budgetTiers.map((tier) => (
                <TableRow key={tier.id}>
                  <TableCell className="font-medium">{tier.name}</TableCell>
                  <TableCell>${tier.min_price} - ${tier.max_price}</TableCell>
                  <TableCell>{tier.description}</TableCell>
                  <TableCell>
                    <Badge variant={tier.is_active ? "default" : "secondary"}>
                      {tier.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteBudgetTier(tier.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );

  const renderCustomerDataTab = () => (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Customer Data</CardTitle>
            <CardDescription>Manage customer data for AI training.</CardDescription>
          </div>
          <Dialog open={showAddCustomerData} onOpenChange={setShowAddCustomerData}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Customer Data
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Customer Data</DialogTitle>
                <DialogDescription>
                  Add customer data for AI training.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddCustomerData} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="customer-id">Customer ID</Label>
                  <Input
                    id="customer-id"
                    value={newCustomerData.customer_id}
                    onChange={(e) => setNewCustomerData({ ...newCustomerData, customer_id: e.target.value })}
                    placeholder="CUST001"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="recipient-name">Recipient Name</Label>
                  <Input
                    id="recipient-name"
                    value={newCustomerData.recipient_name}
                    onChange={(e) => setNewCustomerData({ ...newCustomerData, recipient_name: e.target.value })}
                    placeholder="John Doe"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="favorite-flowers">Favorite Flowers</Label>
                  <Input
                    id="favorite-flowers"
                    value={newCustomerData.favorite_flowers}
                    onChange={(e) => setNewCustomerData({ ...newCustomerData, favorite_flowers: e.target.value })}
                    placeholder="Roses, Lilies"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="allergies">Allergies</Label>
                  <Input
                    id="allergies"
                    value={newCustomerData.allergies}
                    onChange={(e) => setNewCustomerData({ ...newCustomerData, allergies: e.target.value })}
                    placeholder="None"
                  />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setShowAddCustomerData(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Add Customer Data</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {customerData.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No customer data added yet. Add your first customer data to get started.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer ID</TableHead>
                <TableHead>Recipient</TableHead>
                <TableHead>Favorite Flowers</TableHead>
                <TableHead>Allergies</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customerData.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell className="font-medium">{customer.customer_id}</TableCell>
                  <TableCell>{customer.recipient_name}</TableCell>
                  <TableCell>{customer.favorite_flowers}</TableCell>
                  <TableCell>{customer.allergies}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteCustomerData(customer.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );

  const renderTrainingDataContent = () => {
    switch (trainingDataSubTab) {
      case 'flowers':
        return renderFlowersTab();
      case 'styles':
        return renderStyleTemplatesTab();
      case 'types':
        return renderTypesTab();
      case 'occasions':
        return renderOccasionsTab();
      case 'budget-tiers':
        return renderBudgetTiersTab();
      case 'customer-data':
        return renderCustomerDataTab();
      default:
        return null;
    }
  };

  const renderAIConfigContent = () => {
    switch (aiConfigSubTab) {
      case 'prompts':
        return renderPromptTemplatesTab();
      case 'models':
        return renderModelConfigsTab();
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <Tabs value={mainTab} onValueChange={setMainTab} className="w-full">
        <TabsList>
          <TabsTrigger value="overview">
            <Activity className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="training-data">
            <Database className="h-4 w-4 mr-2" />
            Training Data
          </TabsTrigger>
          <TabsTrigger value="ai-config">
            <Brain className="h-4 w-4 mr-2" />
            AI Configuration
          </TabsTrigger>
          <TabsTrigger value="analytics">
            <BarChart3 className="h-4 w-4 mr-2" />
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          {renderOverviewTab()}
        </TabsContent>
        <TabsContent value="training-data" className="mt-4">
          <Tabs
            value={trainingDataSubTab}
            onValueChange={setTrainingDataSubTab}
            className="w-full"
          >
            <TabsList>
              <TabsTrigger value="flowers">
                <Sparkles className="h-4 w-4 mr-2" />
                Flowers
              </TabsTrigger>
              <TabsTrigger value="styles">
                <Palette className="h-4 w-4 mr-2" />
                Styles
              </TabsTrigger>
              <TabsTrigger value="types">
                <FileText className="h-4 w-4 mr-2" />
                Types
              </TabsTrigger>
              <TabsTrigger value="occasions">
                <Calendar className="h-4 w-4 mr-2" />
                Occasions
              </TabsTrigger>
              <TabsTrigger value="budget-tiers">
                <DollarSign className="h-4 w-4 mr-2" />
                Budget Tiers
              </TabsTrigger>
              <TabsTrigger value="customer-data">
                <Users className="h-4 w-4 mr-2" />
                Customer Data
              </TabsTrigger>
            </TabsList>
            <TabsContent value={trainingDataSubTab} className="mt-4">
              {renderTrainingDataContent()}
            </TabsContent>
          </Tabs>
        </TabsContent>
        <TabsContent value="ai-config" className="mt-4">
          <Tabs
            value={aiConfigSubTab}
            onValueChange={setAiConfigSubTab}
            className="w-full"
          >
            <TabsList>
              <TabsTrigger value="prompts">
                <MessageSquare className="h-4 w-4 mr-2" />
                Prompts
              </TabsTrigger>
              <TabsTrigger value="models">
                <Zap className="h-4 w-4 mr-2" />
                Models
              </TabsTrigger>
            </TabsList>
            <TabsContent value={aiConfigSubTab} className="mt-4">
              {renderAIConfigContent()}
            </TabsContent>
          </Tabs>
        </TabsContent>
        <TabsContent value="analytics" className="mt-4">
          {renderAnalyticsTab()}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AITrainingManager; 