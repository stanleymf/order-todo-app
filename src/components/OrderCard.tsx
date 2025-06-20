import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Check, Clock, User as UserIcon, Package, FileText, Tag } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { type Order, type Store, ProductLabel } from '../types';
import { type User } from '../types/multi-tenant';
import { assignOrder, completeOrder, updateOrderRemarks, updateProductCustomizations, getProductLabels } from '../utils/storage';
import { useMobileView } from './Dashboard';

interface OrderCardProps {
  order: Order;
  currentUser: User;
  onUpdate: () => void;
  isSelected?: boolean;
  onToggleSelection?: (orderId: string) => void;
  showSelection?: boolean;
}

export function OrderCard({ order, currentUser, onUpdate, isSelected = false, onToggleSelection, showSelection = false }: OrderCardProps) {
  const [isEditingRemarks, setIsEditingRemarks] = useState(false);
  const [remarksValue, setRemarksValue] = useState(order.remarks || '');
  const [isEditingProduct, setIsEditingProduct] = useState(false);
  const [productCustomizationsValue, setProductCustomizationsValue] = useState(order.productCustomizations || '');
  
  // Get mobile view context to force mobile styling when toggle is active
  const { isMobileView } = useMobileView();

  const canAssignSelf = currentUser.role === 'florist' && !order.assignedFloristId;
  const isAdmin = currentUser.role === 'admin';
  const isAssigned = order.assignedFloristId && order.status !== 'completed';
  const isCompleted = order.status === 'completed';

  // Get the label for this order's difficulty
  const labels = getProductLabels();
  const currentLabel = labels.find(label => label.name === order.difficultyLabel);

  const handleAssignSelf = () => {
    assignOrder(order.id, currentUser.id);
    onUpdate();
  };

  const handleAdminAssign = (floristId: string) => {
    assignOrder(order.id, floristId);
    onUpdate();
  };

  const handleToggleComplete = () => {
    completeOrder(order.id);
    onUpdate();
  };

  const handleRemarksSubmit = () => {
    updateOrderRemarks(order.id, remarksValue);
    setIsEditingRemarks(false);
    onUpdate();
  };

  const handleRemarksCancel = () => {
    setRemarksValue(order.remarks || '');
    setIsEditingRemarks(false);
  };

  const handleProductCustomizationsSubmit = () => {
    updateProductCustomizations(order.id, productCustomizationsValue);
    setIsEditingProduct(false);
    onUpdate();
  };

  const handleProductCustomizationsCancel = () => {
    setProductCustomizationsValue(order.productCustomizations || '');
    setIsEditingProduct(false);
  };

  const handleCheckboxChange = () => {
    if (onToggleSelection) {
      onToggleSelection(order.id);
    }
  };

  // Determine card background color based on status
  const getCardClassName = () => {
    if (isCompleted) {
      return 'mb-4 bg-green-50 border-green-200 border-l-4 border-l-green-500';
    }
    if (isAssigned) {
      return 'mb-4 bg-blue-50 border-blue-200 border-l-4 border-l-blue-500';
    }
    return 'mb-4 border-l-4 border-l-orange-500'; // Default/original look for pending/unassigned
  };

  return (
    <Card className={getCardClassName()}>
      <CardContent className={`${isMobileView ? 'p-2' : 'p-3'}`}>
        {isMobileView ? (
          /* Mobile Compact Horizontal Scrollable Layout */
          <div className="space-y-2">
            {/* Header Row - Order ID and Complete Button */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                {showSelection && (
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={handleCheckboxChange}
                    className="h-3 w-3"
                  />
                )}
                <Package className="h-3 w-3 text-gray-500" />
                <span className="text-xs font-mono text-gray-700 font-medium">#{order.id}</span>
              </div>
              
              <Button
                size="sm"
                onClick={handleToggleComplete}
                className={`h-6 w-6 rounded-full p-0 transition-all duration-200 ${
                  isCompleted
                    ? 'bg-green-600 shadow-lg hover:bg-green-700'
                    : 'bg-green-600 hover:bg-green-700 shadow-lg hover:shadow-xl'
                }`}
                aria-label={isCompleted ? 'Mark order as incomplete' : 'Mark order as completed'}
              >
                <Check className="h-3 w-3 text-white" />
              </Button>
            </div>

            {/* Product Name with Customizations */}
            <div className="text-sm font-medium text-gray-900">
              <div className="leading-snug">
                <div className="overflow-x-auto scrollbar-hide whitespace-nowrap pb-1">
                  {order.productName}
                </div>
              </div>
              {order.productVariant && (
                <div className="text-xs text-gray-600 italic mt-1 leading-snug overflow-x-auto scrollbar-hide whitespace-nowrap pb-1">
                  {order.productVariant}
                </div>
              )}
              {order.productCustomizations && (
                <div className="text-xs text-blue-700 font-normal mt-1 leading-snug">
                  {order.productCustomizations}
                </div>
              )}
            </div>

            {/* Horizontal Scrollable Info Cards */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {/* Difficulty Card */}
              <div className="flex-shrink-0 bg-gray-50 rounded px-2 py-1 min-w-fit">
                <div className="flex items-center gap-1">
                  <Tag className="h-2 w-2 text-gray-500" />
                  <span className="text-[10px] text-gray-600">Difficulty</span>
                </div>
                {currentLabel ? (
                  <div 
                    className="text-[10px] font-medium px-1 rounded text-white mt-0.5"
                    style={{ backgroundColor: currentLabel.color }}
                  >
                    {currentLabel.name}
                  </div>
                ) : (
                  <div className="text-[10px] font-medium text-gray-700 mt-0.5">
                    {order.difficultyLabel}
                  </div>
                )}
              </div>

              {/* Timeslot Card */}
              <div className="flex-shrink-0 bg-gray-50 rounded px-2 py-1 min-w-fit">
                <div className="flex items-center gap-1">
                  <Clock className="h-2 w-2 text-gray-500" />
                  <span className="text-[10px] text-gray-600">Time</span>
                </div>
                <div className="text-[10px] font-medium text-gray-700 mt-0.5">
                  {order.timeslot}
                </div>
              </div>

              {/* Assignment Card */}
              <div className={`flex-shrink-0 rounded px-2 py-1 min-w-fit ${
                order.assignedFloristId === currentUser.id 
                  ? 'bg-yellow-100 border border-yellow-300' 
                  : 'bg-gray-50'
              }`}>
                <div className="flex items-center gap-1">
                  <UserIcon className="h-2 w-2 text-gray-500" />
                  <span className="text-[10px] text-gray-600">Florist</span>
                </div>
                <div className={`text-xs font-medium mt-0.5 ${
                  order.assignedFloristId === currentUser.id 
                    ? 'text-yellow-800 font-semibold' 
                    : 'text-gray-700'
                }`}>
                  {order.assignedFloristId ? 'Assigned' : 'Unassigned'}
                </div>
              </div>

              {/* Remarks Card (if any) */}
              {order.remarks && (
                <div className="flex-shrink-0 bg-blue-50 rounded px-2 py-1 min-w-fit">
                  <div className="flex items-center gap-1">
                    <FileText className="h-2 w-2 text-blue-500" />
                    <span className="text-[10px] text-blue-600">Remarks</span>
                  </div>
                  <div className="text-[10px] font-medium text-blue-700 mt-0.5 max-w-[80px] truncate">
                    {order.remarks}
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-1">
              {canAssignSelf && (
                <Button size="sm" onClick={handleAssignSelf} className="text-xs px-2 py-1 h-6">
                  Assign to Me
                </Button>
              )}
              {isAdmin && (
                <Select onValueChange={handleAdminAssign}>
                  <SelectTrigger className="text-xs px-2 py-1 h-6">
                    <SelectValue placeholder="Assign to florist" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    <SelectItem value={currentUser.id}>Assign to Me</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        ) : (
          /* Desktop Layout */
          <div className="space-y-3">
            {/* Header Row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {showSelection && (
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={handleCheckboxChange}
                  />
                )}
                <Package className="h-4 w-4 text-gray-500" />
                <span className="font-mono text-gray-700 font-medium">#{order.id}</span>
                <Badge variant={isCompleted ? 'default' : 'secondary'}>
                  {order.status}
                </Badge>
              </div>
              
              <Button
                size="sm"
                onClick={handleToggleComplete}
                className={`transition-all duration-200 ${
                  isCompleted
                    ? 'bg-green-600 shadow-lg hover:bg-green-700'
                    : 'bg-green-600 hover:bg-green-700 shadow-lg hover:shadow-xl'
                }`}
              >
                <Check className="h-4 w-4 mr-2" />
                {isCompleted ? 'Completed' : 'Mark Complete'}
              </Button>
            </div>

            {/* Product Details */}
            <div>
              <h3 className="font-medium text-gray-900">{order.productName}</h3>
              {order.productVariant && (
                <p className="text-sm text-gray-600 italic">{order.productVariant}</p>
              )}
              {order.productCustomizations && (
                <p className="text-sm text-blue-700 mt-1">{order.productCustomizations}</p>
              )}
            </div>

            {/* Order Info Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="text-xs text-gray-500">Difficulty</label>
                {currentLabel ? (
                  <Badge 
                    className="mt-1"
                    style={{ backgroundColor: currentLabel.color }}
                  >
                    {currentLabel.name}
                  </Badge>
                ) : (
                  <p className="text-sm font-medium mt-1">{order.difficultyLabel}</p>
                )}
              </div>
              
              <div>
                <label className="text-xs text-gray-500">Timeslot</label>
                <p className="text-sm font-medium mt-1">{order.timeslot}</p>
              </div>
              
              <div>
                <label className="text-xs text-gray-500">Assignment</label>
                <div className="flex items-center gap-2 mt-1">
                  <UserIcon className="h-4 w-4 text-gray-400" />
                  <span className="text-sm">
                    {order.assignedFloristId ? 'Assigned' : 'Unassigned'}
                  </span>
                </div>
              </div>
              
              <div>
                <label className="text-xs text-gray-500">Store</label>
                <p className="text-sm font-medium mt-1">Store #{order.storeId}</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              {canAssignSelf && (
                <Button size="sm" onClick={handleAssignSelf}>
                  Assign to Me
                </Button>
              )}
              {isAdmin && (
                <Select onValueChange={handleAdminAssign}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Assign to florist" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    <SelectItem value={currentUser.id}>Assign to Me</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Remarks Section */}
            {order.remarks && (
              <div>
                <label className="text-xs text-gray-500">Remarks</label>
                <p className="text-sm mt-1">{order.remarks}</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}