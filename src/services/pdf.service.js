import PDFDocument from 'pdfkit';
import { format } from 'date-fns';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOGO_PATH = path.resolve(__dirname, '../assets/pdf-logo.png');

const HSN_SAC = '996812'; // Road freight transport services
const TERMS_AND_CONDITIONS = [
  'Invoices should be paid within the due date to ensure uninterrupted services.',
  'If an invoice remains unpaid beyond 45 days, interest at 2% per month will be charged from the invoice date.',
  'In case outstanding is not cleared within 90 days, CloudTruck may suspend all services.',
  'This invoice shows the actual price of the services described and all particulars are true and correct.',
  'Write to support@cloudtruck.in within 48 hours of receiving the invoice for any disputes.',
];

const PAGE_W = 595.28; // A4 width in points
const PAGE_H = 841.89; // A4 height in points
const MARGIN = 50;
const COL_RIGHT = 370;

const NAVY = '#1e3a8a';
const NAVY_TINT = '#eef2ff';

const colX = {
  sno: 50,
  desc: 80,
  hsn: 270,
  qty: 325,
  rate: 355,
  tax: 405,
  amount: 460
};
const colW = {
  sno: 30,
  desc: 190,
  hsn: 55,
  qty: colX.rate - 5 - 325,
  rate: colX.tax - 5 - colX.rate,
  tax: colX.amount - 5 - colX.tax,
  amount: PAGE_W - MARGIN - 5 - colX.amount
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
    contact.phone ? `Phone: ${contact.phone}` : null,
    contact.email ? `Email: ${contact.email}` : null,
    company.gstNumber ? `GSTIN: ${company.gstNumber}` : null,
    company.panNumber ? `PAN: ${company.panNumber}` : null,
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
  const companyNameY = logoDrawn ? 82 : 40;
  doc.fillColor('#1f2937').fontSize(12).font('Helvetica-Bold')
    .text(company.companyName || 'Cloud Truck Private Limited', MARGIN, companyNameY);

  // Address lines
  const addrLines = [
    addr.street,
    addr.city && addr.state ? `${addr.city}, ${addr.state} - ${addr.pincode || ''}` : addr.city,
    addr.country || 'India',
    contact.phone ? `Phone: ${contact.phone}` : null,
    contact.email ? `Email: ${contact.email}` : null,
    company.gstNumber ? `GSTIN: ${company.gstNumber}` : null,
    company.panNumber ? `PAN: ${company.panNumber}` : null,
  ].filter(Boolean);

  let y = companyNameY + 16;
  for (const line of addrLines) {
    doc.fontSize(8.5).font('Helvetica').fillColor('#4b5563').text(line, MARGIN, y);
    y += 12;
  }

  // Right Side: Tax Invoice title with navy underline
  const titleW = 160;
  const titleX = PAGE_W - MARGIN - titleW;
  doc.fontSize(13).font('Helvetica-Bold').fillColor(NAVY);
  const titleTextW = doc.widthOfString('TAX INVOICE');
  doc.text('TAX INVOICE', titleX, 40, { align: 'right', width: titleW });
  doc.strokeColor(NAVY).lineWidth(1.2)
    .moveTo(titleX + titleW - titleTextW, 56).lineTo(titleX + titleW, 56).stroke();

  doc.fontSize(10.5).font('Helvetica-Bold').fillColor('#4b5563')
    .text(`# ${invNo}`, 0, 62, { align: 'right', width: PAGE_W - MARGIN });

  // Invoice Amount callout box
  const boxW = 150;
  const boxX = PAGE_W - MARGIN - boxW;
  const boxY = 82;
  const boxH = 38;

  doc.save();
  doc.roundedRect(boxX, boxY, boxW, boxH, 3).fillAndStroke(NAVY_TINT, NAVY);
  doc.restore();

  doc.fillColor(NAVY).fontSize(7.5).font('Helvetica-Bold')
    .text('INVOICE AMOUNT', boxX, boxY + 7, { align: 'center', width: boxW });
  doc.fillColor('#1f2937').fontSize(14).font('Helvetica-Bold')
    .text(rupees(totalAmount), boxX, boxY + 18, { align: 'center', width: boxW });

  return Math.max(y + 14, boxY + boxH + 10);
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
  doc.fontSize(9).font('Helvetica-Bold').fillColor(NAVY).text('Bill To', MARGIN, yStart);
  doc.strokeColor(NAVY).lineWidth(1).moveTo(MARGIN, yStart + 11).lineTo(MARGIN + 200, yStart + 11).stroke();

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
  const labelX = 300;
  const labelW = 100;
  const valueX = labelX + labelW + 10;
  const valW = PAGE_W - MARGIN - valueX;

  doc.fontSize(9).font('Helvetica-Bold').fillColor(NAVY).text('Invoice Details', labelX, yStart);
  doc.strokeColor(NAVY).lineWidth(1).moveTo(labelX, yStart + 11).lineTo(PAGE_W - MARGIN, yStart + 11).stroke();

  let yRight = yStart + 18;

  const rows = [
    ['Invoice Date', invDate],
    ['Terms', 'Net 30'],
    ['Due Date', dueDate],
    ['P.O.#', booking?.poNo || booking?.poNumber || '-'],
    ['Billing Month', billingMonth],
  ];

  for (const [key, value] of rows) {
    doc.fontSize(8.5).font('Helvetica').fillColor('#6b7280').text(key, labelX, yRight, { width: labelW, align: 'left' });
    doc.font('Helvetica-Bold').fillColor('#374151').text(String(value), valueX, yRight, { width: valW, align: 'right' });
    yRight += 15;
  }

  const bottomY = Math.max(yLeft, yRight);
  return { bottomY };
}

