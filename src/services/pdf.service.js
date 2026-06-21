import PDFDocument from 'pdfkit';
import { format } from 'date-fns';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOGO_PATH = path.resolve(__dirname, '../../../cloudtruck-customer/public/Logo.jpeg');

const HSN_SAC = '996812'; // Road freight transport services
const TERMS_AND_CONDITIONS = [
  'Invoices should be paid within the due date to ensure uninterrupted services.',
  'If an invoice remains unpaid beyond 45 days, interest at 2% per month will be charged from the invoice date.',
  'In case outstanding is not cleared within 90 days, CloudTruck may suspend all services.',
  'This invoice shows the actual price of the services described and all particulars are true and correct.',
  'Write to support@cloudtruck.in within 48 hours of receiving the invoice for any disputes.',
];

const PAGE_W = 595.28; // A4 width in points
const MARGIN = 50;
const COL_RIGHT = 370;

const colX = {
  sno: 50,
  desc: 80,
  hsn: 270,
  qty: 325,
  rate: 350,
  tax: 415,
  amount: 470
};
const colW = {
  sno: 30,
  desc: 190,
  hsn: 55,
  qty: 25,
  rate: 50,
  tax: 50,
  amount: 75
};

// ─── helpers ─────────────────────────────────────────────────────────────────

function rupees(n) {
  return `Rs. ${(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function na(v) {
  return v != null && v !== '' ? String(v) : 'N/A';
}

function amountInWords(amount) {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function words(n) {
    if (n === 0) return '';
    if (n < 20) return ones[n] + ' ';
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '') + ' ';
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred ' + words(n % 100);
    if (n < 100000) return words(Math.floor(n / 1000)) + 'Thousand ' + words(n % 1000);
    if (n < 10000000) return words(Math.floor(n / 100000)) + 'Lakh ' + words(n % 100000);
    return words(Math.floor(n / 10000000)) + 'Crore ' + words(n % 10000000);
  }

  const rounded = Math.round(amount);
  const paise = Math.round((amount - rounded) * 100);
  let result = 'Rupees ' + words(rounded).trim();
  if (paise > 0) result += ' and ' + words(paise).trim() + ' Paise';
  return result + ' Only';
}

function hr(doc, y, color = '#e5e7eb') {
  doc.strokeColor(color).lineWidth(0.5).moveTo(MARGIN, y).lineTo(PAGE_W - MARGIN, y).stroke();
}

// Determine IGST vs CGST+SGST based on supplier and customer states
function resolveTax(orgSettings, customerState) {
  const taxSettings = orgSettings?.taxSettings || {};
  const orgState = orgSettings?.companyAddress?.state || '';
  const isInterState = orgState.toLowerCase() !== (customerState || '').toLowerCase();
  const igstRate = taxSettings.igstRate ?? 18;
  const cgstRate = taxSettings.cgstRate ?? 9;
  const sgstRate = taxSettings.sgstRate ?? 9;
  return isInterState
    ? { type: 'IGST', rate: igstRate }
    : { type: 'CGST+SGST', cgst: cgstRate, sgst: sgstRate };
}

// Build invoice number in FY format: CT/YYYY-YY/XXXXX
function invoiceNumber(id, date) {
  const d = date ? new Date(date) : new Date();
  const year = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  const fy = `${year}-${String(year + 1).slice(2)}`;
  return `CT/${fy}/${String(id).slice(-5).toUpperCase().padStart(5, '0')}`;
}

// ─── shared layout blocks ─────────────────────────────────────────────────────

function drawHeader(doc, orgSettings, title = 'TAX INVOICE') {
  const company = orgSettings || {};
  const addr = company.companyAddress || {};
  const contact = company.contactDetails || {};

  // Check if logo exists and draw it
  let logoDrawn = false;
  try {
    if (fs.existsSync(LOGO_PATH)) {
      doc.image(LOGO_PATH, MARGIN, 40, { height: 35 });
      logoDrawn = true;
    }
  } catch (err) {}

  // Company Name
  const companyNameY = logoDrawn ? 82 : 50;
  doc.fillColor('#1f2937').fontSize(14).font('Helvetica-Bold')
    .text(company.companyName || 'CloudTruck', MARGIN, companyNameY);

  const addrLines = [
    addr.street,
    addr.city && addr.state ? `${addr.city}, ${addr.state} - ${addr.pincode || ''}` : addr.city,
    addr.country || 'India',
    company.gstNumber ? `GSTIN: ${company.gstNumber}` : null,
    company.panNumber ? `PAN: ${company.panNumber}` : null,
    contact.phone || null,
  ].filter(Boolean);

  let y = companyNameY + 16;
  for (const line of addrLines) {
    doc.fontSize(8.5).font('Helvetica').fillColor('#4b5563').text(line, MARGIN, y);
    y += 12;
  }

  // Title label (right)
  doc.fontSize(title === 'TAX INVOICE' ? 12 : 14).font('Helvetica-Bold').fillColor('#1f2937')
    .text(title, 0, 50, { align: 'right', width: PAGE_W - MARGIN });

  return y + 8;
}

function drawInvoiceHeader(doc, orgSettings, invNo, totalAmount) {
  const company = orgSettings || {};
  const addr = company.companyAddress || {};

  // Check if logo exists and draw it
  let logoDrawn = false;
  try {
    if (fs.existsSync(LOGO_PATH)) {
      doc.image(LOGO_PATH, MARGIN, 40, { height: 35 });
      logoDrawn = true;
    }
  } catch (err) {}

  // Company Name
  const companyNameY = logoDrawn ? 82 : 40;
  doc.fillColor('#1f2937').fontSize(12).font('Helvetica-Bold')
    .text(company.companyName || 'Cloud Truck Private Limited', MARGIN, companyNameY);

  // Address lines
  const addrLines = [
    addr.street,
    addr.city && addr.state ? `${addr.city}, ${addr.state} - ${addr.pincode || ''}` : addr.city,
    addr.country || 'India',
    company.gstNumber ? `GSTIN: ${company.gstNumber}` : null,
    company.panNumber ? `PAN: ${company.panNumber}` : null,
  ].filter(Boolean);

  let y = companyNameY + 14;
  for (const line of addrLines) {
    doc.fontSize(8.5).font('Helvetica').fillColor('#4b5563').text(line, MARGIN, y);
    y += 11;
  }

  // Right Side: Tax Invoice + Invoice No + Amount Info (No Box)
  doc.fontSize(12).font('Helvetica-Bold').fillColor('#1f2937')
    .text('TAX INVOICE', 0, 40, { align: 'right', width: PAGE_W - MARGIN });

  doc.fontSize(12).font('Helvetica-Bold').fillColor('#4b5563')
    .text(`# ${invNo}`, 0, 56, { align: 'right', width: PAGE_W - MARGIN });

  // Amount Info (No Box)
  const boxW = 140;
  const boxX = PAGE_W - MARGIN - boxW;
  const boxY = 75;

  // Label
  doc.fillColor('#6b7280').fontSize(7.5).font('Helvetica-Bold')
    .text('INVOICE AMOUNT', boxX, boxY, { align: 'right', width: boxW });

  // Value
  doc.fillColor('#1f2937').fontSize(14).font('Helvetica-Bold')
    .text(rupees(totalAmount), boxX, boxY + 12, { align: 'right', width: boxW });

  return Math.max(y + 12, boxY + 36);
}

