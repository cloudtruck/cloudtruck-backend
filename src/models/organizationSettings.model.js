import mongoose from 'mongoose';

const addressSubSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  address: { type: String, required: true, trim: true },
  city: { type: String, required: true, trim: true },
  state: { type: String, required: true, trim: true },
  pincode: { type: String, required: true, match: /^\d{6}$/ },
  country: { type: String, default: 'India', trim: true },
  gstin: { type: String, trim: true, uppercase: true },
  pan: { type: String, trim: true, uppercase: true },
  series: { type: String, trim: true },
  accountNo: { type: String, trim: true },
  isPrimary: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true }
});

const organizationSettingsSchema = new mongoose.Schema({
  // Company Information
  companyName: { 
    type: String, 
    required: true,
    trim: true
  },
  gstNumber: { 
    type: String,
    trim: true,
    uppercase: true
  },
  panNumber: {
    type: String,
    trim: true,
    uppercase: true
  },
  companyAddress: {
    street: String,
    city: String,
    state: String,
    pincode: String,
    country: { type: String, default: 'India' }
  },
  contactDetails: {
    phone: String,
    email: String,
    website: String
  },
  
  // Booking Configuration
  bookingSeriesPrefix: { 
    type: String,
    default: 'BK',
    trim: true,
    uppercase: true
  },
  bookingSeriesStartNumber: {
    type: Number,
    default: 1000
  },
  currentBookingNumber: {
    type: Number,
    default: 1000
  },
  
  // Operational Settings
  podMandatory: { 
    type: Boolean, 
    default: true 
  },
  advancePaymentPercentage: { 
    type: Number, 
    default: 30,
    min: 0,
    max: 100
  },
  autoAssignDriver: {
    type: Boolean,
    default: false
  },
  allowPartialPayment: {
    type: Boolean,
    default: true
  },
  
  // Notification Settings
  notificationSettings: {
    emailEnabled: { type: Boolean, default: true },
    smsEnabled: { type: Boolean, default: false },
    whatsappEnabled: { type: Boolean, default: false }
  },
  
  // Tax Configuration
  taxSettings: {
    gstEnabled: { type: Boolean, default: true },
    cgstRate: { type: Number, default: 9 },
    sgstRate: { type: Number, default: 9 },
    igstRate: { type: Number, default: 18 }
  },
  
  // Pricing & Billing
  defaultCurrency: {
    type: String,
    default: 'INR'
  },
  billingCycle: {
    type: String,
    enum: ['immediate', 'weekly', 'monthly'],
    default: 'immediate'
  },
  
  // Features & Modules
  enabledFeatures: {
    type: [String],
    default: ['bookings', 'customers', 'drivers', 'vehicles', 'payments']
  },

  // Master Tab Settings
  noPodAttached: { type: Boolean, default: false },
  noPodMarket: { type: Boolean, default: false },
  serviceChargesEnabled: { type: Boolean, default: false },
  partnerCode: { type: String, default: '', trim: true },
  eximEnabled: { type: Boolean, default: false },
  customerBudgetLimitEnabled: { type: Boolean, default: false },
  additionPointCharge: { type: Number, default: 0, min: 0 },
  bmAccess: { type: String, enum: ['none', 'read', 'full'], default: 'full' },
  paymentMamul: { type: String, enum: ['none', 'custom', 'slab'], default: 'none' },
  documentsMandatory: { type: Boolean, default: false },
  documentsMandatoryFor: { type: [String], default: [] },
  deleteTripTimeRoles: { type: [String], default: [] },
  processSupplierAdvance: { type: Boolean, default: false },
  tripConfirmationEnabled: { type: Boolean, default: false },
  lrMandatory: {
    lrNo: { type: Boolean, default: true },
    lrImage: { type: Boolean, default: false },
    ewayBill: { type: Boolean, default: false },
  },
  lrMandatoryFields: { type: [String], default: [] },
  supplierAdvanceEditMode: { type: String, enum: ['price', 'percent'], default: 'price' },
  deleteTripRoles: { type: [String], default: [] },
  deleteLrRoles: { type: [String], default: [] },
  kycDocsMandatoryEnabled: { type: Boolean, default: false },
  kycDocsMandatoryFor: { type: [String], default: [] },

  // Deletion Approval Policy
  // Resources listed here will require internal/super-admin approval before staff can delete them
  deletionPolicy: {
    requireApprovalFor: {
      type: [String],
      enum: ['driver', 'vehicle', 'customer', 'staff', 'branch', 'supplier', 'master-data', 'account', 'route', 'document'],
      default: []
    }
  },

  // Addresses
  addresses: [addressSubSchema],

  // Audit Tracking
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  
  metadata: { type: Object }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Singleton pattern - only one document allowed
organizationSettingsSchema.statics.getInstance = async function() {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({
      companyName: 'CloudTruck Logistics'
    });
  }
  return settings;
};

organizationSettingsSchema.statics.updateSettings = async function(updates, userId) {
  const settings = await this.getInstance();
  Object.assign(settings, updates);
  settings.updatedBy = userId;
  return settings.save();
};

// Method to get next booking number
organizationSettingsSchema.methods.getNextBookingNumber = async function() {
  const currentNumber = this.currentBookingNumber;
  this.currentBookingNumber += 1;
  await this.save();
  return `${this.bookingSeriesPrefix}${String(currentNumber).padStart(6, '0')}`;
};

export default mongoose.model('OrganizationSettings', organizationSettingsSchema);