const COL_DIVIDERS = [colX.desc, colX.hsn, colX.qty, colX.rate, colX.tax, colX.amount];

function drawLineItemsHeader(doc, y, taxType = 'IGST') {
  doc.rect(MARGIN, y, PAGE_W - MARGIN * 2, 20).fill(NAVY);
  doc.fillColor('#ffffff').fontSize(8.5).font('Helvetica-Bold');
  doc.text('S. No.', colX.sno, y + 6, { width: colW.sno, align: 'center' });
  doc.text('Item & Description', colX.desc, y + 6, { width: colW.desc });
  doc.text('HSN/SAC', colX.hsn, y + 6, { width: colW.hsn, align: 'center' });
  doc.text('Qty', colX.qty, y + 6, { width: colW.qty, align: 'right' });
  doc.text('Rate', colX.rate, y + 6, { width: colW.rate, align: 'right' });
  doc.fontSize(taxType.length > 5 ? 6.5 : 8.5)
    .text(taxType, colX.tax, y + 6.5, { width: colW.tax, align: 'right' });
  doc.fontSize(8.5).text('Amount', colX.amount, y + 6, { width: colW.amount, align: 'right' });
  return y + 20;
}

function drawLineItem(doc, y, sno, description, hsn, qty, rate, taxRateStr, amount) {
  const descHeight = doc.heightOfString(description, { width: colW.desc });
  const rowH = Math.max(28, descHeight + 12);

  if (sno % 2 === 0) {
    doc.rect(MARGIN, y, PAGE_W - MARGIN * 2, rowH).fill('#f9fafb');
  }

  doc.fillColor('#374151').fontSize(8.5).font('Helvetica');
  doc.text(String(sno), colX.sno, y + 6, { width: colW.sno, align: 'center' });

  doc.text(description, colX.desc, y + 6, { width: colW.desc });
  doc.text(hsn, colX.hsn, y + 6, { width: colW.hsn, align: 'center' });
  doc.text(String(qty), colX.qty, y + 6, { width: colW.qty, align: 'right' });
  doc.text(rupees(rate), colX.rate, y + 6, { width: colW.rate, align: 'right' });
  doc.text(taxRateStr, colX.tax, y + 6, { width: colW.tax, align: 'right' });
  doc.text(rupees(amount), colX.amount, y + 6, { width: colW.amount, align: 'right' });

  doc.save();
  doc.strokeColor('#e5e7eb').lineWidth(0.5);
  for (const dx of COL_DIVIDERS) {
    doc.moveTo(dx - 5, y).lineTo(dx - 5, y + rowH).stroke();
  }
  doc.moveTo(MARGIN, y + rowH).lineTo(PAGE_W - MARGIN, y + rowH).stroke();
  doc.restore();

  return y + rowH;
}