function drawInvoiceMeta(doc, yStart, invNo, invDate, dueDate, extraFields = []) {
  let y = yStart + 10;
  const labelX = COL_RIGHT;
  const valueX = labelX + 110;

  const rows = [
    ['Invoice No.', invNo],
    ['Invoice Date', invDate],
    ['Due Date', dueDate],
    ...extraFields,
  ];

  for (const [label, value] of rows) {
    doc.fontSize(9).font('Helvetica').fillColor('#6b7280').text(label + ':', labelX, y);
    doc.font('Helvetica-Bold').fillColor('#374151').text(String(value), valueX, y);
    y += 14;
  }

  return y;
}

function drawInvoiceBillToAndMeta(doc, yStart, customer, invDate, dueDate, billingMonth, booking = null, paymentStatus = 'unpaid') {
  const addr = customer.billingAddress || customer.address || {};
  const customerState = addr.state || '';

  // --- Left Column: Bill To ---
  doc.fontSize(9).font('Helvetica-Bold').fillColor('#1f2937').text('Bill To', MARGIN, yStart);
  doc.strokeColor('#e5e7eb').lineWidth(0.5).moveTo(MARGIN, yStart + 11).lineTo(MARGIN + 200, yStart + 11).stroke();

  let yLeft = yStart + 18;
  doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#374151')
     .text(customer.companyName || 'N/A', MARGIN, yLeft);
  yLeft += 13;

  const addrLines = [
    addr.street,
    addr.city && addr.state
      ? `${addr.city}, ${addr.state}${addr.pincode ? ' - ' + addr.pincode : ''}`
      : addr.city || addr.state,
    addr.country || 'India',
  ].filter(Boolean);

  for (const line of addrLines) {
    doc.fontSize(8.5).font('Helvetica').fillColor('#4b5563').text(line, MARGIN, yLeft);
    yLeft += 11;
  }

  if (customer.gst) {
    doc.fontSize(8.5).font('Helvetica').fillColor('#4b5563').text(`GSTIN - ${customer.gst}`, MARGIN, yLeft);
    yLeft += 11;
  }
  if (customer.pan) {
    doc.fontSize(8.5).font('Helvetica').fillColor('#4b5563').text(`PAN - ${customer.pan}`, MARGIN, yLeft);
    yLeft += 11;
  }

  if (customerState) {
    yLeft += 4;
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#4b5563')
       .text(`Place Of Supply: ${customerState}`, MARGIN, yLeft);
    yLeft += 12;
  }

  // --- Right Column: Invoice Meta ---
  const keyX = 300;
  const labelW = 110;
  const valueX = 425;
  const valW = 120;
  let yRight = yStart + 5;

  const rows = [
    ['Invoice Date :', invDate],
    ['Terms :', 'Net 30'],
    ['Due Date :', dueDate],
    ['P.O.# :', booking?.poNo || booking?.poNumber || '-'],
    ['Billing Month :', billingMonth],
    ['Anchor Customer :', customer.companyName || 'N/A'],
    ['Number of Trips :', booking ? '1' : '0']
  ];

  for (const [key, value] of rows) {
    doc.fontSize(8.5).font('Helvetica').fillColor('#6b7280').text(key, keyX, yRight, { width: labelW, align: 'right' });
    doc.font('Helvetica-Bold').fillColor('#374151').text(String(value), valueX, yRight, { width: valW, align: 'right' });
    yRight += 18;
  }

  const bottomY = Math.max(yLeft, yRight);
  return { bottomY };
}

function drawBillTo(doc, yStart, customer) {
  const addr = customer.billingAddress || customer.address || {};
  const customerState = addr.state || '';

  doc.fontSize(9).font('Helvetica').fillColor('#888888').text('BILL TO', MARGIN, yStart);
  doc.fontSize(10).font('Helvetica-Bold').fillColor('#1a1a1a')
    .text(customer.companyName || na(null), MARGIN, yStart + 13);

  let y = yStart + 27;
  const lines = [
    addr.street,
    addr.city && addr.state
      ? `${addr.city}, ${addr.state}${addr.pincode ? ' - ' + addr.pincode : ''}`
      : addr.city || addr.state,
    addr.country || 'India',
    customer.gst ? `GSTIN: ${customer.gst}` : null,
    customer.pan ? `PAN: ${customer.pan}` : null,
  ].filter(Boolean);

  for (const line of lines) {
    doc.fontSize(8.5).font('Helvetica').fillColor('#444444').text(line, MARGIN, y);
    y += 12;
  }

  if (customerState) {
    doc.fontSize(8.5).font('Helvetica').fillColor('#666666')
      .text(`Place of Supply: ${customerState}`, MARGIN, y);
    y += 12;
  }

  return { bottomY: y + 4, customerState };
}

function drawLineItemsHeader(doc, y, taxType = 'IGST') {
  doc.rect(MARGIN, y, PAGE_W - MARGIN * 2, 20).fill('#374151');
  doc.fillColor('#ffffff').fontSize(8.5).font('Helvetica-Bold');
  doc.text('S. No.', colX.sno, y + 6, { width: colW.sno, align: 'center' });
  doc.text('Item & Description', colX.desc, y + 6, { width: colW.desc });
  doc.text('HSN/SAC', colX.hsn, y + 6, { width: colW.hsn, align: 'center' });
  doc.text('Qty', colX.qty, y + 6, { width: colW.qty, align: 'right' });
  doc.text('Rate', colX.rate, y + 6, { width: colW.rate, align: 'right' });
  doc.text(taxType, colX.tax, y + 6, { width: colW.tax, align: 'right' });
  doc.text('Amount', colX.amount, y + 6, { width: colW.amount - 5, align: 'right' });
  return y + 20;
}

function drawLineItem(doc, y, sno, description, hsn, qty, rate, taxRateStr, amount) {
  doc.fillColor('#374151').fontSize(8.5).font('Helvetica');
  doc.text(String(sno), colX.sno, y + 6, { width: colW.sno, align: 'center' });
  
  const descHeight = doc.heightOfString(description, { width: colW.desc });
  const rowH = Math.max(28, descHeight + 12);
  
  doc.text(description, colX.desc, y + 6, { width: colW.desc });
  doc.text(hsn, colX.hsn, y + 6, { width: colW.hsn, align: 'center' });
  doc.text(String(qty), colX.qty, y + 6, { width: colW.qty, align: 'right' });
  doc.text(rupees(rate), colX.rate, y + 6, { width: colW.rate, align: 'right' });
  doc.text(taxRateStr, colX.tax, y + 6, { width: colW.tax, align: 'right' });
  doc.text(rupees(amount), colX.amount, y + 6, { width: colW.amount - 5, align: 'right' });
  
  doc.strokeColor('#e5e7eb').lineWidth(0.5).moveTo(MARGIN, y + rowH).lineTo(PAGE_W - MARGIN, y + rowH).stroke();
  
  return y + rowH;
}

