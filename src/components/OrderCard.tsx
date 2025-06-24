import React, { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Badge } from "./ui/badge"
import { Button } from "./ui/button"
import { Textarea } from "./ui/textarea"
import { Input } from "./ui/input"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "./ui/select"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip"
import {
  CheckCircle,
  Package,
  Clock,
  Hash,
  Calendar,
  Tag,
  User,
  AlertTriangle,
  Eye,
  EyeOff,
  Circle,
  Gift,
  MessageSquare,
  Save,
  RefreshCw,
  Loader2,
} from "lucide-react"
import { OrderCardField } from "../types/orderCardFields"
import { useIsMobile } from "./hooks/use-mobile"
import { ProductImageModal } from "./shared/ProductImageModal"
import { useAuth } from "../contexts/AuthContext"

interface OrderCardProps {
  fields: OrderCardField[];
  realOrderData: any;
  users?: Array<{ id: string; name: string }>;
  difficultyLabels?: Array<{ id: string; name: string; color: string }>;
  productTypeLabels?: Array<{ id: string; name: string; color: string }>;
  currentUserId?: string;
}

// ========== Utility Functions (from OrderCardPreview) ==========
const getValueFromShopifyData = (sourcePath: string, data: any): any => {
  if (!sourcePath || !data) return null;
  const parts = sourcePath.split('.');
  let current: any = data;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (current === null || typeof current === 'undefined') return null;
    if (Array.isArray(current)) {
      const index = parseInt(part);
      if (!isNaN(index)) {
        if (index >= 0 && index < current.length) {
          current = current[index];
        } else {
          return null;
        }
      } else {
        const nextPart = parts[i + 1];
        if (nextPart) {
          const item = current.find(d => d.name === nextPart);
          current = item ? item.value : null;
          i++;
        } else {
          return current;
        }
      }
    } else if (typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      return null;
    }
  }
  return current;
};

const applyTransformation = (value: any, field: OrderCardField): any => {
  if (field.transformation === "extract" && field.transformationRule) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === 'string') {
          const match = item.match(new RegExp(field.transformationRule));
          if (match) return match[0];
        }
      }
      return "Not set";
    }
    if (typeof value === "string") {
      try {
        const regex = new RegExp(field.transformationRule);
        const match = value.match(regex);
        return match ? match[0] : "Not set";
      } catch (e) {
        return "Invalid Regex";
      }
    }
    return "Not set";
  }
  if (Array.isArray(value)) {
    return value.join(', ');
  }
  return value ?? "Not set";
};