function drawInvoiceTotalsAndWords(doc, y, subTotal, taxAmount, taxLabel, rounding, total) {
  const lx = 325;
  const rx = PAGE_W - MARGIN;
  const vx = rx - 10;
  const cardW = rx - lx;

  const rows = [['Sub Total', subTotal], [taxLabel, taxAmount], ['Rounding', rounding]];
  const rowH = 16;
  const grandH = 24;
  const wordsH = 30;
  const cardH = rows.length * rowH + grandH + wordsH + 10;

  doc.save();
  doc.lineWidth(1).roundedRect(lx, y, cardW, cardH, 3).fillAndStroke(NAVY_TINT, NAVY);
  doc.restore();

  let ty = y + 8;
  for (const [label, value] of rows) {
    doc.fontSize(8.5).font('Helvetica').fillColor('#4b5563').text(label, lx + 10, ty);
    doc.font('Helvetica-Bold').fillColor('#374151').text(rupees(value), 0, ty, { align: 'right', width: vx });
    ty += rowH;
  }

  // Invoice Amount row (bold, navy)
  doc.strokeColor(NAVY).lineWidth(1).moveTo(lx + 8, ty).lineTo(rx - 8, ty).stroke();
  ty += 6;
  doc.fillColor(NAVY).fontSize(10.5).font('Helvetica-Bold')
     .text('Invoice Amount', lx + 10, ty)
     .text(rupees(total), 0, ty, { align: 'right', width: vx });
  ty += grandH - 6;

  // Amount in words caption
  doc.fontSize(7).font('Helvetica-Bold').fillColor('#6b7280')
     .text('AMOUNT IN WORDS', lx + 10, ty, { width: cardW - 20 });
  doc.fontSize(7.5).font('Helvetica-Oblique').fillColor('#374151')
     .text(amountInWords(total), lx + 10, ty + 10, { width: cardW - 20 });

  return y + cardH + 12;
}

function drawBankDetails(doc, y, orgSettings) {
  const bankAddr = orgSettings?.bank || orgSettings?.addresses?.find(a => a.accountNo) || {};
  if (!bankAddr.accountNo && !bankAddr.bankName && !bankAddr.name) return y;

  doc.strokeColor(NAVY).lineWidth(1).moveTo(MARGIN, y).lineTo(MARGIN + 150, y).stroke();
  y += 12;

  doc.fontSize(9.5).font('Helvetica-Bold').fillColor(NAVY).text('Bank Details', MARGIN, y);
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
  doc.strokeColor(NAVY).lineWidth(1).moveTo(MARGIN, y).lineTo(MARGIN + 150, y).stroke();
  y += 12;

  doc.fontSize(9.5).font('Helvetica-Bold').fillColor(NAVY).text('Terms & Conditions', MARGIN, y);
  y += 16;

  const lineH = 14;
  const panelH = TERMS_AND_CONDITIONS.length * lineH + 10;
  doc.rect(MARGIN, y - 4, PAGE_W - MARGIN * 2, panelH).fill('#f9fafb');

  for (const line of TERMS_AND_CONDITIONS) {
    doc.fontSize(8.5).font('Helvetica').fillColor('#4b5563')
      .text(`•  ${line}`, MARGIN + 8, y, { width: PAGE_W - MARGIN * 2 - 16 });
    y += lineH;
  }
  return y + 12;
}

function drawNotes(doc, y, note) {
  if (!note) return y;
  doc.strokeColor(NAVY).lineWidth(1).moveTo(MARGIN, y).lineTo(MARGIN + 150, y).stroke();
  y += 12;
  doc.fontSize(9.5).font('Helvetica-Bold').fillColor(NAVY).text('Notes', MARGIN, y);
  y += 16;
  doc.fontSize(8.5).font('Helvetica').fillColor('#4b5563').text(note, MARGIN, y, { width: PAGE_W - MARGIN * 2 });
  return y + 20;
}

const CAPABILITIES = [
  { label: 'Booking', icon: 'box' },
  { label: 'Tracking', icon: 'pin' },
  { label: 'E-Way Bill', icon: 'doc' },
  { label: 'POD', icon: 'check' },
  { label: 'Payments', icon: 'rupee' },
  { label: 'Analytics', icon: 'bars' },
];