function drawInvoiceTotalsAndWords(doc, y, subTotal, taxAmount, taxLabel, rounding, total) {
  const lx = 325;
  const rx = PAGE_W - MARGIN;
  const vx = rx - 5;

  // Sub Total
  doc.fontSize(8.5).font('Helvetica').fillColor('#6b7280').text('Sub Total', lx, y);
  doc.font('Helvetica-Bold').fillColor('#374151').text(rupees(subTotal), 0, y, { align: 'right', width: vx });
  doc.strokeColor('#f3f4f6').lineWidth(0.5).moveTo(lx, y + 12).lineTo(rx, y + 12).stroke();
  y += 16;

  // Tax
  doc.fontSize(8.5).font('Helvetica').fillColor('#6b7280').text(taxLabel, lx, y);
  doc.font('Helvetica-Bold').fillColor('#374151').text(rupees(taxAmount), 0, y, { align: 'right', width: vx });
  doc.strokeColor('#f3f4f6').lineWidth(0.5).moveTo(lx, y + 12).lineTo(rx, y + 12).stroke();
  y += 16;

  // Rounding
  doc.fontSize(8.5).font('Helvetica').fillColor('#6b7280').text('Rounding', lx, y);
  doc.font('Helvetica-Bold').fillColor('#374151').text(rupees(rounding), 0, y, { align: 'right', width: vx });
  doc.strokeColor('#f3f4f6').lineWidth(0.5).moveTo(lx, y + 12).lineTo(rx, y + 12).stroke();
  y += 16;

  // Total bg box
  doc.rect(lx, y, rx - lx, 20).fill('#f9fafb');
  doc.fillColor('#1f2937').fontSize(9).font('Helvetica-Bold')
     .text('TOTAL', lx + 5, y + 5)
     .text(rupees(total), 0, y + 5, { align: 'right', width: vx });
  y += 24;

  // Invoice Amount thick border box
  doc.strokeColor('#1f2937').lineWidth(1.5).moveTo(lx, y).lineTo(rx, y).stroke();
  doc.fillColor('#1f2937').fontSize(9.5).font('Helvetica-Bold')
     .text('Invoice Amount', lx + 5, y + 6)
     .text(rupees(total), 0, y + 6, { align: 'right', width: vx });
  y += 22;

  // Total in words
  doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#6b7280').text('TOTAL IN WORDS', 0, y + 8, { align: 'right', width: rx });
  doc.fontSize(8.5).font('Helvetica-Oblique').fillColor('#1f2937').text(amountInWords(total), 0, y + 18, { align: 'right', width: rx });
  
  return y + 32;
}

function drawTotals(doc, y, subTotal, tax, taxLabel, rounding, total) {
  const lx = COL_RIGHT + 10;
  const vx = PAGE_W - MARGIN - 2;

  const rows = [
    ['Sub Total', rupees(subTotal), false],
    [taxLabel, rupees(tax), false],
  ];
  if (rounding !== 0) rows.push(['Rounding', rupees(rounding), false]);
  rows.push(['Total', rupees(total), true]);

  let ty = y + 8;
  for (const [label, value, bold] of rows) {
    doc.fontSize(9)
      .font(bold ? 'Helvetica-Bold' : 'Helvetica')
      .fillColor(bold ? '#1a1a1a' : '#444444')
      .text(label + ':', lx, ty)
      .text(value, 0, ty, { align: 'right', width: vx });
    ty += 16;
  }

  // Invoice Amount box
  ty += 4;
  doc.rect(lx - 4, ty, PAGE_W - MARGIN - lx + 4, 22).fill('#1a1a1a');
  doc.fillColor('#ffffff').fontSize(10).font('Helvetica-Bold')
    .text('Invoice Amount', lx, ty + 6)
    .text(rupees(total), 0, ty + 6, { align: 'right', width: vx });

  return ty + 28;
}

function drawAmountInWords(doc, y, total) {
  doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#1a1a1a')
    .text('Amount in Words: ', MARGIN, y, { continued: true })
    .font('Helvetica').text(amountInWords(total));
  return y + 18;
}

function drawBankDetails(doc, y, orgSettings) {
  const bankAddr = orgSettings?.bank || orgSettings?.addresses?.find(a => a.accountNo) || {};
  if (!bankAddr.accountNo && !bankAddr.bankName && !bankAddr.name) return y;

  doc.strokeColor('#e5e7eb').lineWidth(0.5).moveTo(MARGIN, y).lineTo(PAGE_W - MARGIN, y).stroke();
  y += 12;
  
  doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#1f2937').text('Bank Details', MARGIN, y);
  y += 16;

  const rows = [
    ['Beneficiary Name', orgSettings?.companyName || 'Cloud Truck Private Limited'],
    ['Bank Name', bankAddr.bankName || bankAddr.name || 'N/A'],
    ['Account No.', bankAddr.accountNo || 'N/A'],
    ['IFSC Code', bankAddr.ifsc || 'N/A'],
  ];

  for (const [label, value] of rows) {
    doc.fontSize(8.5).font('Helvetica').fillColor('#6b7280')
      .text(label + ':', MARGIN, y, { continued: true })
      .font('Helvetica-Bold').fillColor('#374151')
      .text(' ' + value);
    y += 13;
  }

  return y + 8;
}

function drawTerms(doc, y) {
  doc.strokeColor('#e5e7eb').lineWidth(0.5).moveTo(MARGIN, y).lineTo(PAGE_W - MARGIN, y).stroke();
  y += 12;
  
  doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#1f2937').text('Terms & Conditions', MARGIN, y);
  y += 16;
  
  for (const line of TERMS_AND_CONDITIONS) {
    doc.fontSize(8.5).font('Helvetica').fillColor('#4b5563')
      .text(`•  ${line}`, MARGIN + 8, y, { width: PAGE_W - MARGIN * 2 - 8 });
    y += 14;
  }
  return y + 8;
}

function drawNotes(doc, y, note) {
  if (!note) return y;
  doc.strokeColor('#e5e7eb').lineWidth(0.5).moveTo(MARGIN, y).lineTo(PAGE_W - MARGIN, y).stroke();
  y += 12;
  doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#1f2937').text('Notes', MARGIN, y);
  y += 16;
  doc.fontSize(8.5).font('Helvetica').fillColor('#4b5563').text(note, MARGIN, y, { width: PAGE_W - MARGIN * 2 });
  return y + 20;
}

