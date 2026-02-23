import cron from 'node-cron';
import EwayBill from '../models/ewayBill.model.js';
import Booking from '../models/booking.model.js';
import Customer from '../models/customer.model.js';
import User from '../models/user.model.js';
import Staff from '../models/staff.model.js';
import { sendTransactionalSMS } from '../services/otp.service.js';
import NotificationService from '../services/notification.service.js';
import logger from '../utils/logger.js';

/**
 * E-way Bill Expiry Alert Job
 * Runs hourly to check for E-way bills expiring within 24 hours
 * Sends SMS alerts to customers and notifications to staff
 */
class EwayBillExpiryJob {
  /**
   * Initialize and start the cron job
   */
  static start() {
    // Schedule: Run every hour at minute 0
    // Cron pattern: '0 * * * *' = At minute 0 of every hour
    const schedule = '0 * * * *';

    logger.info('Initializing E-way Bill expiry alert cron job');

    cron.schedule(schedule, async () => {
      try {
        logger.info('Running E-way Bill expiry alert job');
        await this.checkExpiringBills();
      } catch (error) {
        logger.error('Error in E-way Bill expiry job:', error);
      }
    });

    logger.info(`E-way Bill expiry alert job scheduled: ${schedule}`);
  }

  /**
   * Check for expiring E-way bills and send alerts
   */
  static async checkExpiringBills() {
    try {
      const now = new Date();
      const next24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      // Find E-way bills expiring within 24 hours that haven't been alerted yet
      const expiringBills = await EwayBill.find({
        'expiryTracking.validUpto': {
          $gte: now,
          $lte: next24Hours
        },
        'expiryTracking.expiryAlertSent': false,
        status: { $ne: 'expired' },
        isDeleted: false
      })
        .populate({
          path: 'bookingId',
          select: 'bookingId customer',
          populate: {
            path: 'customer',
            select: 'companyName user',
            populate: {
              path: 'user',
              select: 'phone'
            }
          }
        })
        .populate('createdBy', 'name email phone department')
        .lean();

      if (expiringBills.length === 0) {
        logger.info('No E-way bills expiring in the next 24 hours');
        return;
      }

      logger.info(`Found ${expiringBills.length} E-way bill(s) expiring soon`);

      // Process each expiring bill
      for (const bill of expiringBills) {
        try {
          await this.sendExpiryAlert(bill);
        } catch (error) {
          logger.error(`Error sending alert for E-way bill ${bill.ewayBillNumber}:`, error);
          // Continue with other bills even if one fails
        }
      }

      logger.info('E-way Bill expiry alert job completed');
    } catch (error) {
      logger.error('Error checking expiring E-way bills:', error);
      throw error;
    }
  }

  /**
   * Send expiry alert for a specific E-way bill
   * @param {Object} bill - E-way bill object (populated)
   */
  static async sendExpiryAlert(bill) {
    try {
      const booking = bill.bookingId;
      const customer = booking?.customer;
      const customerUser = customer?.user;
      const createdByStaff = bill.createdBy;

      // Format expiry date
      const expiryDate = new Date(bill.expiryTracking.validUpto);
      const formattedExpiryDate = expiryDate.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      // Prepare SMS message for customer
      const smsMessage = `E-way Bill ${bill.ewayBillNumber} for booking ${booking?.bookingId || 'N/A'} expires on ${formattedExpiryDate}. Please extend validity if required. - CloudTruck`;

      // Send SMS to customer
      if (customerUser?.phone) {
        logger.info(`Sending expiry alert SMS to customer: ${customerUser.phone}`);
        const smsResult = await sendTransactionalSMS(
          customerUser.phone,
          smsMessage,
          customer._id?.toString()
        );

        if (smsResult.success) {
          logger.info(`SMS alert sent successfully for E-way bill ${bill.ewayBillNumber}`);
        } else {
          logger.warn(`Failed to send SMS alert: ${smsResult.error}`);
        }
      } else {
        logger.warn(`No phone number found for customer of E-way bill ${bill.ewayBillNumber}`);
      }

      // Send notification to staff (creator and operations team)
      const staffNotificationMessage = `E-way Bill ${bill.ewayBillNumber} for booking ${booking?.bookingId || 'N/A'} expires on ${formattedExpiryDate}. Customer: ${customer?.companyName || 'N/A'}. Please follow up for validity extension.`;

      // Notify the staff member who created the bill
      if (createdByStaff?._id) {
        await NotificationService.sendNotification({
          recipient: createdByStaff._id,
          type: 'eway_bill_expiry',
          title: 'E-way Bill Expiry Alert',
          message: staffNotificationMessage,
          entityType: 'system',
          entityId: bill._id,
          channels: ['push', 'in-app'],
          data: {
            ewayBillNumber: bill.ewayBillNumber,
            bookingId: booking?._id?.toString(),
            expiryDate: bill.expiryTracking.validUpto?.toISOString()
          }
        });
        logger.info(`Staff notification sent to ${createdByStaff.name || createdByStaff._id}`);
      }

      // Notify operations team (staff with department = 'operations')
      const operationsStaff = await Staff.find({
        department: 'operations',
        isDeleted: false
      }).select('user');

      for (const staff of operationsStaff) {
        if (staff.user && staff.user.toString() !== createdByStaff?._id?.toString()) {
          await NotificationService.sendNotification({
            recipient: staff.user,
            type: 'eway_bill_expiry',
            title: 'E-way Bill Expiry Alert',
            message: staffNotificationMessage,
            entityType: 'system',
            entityId: bill._id,
            channels: ['push', 'in-app'],
            data: {
              ewayBillNumber: bill.ewayBillNumber,
              bookingId: booking?._id?.toString(),
              expiryDate: bill.expiryTracking.validUpto?.toISOString()
            }
          });
        }
      }

      // Update the E-way bill to mark alert as sent
      await EwayBill.findByIdAndUpdate(bill._id, {
        $set: {
          'expiryTracking.expiryAlertSent': true,
          'expiryTracking.expiryNotifiedAt': new Date()
        }
      });

      logger.info(`Expiry alert completed for E-way bill ${bill.ewayBillNumber}`);
    } catch (error) {
      logger.error(`Error sending expiry alert for bill ${bill.ewayBillNumber}:`, error);
      throw error;
    }
  }

  /**
   * Manual trigger for testing (can be called from API endpoint)
   */
  static async triggerManually() {
    logger.info('Manually triggering E-way Bill expiry alert job');
    await this.checkExpiringBills();
  }
}

export default EwayBillExpiryJob;
