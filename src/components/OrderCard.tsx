import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Check, Clock, User as UserIcon, Package, FileText, Tag } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { type Order, type User, type Store, ProductLabel } from '../types';
import { assignOrder, completeOrder, updateOrderRemarks, updateProductCustomizations, getProductLabels } from '../utils/storage';
import { useMobileView } from './Dashboard';

interface OrderCardProps {
  order: Order;
  currentUser: User;
  florists: User[];
  stores: Store[];
  onOrderUpdate: () => void;
  isBatchMode?: boolean;
  isSelected?: boolean;
  onToggleSelection?: (orderId: string) => void;
}

export function OrderCard({ order, currentUser, florists, stores, onOrderUpdate, isBatchMode = false, isSelected = false, onToggleSelection }: OrderCardProps) {
  const [isEditingRemarks, setIsEditingRemarks] = useState(false);
  const [remarksValue, setRemarksValue] = useState(order.remarks || '');
  const [isEditingProduct, setIsEditingProduct] = useState(false);
  const [productCustomizationsValue, setProductCustomizationsValue] = useState(order.productCustomizations || '');
  
  // Get mobile view context to force mobile styling when toggle is active
  const { isMobileView } = useMobileView();

  const assignedFlorist = florists.find(f => f.id === order.assignedFloristId);
  const orderStore = stores.find(s => s.id === order.storeId);
  const canAssignSelf = currentUser.role === 'florist' && !order.assignedFloristId;
  const isAdmin = currentUser.role === 'admin';
  const isAssigned = order.assignedFloristId && order.status !== 'completed';
  const isCompleted = order.status === 'completed';

  // Get the label for this order's difficulty
  const labels = getProductLabels();
  const currentLabel = labels.find(label => label.name === order.difficultyLabel);

  const handleAssignSelf = () => {
    assignOrder(order.id, currentUser.id);
    onOrderUpdate();
  };

  const handleAdminAssign = (floristId: string) => {
    assignOrder(order.id, floristId);
    onOrderUpdate();
  };

  const handleToggleComplete = () => {
    completeOrder(order.id);
    onOrderUpdate();
  };

  const handleRemarksSubmit = () => {
    updateOrderRemarks(order.id, remarksValue);
    setIsEditingRemarks(false);
    onOrderUpdate();
  };

  const handleRemarksCancel = () => {
    setRemarksValue(order.remarks || '');
    setIsEditingRemarks(false);
  };

  const handleProductCustomizationsSubmit = () => {
    updateProductCustomizations(order.id, productCustomizationsValue);
    setIsEditingProduct(false);
    onOrderUpdate();
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
                {isBatchMode && (
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
                assignedFlorist?.id === currentUser.id 
                  ? 'bg-yellow-100 border border-yellow-300' 
                  : 'bg-gray-50'
              }`}>
                <div className="flex items-center gap-1">
                  <UserIcon className="h-2 w-2 text-gray-500" />
                  <span className="text-[10px] text-gray-600">Florist</span>
                </div>
                <div className={`text-xs font-medium mt-0.5 ${
                  assignedFlorist?.id === currentUser.id 
                    ? 'text-yellow-800 font-semibold' 
                    : 'text-gray-700'
                }`}>
                  {assignedFlorist ? assignedFlorist.name : 'Unassigned'}
                </div>
              </div>



              {/* Remarks Card (if any) */}
              {order.remarks && (
                <div className="flex-shrink-0 bg-gray-50 rounded px-2 py-1 min-w-fit">
                  <div className="flex items-center gap-1">
                    <FileText className="h-2 w-2 text-gray-500" />
                    <span className="text-[10px] text-gray-600">Note</span>
                  </div>
                  <div className="text-[10px] font-medium text-gray-700 mt-0.5 max-w-20 truncate">
                    {order.remarks}
                  </div>
                </div>
              )}

              {/* Action Cards */}
              {canAssignSelf && !isCompleted && (
                <div className="flex-shrink-0">
                  <button 
                    onClick={handleAssignSelf}
                    className="bg-green-100 text-green-700 rounded px-2 py-1 text-[10px] font-medium hover:bg-green-200 transition-colors"
                  >
                    Assign Me
                  </button>
                </div>
              )}

              {isAdmin && !isCompleted && (
                <div className="flex-shrink-0">
                  <Select
                    value={order.assignedFloristId || 'unassigned'}
                    onValueChange={handleAdminAssign}
                  >
                    <SelectTrigger className="h-6 text-[10px] w-20 border-gray-300">
                      <SelectValue placeholder="Assign" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {florists.map(florist => (
                        <SelectItem key={florist.id} value={florist.id}>
                          {florist.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Desktop Layout - More Concise */
          <div className="space-y-3">
            
            {/* Header Row - Order ID and Complete Button */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isBatchMode && (
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={handleCheckboxChange}
                    className="h-4 w-4"
                  />
                )}
                <Package className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-mono text-gray-700 font-medium">#{order.id}</span>
              </div>
              
              <Button
                size="sm"
                onClick={handleToggleComplete}
                className={`h-8 w-8 rounded-full p-0 transition-all duration-200 ${
                  isCompleted
                    ? 'bg-green-600 shadow-lg hover:bg-green-700'
                    : 'bg-green-600 hover:bg-green-700 shadow-lg hover:shadow-xl'
                }`}
                aria-label={isCompleted ? 'Mark order as incomplete' : 'Mark order as completed'}
              >
                <Check className="h-4 w-4 text-white" />
              </Button>
            </div>

            {/* Product Information - Compact */}
            <div>
              {isEditingProduct ? (
                <div className="space-y-2">
                  <div className="font-medium text-gray-900 text-sm">
                    {order.productName}
                    {order.productVariant && (
                      <span className="text-gray-600 ml-2 text-xs">({order.productVariant})</span>
                    )}
                  </div>
                  <Textarea
                    value={productCustomizationsValue}
                    onChange={(e) => setProductCustomizationsValue(e.target.value)}
                    placeholder="Add customizations or special instructions..."
                    className="text-sm min-h-[60px] resize-none"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleProductCustomizationsSubmit}>
                      Save
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleProductCustomizationsCancel}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  className={`${
                    isAdmin && !isCompleted ? 'cursor-pointer hover:bg-gray-50 p-2 rounded transition-colors border border-dashed border-gray-200 hover:border-gray-300' : 'p-2'
                  }`}
                  onClick={() => isAdmin && !isCompleted && setIsEditingProduct(true)}
                  onKeyDown={(e) => {
                    if (isAdmin && !isCompleted && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault();
                      setIsEditingProduct(true);
                    }
                  }}
                  tabIndex={isAdmin && !isCompleted ? 0 : -1}
                  role={isAdmin && !isCompleted ? 'button' : undefined}
                >
                  <div className="font-medium text-gray-900 text-sm leading-tight">
                    {order.productName}
                    {order.productVariant && (
                      <span className="text-gray-600 ml-2 text-xs">({order.productVariant})</span>
                    )}
                  </div>
                  {order.productCustomizations && (
                    <div className="text-xs text-blue-700 mt-1 bg-blue-50 p-2 rounded border border-blue-200">
                      <div className="flex items-start gap-1">
                        <FileText className="h-3 w-3 mt-0.5 flex-shrink-0" />
                        <div>{order.productCustomizations}</div>
                      </div>
                    </div>
                  )}
                  {isAdmin && !isCompleted && !order.productCustomizations && (
                    <div className="text-xs text-gray-400 italic mt-1 flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      Click to add customizations
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Metadata Row - Compact */}
            <div className="grid grid-cols-3 gap-4 text-xs">
              {/* Difficulty */}
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <Tag className="h-3 w-3 text-gray-500" />
                  <span className="text-gray-600 font-medium">Difficulty</span>
                </div>
                {currentLabel ? (
                  <Badge 
                    style={{ backgroundColor: currentLabel.color, color: 'white' }}
                    className="text-white text-xs px-2 py-1"
                  >
                    {currentLabel.name}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs px-2 py-1">
                    {order.difficultyLabel}
                  </Badge>
                )}
              </div>
              
              {/* Timeslot */}
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <Clock className="h-3 w-3 text-gray-500" />
                  <span className="text-gray-600 font-medium">Timeslot</span>
                </div>
                <Badge variant="outline" className="text-xs px-2 py-1">
                  {order.timeslot}
                </Badge>
              </div>

              {/* Assignment */}
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <UserIcon className="h-3 w-3 text-gray-500" />
                  <span className="text-gray-600 font-medium">Florist</span>
                </div>
                {isAdmin ? (
                  <Select
                    value={order.assignedFloristId || 'unassigned'}
                    onValueChange={handleAdminAssign}
                    disabled={isCompleted}
                  >
                    <SelectTrigger className={`h-7 text-sm w-full ${
                      order.assignedFloristId === currentUser.id 
                        ? 'bg-yellow-100 border-yellow-300 text-yellow-800 font-semibold' 
                        : ''
                    }`}>
                      <SelectValue placeholder="Assign" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {florists.map(florist => (
                        <SelectItem key={florist.id} value={florist.id}>
                          {florist.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div>
                    {assignedFlorist ? (
                      <Badge 
                        variant={assignedFlorist.id === currentUser.id ? "default" : "secondary"} 
                        className={`text-sm px-2 py-1 ${
                          assignedFlorist.id === currentUser.id 
                            ? 'bg-yellow-500 hover:bg-yellow-600 text-yellow-900 font-semibold' 
                            : ''
                        }`}
                      >
                        {assignedFlorist.name}
                      </Badge>
                    ) : (
                      <span className="text-gray-400 text-sm">Unassigned</span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Remarks and Actions Row */}
            <div className="flex gap-3 items-start">
              {/* Remarks - takes most space */}
              <div className="flex-1">
                <div className="flex items-center gap-1 mb-1">
                  <FileText className="h-3 w-3 text-gray-500" />
                  <span className="text-xs text-gray-600 font-medium">Remarks</span>
                </div>
                {isEditingRemarks ? (
                  <div className="space-y-2">
                    <Input
                      value={remarksValue}
                      onChange={(e) => setRemarksValue(e.target.value)}
                      placeholder="Add remarks..."
                      className="text-xs h-8"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleRemarksSubmit} className="h-7 text-xs">
                        Save
                      </Button>
                      <Button size="sm" variant="outline" onClick={handleRemarksCancel} className="h-7 text-xs">
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    className={`text-xs ${order.remarks ? 'text-gray-700' : 'text-gray-400'} ${
                      isAdmin && !isCompleted ? 'cursor-pointer hover:bg-gray-50 p-2 rounded transition-colors border border-dashed border-gray-200 hover:border-gray-300' : 'p-2 bg-gray-50 rounded'
                    } break-words leading-tight min-h-[32px] flex items-center`}
                    onClick={() => isAdmin && !isCompleted && setIsEditingRemarks(true)}
                    onKeyDown={(e) => {
                      if (isAdmin && !isCompleted && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault();
                        setIsEditingRemarks(true);
                      }
                    }}
                    tabIndex={isAdmin && !isCompleted ? 0 : -1}
                    role={isAdmin && !isCompleted ? 'button' : undefined}
                  >
                    {order.remarks || (isAdmin && !isCompleted ? 'Click to add remarks...' : 'No remarks')}
                  </div>
                )}
              </div>

              {/* Assign to Me Button */}
              {canAssignSelf && !isCompleted && (
                <Button 
                  size="sm" 
                  onClick={handleAssignSelf} 
                  className="bg-green-600 hover:bg-green-700 h-8 text-xs px-3"
                >
                  <UserIcon className="h-3 w-3 mr-1" />
                  Assign Me
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}