function drawFooter(doc) {
  const y = 750;
  const oldBottom = doc.page && doc.page.margins ? doc.page.margins.bottom : 50;
  if (doc.page && doc.page.margins) {
    doc.page.margins.bottom = 0;
  }
  
  doc.strokeColor('#e5e7eb').lineWidth(0.5).moveTo(MARGIN, y).lineTo(PAGE_W - MARGIN, y).stroke();
  doc.fontSize(8).font('Helvetica').fillColor('#9ca3af')
    .text('This is a computer-generated document. No physical signature required.', MARGIN, y + 8, {
      align: 'center', width: PAGE_W - MARGIN * 2,
    });

  if (doc.page && doc.page.margins) {
    doc.page.margins.bottom = oldBottom;
  }
}

function buildDoc(renderFn) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: MARGIN, size: 'A4' });
    const buffers = [];
    doc.on('data', b => buffers.push(b));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);
    try {
      renderFn(doc);
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

// ─── public invoice generators ────────────────────────────────────────────────

class PDFService {
  /**
   * Payment-level invoice (single payment against a booking).
   * @param {Object} payment - Payment doc (populated: booking, customer)
   * @param {Object} orgSettings - OrganizationSettings singleton
   */
  static async generateInvoice(payment, orgSettings = {}) {
    return buildDoc(doc => {
      const customer = payment.customer || {};
      const customerState = customer.billingAddress?.state || customer.address?.state || '';
      const tax = resolveTax(orgSettings, customerState);
      const subTotal = payment.amount || 0;
      const taxAmount = parseFloat(((subTotal * (tax.rate || (tax.cgst + tax.sgst))) / 100).toFixed(2));
      const total = subTotal + taxAmount;
      const rounding = parseFloat((Math.round(total) - total).toFixed(2));
      const finalTotal = total + rounding;

      const invDate = format(new Date(payment.createdAt || new Date()), 'dd-MM-yy');
      const dueDate = format(new Date(payment.createdAt || new Date()), 'dd-MM-yy');
      const invNo = invoiceNumber(payment._id, payment.createdAt);

      let y = drawInvoiceHeader(doc, orgSettings, invNo, finalTotal);

      // Bill To + Meta side by side
      const { bottomY } = drawInvoiceBillToAndMeta(
        doc,
        y,
        customer,
        invDate,
        dueDate,
        format(new Date(payment.createdAt || new Date()), 'MMM-yy'),
        payment.booking,
        payment.status
      );
      y = bottomY + 15;

      // Line items
      y = drawLineItemsHeader(doc, y, tax.type);
      const route = `${payment.booking?.pickup?.city || 'N/A'} to ${payment.booking?.drop?.city || 'N/A'}`;
      const desc = `Trucking Services - ${route}\nBooking: ${payment.booking?.bookingId || 'N/A'}`;
      y = drawLineItem(doc, y, 1, desc, HSN_SAC, 1, subTotal, `${tax.rate || (tax.cgst + tax.sgst)}%`, subTotal);
      y += 8;

      const taxLabel = tax.type === 'IGST'
        ? `IGST (${tax.rate}%)`
        : `CGST (${tax.cgst}%) + SGST (${tax.sgst}%)`;
      y = drawInvoiceTotalsAndWords(doc, y, subTotal, taxAmount, taxLabel, rounding, finalTotal);

      // Page 2
      doc.addPage();
      y = MARGIN;
      y = drawBankDetails(doc, y, orgSettings);
      y = drawTerms(doc, y);
      drawNotes(doc, y, 'Pay before the due date to enjoy uninterrupted services.');
      drawFooter(doc);
    });
  }

  /**
   * Booking-level freight invoice (all payments + balance).
   * @param {Object} booking - Booking doc (populated: customer, driver, vehicle)
   * @param {Object} summary - { payable, totalPaid, balance, paymentStatus, payments[] }
   * @param {Object} orgSettings - OrganizationSettings singleton
   */
  static async generateBookingInvoice(booking, summary, orgSettings = {}) {
    return buildDoc(doc => {
      const customer = booking.customer || {};
      const customerState = customer.billingAddress?.state || customer.address?.state || '';
      const tax = resolveTax(orgSettings, customerState);
      const subTotal = summary.payable || 0;
      const taxRate = tax.rate || (tax.cgst + tax.sgst);
      const taxAmount = parseFloat(((subTotal * taxRate) / 100).toFixed(2));
      const grossTotal = subTotal + taxAmount;
      const rounding = parseFloat((Math.round(grossTotal) - grossTotal).toFixed(2));
      const finalTotal = grossTotal + rounding;

      const invDate = format(new Date(), 'dd-MM-yy');
      const dueDate = format(new Date(Date.now() + 30 * 86400000), 'dd-MM-yy');
      const invNo = invoiceNumber(booking._id, new Date());
      const billingMonth = format(new Date(), 'MMM-yy');

      const invNoFormatted = booking.invoiceNo || invNo;
      let y = drawInvoiceHeader(doc, orgSettings, invNoFormatted, finalTotal);

      const { bottomY } = drawInvoiceBillToAndMeta(
        doc,
        y,
        customer,
        invDate,
        dueDate,
        billingMonth,
        booking,
        summary.paymentStatus
      );
      y = bottomY + 15;

      // Line items
      y = drawLineItemsHeader(doc, y, tax.type);
      const route = `${booking.pickup?.city || 'N/A'} - ${booking.drop?.city || 'N/A'}`;
      const desc = `Freight Services - ${route}\n${booking.materialType || ''} | ${booking.truckTypeNeeded || ''} | Trips: 1`;
      y = drawLineItem(doc, y, 1, desc, HSN_SAC, 1, subTotal, `${taxRate}%`, subTotal);
      y += 8;

      const taxLabel = tax.type === 'IGST'
        ? `IGST (${tax.rate}%)`
        : `CGST (${tax.cgst}%) + SGST (${tax.sgst}%)`;
      y = drawInvoiceTotalsAndWords(doc, y, subTotal, taxAmount, taxLabel, rounding, finalTotal);

      // Payment history
      if (summary.payments?.length) {
        y += 15;
        doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#1f2937').text('Payment History', MARGIN, y);
        doc.strokeColor('#e5e7eb').lineWidth(0.5).moveTo(MARGIN, y + 12).lineTo(MARGIN + 200, y + 12).stroke();
        y += 18;

        // Table Header
        doc.rect(MARGIN, y, PAGE_W - MARGIN * 2, 18).fill('#374151');
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#ffffff')
          .text('Date', MARGIN + 8, y + 5)
          .text('Method / Reference', MARGIN + 100, y + 5)
          .text('Amount', 0, y + 5, { align: 'right', width: PAGE_W - MARGIN - 8 });
        y += 18;

        for (const p of summary.payments) {
          const date = p.paidAt ? format(new Date(p.paidAt), 'dd-MMM-yy') : '-';
          const ref = [p.paymentMethod, p.referenceNumber || p.transactionId].filter(Boolean).join(' / ');
          doc.fontSize(8).font('Helvetica').fillColor('#4b5563')
            .text(date, MARGIN + 8, y + 4)
            .text(ref || '-', MARGIN + 100, y + 4)
            .text(rupees(p.amount), 0, y + 4, { align: 'right', width: PAGE_W - MARGIN - 8 });
          y += 16;
          doc.strokeColor('#e5e7eb').lineWidth(0.5).moveTo(MARGIN, y).lineTo(PAGE_W - MARGIN, y).stroke();
        }

        y += 10;
        doc.strokeColor('#1f2937').lineWidth(1).moveTo(325, y).lineTo(PAGE_W - MARGIN, y).stroke();
        doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#1f2937')
          .text('Balance Due:', 330, y + 5)
          .text(rupees(summary.balance || 0), 0, y + 5, { align: 'right', width: PAGE_W - MARGIN - 5 });
        y += 25;
      }

      // Page 2
      doc.addPage();
      y = MARGIN;
      y = drawBankDetails(doc, y, orgSettings);
      y = drawTerms(doc, y);
      drawNotes(doc, y, 'Pay before the due date to enjoy uninterrupted services.');
      drawFooter(doc);
    });
  }

  /**
   * Driver trip invoice (shown in driver app).
   * @param {Object} booking - Booking doc (populated: customer, driver, vehicle)
   * @param {Object} orgSettings - OrganizationSettings singleton
   */
  static async generateDriverInvoice(booking, orgSettings = {}) {
    return buildDoc(doc => {
      const invDate = format(new Date(), 'dd-MM-yy');
      const invNo = invoiceNumber(booking._id, new Date());
      const freight = booking.finalAmount || booking.expectedAmount || 0;
      const advance = booking.advanceRequired || 0;
      const balance = freight - advance;

      let y = drawHeader(doc, orgSettings);
      hr(doc, y);
      y += 10;

      // Invoice meta
      drawInvoiceMeta(doc, y - 10, invNo, invDate, '-', [
        ['Booking ID', na(booking.bookingId)],
        ['Status', na(booking.status).replace(/-/g, ' ').toUpperCase()],
        ['Load Date', booking.loadDateTime ? format(new Date(booking.loadDateTime), 'dd-MMM-yyyy') : 'N/A'],
      ]);

      // Driver & vehicle (left column)
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#1f2937').text('DRIVER', MARGIN, y);
      y += 13;
      doc.fontSize(8.5).font('Helvetica').fillColor('#4b5563')
        .text(`Name: ${na(booking.driver?.name)}`, MARGIN, y)
        .text(`Phone: ${na(booking.driver?.phone)}`, MARGIN, y + 12);
      y += 30;

      doc.fontSize(9).font('Helvetica-Bold').fillColor('#1f2937').text('VEHICLE', MARGIN, y);
      y += 13;
      doc.fontSize(8.5).font('Helvetica').fillColor('#4b5563')
        .text(`Number: ${na(booking.vehicle?.vehicleNumber)}`, MARGIN, y)
        .text(`Type: ${na(booking.vehicle?.truckType)}`, MARGIN, y + 12);
      y += 35;

      hr(doc, y);
      y += 10;

      // Route
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#1f2937').text('FROM', MARGIN, y).text('TO', 300, y);
      y += 13;
      doc.fontSize(9).font('Helvetica').fillColor('#4b5563')
        .text(na(booking.pickup?.city), MARGIN, y, { width: 230 })
        .text(na(booking.drop?.city), 300, y, { width: 230 });
      y += 13;
      doc.fontSize(8).fillColor('#9ca3af')
        .text(na(booking.pickup?.address), MARGIN, y, { width: 230 })
        .text(na(booking.drop?.address), 300, y, { width: 230 });
      y += 28;

      hr(doc, y);
      y += 10;

      // Cargo
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#1f2937').text('CARGO DETAILS', MARGIN, y);
      y += 14;
      const weightStr = booking.weight?.value
        ? `${booking.weight.value} ${booking.weight.unit || ''}`.trim()
        : na(null);
      doc.fontSize(8.5).font('Helvetica').fillColor('#4b5563')
        .text(`Material: ${na(booking.materialType)}`, MARGIN, y)
        .text(`Weight: ${weightStr}`, 200, y)
        .text(`Distance: ${booking.estimatedDistance ? booking.estimatedDistance + ' km' : 'N/A'}`, 370, y);
      y += 13;
      doc.text(`Truck Type: ${na(booking.truckTypeNeeded)}`, MARGIN, y)
        .text(`Body Type: ${na(booking.bodyType)}`, 200, y);
      y += 25;

      hr(doc, y);
      y += 10;

      // Freight breakdown table
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#1f2937').text('FREIGHT BREAKDOWN', MARGIN, y);
      y += 8;
      hr(doc, y);
      y += 10;

      const fRows = [
        ['Total Freight', rupees(freight), false],
        ['Advance Paid', rupees(advance), false],
        ['Balance Due', rupees(balance), true],
      ];
      for (const [label, value, bold] of fRows) {
        doc.fontSize(bold ? 10 : 9)
          .font(bold ? 'Helvetica-Bold' : 'Helvetica')
          .fillColor(bold ? '#1f2937' : '#4b5563')
          .text(label + ':', COL_RIGHT, y)
          .text(value, 0, y, { align: 'right', width: PAGE_W - MARGIN - 2 });
        y += bold ? 20 : 16;
      }

      // POD delivery confirmation
      if (booking.podDetails?.receiverName) {
        y += 8;
        hr(doc, y);
        y += 10;
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#1f2937').text('DELIVERY CONFIRMATION', MARGIN, y);
        y += 14;
        doc.fontSize(8.5).font('Helvetica').fillColor('#4b5563')
          .text(`Receiver: ${booking.podDetails.receiverName}`, MARGIN, y)
          .text(`Phone: ${na(booking.podDetails.receiverPhone)}`, 220, y);
        y += 13;
        if (booking.podDetails.deliveredAt) {
          doc.text(`Delivered At: ${format(new Date(booking.podDetails.deliveredAt), 'dd-MMM-yyyy HH:mm')}`, MARGIN, y);
          y += 13;
        }
        if (booking.podDetails.remarks) {
          doc.text(`Remarks: ${booking.podDetails.remarks}`, MARGIN, y);
          y += 13;
        }
      }

      drawFooter(doc);
    });
  }

  /**
   * Loading memo PDF (issued at load time) in Consignment Note format.
   * @param {Object} booking - Fully populated booking doc
   * @param {Object} orgSettings - OrganizationSettings singleton
   */
  static async generateLoadingMemo(booking, orgSettings = {}) {
    return buildDoc(doc => {
      // Draw Copy 1: Consignor Copy
      const copy1Height = drawSingleCopy(doc, 20, booking, orgSettings, 'CONSIGNOR');

      // Draw Cut Here line
      const cutY = 20 + copy1Height + 10;
      const copy2Height = copy1Height;

      if (cutY + 10 + copy2Height > 820) {
        // Starts on page 2
        doc.addPage();
        drawSingleCopy(doc, 20, booking, orgSettings, 'CONSIGNEE');
      } else {
        // Draw Cut Here line
        doc.save();
        doc.strokeColor('#9ca3af').lineWidth(0.5).dash(4, { space: 4 }).moveTo(30, cutY).lineTo(PAGE_W - 30, cutY).stroke();
        doc.fontSize(7).font('Helvetica-Oblique').fillColor('#6b7280')
           .text('--- Cut Here ---', 0, cutY - 3, { align: 'center', width: PAGE_W });
        doc.restore();

        // Draw Copy 2
        drawSingleCopy(doc, cutY + 10, booking, orgSettings, 'CONSIGNEE');
      }
    });
  }
}

function drawSingleCopy(doc, yStart, booking, orgSettings, copyType) {
  const company = orgSettings || {};
  const addr = company.companyAddress || {};
  const contact = company.contactDetails || {};

  // --- 1. Header (Left & Right) ---
  let logoDrawn = false;
  try {
    if (fs.existsSync(LOGO_PATH)) {
      doc.image(LOGO_PATH, 40, yStart + 8, { fit: [80, 26] });
      logoDrawn = true;
    }
  } catch (err) {}

  const companyX = logoDrawn ? 130 : 40;
  doc.fillColor('#1e3a8a').fontSize(12).font('Helvetica-Bold')
    .text(company.companyName || 'Cloud Truck Private Limited', companyX, yStart + 15);

  const headerAddr = [
    addr.street,
    addr.city && addr.state ? `${addr.city}, ${addr.state} - ${addr.pincode || ''}` : addr.city,
    [contact.phone ? `Phone: ${contact.phone}` : null, company.email ? `Email: ${company.email}` : null].filter(Boolean).join(', '),
    [company.gstNumber ? `GST NO: ${company.gstNumber}` : null, company.panNumber ? `PAN NO: ${company.panNumber}` : null].filter(Boolean).join(', ')
  ].filter(Boolean);

  let yHeader = yStart + 28;
  for (const line of headerAddr) {
    doc.fontSize(6.5).font('Helvetica').fillColor('#4b5563').text(line, companyX, yHeader);
    yHeader += 8;
  }

  // --- 2. Consignment Note Blue Bar ---
  doc.save();
  doc.rect(30, yStart + 60, PAGE_W - 60, 14).fill('#1e3a8a');
  doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#ffffff')
     .text('CONSIGNMENT NOTE', 30, yStart + 64, { align: 'center', width: PAGE_W - 60 });
  doc.restore();

  // --- 3. First Meta Grid (CN Details) ---
  const gridY = yStart + 74;
  doc.save();
  doc.strokeColor('#9ca3af').lineWidth(0.5);
  // Grid outer boundary
  doc.rect(30, gridY, PAGE_W - 60, 40).stroke();
  // Horizontal dividing line
  doc.moveTo(30, gridY + 20).lineTo(PAGE_W - 30, gridY + 20).stroke();
  
  // Row 1 vertical dividers: CN NUMBER, DATE, DELIVERY TYPE, ORIGIN, DESTINATION, PAYMENT, COPY FOR
  const cols1 = [30, 110, 180, 250, 320, 390, 465, PAGE_W - 30];
  for (let i = 1; i < cols1.length - 1; i++) {
    doc.moveTo(cols1[i], gridY).lineTo(cols1[i], gridY + 20).stroke();
  }
  doc.restore();

  // Row 1 text
  const labels1 = ['CN NUMBER', 'DATE', 'DELIVERY TYPE', 'ORIGIN', 'DESTINATION', 'PAYMENT', 'COPY FOR'];
  const values1 = [
    booking.lrDetails?.lrNumber || booking.bookingId || '-',
    booking.lrDetails?.lrDate ? format(new Date(booking.lrDetails.lrDate), 'dd-MM-yyyy') : (booking.loadDateTime ? format(new Date(booking.loadDateTime), 'dd-MM-yyyy') : '-'),
    'Road',
    (booking.pickup?.city || '-').toUpperCase(),
    (booking.drop?.city || '-').toUpperCase(),
    'TO BE BILLED',
    copyType.toUpperCase()
  ];
  for (let i = 0; i < labels1.length; i++) {
    doc.fontSize(6).font('Helvetica-Bold').fillColor('#4b5563')
       .text(labels1[i], cols1[i], gridY + 3, { align: 'center', width: cols1[i+1] - cols1[i] });
    doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#1f2937')
       .text(values1[i], cols1[i], gridY + 10, { align: 'center', width: cols1[i+1] - cols1[i] });
  }

  // Row 2 vertical dividers: VEHICLE NO (w=150), DOOR DELIVERY (w=120), SHIPPING CHARGE (w=120), DRIVER (w=145)
  const cols2 = [30, 180, 300, 420, PAGE_W - 30];
  doc.save();
  doc.strokeColor('#9ca3af').lineWidth(0.5);
  for (let i = 1; i < cols2.length - 1; i++) {
    doc.moveTo(cols2[i], gridY + 20).lineTo(cols2[i], gridY + 40).stroke();
  }
  doc.restore();

  // Row 2 text
  const labels2 = ['VEHICLE NO', 'DOOR DELIVERY', 'SHIPPING CHARGE', 'DRIVER:'];
  const values2 = [
    booking.vehicle?.vehicleNumber || 'N/A',
    booking.bodyType ? booking.bodyType.toUpperCase() : 'DOOR DELIVERY',
    'TO BE BILLED',
    booking.driver?.name || 'N/A'
  ];
  for (let i = 0; i < labels2.length; i++) {
    doc.fontSize(6).font('Helvetica-Bold').fillColor('#4b5563')
       .text(labels2[i], cols2[i], gridY + 23, { align: 'center', width: cols2[i+1] - cols2[i] });
    doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#1f2937')
       .text(values2[i], cols2[i], gridY + 30, { align: 'center', width: cols2[i+1] - cols2[i] });
  }

  // --- 4. Address block grid (Consignor / Consignee / Shipping Address) ---
  const addrY = gridY + 40;
  const colWidth = (PAGE_W - 60) / 3;
  doc.save();
  doc.strokeColor('#9ca3af').lineWidth(0.5);
  // Bounding box
  doc.rect(30, addrY, PAGE_W - 60, 64).stroke();
  // Dividers
  doc.moveTo(30 + colWidth, addrY).lineTo(30 + colWidth, addrY + 64).stroke();
  doc.moveTo(30 + colWidth * 2, addrY).lineTo(30 + colWidth * 2, addrY + 64).stroke();
  doc.restore();

  // Consignor info
  const consignor = booking.customer || {};
  const cAddr = consignor.billingAddress || consignor.address || booking.pickup || {};
  doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#1e3a8a')
     .text('CONSIGNOR:', 35, addrY + 4);
  doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#1f2937')
     .text(consignor.companyName || 'N/A', 35, addrY + 13, { width: colWidth - 10, height: 11, ellipsis: true });
  
  const consignorAddress = [
    cAddr.address || cAddr.street,
    [cAddr.city, cAddr.state].filter(Boolean).join(', ') + (cAddr.pincode ? ` - ${cAddr.pincode}` : '')
  ].filter(Boolean).join('\n');
  doc.fontSize(6.5).font('Helvetica').fillColor('#4b5563')
     .text(consignorAddress || 'N/A', 35, addrY + 24, { width: colWidth - 10, height: 20 });
  doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#4b5563')
     .text(`GST: ${consignor.gst || 'N/A'}  PAN: ${consignor.pan || 'N/A'}`, 35, addrY + 45, { width: colWidth - 10 });

  // Consignee info
  const consigneeName = booking.drop?.contactPerson?.name || 'N/A';
  const dropAddr = booking.drop || {};
  const consigneeAddress = [
    dropAddr.address,
    [dropAddr.city, dropAddr.state].filter(Boolean).join(', ') + (dropAddr.pincode ? ` - ${dropAddr.pincode}` : '')
  ].filter(Boolean).join('\n');
  doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#1e3a8a')
     .text('CONSIGNEE:', 35 + colWidth, addrY + 4);
  doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#1f2937')
     .text(consigneeName, 35 + colWidth, addrY + 13, { width: colWidth - 10, height: 11, ellipsis: true });
  doc.fontSize(6.5).font('Helvetica').fillColor('#4b5563')
     .text(consigneeAddress || 'N/A', 35 + colWidth, addrY + 24, { width: colWidth - 10, height: 20 });
  doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#4b5563')
     .text(`GST: N/A  PAN: N/A`, 35 + colWidth, addrY + 45, { width: colWidth - 10 });

  // Shipping Address
  doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#1e3a8a')
     .text('SHIPPING ADDRESS:', 35 + colWidth * 2, addrY + 4);
  doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#1f2937')
     .text(consigneeName, 35 + colWidth * 2, addrY + 13, { width: colWidth - 10, height: 11, ellipsis: true });
  doc.fontSize(6.5).font('Helvetica').fillColor('#4b5563')
     .text(consigneeAddress || 'N/A', 35 + colWidth * 2, addrY + 24, { width: colWidth - 10, height: 20 });
  doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#4b5563')
     .text(`GST: N/A  PAN: N/A`, 35 + colWidth * 2, addrY + 45, { width: colWidth - 10 });

  // --- 5. Item details and Charges Sidebar ---
  const itemY = addrY + 64;
  const leftW = 360;
  const rightW = PAGE_W - 60 - leftW;

  const items = booking.items || [
    {
      sno: '1',
      name: booking.materialType || 'General Cargo',
      pkgType: 'Loose',
      qty: booking.numberOfTrucks || 1,
      nwt: booking.weight?.value ? `${booking.weight.value} ${(booking.weight.unit || 'kg').toUpperCase()}` : '-',
      gwt: booking.weight?.value ? `${booking.weight.value} ${(booking.weight.unit || 'kg').toUpperCase()}` : '-',
      rateType: 'Weight',
      amount: '0.00'
    }
  ];

  const rowHeight = 12;
  const headerHeight = 11;
  const totalRowHeight = 11;
  const tableHeight = headerHeight + (items.length * rowHeight) + totalRowHeight;
  const chargesHeight = 88; // CGST, SGST, IGST as separate rows

  const containerHeight = Math.max(tableHeight, chargesHeight);
  const refY = itemY + containerHeight;

  doc.save();
  doc.strokeColor('#9ca3af').lineWidth(0.5);
  // Main container
  doc.rect(30, itemY, PAGE_W - 60, containerHeight).stroke();
  // Sidebar vertical divider
  doc.moveTo(30 + leftW, itemY).lineTo(30 + leftW, itemY + containerHeight).stroke();
  
  // Left Header (Item Columns)
  doc.rect(30, itemY, leftW, 11).fill('#f3f4f6');
  // Divider lines inside left header
  const itemCols = [30, 160, 205, 235, 275, 315, 345, 30 + leftW];
  for (let i = 1; i < itemCols.length - 1; i++) {
    doc.moveTo(itemCols[i], itemY).lineTo(itemCols[i], itemY + containerHeight - totalRowHeight).stroke();
  }
  doc.restore();

  // Left header labels
  const itemLabels = ['ITEM', 'PKG TYPE', 'QTY', 'N.WT', 'G.WT', 'RATE TYPE', 'AMOUNT'];
  for (let i = 0; i < itemLabels.length; i++) {
    doc.fontSize(5.5).font('Helvetica-Bold').fillColor('#374151')
       .text(itemLabels[i], itemCols[i], itemY + 3, { align: 'center', width: itemCols[i+1] - itemCols[i] });
  }

  // Left Row values (Dynamic items loop)
  let curRowY = itemY + 13;
  for (const item of items) {
    const itemVals = [
      String(item.name || 'General Cargo'),
      String(item.pkgType || 'Loose'),
      parseFloat(item.qty || 0).toFixed(2),
      String(item.nwt || '-'),
      String(item.gwt || '-'),
      String(item.rateType || 'Weight'),
      String(item.amount || '0.00')
    ];
    for (let i = 0; i < itemVals.length; i++) {
      doc.fontSize(6.5).font('Helvetica').fillColor('#1f2937')
         .text(itemVals[i], itemCols[i], curRowY, { align: 'center', width: itemCols[i+1] - itemCols[i] });
    }
    curRowY += rowHeight;
  }

  // Left Total Row
  doc.save();
  doc.strokeColor('#9ca3af').lineWidth(0.5);
  doc.moveTo(30, itemY + containerHeight - totalRowHeight).lineTo(30 + leftW, itemY + containerHeight - totalRowHeight).stroke();
  doc.restore();

  const totalWeightStr = items.length === 1 ? items[0].nwt : '-';
  doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#1f2937')
     .text('Total', 35, itemY + containerHeight - totalRowHeight + 2)
     .text(String(items.length), 205, itemY + containerHeight - totalRowHeight + 2, { align: 'center', width: 30 })
     .text(totalWeightStr, 235, itemY + containerHeight - totalRowHeight + 2, { align: 'center', width: 40 })
     .text(totalWeightStr, 275, itemY + containerHeight - totalRowHeight + 2, { align: 'center', width: 40 })
     .text('TO BE BILLED', 345, itemY + containerHeight - totalRowHeight + 2, { align: 'center', width: 45 });

  // Right Charges Sidebar
  doc.save();
  doc.rect(30 + leftW, itemY, rightW, 11).fill('#f3f4f6');
  doc.strokeColor('#9ca3af').lineWidth(0.5);
  const chargeColX = 30 + leftW + 115;
  doc.moveTo(chargeColX, itemY).lineTo(chargeColX, itemY + containerHeight).stroke();
  
  // Header texts
  doc.fontSize(5.5).font('Helvetica-Bold').fillColor('#374151')
     .text('CHARGES', 30 + leftW, itemY + 3, { align: 'center', width: 115 })
     .text('AMOUNT', chargeColX, itemY + 3, { align: 'center', width: rightW - 115 });
  
  // Draw inner rows of charges (CGST, SGST, IGST as separate rows)
  const chargesList = [
    ['ST. CHARGE', '0'],
    ['HOLD & WAITING CHA.', '0'],
    ['SUB TOTAL', 'TO BE BILLED'],
    ['CGST 2.5%', '0.00'],
    ['SGST 2.5%', '0.00'],
    ['IGST 5%', '0.00'],
    ['Insurance', '0.00'],
    ['GRAND TOTAL', 'TO BE BILLED']
  ];
  
  let cy = itemY + 13;
  for (const [chg, amt] of chargesList) {
    doc.fontSize(5.5).font('Helvetica').fillColor('#4b5563').text(chg, 30 + leftW + 5, cy);
    doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#1f2937').text(amt, chargeColX, cy, { align: 'center', width: rightW - 115 });
    cy += 9;
  }
  doc.restore();

  // --- 6. Lower Info/Reference Row ---
  doc.save();
  doc.strokeColor('#9ca3af').lineWidth(0.5);
  doc.rect(30, refY, PAGE_W - 60, 48).stroke();
  
  // Horiz divides
  doc.moveTo(30, refY + 12).lineTo(PAGE_W - 30, refY + 12).stroke();
  doc.moveTo(30, refY + 24).lineTo(PAGE_W - 30, refY + 24).stroke();
  doc.moveTo(30, refY + 36).lineTo(PAGE_W - 30, refY + 36).stroke();
  
  // Vert divides
  doc.moveTo(170, refY).lineTo(170, refY + 24).stroke();
  doc.moveTo(330, refY).lineTo(330, refY + 24).stroke();
  doc.moveTo(330, refY + 24).lineTo(330, refY + 48).stroke();
  doc.restore();

  // Row 1: INVOICE NO / DATE / VALUE
  const freightVal = booking.finalAmount || booking.expectedAmount || 0;
  doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#4b5563')
     .text('INVOICE NO:', 35, refY + 3)
     .text('DATE:', 175, refY + 3)
     .text('VALUE:', 335, refY + 3);
  doc.font('Helvetica').fillColor('#1f2937')
     .text(booking.invoiceNo || 'N/A', 80, refY + 3)
     .text(booking.loadDateTime ? format(new Date(booking.loadDateTime), 'dd-MM-yyyy') : 'N/A', 205, refY + 3)
     .text(freightVal ? rupees(freightVal) : 'TO BE BILLED', 370, refY + 3);

  // Row 2: E-WAY BILL NO / DATE / TAX PAID BY CONSIGNOR
  doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#4b5563')
     .text('E-WAY BILL NO:', 35, refY + 15)
     .text('DATE:', 175, refY + 15);
  doc.font('Helvetica').fillColor('#1f2937')
     .text(booking.ewayBillNo || 'N/A', 92, refY + 15)
     .text(booking.loadDateTime ? format(new Date(booking.loadDateTime), 'dd-MM-yyyy') : 'N/A', 205, refY + 15);
  
  doc.rect(335, refY + 14, 180, 8).fill('#f3f4f6');
  doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#1f2937')
     .text('TAX PAID BY CONSIGNOR', 335, refY + 15, { align: 'center', width: 180 });

  // Row 3: PRIVATE MARK
  doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#4b5563')
     .text('PRIVATE MARK:', 35, refY + 27);
  doc.font('Helvetica').fillColor('#1f2937')
     .text('N/A', 98, refY + 27);

  // Row 4: REMARKS / CLAIM AMOUNT / AMOUNT IN WORD
  doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#4b5563')
     .text('REMARKS:', 35, refY + 39)
     .text('Amount in Word:', 335, refY + 27)
     .text('CLAIM AMOUNT:', 335, refY + 39);
  doc.font('Helvetica').fillColor('#1f2937')
     .text(booking.remarks || 'None', 80, refY + 39)
     .text('TO BE BILLED', 405, refY + 27)
     .text('N/A', 405, refY + 39);

  // --- 7. Notes and Signature Footer ---
  const footY = refY + 48;
  doc.fontSize(5).font('Helvetica').fillColor('#6b7280')
     .text('NOTE:- 1) Luggage is transported at owner\'s risk. (2) In the case of non-insured goods, management will not entertain any claim exceeding Rs. 1000/-. (3) SUBJECT TO (MUMBAI) JURISDICTION.', 35, footY + 5, { width: 330 });

  // Bank Info
  const bank = orgSettings.bank || {};
  const bankDetailsText = `A/C NAME: ${company.companyName?.toUpperCase() || 'HIRA SINGH TRANSPORT'} , ACCOUNT NO: ${bank.accountNo || '300002000003951'} , BANK: ${bank.name || 'S.V.C CO-OPERATIVE BANK LTD.'} , IFSC: ${bank.ifsc || 'SVCB0000039'} , BRANCH: ${bank.branch || 'BHAYANDAR (W)'}`;
  doc.fontSize(5).font('Helvetica-Bold').fillColor('#4b5563')
     .text(bankDetailsText, 35, footY + 23, { width: 330 });

  // Stamp and signature
  doc.fontSize(7).font('Helvetica-Bold').fillColor('#1f2937')
     .text(`For ${company.companyName?.toUpperCase() || 'HIRA SINGH TRANSPORT'}`, 380, footY + 5, { align: 'center', width: 170 });
  
  // Fake stamp circle for aesthetic quality!
  doc.save();
  doc.strokeColor('#3b82f6').lineWidth(0.75).circle(465, footY + 20, 12).stroke();
  doc.fontSize(4).font('Helvetica-Bold').fillColor('#3b82f6')
     .text('DIGITALLY', 450, footY + 16, { align: 'center', width: 30 })
     .text('SIGNED', 450, footY + 21, { align: 'center', width: 30 });
  doc.restore();

  doc.fontSize(6).font('Helvetica').fillColor('#9ca3af')
     .text('Note: Digitally Generated CN/LR, Signature Not Required', 380, footY + 32, { align: 'center', width: 170 });

  const copyHeight = (footY - yStart) + 40;

  // Draw outer border box now that we have copyHeight
  doc.save();
  doc.strokeColor('#9ca3af').lineWidth(0.75).rect(30, yStart, PAGE_W - 60, copyHeight).stroke();
  doc.restore();

  return copyHeight;
}

export default PDFService;
