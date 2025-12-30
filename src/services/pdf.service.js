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
