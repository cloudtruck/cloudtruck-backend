import PDFDocument from 'pdfkit';
import { format } from 'date-fns';

class PDFService {
  /**
   * Generate Payment Invoice PDF
   * @param {Object} payment - Payment object with populated booking and customer
   * @returns {Promise<Buffer>} PDF Buffer
   */
  static async generateInvoice(payment) {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const buffers = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });
      doc.on('error', reject);

      // Header
      doc
        .fillColor('#444444')
        .fontSize(20)
        .text('CLOUDTRUCK', 50, 57)
        .fontSize(10)
        .text('Managed Trucking Solutions', 50, 80)
        .text('123 Logistics Park, Sector 5', 50, 95)
        .text('New Delhi, India - 110001', 50, 110)
        .moveDown();

      // Invoice Title
      doc
        .fillColor('#333333')
        .fontSize(20)
        .text('INVOICE', 50, 160, { align: 'right' });

      this.generateHr(doc, 185);

      // Invoice Info
      const customerInfoTop = 200;
      doc
        .fontSize(10)
        .text('Invoice Number:', 50, customerInfoTop)
        .font('Helvetica-Bold')
        .text(`INV-${payment._id.toString().slice(-8).toUpperCase()}`, 150, customerInfoTop)
        .font('Helvetica')
        .text('Invoice Date:', 50, customerInfoTop + 15)
        .text(format(new Date(), 'MMM dd, yyyy'), 150, customerInfoTop + 15)
        .text('Payment Status:', 50, customerInfoTop + 30)
        .text(payment.status.toUpperCase(), 150, customerInfoTop + 30)
        .moveDown();

      // Bill To
      doc
        .font('Helvetica-Bold')
        .text('BILL TO:', 300, customerInfoTop)
        .font('Helvetica')
        .text(payment.customer?.companyName || 'N/A', 300, customerInfoTop + 15)
        .text(`GST: ${payment.customer?.gst || 'N/A'}`, 300, customerInfoTop + 30)
        .moveDown();

      this.generateHr(doc, 252);

      // Table Header
      const tableTop = 270;
      doc.font('Helvetica-Bold');
      this.generateTableRow(
        doc,
        tableTop,
        'Description',
        'Booking ID',
        'Amount'
      );
      this.generateHr(doc, tableTop + 20);
      doc.font('Helvetica');

      // Table Row
      const description = `Trucking Services: ${payment.booking?.pickup?.city || 'N/A'} to ${payment.booking?.drop?.city || 'N/A'}`;
      this.generateTableRow(
        doc,
        tableTop + 30,
        description,
        payment.booking?.bookingId || 'N/A',
        `INR ${payment.amount.toLocaleString('en-IN')}`
      );

      this.generateHr(doc, tableTop + 50);

      // Summary
      const summaryTop = tableTop + 70;
      doc
        .font('Helvetica-Bold')
        .text('Total Amount:', 350, summaryTop)
        .text(`INR ${payment.amount.toLocaleString('en-IN')}`, 450, summaryTop, { align: 'right' });

      // Footer
      doc
        .fontSize(10)
        .fillColor('#777777')
        .text(
          'Thank you for choosing Cloudtruck. For any queries, contact support@cloudtruck.local',
          50,
          700,
          { align: 'center', width: 500 }
        );

      doc.end();
    });
  }

  /**
   * Generate Booking-level Freight Invoice PDF
   * Shows all payments made against a booking with payable/paid/balance summary.
   * Works for unpaid, partial, and fully-paid bookings.
   * @param {Object} booking - Booking doc (populated: customer, driver, vehicle)
   * @param {Object} summary - { payable, totalPaid, balance, paymentStatus, payments[] }
   * @returns {Promise<Buffer>}
   */
  static async generateBookingInvoice(booking, summary) {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      const fmt = (n) => `INR ${(n || 0).toLocaleString('en-IN')}`;

      // Header
      doc.fillColor('#444444').fontSize(20).text('CLOUDTRUCK', 50, 57)
        .fontSize(10)
        .text('Managed Trucking Solutions', 50, 80)
        .text('123 Logistics Park, Sector 5', 50, 95)
        .text('New Delhi, India - 110001', 50, 110);

      doc.fillColor('#333333').fontSize(20).text('FREIGHT INVOICE', 50, 160, { align: 'right' });
      this.generateHr(doc, 185);

      // Invoice meta
      const infoTop = 200;
      doc.fontSize(10)
        .text('Booking ID:', 50, infoTop).font('Helvetica-Bold')
        .text(booking.bookingId || 'N/A', 150, infoTop).font('Helvetica')
        .text('Invoice Date:', 50, infoTop + 15)
        .text(format(new Date(), 'MMM dd, yyyy'), 150, infoTop + 15)
        .text('Payment Status:', 50, infoTop + 30)
        .text((summary.paymentStatus || 'unpaid').toUpperCase(), 150, infoTop + 30);

      // Bill To
      const customer = booking.customer || {};
      doc.font('Helvetica-Bold').text('BILL TO:', 300, infoTop).font('Helvetica')
        .text(customer.companyName || 'N/A', 300, infoTop + 15)
        .text(`GST: ${customer.gst || 'N/A'}`, 300, infoTop + 30);

      // Route
      doc.text(`Route: ${booking.pickup?.city || 'N/A'} → ${booking.drop?.city || 'N/A'}`, 50, infoTop + 50);

      this.generateHr(doc, 262);

      // Freight summary table
      const tableTop = 278;
      doc.font('Helvetica-Bold');
      this.generateTableRow(doc, tableTop, 'Description', 'Details', 'Amount');
      this.generateHr(doc, tableTop + 20);
      doc.font('Helvetica');
      this.generateTableRow(
        doc, tableTop + 30,
        `Trucking: ${booking.pickup?.city || ''} to ${booking.drop?.city || ''}`,
        `${booking.materialType || ''} · ${booking.truckTypeNeeded || ''}`,
        fmt(summary.payable)
      );
      this.generateHr(doc, tableTop + 55);

      // Payments made
      let cursor = tableTop + 70;
      if (summary.payments && summary.payments.length > 0) {
        doc.font('Helvetica-Bold').text('Payment History', 50, cursor);
        cursor += 18;
        this.generateHr(doc, cursor);
        cursor += 5;
        doc.font('Helvetica');
        for (const p of summary.payments) {
          const ref = p.referenceNumber || p.transactionId || '-';
          const date = p.paidAt ? format(new Date(p.paidAt), 'dd-MMM-yy') : '-';
          const method = (p.paymentMethod || p.gateway || 'online').toUpperCase();
          this.generateTableRow(doc, cursor, `${method} · ${ref}`, date, fmt(p.amount));
          cursor += 22;
        }
        this.generateHr(doc, cursor);
        cursor += 10;
      }

      // Totals
      doc.font('Helvetica-Bold')
        .text('Total Payable:', 300, cursor).text(fmt(summary.payable), 450, cursor, { align: 'right' })
        .text('Total Paid:', 300, cursor + 18).text(fmt(summary.totalPaid), 450, cursor + 18, { align: 'right' })
        .fontSize(12).text('Balance Due:', 300, cursor + 40)
        .text(fmt(summary.balance), 450, cursor + 40, { align: 'right' });

      doc.fontSize(10).fillColor('#777777')
        .text('Thank you for choosing Cloudtruck. For queries, contact support@cloudtruck.local',
          50, 700, { align: 'center', width: 500 });

      doc.end();
    });
  }

  /**
   * Generate Loading Memo PDF
   * Booking receipt issued at load time — shows cargo, vehicle, driver, route.
   * @param {Object} booking - Fully populated booking doc
   * @returns {Promise<Buffer>}
   */
  static async generateLoadingMemo(booking) {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      const fmt = (n) => `INR ${(n || 0).toLocaleString('en-IN')}`;
      const na = (v) => v || 'N/A';

      // Header
      doc.fillColor('#444444').fontSize(20).text('CLOUDTRUCK', 50, 57)
        .fontSize(10).text('Managed Trucking Solutions', 50, 80);

      doc.fillColor('#333333').fontSize(18).text('LOADING MEMO', 50, 57, { align: 'right' });
      this.generateHr(doc, 100);

      // Booking ref row
      let y = 115;
      doc.fontSize(10).font('Helvetica-Bold')
        .text('Booking ID:', 50, y).font('Helvetica').text(na(booking.bookingId), 150, y)
        .font('Helvetica-Bold').text('LR No:', 300, y).font('Helvetica')
        .text(na(booking.lrDetails?.lrNumber), 380, y);

      y += 18;
      doc.font('Helvetica-Bold').text('Load Date:', 50, y).font('Helvetica')
        .text(booking.loadDateTime ? format(new Date(booking.loadDateTime), 'dd-MMM-yyyy') : 'N/A', 150, y);

      this.generateHr(doc, y + 18);

      // Route
      y += 32;
      doc.font('Helvetica-Bold').fontSize(11).text('FROM', 50, y).text('TO', 310, y);
      y += 16;
      doc.fontSize(10).font('Helvetica')
        .text(na(booking.pickup?.city), 50, y).text(na(booking.drop?.city), 310, y);
      y += 14;
      doc.text(na(booking.pickup?.address), 50, y, { width: 240 })
        .text(na(booking.drop?.address), 310, y, { width: 240 });
      y += 28;
      doc.text(`Contact: ${na(booking.pickup?.contactPerson?.name)} · ${na(booking.pickup?.contactPerson?.phone)}`, 50, y)
        .text(`Contact: ${na(booking.drop?.contactPerson?.name)} · ${na(booking.drop?.contactPerson?.phone)}`, 310, y);

      this.generateHr(doc, y + 18);

      // Cargo details
      y += 32;
      doc.font('Helvetica-Bold').text('CARGO DETAILS', 50, y);
      y += 16;
      doc.font('Helvetica')
        .text(`Material: ${na(booking.materialType)}`, 50, y)
        .text(`Weight: ${na(booking.weight)} ${na(booking.weightUnit)}`, 220, y)
        .text(`Trucks: ${booking.numberOfTrucks || 1}`, 400, y);
      y += 14;
      doc.text(`Truck Type: ${na(booking.truckTypeNeeded)}`, 50, y)
        .text(`Body Type: ${na(booking.bodyType)}`, 220, y);

      this.generateHr(doc, y + 18);

      // Vehicle & Driver
      y += 32;
      doc.font('Helvetica-Bold').text('VEHICLE', 50, y).text('DRIVER', 310, y);
      y += 16;
      doc.font('Helvetica')
        .text(`Number: ${na(booking.vehicle?.vehicleNumber)}`, 50, y)
        .text(`Name: ${na(booking.driver?.name)}`, 310, y);
      y += 14;
      doc.text(`Type: ${na(booking.vehicle?.truckType)}`, 50, y)
        .text(`Phone: ${na(booking.driver?.phone)}`, 310, y);

      this.generateHr(doc, y + 18);

      // Freight
      y += 32;
      const freight = booking.finalAmount || booking.expectedAmount || 0;
      doc.font('Helvetica-Bold').text('Freight Amount:', 50, y)
        .font('Helvetica').text(fmt(freight), 180, y)
        .font('Helvetica-Bold').text('Advance:', 300, y)
        .font('Helvetica').text(fmt(booking.advanceRequired), 380, y);

      // Footer
      doc.fontSize(9).fillColor('#777777')
        .text('This is a computer-generated document. No signature required.',
          50, 700, { align: 'center', width: 500 });

      doc.end();
    });
  }

  /**
   * Generate Driver Trip Invoice PDF
   * Shows trip details, freight breakdown (advance + balance) for the driver.
   * @param {Object} booking - Booking doc (populated: customer, driver, vehicle)
   * @returns {Promise<Buffer>}
   */
  static async generateDriverInvoice(booking) {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      const fmt = (n) => `INR ${(n || 0).toLocaleString('en-IN')}`;
      const na = (v) => (v != null && v !== '') ? String(v) : 'N/A';

      // Header
      doc.fillColor('#444444').fontSize(20).text('CLOUDTRUCK', 50, 57)
        .fontSize(10)
        .text('Managed Trucking Solutions', 50, 80)
        .text('123 Logistics Park, Sector 5', 50, 95)
        .text('New Delhi, India - 110001', 50, 110);

      doc.fillColor('#333333').fontSize(18).text('TRIP INVOICE', 50, 57, { align: 'right' });
      this.generateHr(doc, 125);

      // Booking meta
      let y = 140;
      doc.fontSize(10).font('Helvetica-Bold')
        .text('Booking ID:', 50, y).font('Helvetica').text(na(booking.bookingId), 150, y)
        .font('Helvetica-Bold').text('Invoice Date:', 300, y).font('Helvetica')
        .text(format(new Date(), 'dd-MMM-yyyy'), 400, y);

      y += 18;
      doc.font('Helvetica-Bold').text('Status:', 50, y).font('Helvetica')
        .text(na(booking.status).replace(/-/g, ' ').toUpperCase(), 150, y)
        .font('Helvetica-Bold').text('Load Date:', 300, y).font('Helvetica')
        .text(booking.loadDateTime ? format(new Date(booking.loadDateTime), 'dd-MMM-yyyy') : 'N/A', 400, y);

      this.generateHr(doc, y + 18);

      // Route
      y += 32;
      doc.font('Helvetica-Bold').fontSize(11).text('FROM', 50, y).text('TO', 310, y);
      y += 16;
      doc.fontSize(10).font('Helvetica')
        .text(na(booking.pickup?.city), 50, y).text(na(booking.drop?.city), 310, y);
      y += 14;
      doc.text(na(booking.pickup?.address), 50, y, { width: 240 })
        .text(na(booking.drop?.address), 310, y, { width: 240 });

      this.generateHr(doc, y + 28);

      // Cargo
      y += 44;
      doc.font('Helvetica-Bold').text('CARGO DETAILS', 50, y);
      y += 16;
      const weightStr = booking.weight?.value ? `${booking.weight.value} ${booking.weight.unit || ''}` : 'N/A';
      doc.font('Helvetica')
        .text(`Material: ${na(booking.materialType)}`, 50, y)
        .text(`Weight: ${weightStr}`, 220, y)
        .text(`Distance: ${booking.estimatedDistance ? `${booking.estimatedDistance} km` : 'N/A'}`, 400, y);
      y += 14;
      doc.text(`Truck Type: ${na(booking.truckTypeNeeded)}`, 50, y)
        .text(`Body Type: ${na(booking.bodyType)}`, 220, y);

      this.generateHr(doc, y + 18);

      // Driver & Vehicle
      y += 32;
      doc.font('Helvetica-Bold').text('DRIVER', 50, y).text('VEHICLE', 310, y);
      y += 16;
      doc.font('Helvetica')
        .text(`Name: ${na(booking.driver?.name)}`, 50, y)
        .text(`Number: ${na(booking.vehicle?.vehicleNumber)}`, 310, y);
      y += 14;
      doc.text(`Phone: ${na(booking.driver?.phone)}`, 50, y)
        .text(`Type: ${na(booking.vehicle?.truckType)}`, 310, y);

      this.generateHr(doc, y + 18);

      // Freight breakdown
      y += 32;
      const freight = booking.finalAmount || booking.expectedAmount || 0;
      const advance = booking.advanceRequired || 0;
      const balance = freight - advance;

      doc.font('Helvetica-Bold').text('FREIGHT BREAKDOWN', 50, y);
      y += 16;
      this.generateHr(doc, y);
      y += 8;
      doc.font('Helvetica')
        .text('Total Freight:', 300, y).font('Helvetica-Bold').text(fmt(freight), 450, y, { align: 'right' });
      y += 18;
      doc.font('Helvetica')
        .text('Advance Paid:', 300, y).text(fmt(advance), 450, y, { align: 'right' });
      y += 18;
      this.generateHr(doc, y);
      y += 8;
      doc.font('Helvetica-Bold').fontSize(12)
        .text('Balance Due:', 300, y).text(fmt(balance), 450, y, { align: 'right' });

      // POD details if available
      if (booking.podDetails?.receiverName) {
        y += 32;
        doc.fontSize(10).font('Helvetica-Bold').text('DELIVERY CONFIRMATION', 50, y);
        y += 16;
        doc.font('Helvetica')
          .text(`Receiver: ${booking.podDetails.receiverName}`, 50, y)
          .text(`Phone: ${na(booking.podDetails.receiverPhone)}`, 220, y);
        if (booking.podDetails.deliveredAt) {
          y += 14;
          doc.text(`Delivered At: ${format(new Date(booking.podDetails.deliveredAt), 'dd-MMM-yyyy HH:mm')}`, 50, y);
        }
        if (booking.podDetails.remarks) {
          y += 14;
          doc.text(`Remarks: ${booking.podDetails.remarks}`, 50, y);
        }
      }

      doc.fontSize(9).fillColor('#777777')
        .text('This is a computer-generated document. No signature required.',
          50, 700, { align: 'center', width: 500 });

      doc.end();
    });
  }

  static generateTableRow(doc, y, description, bookingId, amount) {
    doc
      .fontSize(10)
      .text(description, 50, y)
      .text(bookingId, 250, y)
      .text(amount, 400, y, { align: 'right' });
  }

  static generateHr(doc, y) {
    doc
      .strokeColor('#aaaaaa')
      .lineWidth(1)
      .moveTo(50, y)
      .lineTo(550, y)
      .stroke();
  }
}

export default PDFService;