// ========== Main Component ==========
export const OrderCard: React.FC<OrderCardProps> = ({
  fields,
  realOrderData,
  users = [],
  difficultyLabels = [],
  productTypeLabels = [],
  currentUserId,
}) => {
  const { tenant } = useAuth();
  const [isExpanded, setIsExpanded] = useState(false);
  const [productLabel, setProductLabel] = useState<{ name: string; color: string } | null>(null);
  const [orderCardLabels, setOrderCardLabels] = useState<{ difficulty?: { name: string, color: string }, productType?: { name: string, color: string } }>({});
  const [productImageUrl, setProductImageUrl] = useState<string | null>(null);
  const [isProductImageModalOpen, setIsProductImageModalOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | undefined>();
  const [selectedVariantId, setSelectedVariantId] = useState<string | undefined>();

  // Fetch product label logic (from OrderCardPreview)
  useEffect(() => {
    const fetchProductLabelAndImage = async () => {
      if (!tenant?.id || !realOrderData) return;
      let shopifyProductId = realOrderData.shopifyProductId || realOrderData.product_id || realOrderData.productId;
      let shopifyVariantId = realOrderData.shopifyVariantId || realOrderData.variant_id || realOrderData.variantId;
      if (!shopifyProductId || !shopifyVariantId) {
        const lineItem = realOrderData.lineItems?.edges?.[0]?.node;
        if (lineItem) {
          shopifyProductId = lineItem.product?.id;
          shopifyVariantId = lineItem.variant?.id;
        }
      }
      if (shopifyProductId && shopifyProductId.includes('/')) {
        shopifyProductId = shopifyProductId.split('/').pop();
      }
      if (shopifyVariantId && shopifyVariantId.includes('/')) {
        shopifyVariantId = shopifyVariantId.split('/').pop();
      }
      if (!shopifyProductId || !shopifyVariantId) return;
      try {
        const jwt = localStorage.getItem("auth_token");
        const res = await fetch(`/api/tenants/${tenant.id}/saved-products/by-shopify-id?shopify_product_id=${shopifyProductId}&shopify_variant_id=${shopifyVariantId}`, {
          credentials: "include",
          headers: {
            Authorization: `Bearer ${jwt}`,
            "Content-Type": "application/json"
          }
        });
        if (!res.ok) return;
        const product = await res.json();
        setProductImageUrl(product.imageUrl || product.image_url || null);
        let names = [];
        let cats = [];
        let colors = [];
        if (Array.isArray(product.labelNames)) {
          names = product.labelNames;
        } else if (typeof product.labelNames === 'string') {
          names = product.labelNames.split(',');
        }
        if (Array.isArray(product.labelCategories)) {
          cats = product.labelCategories;
        } else if (typeof product.labelCategories === 'string') {
          cats = product.labelCategories.split(',');
        }
        if (Array.isArray(product.labelColors)) {
          colors = product.labelColors;
        } else if (typeof product.labelColors === 'string') {
          colors = product.labelColors.split(',');
        }
        let difficulty;
        let productType;
        for (let i = 0; i < cats.length; i++) {
          if (cats[i] === 'difficulty') {
            difficulty = { name: names[i], color: colors[i] || '#e53e3e' };
          }
          if (cats[i] === 'productType') {
            productType = { name: names[i], color: colors[i] || '#3182ce' };
          }
        }
        setOrderCardLabels({ difficulty, productType });
        let label = null;
        for (let i = 0; i < cats.length; i++) {
          if (cats[i] === 'difficulty') {
            label = { name: names[i], color: colors[i] || '#e53e3e' };
            break;
          }
        }
        if (!label) {
          for (let i = 0; i < cats.length; i++) {
            if (cats[i] === 'productType') {
              label = { name: names[i], color: colors[i] || '#3182ce' };
              break;
            }
          }
        }
        setProductLabel(label);
      } catch (e) {
        setProductLabel(null);
        setProductImageUrl(null);
      }
    };
    fetchProductLabelAndImage();
  }, [tenant?.id, realOrderData]);

  // Handlers
  const handleShowProductImage = useCallback((shopifyProductId?: string, shopifyVariantId?: string) => {
    const numericProductId = shopifyProductId ? shopifyProductId.split('/').pop() : undefined;
    const numericVariantId = shopifyVariantId ? shopifyVariantId.split('/').pop() : undefined;
    setSelectedProductId(numericProductId);
    setSelectedVariantId(numericVariantId);
    setIsProductImageModalOpen(true);
  }, []);

  // Field value getter
  const getFieldValue = useCallback((fieldId: string): any => {
    const field = fields.find((f) => f.id === fieldId);
    if (!field) return "";
    let rawValue;
    // Prefer shopifyOrderData if present
    const dataSource = realOrderData.shopifyOrderData || realOrderData;
    if (dataSource && field.shopifyFields && field.shopifyFields.length > 0) {
      const sourcePath = field.shopifyFields[0];
      rawValue = getValueFromShopifyData(sourcePath, dataSource);
    } else {
      rawValue = (realOrderData as any)[fieldId];
    }
    const transformedValue = applyTransformation(rawValue, field);
    return transformedValue;
  }, [fields, realOrderData]);

  // Card style
  const getCardStyle = () => {
    if (realOrderData.isCompleted) {
      return "border-green-500 bg-green-50";
    }
    if (realOrderData.assignedTo) {
      return "border-blue-500 bg-blue-50";
    }
    return "border-gray-200 bg-white";
  };

  // Collapsed View
  const CollapsedView = () => {
    // Use the fetched difficulty label for consistency
    const difficultyLabel = productLabel && productLabel.name && productLabel.color ? productLabel : null;
    
    // Check if this is an add-on card
    const isAddOnCard = realOrderData.isAddOnCard;
    
    return (
      <CardContent className="p-3 cursor-pointer relative min-h-[90px] fade-in" onClick={() => setIsExpanded(true)}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0 pr-16">
            <div className="text-base font-semibold text-gray-900 leading-tight">
              {isAddOnCard ? realOrderData.addOnTitle : realOrderData.productTitle}
            </div>
            <div className="text-sm text-gray-500 font-normal mt-1">
              {isAddOnCard ? `Add-On - $${realOrderData.addOnPrice}` : realOrderData.productVariantTitle}
            </div>
            {!isAddOnCard && realOrderData?.lineItems?.edges?.[0]?.node?.product?.id && (
              <div className="mt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0"
                  onClick={e => {
                    e.stopPropagation();
                    const productId = realOrderData.lineItems.edges[0].node.product.id;
                    const variantId = realOrderData.lineItems.edges[0].node.variant?.id;
                    setSelectedProductId(productId);
                    setSelectedVariantId(variantId);
                    setIsProductImageModalOpen(true);
                  }}
                >
                  <Eye className="h-4 w-4 text-gray-500 hover:text-gray-700" />
                </Button>
              </div>
            )}
            {/* Display add-ons for main orders */}
            {!isAddOnCard && realOrderData.addOns && realOrderData.addOns.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                <Badge variant="outline" className="text-xs">
                  <Gift className="h-3 w-3 mr-1" />
                  {realOrderData.addOns.length} add-on{realOrderData.addOns.length !== 1 ? 's' : ''}
                </Badge>
              </div>
            )}
          </div>
          <div className="absolute top-3 right-3 flex flex-col items-end gap-2 flex-shrink-0">
            {isAddOnCard && (
              <Badge variant="secondary" className="text-xs">
                <Gift className="h-3 w-3 mr-1" />
                Add-On
              </Badge>
            )}
            {difficultyLabel && (
              <Badge
                style={{ backgroundColor: difficultyLabel.color, color: "white", marginTop: 8 }}
                className="text-xs"
              >
                {difficultyLabel.name}
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    );
  };

  // Expanded View
  const ExpandedView = () => {
    const renderField = (field: OrderCardField) => {
      if (field.id === "difficultyLabel" || field.id === "productTypeLabel") {
        return (
          <div className="flex items-center gap-2 text-sm">
            {field.id === "difficultyLabel" ? (
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            ) : (
              <Package className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="font-medium">{field.label}:</span>
            {productLabel ? (
              <Badge
                variant="secondary"
                style={{ backgroundColor: productLabel.color, color: "white" }}
              >
                {productLabel.name}
              </Badge>
            ) : (
              <span className="text-gray-400">Not set</span>
            )}
          </div>
        );
      }
      
      // Special handling for add-ons field
      if (field.id === "addOns") {
        const addOns = realOrderData.addOns;
        if (!addOns || addOns.length === 0) {
          return (
            <div className="flex items-center gap-2 text-sm">
              <Gift className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{field.label}:</span>
              <span className="text-gray-400">None</span>
            </div>
          );
        }
        
        return (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Gift className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{field.label}:</span>
            </div>
            <div className="ml-6 space-y-1">
              {addOns.map((addOn: any, index: number) => (
                <div key={index} className="flex items-center justify-between text-sm bg-gray-50 p-2 rounded">
                  <span>{addOn.title}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">Qty: {addOn.quantity}</span>
                    <span className="font-medium">${addOn.price}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      }
      
      const value = getFieldValue(field.id);
      return (
        <div key={field.id} className="flex items-center gap-2 text-sm">
          {/* Add icon logic if needed */}
          <span className="font-medium">{field.label}:</span>
          <span>{value}</span>
        </div>
      );
    };
    
    // Check if this is an add-on card
    const isAddOnCard = realOrderData.isAddOnCard;
    
    return (
      <>
        <CardHeader className="pb-3 cursor-pointer" onClick={() => setIsExpanded(false)}>
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                {isAddOnCard ? <Gift className="h-5 w-5" /> : <Package className="h-5 w-5" />}
                {isAddOnCard ? realOrderData.addOnTitle : realOrderData.productTitle}
                {!isAddOnCard && realOrderData?.lineItems?.edges?.[0]?.node?.product?.id && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 ml-1"
                    onClick={e => {
                      e.stopPropagation();
                      const productId = realOrderData.lineItems.edges[0].node.product.id;
                      const variantId = realOrderData.lineItems.edges[0].node.variant?.id;
                      setSelectedProductId(productId);
                      setSelectedVariantId(variantId);
                      setIsProductImageModalOpen(true);
                    }}
                  >
                    <Eye className="h-4 w-4 text-gray-500 hover:text-gray-700" />
                  </Button>
                )}
                {isAddOnCard && (
                  <Badge variant="secondary" className="ml-2">
                    Add-On
                  </Badge>
                )}
              </CardTitle>
              {isAddOnCard ? (
                <p className="text-sm text-muted-foreground mt-1">
                  Add-On - ${realOrderData.addOnPrice}
                </p>
              ) : (
                realOrderData.productVariantTitle && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {realOrderData.productVariantTitle}
                  </p>
                )
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {fields
            .filter(
              field =>
                field.isVisible &&
                ![
                  "productTitle",
                  "productVariantTitle",
                  "orderId",
                  "assignedTo",
                  "customisations",
                ].includes(field.id)
            )
            .map(renderField)}
          {fields.find(f => f.id === "customisations")?.isVisible && (
            <div className="space-y-2">
              <Textarea
                id="customisations-textarea"
                value={getFieldValue("customisations")}
                onChange={e => {}}
                placeholder="Add extra notes..."
                className="mt-1 resize-none overflow-y-auto max-h-[500px] whitespace-pre-wrap"
                onClick={e => e.stopPropagation()}
                onFocus={e => e.stopPropagation()}
                onMouseDown={e => e.stopPropagation()}
                onKeyDown={e => e.stopPropagation()}
              />
            </div>
          )}
        </CardContent>
      </>
    );
  };

  return (
    <Card className={`${getCardStyle()} transition-all duration-200 fade-in`}>
      {isExpanded ? <ExpandedView /> : <CollapsedView />}
      <ProductImageModal
        isOpen={isProductImageModalOpen}
        onClose={() => setIsProductImageModalOpen(false)}
        shopifyProductId={selectedProductId}
        shopifyVariantId={selectedVariantId}
        tenantId={tenant?.id}
      />
    </Card>
  );
}

// Add fade-in animation for cards
// In your global CSS or index.css, add:
// .fade-in { animation: fadeIn 0.3s ease; }
// @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
