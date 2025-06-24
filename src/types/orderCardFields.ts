// Centralized registry of Order Card fields
// This ensures consistency between OrderCard component and Settings mapping

export type OrderCardFieldType = "text" | "textarea" | "select" | "date" | "tags" | "status"

export interface OrderCardField {
  id: string
  label: string
  description: string
  type: OrderCardFieldType
  isVisible: boolean
  isSystem: boolean
  isEditable: boolean
  shopifyFields?: string[]
  transformation?: "extract" | "transform" | "none"
  transformationRule?: string
}

export const ORDER_CARD_FIELDS: OrderCardField[] = [
  // Product Fields
  {
    id: "productTitle",
    label: "Product Title",
    type: "text",
    description: "Name of the product",
    isVisible: true,
    isSystem: false,
    isEditable: false,
  },
  {
    id: "productVariantTitle",
    label: "Product Variant Title",
    type: "text",
    description: "Specific variant of the product",
    isVisible: true,
    isSystem: false,
    isEditable: false,
  },
  {
    id: "timeslot",
    label: "Timeslot",
    type: "text",
    description: "Scheduled order preparation timeslot",
    isVisible: true,
    isSystem: false,
    isEditable: true,
  },
  {
    id: "orderId",
    label: "Order ID",
    type: "text",
    description: "Unique order identifier",
    isVisible: true,
    isSystem: false,
    isEditable: false,
  },
  {
    id: "orderDate",
    label: "Order Date",
    type: "date",
    description: "Date when order was placed",
    isVisible: false, // Hidden by default
    isSystem: false,
    isEditable: false,
    shopifyFields: ["tags"],
    transformation: "extract",
    transformationRule: "\\d{2}/\\d{2}/\\d{4}",
  },
  {
    id: "orderTags",
    label: "Order Tags",
    type: "text",
    description: "Tags associated with the order",
    isVisible: false, // Hidden by default
    isSystem: false,
    isEditable: false,
  },
  // Admin Fields
  {
    id: "assignedTo",
    label: "Assigned To",
    type: "select",
    description: "Florist assigned to this order",
    isVisible: true,
    isSystem: false,
    isEditable: true,
  },
  {
    id: "difficultyLabel",
    label: "Difficulty Label",
    type: "text",
    description: "Difficulty/Priority level",
    isVisible: true,
    isSystem: false,
    isEditable: false,
  },
  {
    id: "productTypeLabel",
    label: "Product Type Label",
    type: "text",
    description: "Product type assigned to the product from Product Management",
    isVisible: true,
    isSystem: false,
    isEditable: false,
  },
  {
    id: "addOns",
    label: "Add-Ons",
    type: "text",
    description: "Special requests or add-ons for the order",
    isVisible: true,
    isSystem: false,
    isEditable: true,
  },
  {
    id: "customisations",
    label: "Customisations",
    type: "textarea",
    description: "Additional remarks and customisation notes",
    isVisible: true,
    isSystem: false,
    isEditable: true,
  },
  // Status Fields
  {
    id: "isCompleted",
    label: "Completed",
    type: "select",
    description: "Order completion status",
    isVisible: true,
    isSystem: false,
    isEditable: true,
  },
]

export function getVisibleFields(): OrderCardField[] {
  return ORDER_CARD_FIELDS.filter((field) => field.isVisible)
}

export function getAllFields(): OrderCardField[] {
  return [
    {
      id: "productTitle",
      label: "Product Title",
      description: "Name of the product",
      type: "text",
      isVisible: true,
      isSystem: false,
      isEditable: false,
      shopifyFields: ["lineItems.edges.0.node.title"],
    },
    {
      id: "productVariantTitle",
      label: "Product Variant Title",
      description: "Specific variant of the product",
      type: "text",
      isVisible: true,
      isSystem: false,
      isEditable: false,
      shopifyFields: ["lineItems.edges.0.node.variant.title"],
    },
    {
      id: "timeslot",
      label: "Timeslot",
      description: "Scheduled order preparation timeslot",
      type: "text",
      isVisible: true,
      isSystem: false,
      isEditable: true,
      shopifyFields: ["tags"],
      transformation: "extract",
      transformationRule: "\\d{2}:\\d{2}-\\d{2}:\\d{2}",
    },
    {
      id: "orderId",
      label: "Order ID",
      description: "Unique order identifier",
      type: "text",
      isVisible: true,
      isSystem: false,
      isEditable: false,
      shopifyFields: ["name"],
    },
    {
      id: "orderDate",
      label: "Order Date",
      description: "Date when order was placed",
      type: "date",
      isVisible: true,
      isSystem: false,
      isEditable: false,
      shopifyFields: ["tags"],
      transformation: "extract",
      transformationRule: "\\b(0[1-9]|[12][0-9]|3[01])/(0[1-9]|1[0-2])/([0-9]{4})\\b",
    },
    {
      id: "orderTags",
      label: "Order Tags",
      description: "Tags associated with the order",
      type: "tags",
      isVisible: true,
      isSystem: false,
      isEditable: true,
      shopifyFields: ["tags"],
    },
    {
      id: "assignedTo",
      label: "Assigned To",
      description: "Florist assigned to this order",
      type: "select",
      isVisible: true,
      isSystem: false,
      isEditable: true,
      shopifyFields: [],
    },
    {
      id: "difficultyLabel",
      label: "Difficulty Label",
      description: "Difficulty/Priority level",
      type: "text",
      isVisible: true,
      isSystem: false,
      isEditable: false,
      shopifyFields: ["product:difficultyLabel"],
    },
    {
      id: "productTypeLabel",
      label: "Product Type Label",
      description: "Product type assigned to the product from Product Management",
      type: "text",
      isVisible: true,
      isSystem: false,
      isEditable: false,
      shopifyFields: ["product:productTypeLabel"],
    },
    {
      id: "addOns",
      label: "Add-Ons",
      description: "Special requests or add-ons for the order",
      type: "textarea",
      isVisible: true,
      isSystem: false,
      isEditable: true,
      shopifyFields: ["note"],
    },
    {
      id: "customisations",
      label: "Customisations",
      description: "Additional remarks and customisation notes",
      type: "textarea",
      isVisible: false,
      isSystem: false,
      isEditable: true,
      shopifyFields: ["note"],
    },
    {
      id: "isCompleted",
      label: "Status",
      description: "Whether the order is completed",
      type: "status",
      isVisible: true,
      isSystem: false,
      isEditable: true,
      shopifyFields: ["displayFulfillmentStatus"],
    },
  ]
}

export function getFieldById(id: string): OrderCardField | undefined {
  return ORDER_CARD_FIELDS.find((field) => field.id === id)
}

export function updateFieldVisibility(fieldId: string, isVisible: boolean): OrderCardField[] {
  return ORDER_CARD_FIELDS.map((field) => (field.id === fieldId ? { ...field, isVisible } : field))
}

export function updateFieldOptions(
  fieldId: string,
  options: Array<{ value: string; label: string }>
): OrderCardField[] {
  return ORDER_CARD_FIELDS.map((field) => (field.id === fieldId ? { ...field, options } : field))
}