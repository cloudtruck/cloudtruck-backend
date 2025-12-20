// User Roles
export const USER_ROLES = {
  CUSTOMER: 'customer',
  DRIVER: 'driver',
  STAFF: 'staff',
  INTERNAL: 'internal',
  SUPER_ADMIN: 'super-admin'
};

// User Status
export const USER_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  BLOCKED: 'blocked',
  PENDING_VERIFICATION: 'pending-verification'
};

// Booking Status
export const BOOKING_STATUS = {
  CREATED: 'created',
  UNDER_REVIEW: 'under-review',
  ASSIGNED: 'assigned',
  DRIVER_EN_ROUTE: 'driver-en-route',
  REACHED_PICKUP: 'reached-pickup',
  LOADED: 'loaded',
  IN_TRANSIT: 'in-transit',
  REACHED_DESTINATION: 'reached-destination',
  DELIVERED: 'delivered',
  POD_RECEIVED: 'pod-received',
  CLOSED: 'closed',
  CANCELLED: 'cancelled'
};

// Payment Status
export const PAYMENT_STATUS = {
  UNPAID: 'unpaid',
  PAID: 'paid',
  PARTIALLY_PAID: 'partially-paid',
  FAILED: 'failed',
  REFUNDED: 'refunded'
};

// Payment Methods
export const PAYMENT_METHODS = {
  ONLINE: 'online',
  NEFT: 'neft',
  RTGS: 'rtgs',
  CHEQUE: 'cheque',
  CASH: 'cash',
  UPI: 'upi'
};

// Payment Gateways
export const PAYMENT_GATEWAYS = {
  PHONEPE: 'phonepe',
  RAZORPAY: 'razorpay',
  PAYTM: 'paytm',
  MANUAL: 'manual'
};

// Truck Types
export const TRUCK_TYPES = {
  '14_FT': '14-ft',
  '17_FT': '17-ft',
  '19_FT': '19-ft',
  '20_FT': '20-ft',
  '22_FT': '22-ft',
  '24_FT': '24-ft',
  '32_FT_SXL': '32-ft-sxl',
  '32_FT_MXL': '32-ft-mxl',
  CONTAINER_20FT: 'container-20ft',
  CONTAINER_32FT: 'container-32ft',
  CONTAINER_40FT: 'container-40ft',
  TRAILER: 'trailer',
  FLATBED: 'flatbed',
  OPEN_BODY: 'open-body'
};

// Body Types
export const BODY_TYPES = {
  OPEN: 'open',
  CLOSED: 'closed',
  CONTAINER: 'container',
  FLATBED: 'flatbed',
  TRAILER: 'trailer'
};

// Document Types
export const DOCUMENT_TYPES = {
  POD: 'pod',
  LOADING_IMAGE: 'loading-image',
  RC: 'rc',
  LICENSE: 'license',
  PERMIT: 'permit',
  FITNESS: 'fitness',
  INSURANCE: 'insurance',
  GST: 'gst',
  PAN: 'pan',
  AADHAAR: 'aadhaar',
  OTHER: 'other'
};

// Staff Departments
export const STAFF_DEPARTMENTS = {
  OPERATIONS: 'operations',
  SALES: 'sales',
  CUSTOMER_SERVICE: 'customer-service',
  FINANCE: 'finance',
  ADMIN: 'admin',
  IT: 'it'
};

// Material Types
export const MATERIAL_TYPES = [
  'FMCG',
  'Electronics',
  'Furniture',
  'Textiles',
  'Automobile Parts',
  'Steel',
  'Cement',
  'Tiles',
  'Chemicals',
  'Food Items',
  'Medical Supplies',
  'Industrial Goods',
  'Agricultural Products',
  'Other'
];

// Notification Types
export const NOTIFICATION_TYPES = {
  BOOKING_CREATED: 'booking_created',
  DRIVER_ASSIGNED: 'driver_assigned',
  STATUS_UPDATE: 'status_update',
  PAYMENT_SUCCESS: 'payment_success',
  PAYMENT_FAILED: 'payment_failed',
  DELAY_NOTIFICATION: 'delay_notification',
  BOOKING_CANCELLED: 'booking_cancelled',
  POD_UPLOADED: 'pod_uploaded',
  CUSTOM: 'custom'
};

// Audit Actions
export const AUDIT_ACTIONS = {
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  STATUS_CHANGE: 'STATUS_CHANGE',
  PAYMENT: 'PAYMENT',
  ASSIGN_DRIVER: 'ASSIGN_DRIVER',
  UPLOAD_DOCUMENT: 'UPLOAD_DOCUMENT',
  VERIFY_USER: 'VERIFY_USER',
  BLOCK_USER: 'BLOCK_USER'
};

// Rate Limiting
export const RATE_LIMITS = {
  GLOBAL: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // requests per window
  },
  AUTH: {
    windowMs: 15 * 60 * 1000,
    max: 5 // login attempts per window
  },
  API: {
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 30 // API calls per minute
  }
};

// File Upload
export const FILE_UPLOAD = {
  MAX_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'],
  MAX_FILES: 10
};

// Pagination
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100
};

// Distance Units
export const DISTANCE_UNITS = {
  KM: 'km',
  MILES: 'miles'
};

// Weight Units
export const WEIGHT_UNITS = {
  KG: 'kg',
  TONS: 'tons',
  QUINTALS: 'quintals'
};

export default {
  USER_ROLES,
  USER_STATUS,
  BOOKING_STATUS,
  PAYMENT_STATUS,
  PAYMENT_METHODS,
  PAYMENT_GATEWAYS,
  TRUCK_TYPES,
  BODY_TYPES,
  DOCUMENT_TYPES,
  STAFF_DEPARTMENTS,
  MATERIAL_TYPES,
  NOTIFICATION_TYPES,
  AUDIT_ACTIONS,
  RATE_LIMITS,
  FILE_UPLOAD,
  PAGINATION,
  DISTANCE_UNITS,
  WEIGHT_UNITS
};