function drawCapabilityIcon(doc, type, cx, cy) {
  doc.save();
  doc.strokeColor(NAVY).fillColor(NAVY).lineWidth(1);
  const r = 7;
  switch (type) {
    case 'box':
      doc.rect(cx - r, cy - r, r * 2, r * 2).stroke();
      doc.moveTo(cx - r, cy - r / 3).lineTo(cx + r, cy - r / 3).stroke();
      break;
    case 'pin':
      doc.circle(cx, cy - 2, r * 0.65).stroke();
      doc.moveTo(cx, cy + 2).lineTo(cx, cy + r).stroke();
      break;
    case 'doc':
      doc.rect(cx - r * 0.7, cy - r, r * 1.4, r * 2).stroke();
      doc.moveTo(cx - r * 0.35, cy - r * 0.3).lineTo(cx + r * 0.35, cy - r * 0.3).stroke();
      doc.moveTo(cx - r * 0.35, cy + r * 0.2).lineTo(cx + r * 0.35, cy + r * 0.2).stroke();
      break;
    case 'check':
      doc.circle(cx, cy, r).stroke();
      doc.moveTo(cx - r * 0.45, cy).lineTo(cx - r * 0.1, cy + r * 0.4).lineTo(cx + r * 0.5, cy - r * 0.4).stroke();
      break;
    case 'rupee':
      doc.circle(cx, cy, r).stroke();
      doc.fontSize(8).font('Helvetica-Bold').text('Rs', cx - r * 0.55, cy - r * 0.55);
      break;
    case 'bars':
      doc.rect(cx - r, cy + r * 0.2, r * 0.5, r * 0.8).fillAndStroke(NAVY, NAVY);
      doc.rect(cx - r * 0.2, cy - r * 0.3, r * 0.5, r * 1.3).fillAndStroke(NAVY, NAVY);
      doc.rect(cx + r * 0.6, cy - r, r * 0.5, r * 2).fillAndStroke(NAVY, NAVY);
      break;
  }
  doc.restore();
}

function drawCapabilityStrip(doc, y) {
  const stripH = 36;
  const innerW = PAGE_W - MARGIN * 2;
  const colW2 = innerW / CAPABILITIES.length;

  doc.save();
  doc.lineWidth(1).roundedRect(MARGIN, y, innerW, stripH, 3).fillAndStroke(NAVY_TINT, NAVY);
  doc.restore();

  CAPABILITIES.forEach((cap, i) => {
    const cx = MARGIN + colW2 * i + colW2 / 2;
    drawCapabilityIcon(doc, cap.icon, cx, y + 13);
    doc.fillColor(NAVY).fontSize(6.5).font('Helvetica-Bold')
      .text(cap.label, MARGIN + colW2 * i, y + 24, { width: colW2, align: 'center' });
  });

  return y + stripH + 10;
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

// Stamps "Page X of Y" on every buffered page; call once, right before doc.end().
function drawPageNumbers(doc) {
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    const oldBottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.fontSize(7.5).font('Helvetica').fillColor('#9ca3af')
      .text(`Page ${i + 1} of ${range.count}`, MARGIN, PAGE_H - 30, {
        align: 'right', width: PAGE_W - MARGIN * 2,
      });
    doc.page.margins.bottom = oldBottom;
  }
}

