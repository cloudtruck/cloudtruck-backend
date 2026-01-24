import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import OrganizationSettings from '../models/organizationSettings.model.js';

// @desc    Get organization settings
// @route   GET /api/v1/organization/settings
// @access  Super-admin, Staff
export const getSettings = asyncHandler(async (req, res) => {
  const settings = await OrganizationSettings.getInstance();
  
  res.json(
    new ApiResponse(200, settings, 'Organization settings fetched successfully')
  );
});

// @desc    Update organization settings
// @route   PATCH /api/v1/organization/settings
// @access  Super-admin
export const updateSettings = asyncHandler(async (req, res) => {
  const updates = req.body;
  
  // Prevent updating certain fields directly
  delete updates._id;
  delete updates.createdAt;
  delete updates.currentBookingNumber; // Use separate endpoint for this
  
  const settings = await OrganizationSettings.updateSettings(updates, req.user._id);
  
  res.json(
    new ApiResponse(200, settings, 'Organization settings updated successfully')
  );
});

// @desc    Get next booking number
// @route   GET /api/v1/organization/settings/next-booking-number
// @access  Super-admin, Staff
export const getNextBookingNumber = asyncHandler(async (req, res) => {
  const settings = await OrganizationSettings.getInstance();
  const nextNumber = await settings.getNextBookingNumber();
  
  res.json(
    new ApiResponse(200, { bookingNumber: nextNumber }, 'Next booking number generated')
  );
});

// @desc    Update company information
// @route   PATCH /api/v1/organization/settings/company
// @access  Super-admin
export const updateCompanyInfo = asyncHandler(async (req, res) => {
  const { companyName, gstNumber, panNumber, companyAddress, contactDetails } = req.body;
  
  const settings = await OrganizationSettings.getInstance();
  
  if (companyName) settings.companyName = companyName;
  if (gstNumber !== undefined) settings.gstNumber = gstNumber;
  if (panNumber !== undefined) settings.panNumber = panNumber;
  if (companyAddress) settings.companyAddress = { ...settings.companyAddress, ...companyAddress };
  if (contactDetails) settings.contactDetails = { ...settings.contactDetails, ...contactDetails };
  settings.updatedBy = req.user._id;
  
  await settings.save();
  
  res.json(
    new ApiResponse(200, settings, 'Company information updated successfully')
  );
});

// @desc    Update booking configuration
// @route   PATCH /api/v1/organization/settings/booking-config
// @access  Super-admin
export const updateBookingConfig = asyncHandler(async (req, res) => {
  const { bookingSeriesPrefix, bookingSeriesStartNumber, podMandatory, autoAssignDriver } = req.body;
  
  const settings = await OrganizationSettings.getInstance();
  
  if (bookingSeriesPrefix) settings.bookingSeriesPrefix = bookingSeriesPrefix;
  if (bookingSeriesStartNumber !== undefined) {
    settings.bookingSeriesStartNumber = bookingSeriesStartNumber;
    // Only update current number if it's less than start number
    if (settings.currentBookingNumber < bookingSeriesStartNumber) {
      settings.currentBookingNumber = bookingSeriesStartNumber;
    }
  }
  if (podMandatory !== undefined) settings.podMandatory = podMandatory;
  if (autoAssignDriver !== undefined) settings.autoAssignDriver = autoAssignDriver;
  settings.updatedBy = req.user._id;
  
  await settings.save();
  
  res.json(
    new ApiResponse(200, settings, 'Booking configuration updated successfully')
  );
});

// @desc    Update operational settings
// @route   PATCH /api/v1/organization/settings/operational
// @access  Super-admin
export const updateOperationalSettings = asyncHandler(async (req, res) => {
  const { advancePaymentPercentage, allowPartialPayment } = req.body;
  
  const settings = await OrganizationSettings.getInstance();
  
  if (advancePaymentPercentage !== undefined) {
    if (advancePaymentPercentage < 0 || advancePaymentPercentage > 100) {
      throw new ApiError(400, 'Advance payment percentage must be between 0 and 100');
    }
    settings.advancePaymentPercentage = advancePaymentPercentage;
  }
  if (allowPartialPayment !== undefined) settings.allowPartialPayment = allowPartialPayment;
  settings.updatedBy = req.user._id;
  
  await settings.save();
  
  res.json(
    new ApiResponse(200, settings, 'Operational settings updated successfully')
  );
});

// @desc    Update notification settings
// @route   PATCH /api/v1/organization/settings/notifications
// @access  Super-admin
export const updateNotificationSettings = asyncHandler(async (req, res) => {
  const { emailEnabled, smsEnabled, whatsappEnabled } = req.body;
  
  const settings = await OrganizationSettings.getInstance();
  
  if (emailEnabled !== undefined) settings.notificationSettings.emailEnabled = emailEnabled;
  if (smsEnabled !== undefined) settings.notificationSettings.smsEnabled = smsEnabled;
  if (whatsappEnabled !== undefined) settings.notificationSettings.whatsappEnabled = whatsappEnabled;
  settings.updatedBy = req.user._id;
  
  await settings.save();
  
  res.json(
    new ApiResponse(200, settings, 'Notification settings updated successfully')
  );
});

// @desc    Update tax settings
// @route   PATCH /api/v1/organization/settings/tax
// @access  Super-admin
export const updateTaxSettings = asyncHandler(async (req, res) => {
  const { gstEnabled, cgstRate, sgstRate, igstRate } = req.body;
  
  const settings = await OrganizationSettings.getInstance();
  
  if (gstEnabled !== undefined) settings.taxSettings.gstEnabled = gstEnabled;
  if (cgstRate !== undefined) settings.taxSettings.cgstRate = cgstRate;
  if (sgstRate !== undefined) settings.taxSettings.sgstRate = sgstRate;
  if (igstRate !== undefined) settings.taxSettings.igstRate = igstRate;
  settings.updatedBy = req.user._id;
  
  await settings.save();
  
  res.json(
    new ApiResponse(200, settings, 'Tax settings updated successfully')
  );
});
