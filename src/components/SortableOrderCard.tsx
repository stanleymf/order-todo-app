import React from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { OrderDetailCard } from './OrderDetailCard'
import { OrderCardField } from '../types/orderCardFields'

interface SortableOrderCardProps {
  id: string
  order: any
  fields: OrderCardField[]
  isExpanded?: boolean
  onToggle?: () => void
  onStatusChange?: (orderId: string, newStatus: 'unassigned' | 'assigned' | 'completed') => void
  onDelete?: (orderId: string) => void
  deliveryDate?: string
  disabled?: boolean
}

export const SortableOrderCard: React.FC<SortableOrderCardProps> = ({
  id,
  order,
  fields,
  isExpanded = false,
  onToggle,
  onStatusChange,
  onDelete,
  deliveryDate,
  disabled = false,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
    disabled,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 'auto',
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
    >
      <OrderDetailCard
        order={order}
        fields={fields}
        isExpanded={isExpanded}
        onToggle={onToggle}
        onStatusChange={onStatusChange}
        onDelete={onDelete}
        deliveryDate={deliveryDate}
      />
    </div>
  )
} 