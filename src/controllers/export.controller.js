import ExportService from '../services/export.service.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/ApiResponse.js';
import ApiError from '../utils/ApiError.js';

/**
 * Export Bookings
 * GET /api/v1/exports/bookings
 */
export const exportBookings = asyncHandler(async (req, res) => {
  const { dateFrom, dateTo } = req.query;
  
  const workbook = await ExportService.exportBookings({ dateFrom, dateTo });
  
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader(
    'Content-Disposition',
    'attachment; filename=' + 'bookings-report.xlsx'
  );

  await workbook.xlsx.write(res);
  res.end();
});

/**
 * Export Payments
 * GET /api/v1/exports/payments
 */
export const exportPayments = asyncHandler(async (req, res) => {
  const { dateFrom, dateTo } = req.query;
  
  const workbook = await ExportService.exportPayments({ dateFrom, dateTo });
  
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader(
    'Content-Disposition',
    'attachment; filename=' + 'payments-report.xlsx'
  );

  await workbook.xlsx.write(res);
  res.end();
});

/**
 * Export Drivers
 * GET /api/v1/exports/drivers
 */
export const exportDrivers = asyncHandler(async (req, res) => {
  const workbook = await ExportService.exportDrivers();
  
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader(
    'Content-Disposition',
    'attachment; filename=' + 'drivers-report.xlsx'
  );

  await workbook.xlsx.write(res);
  res.end();
});

/**
 * Export Customers
 * GET /api/v1/exports/customers
 */
export const exportCustomers = asyncHandler(async (req, res) => {
  const workbook = await ExportService.exportCustomers();
  
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader(
    'Content-Disposition',
    'attachment; filename=' + 'customers-report.xlsx'
  );

  await workbook.xlsx.write(res);
  res.end();
});