function buildDoc(renderFn) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: MARGIN, size: 'A4', bufferPages: true });
    const buffers = [];
    doc.on('data', b => buffers.push(b));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);
    try {
      renderFn(doc);
      drawPageNumbers(doc);
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

      if (y < 660) {
        drawCapabilityStrip(doc, 700);
      }
      drawFooter(doc);

      // Page 2
      doc.addPage();
      y = MARGIN;
      y = drawBankDetails(doc, y, orgSettings);
      y = drawTerms(doc, y);
      y = drawNotes(doc, y, 'Pay before the due date to enjoy uninterrupted services.');
      drawCapabilityStrip(doc, 700);
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
        doc.fontSize(9.5).font('Helvetica-Bold').fillColor(NAVY).text('Payment History', MARGIN, y);
        doc.strokeColor(NAVY).lineWidth(1).moveTo(MARGIN, y + 12).lineTo(MARGIN + 200, y + 12).stroke();
        y += 18;

        // Table Header
        doc.rect(MARGIN, y, PAGE_W - MARGIN * 2, 18).fill(NAVY);
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#ffffff')
          .text('Date', MARGIN + 8, y + 5)
          .text('Method / Reference', MARGIN + 100, y + 5)
          .text('Amount', 0, y + 5, { align: 'right', width: PAGE_W - MARGIN - 8 });
        y += 18;

        for (const [i, p] of summary.payments.entries()) {
          const rowH = 16;
          if (i % 2 === 0) {
            doc.rect(MARGIN, y, PAGE_W - MARGIN * 2, rowH).fill('#f9fafb');
          }
          const date = p.paidAt ? format(new Date(p.paidAt), 'dd-MMM-yy') : '-';
          const ref = [p.paymentMethod, p.referenceNumber || p.transactionId].filter(Boolean).join(' / ');
          doc.fontSize(8).font('Helvetica').fillColor('#4b5563')
            .text(date, MARGIN + 8, y + 4)
            .text(ref || '-', MARGIN + 100, y + 4)
            .text(rupees(p.amount), 0, y + 4, { align: 'right', width: PAGE_W - MARGIN - 8 });
          y += rowH;
          doc.strokeColor('#e5e7eb').lineWidth(0.5).moveTo(MARGIN, y).lineTo(PAGE_W - MARGIN, y).stroke();
        }

        y += 10;
        doc.strokeColor(NAVY).lineWidth(1).moveTo(325, y).lineTo(PAGE_W - MARGIN, y).stroke();
        doc.fontSize(9.5).font('Helvetica-Bold').fillColor(NAVY)
          .text('Balance Due:', 330, y + 5)
          .text(rupees(summary.balance || 0), 0, y + 5, { align: 'right', width: PAGE_W - MARGIN - 5 });
        y += 25;
      }

      if (y < 660) {
        drawCapabilityStrip(doc, 700);
      }
      drawFooter(doc);

      // Page 2
      doc.addPage();
      y = MARGIN;
      y = drawBankDetails(doc, y, orgSettings);
      y = drawTerms(doc, y);
      y = drawNotes(doc, y, 'Pay before the due date to enjoy uninterrupted services.');
      drawCapabilityStrip(doc, 700);
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
  const logoBoxW = 80;
  const logoBoxH = 32;
  let logoDrawn = false;
  let logoRenderH = 0;
  const logoTop = yStart + 12;
  try {
    if (fs.existsSync(LOGO_PATH)) {
      const { width: srcW, height: srcH } = doc.openImage(LOGO_PATH);
      logoRenderH = Math.min(logoBoxH, logoBoxW * (srcH / srcW));
      doc.image(LOGO_PATH, 40, logoTop, { fit: [logoBoxW, logoBoxH] });
      logoDrawn = true;
    }
  } catch (err) {}

  const companyX = logoDrawn ? 130 : 40;

  // Align the company name with the top of the right-side header block (CIN etc.), which starts at yStart + 15
  const companyNameY = yStart + 15;
  doc.fillColor('#1e3a8a').fontSize(12).font('Helvetica-Bold')
    .text(company.companyName || 'Cloud Truck Private Limited', companyX, companyNameY);

  const headerAddr = [
    addr.street,
    addr.city && addr.state ? `${addr.city}, ${addr.state} - ${addr.pincode || ''}` : addr.city,
  ].filter(Boolean);

  let yHeader = companyNameY + 16;
  for (const line of headerAddr) {
    doc.fontSize(6.5).font('Helvetica').fillColor('#4b5563').text(line, companyX, yHeader);
    yHeader += 8;
  }

  // Right side of header: CIN, GST No., Phone, Email — right-aligned with padding from the border
  const headerRightPad = 8;
  const headerRightW = 230;
  const headerRightX = PAGE_W - 30 - headerRightPad - headerRightW;
  const headerRight = [
    company.cinNumber ? `CIN: ${company.cinNumber}` : null,
    company.gstNumber ? `GST No: ${company.gstNumber}` : null,
    contact.phone ? `Phone: ${contact.phone}` : null,
    contact.email ? `Email: ${contact.email}` : null,
  ].filter(Boolean);

  let yHeaderRight = yStart + 15;
  for (const line of headerRight) {
    doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#4b5563')
      .text(line, headerRightX, yHeaderRight, { align: 'right', width: headerRightW });
    yHeaderRight += 9;
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
  const addrBlockH = 88;
  const colWidth = (PAGE_W - 60) / 3;
  doc.save();
  doc.strokeColor('#9ca3af').lineWidth(0.5);
  // Bounding box
  doc.rect(30, addrY, PAGE_W - 60, addrBlockH).stroke();
  // Dividers
  doc.moveTo(30 + colWidth, addrY).lineTo(30 + colWidth, addrY + addrBlockH).stroke();
  doc.moveTo(30 + colWidth * 2, addrY).lineTo(30 + colWidth * 2, addrY + addrBlockH).stroke();
  doc.restore();

  // Consignor info
  const consignor = booking.customer || {};
  const pickupContact = booking.pickup?.contactPerson || {};
  const cAddr = consignor.billingAddress || consignor.address || booking.pickup || {};
  const consignorName = consignor.companyName || pickupContact.name || 'N/A';
  const consignorGst = consignor.gst || pickupContact.gstNumber || 'N/A';
  doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#1e3a8a')
     .text('CONSIGNOR:', 35, addrY + 4);
  doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#1f2937')
     .text(consignorName, 35, addrY + 13, { width: colWidth - 10, height: 20 });

  const consignorAddress = [
    cAddr.address || cAddr.street,
    [cAddr.city, cAddr.state].filter(Boolean).join(', ') + (cAddr.pincode ? ` - ${cAddr.pincode}` : '')
  ].filter(Boolean).join('\n');
  doc.fontSize(6.5).font('Helvetica').fillColor('#4b5563')
     .text(consignorAddress || 'N/A', 35, addrY + 32, { width: colWidth - 10, height: 40 });
  doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#4b5563')
     .text(`GST: ${consignorGst}  PAN: ${consignor.pan || 'N/A'}`, 35, addrY + 74, { width: colWidth - 10 });

  // Consignee info
  const dropContact = booking.drop?.contactPerson || {};
  const consigneeName = dropContact.name || 'N/A';
  const consigneeGst = dropContact.gstNumber || 'N/A';
  const dropAddr = booking.drop || {};
  const consigneeAddress = [
    dropAddr.address,
    [dropAddr.city, dropAddr.state].filter(Boolean).join(', ') + (dropAddr.pincode ? ` - ${dropAddr.pincode}` : '')
  ].filter(Boolean).join('\n');
  doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#1e3a8a')
     .text('CONSIGNEE:', 35 + colWidth, addrY + 4);
  doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#1f2937')
     .text(consigneeName, 35 + colWidth, addrY + 13, { width: colWidth - 10, height: 20 });
  doc.fontSize(6.5).font('Helvetica').fillColor('#4b5563')
     .text(consigneeAddress || 'N/A', 35 + colWidth, addrY + 32, { width: colWidth - 10, height: 40 });
  doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#4b5563')
     .text(`GST: ${consigneeGst}  PAN: N/A`, 35 + colWidth, addrY + 74, { width: colWidth - 10 });

  // Shipping Address
  doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#1e3a8a')
     .text('SHIPPING ADDRESS:', 35 + colWidth * 2, addrY + 4);
  doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#1f2937')
     .text(consigneeName, 35 + colWidth * 2, addrY + 13, { width: colWidth - 10, height: 20 });
  doc.fontSize(6.5).font('Helvetica').fillColor('#4b5563')
     .text(consigneeAddress || 'N/A', 35 + colWidth * 2, addrY + 32, { width: colWidth - 10, height: 40 });
  doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#4b5563')
     .text(`GST: ${consigneeGst}  PAN: N/A`, 35 + colWidth * 2, addrY + 74, { width: colWidth - 10 });

  // --- 5. Item details and Charges Sidebar ---
  const itemY = addrY + addrBlockH;
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
  const bankDetailsText = `A/C NAME: ${(bank.accountName || company.companyName)?.toUpperCase() || 'HIRA SINGH TRANSPORT'} , ACCOUNT NO: ${bank.accountNo || '300002000003951'} , BANK: ${bank.name || 'S.V.C CO-OPERATIVE BANK LTD.'} , IFSC: ${bank.ifsc || 'SVCB0000039'} , BRANCH: ${bank.branch || 'BHAYANDAR (W)'}`;
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
