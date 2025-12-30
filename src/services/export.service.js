import ExcelJS from 'exceljs';
import Booking from '../models/booking.model.js';
import Payment from '../models/payment.model.js';
import Driver from '../models/driver.model.js';
import Customer from '../models/customer.model.js';
import { format } from 'date-fns';

class ExportService {
  /**
   * Export Bookings to Excel
   */
  static async exportBookings(filters = {}) {
    const { dateFrom, dateTo } = filters;
    const query = { isDeleted: false };

    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo) query.createdAt.$lte = new Date(dateTo);
    }

    const bookings = await Booking.find(query)
      .populate('customer', 'companyName phone')
      .populate('driver', 'name phone')
      .populate('vehicle', 'vehicleNumber truckType')
      .sort({ createdAt: -1 });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Bookings');

    worksheet.columns = [
      { header: 'Booking ID', key: 'bookingId', width: 15 },
      { header: 'Customer', key: 'customer', width: 25 },
      { header: 'Pickup City', key: 'pickupCity', width: 20 },
      { header: 'Drop City', key: 'dropCity', width: 20 },
      { header: 'Material', key: 'material', width: 15 },
      { header: 'Weight', key: 'weight', width: 10 },
      { header: 'Truck Type', key: 'truckType', width: 15 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Payment Status', key: 'paymentStatus', width: 15 },
      { header: 'Amount', key: 'amount', width: 12 },
      { header: 'Driver', key: 'driver', width: 20 },
      { header: 'Vehicle', key: 'vehicle', width: 15 },
      { header: 'Created At', key: 'createdAt', width: 20 }
    ];

    bookings.forEach(b => {
      worksheet.addRow({
        bookingId: b.bookingId,
        customer: b.customer?.companyName || 'N/A',
        pickupCity: b.pickup?.city || 'N/A',
        dropCity: b.drop?.city || 'N/A',
        material: b.materialType,
        weight: b.weight,
        truckType: b.truckTypeNeeded,
        status: b.status,
        paymentStatus: b.paymentStatus,
        amount: b.expectedAmount,
        driver: b.driver?.name || 'Not Assigned',
        vehicle: b.vehicle?.vehicleNumber || 'Not Assigned',
        createdAt: format(b.createdAt, 'yyyy-MM-dd HH:mm')
      });
    });

    // Style header
    worksheet.getRow(1).font = { bold: true };

    return workbook;
  }

  /**
   * Export Payments to Excel
   */
  static async exportPayments(filters = {}) {
    const { dateFrom, dateTo } = filters;
    const query = { isDeleted: false };

    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo) query.createdAt.$lte = new Date(dateTo);
    }

    const payments = await Payment.find(query)
      .populate('customer', 'companyName')
      .populate('booking', 'bookingId')
      .sort({ createdAt: -1 });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Payments');

    worksheet.columns = [
      { header: 'Transaction ID', key: 'transactionId', width: 25 },
      { header: 'Booking ID', key: 'bookingId', width: 15 },
      { header: 'Customer', key: 'customer', width: 25 },
      { header: 'Amount', key: 'amount', width: 12 },
      { header: 'Method', key: 'method', width: 15 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Type', key: 'type', width: 15 },
      { header: 'Date', key: 'createdAt', width: 20 }
    ];

    payments.forEach(p => {
      worksheet.addRow({
        transactionId: p.transactionId || p._id,
        bookingId: p.booking?.bookingId || 'N/A',
        customer: p.customer?.companyName || 'N/A',
        amount: p.amount,
        method: p.paymentMethod,
        status: p.status,
        type: p.paymentType,
        createdAt: format(p.createdAt, 'yyyy-MM-dd HH:mm')
      });
    });

    worksheet.getRow(1).font = { bold: true };
    return workbook;
  }

  /**
   * Export Drivers to Excel
   */
  static async exportDrivers(filters = {}) {
    const query = { isDeleted: false };

    const drivers = await Driver.find(query)
      .populate('user', 'phone email')
      .sort({ createdAt: -1 });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Drivers');

    worksheet.columns = [
      { header: 'Name', key: 'name', width: 25 },
      { header: 'Phone', key: 'phone', width: 15 },
      { header: 'Email', key: 'email', width: 25 },
      { header: 'License Number', key: 'license', width: 20 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Verified', key: 'isVerified', width: 12 },
      { header: 'Total Trips', key: 'totalTrips', width: 12 },
      { header: 'Rating', key: 'rating', width: 10 },
      { header: 'Joined At', key: 'createdAt', width: 20 }
    ];

    drivers.forEach(d => {
      worksheet.addRow({
        name: d.name,
        phone: d.user?.phone || d.phone,
        email: d.user?.email || 'N/A',
        license: d.licenseNumber,
        status: d.isBlacklisted ? 'Blocked' : (d.availability || 'Offline'),
        isVerified: d.isVerified ? 'Yes' : 'No',
        totalTrips: d.totalTrips || 0,
        rating: d.rating || 0,
        createdAt: format(d.createdAt, 'yyyy-MM-dd')
      });
    });

    worksheet.getRow(1).font = { bold: true };
    return workbook;
  }

  /**
   * Export Customers to Excel
   */
  static async exportCustomers(filters = {}) {
    const query = { isDeleted: false };

    const customers = await Customer.find(query)
      .populate('user', 'phone email')
      .sort({ createdAt: -1 });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Customers');

    worksheet.columns = [
      { header: 'Company Name', key: 'companyName', width: 30 },
      { header: 'Contact Person', key: 'contactPerson', width: 25 },
      { header: 'Phone', key: 'phone', width: 15 },
      { header: 'Email', key: 'email', width: 25 },
      { header: 'GST Number', key: 'gst', width: 20 },
      { header: 'City', key: 'city', width: 15 },
      { header: 'Verified', key: 'isVerified', width: 12 },
      { header: 'Joined At', key: 'createdAt', width: 20 }
    ];

    customers.forEach(c => {
      worksheet.addRow({
        companyName: c.companyName,
        contactPerson: c.contactPerson?.name || 'N/A',
        phone: c.user?.phone || c.phone,
        email: c.user?.email || 'N/A',
        gst: c.gst || 'N/A',
        city: c.address?.city || 'N/A',
        isVerified: c.isVerified ? 'Yes' : 'No',
        createdAt: format(c.createdAt, 'yyyy-MM-dd')
      });
    });

    worksheet.getRow(1).font = { bold: true };
    return workbook;
  }
}

export default ExportService;
