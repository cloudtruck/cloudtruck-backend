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

const NAVY = '#000000';
const NAVY_TINT = '#ffffff';
const BLUE_THEME = '#1d4ed8';
const BLUE_TINT = '#eff6ff';


const FONT_REG = fs.existsSync(path.resolve(__dirname, '../assets/calibril.ttf')) ? 'Calibri-Light' : 'Helvetica';
const FONT_BOLD = fs.existsSync(path.resolve(__dirname, '../assets/calibrib.ttf')) ? 'Calibri-Bold' : 'Helvetica-Bold';
const SIZE_BOLD = 8;
const SIZE_REG = 9;

const colX = {
  sno: 50,
  desc: 75,
  hsn: 245,
  qty: 300,
  rate: 330,
  tax: 395,
  amount: 455
};
const colW = {
  sno: 25,
  desc: 170,
  hsn: 55,
  qty: 30,
  rate: 65,
  tax: 60,
  amount: PAGE_W - MARGIN - 455
};

// ─── helpers ─────────────────────────────────────────────────────────────────

function rupees(n) {
  return `₹${(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

function amountInWordsLR(amount) {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function words(n) {
    if (n === 0) return '';
    if (n < 20) return ones[n] + ' ';
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? '-' + ones[n % 10].toLowerCase() : '') + ' ';
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred ' + words(n % 100);
    if (n < 100000) return words(Math.floor(n / 1000)) + 'Thousand ' + words(n % 1000);
    if (n < 10000000) return words(Math.floor(n / 100000)) + 'Lakh ' + words(n % 100000);
    return words(Math.floor(n / 10000000)) + 'Crore ' + words(n % 10000000);
  }

  const major = Math.floor(amount);
  const minor = Math.round((amount - major) * 100);
  let result = words(major).trim().toLowerCase();
  if (result.length > 0) {
    result = result.charAt(0).toUpperCase() + result.slice(1);
  }
  if (minor > 0) {
    result += ' and ' + words(minor).trim().toLowerCase() + ' paise';
  }
  return result + ' Rs only.';
}

function toTitleCase(str) {
  if (!str) return '';
  return str.split(/[\s_-]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
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

function drawHeader(doc, orgSettings, title = 'Tax Invoice') {
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
  doc.fillColor('#000000').fontSize(9).font(FONT_BOLD)
    .text(company.companyName || 'CloudTruck', MARGIN, companyNameY);

  const addrLines = [
    'Corporate Office Address:',
    addr.street,
    addr.city && addr.state ? `${addr.city}, ${addr.state} - ${addr.pincode || ''}` : addr.city,
    addr.country || 'India',
    contact.phone ? `Phone: ${contact.phone}` : null,
    contact.email ? `Email: ${contact.email}` : null,
    company.gstNumber ? `GSTIN: ${company.gstNumber}` : null,
    company.panNumber ? `PAN: ${company.panNumber}` : null,
  ].filter(Boolean);

  let y = companyNameY + 13;
  for (const line of addrLines) {
    const isLabel = line === 'Corporate Office Address:';
    doc.fontSize(SIZE_REG).font(isLabel ? FONT_BOLD : FONT_REG).fillColor('#000000').text(line, MARGIN, y);
    y += 10.5;
  }

  // Title label (right)
  doc.fontSize(SIZE_BOLD).font(FONT_BOLD).fillColor('#000000')
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
  doc.fillColor('#000000').fontSize(9).font(FONT_BOLD)
    .text(company.companyName || 'Cloud Truck Private Limited', MARGIN, companyNameY);

  // Address lines
  const addrLines = [
    'Corporate Office Address:',
    addr.street,
    addr.city && addr.state ? `${addr.city}, ${addr.state} - ${addr.pincode || ''}` : addr.city,
    addr.country || 'India',
    contact.phone ? `Phone: ${contact.phone}` : null,
    contact.email ? `Email: ${contact.email}` : null,
    company.gstNumber ? `GSTIN: ${company.gstNumber}` : null,
    company.panNumber ? `PAN: ${company.panNumber}` : null,
  ].filter(Boolean);

  let y = companyNameY + 13;
  for (const line of addrLines) {
    const isLabel = line === 'Corporate Office Address:';
    doc.fontSize(SIZE_REG).font(isLabel ? FONT_BOLD : FONT_REG).fillColor('#000000').text(line, MARGIN, y);
    y += 10.5;
  }

  // Right Side: Tax Invoice title
  const titleW = 160;
  const titleX = PAGE_W - MARGIN - titleW;
  doc.fontSize(11).font(FONT_BOLD).fillColor('#000000')
    .text(`Tax Invoice\n# ${invNo}`, titleX, 40, { align: 'right', width: titleW });

  // Invoice Amount callout box
  const boxW = 150;
  const boxX = PAGE_W - MARGIN - boxW;
  const boxY = 76;
  const boxH = 36;

  doc.fillColor('#000000').fontSize(SIZE_BOLD).font(FONT_BOLD)
    .text('Invoice Amount', boxX, boxY + 7, { align: 'right', width: boxW });
  doc.fillColor('#000000').fontSize(11).font(FONT_BOLD)
    .text(rupees(totalAmount), boxX, boxY + 18, { align: 'right', width: boxW });

  return Math.max(y + 8, boxY + boxH + 6);
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
    doc.fontSize(SIZE_REG).font(FONT_REG).fillColor('#000000').text(label + ':', labelX, y);
    doc.font(FONT_BOLD).fillColor('#000000').text(String(value), valueX, y);
    y += 14;
  }

  return y;
}

function drawInvoiceBillToAndMeta(doc, yStart, customer, invDate, dueDate, billingMonth, booking = null, paymentStatus = 'unpaid') {
  const addr = customer.billingAddress || customer.address || {};
  const customerState = addr.state || '';

  // --- Left Column: Bill To ---
  doc.fontSize(SIZE_BOLD).font(FONT_REG).fillColor('#000000').text('Bill To', MARGIN, yStart);

  let yLeft = yStart + 11;
  doc.fontSize(SIZE_BOLD).font(FONT_BOLD).fillColor('#000000')
     .text(customer.companyName || 'N/A', MARGIN, yLeft);
  yLeft += 11;

  const addrLines = [
    addr.street,
    addr.city && addr.state
      ? `${addr.city}, ${addr.state}${addr.pincode ? ' - ' + addr.pincode : ''}`
      : addr.city || addr.state,
    addr.country || 'India',
  ].filter(Boolean);

  for (const line of addrLines) {
    doc.fontSize(SIZE_REG).font(FONT_REG).fillColor('#000000').text(line, MARGIN, yLeft);
    yLeft += 10.5;
  }

  if (customer.gst) {
    doc.fontSize(SIZE_REG).font(FONT_REG).fillColor('#000000').text(`GSTIN - ${customer.gst}`, MARGIN, yLeft);
    yLeft += 10.5;
  }
  if (customer.pan) {
    doc.fontSize(SIZE_REG).font(FONT_REG).fillColor('#000000').text(`PAN - ${customer.pan}`, MARGIN, yLeft);
    yLeft += 10.5;
  }

  if (customerState) {
    yLeft += 2;
    doc.fontSize(SIZE_REG).font(FONT_BOLD).fillColor('#000000')
       .text(`Place Of Supply: ${customerState}`, MARGIN, yLeft);
    yLeft += 11;
  }

  // --- Right Column: Invoice Meta ---
  const labelX = 300;
  const labelW = 100;
  const valueX = labelX + labelW + 10;
  const valW = PAGE_W - MARGIN - valueX;

  doc.fontSize(SIZE_BOLD).font(FONT_REG).fillColor('#000000').text('Invoice Details', labelX, yStart);

  let yRight = yStart + 11;

  const rows = [
    ['Invoice Date', invDate],
    ['Terms', 'Net 30'],
    ['Due Date', dueDate],
    ['P.O.#', booking?.poNo || booking?.poNumber || '-'],
    ['Billing Month', billingMonth],
  ];

  for (const [key, value] of rows) {
    doc.fontSize(SIZE_REG).font(FONT_REG).fillColor('#000000').text(key, labelX, yRight, { width: labelW, align: 'left' });
    doc.font(FONT_BOLD).fillColor('#000000').text(String(value), valueX, yRight, { width: valW, align: 'right' });
    yRight += 11.5;
  }

  const bottomY = Math.max(yLeft, yRight);
  return { bottomY };
}

const COL_DIVIDERS = [75, 245, 300, 330, 395, 455];

function drawLineItemsHeader(doc, y, taxType = 'IGST') {
  doc.save();
  // Dark header background
  doc.fillColor('#333333').rect(MARGIN, y, PAGE_W - MARGIN * 2, 26).fill();

  // White vertical column dividers
  doc.strokeColor('#ffffff').lineWidth(0.5);
  for (const dx of COL_DIVIDERS) {
    doc.moveTo(dx, y).lineTo(dx, y + 26).stroke();
  }
  doc.restore();

  // White text headers
  doc.fillColor('#ffffff').fontSize(SIZE_BOLD).font(FONT_BOLD);
  doc.text('S. No.', colX.sno, y + 9, { width: colW.sno, align: 'center' });
  doc.text('Item & Description', colX.desc + 5, y + 9, { width: colW.desc - 10, align: 'left' });
  doc.text('HSN/SAC', colX.hsn, y + 9, { width: colW.hsn, align: 'center' });
  doc.text('Qty', colX.qty, y + 9, { width: colW.qty - 5, align: 'right' });
  doc.text('Rate', colX.rate, y + 9, { width: colW.rate - 8, align: 'right' });
  doc.fontSize(taxType.length > 5 ? 6.5 : SIZE_BOLD)
    .text(taxType, colX.tax, y + (taxType.length > 5 ? 9.5 : 9), { width: colW.tax - 8, align: 'right' });
  doc.fontSize(SIZE_BOLD).text('Amount', colX.amount, y + 9, { width: colW.amount - 8, align: 'right' });
  return y + 26;
}

function drawLineItem(doc, y, sno, description, hsn, qty, rate, taxRateStr, amount) {
  // Split description by newline to render title in bold and details in regular
  const descParts = description.split('\n');
  const title = descParts[0];
  const details = descParts.slice(1).join('\n');

  // Calculate dynamic heights for title and details
  doc.font(FONT_BOLD).fontSize(SIZE_REG);
  const titleHeight = doc.heightOfString(title, { width: colW.desc - 10 });
  let detailsHeight = 0;
  if (details) {
    doc.font(FONT_REG).fontSize(SIZE_REG - 1.0);
    detailsHeight = doc.heightOfString(details, { width: colW.desc - 10 }) + 2;
  }
  const rowH = Math.max(34, titleHeight + detailsHeight + 16);

  // Top alignment Y coordinate for all cells
  const topY = y + 8;

  // S. No (Top aligned)
  doc.fontSize(SIZE_REG).font(FONT_REG).fillColor('#1a1a1a');
  doc.text(String(sno), colX.sno, topY, { width: colW.sno, align: 'center' });

  // Description (Title in Bold, Details in Regular/Gray)
  doc.font(FONT_BOLD).fillColor('#1a1a1a');
  doc.text(title, colX.desc + 5, topY, { width: colW.desc - 10, align: 'left' });
  if (details) {
    doc.font(FONT_REG).fontSize(SIZE_REG - 1.0).fillColor('#333333');
    doc.text(details, colX.desc + 5, topY + titleHeight + 2, { width: colW.desc - 10, align: 'left' });
  }

  // HSN/SAC (Top aligned)
  doc.fontSize(SIZE_REG).font(FONT_REG).fillColor('#1a1a1a');
  doc.text(hsn, colX.hsn, topY, { width: colW.hsn, align: 'center' });

  // Qty (Top aligned, Right aligned)
  doc.text(String(qty), colX.qty, topY, { width: colW.qty - 5, align: 'right' });

  // Rate (Top aligned, Right aligned, consistent font size)
  const rateStr = rate.toFixed(2);
  doc.text(rateStr, colX.rate, topY, { width: colW.rate - 8, align: 'right' });

  // IGST (Top aligned, Right aligned, percentage rate drawn directly on the line below the tax amount)
  const pct = parseFloat(taxRateStr.replace(/[^0-9.]/g, ''));
  const taxAmt = !isNaN(pct) ? (amount * pct) / 100 : 0;
  const taxAmtStr = taxAmt.toFixed(2);

  // Draw tax amount
  doc.text(taxAmtStr, colX.tax, topY, { width: colW.tax - 8, align: 'right' });
  
  // Measure height of the tax amount block dynamically
  const actualAmtHeight = doc.heightOfString(taxAmtStr, { width: colW.tax - 8 });
  
  // Draw tax percentage rate directly below the actual height of the tax amount
  doc.fontSize(SIZE_REG - 1.0).font(FONT_REG).fillColor('#333333');
  doc.text(taxRateStr, colX.tax, topY + actualAmtHeight + 1, { width: colW.tax - 8, align: 'right' });

  // Amount (Top aligned, Right aligned, consistent font size)
  doc.fontSize(SIZE_REG).font(FONT_REG).fillColor('#1a1a1a');
  const amountStr = amount.toFixed(2);
  doc.text(amountStr, colX.amount, topY, { width: colW.amount - 8, align: 'right' });

  // Thin horizontal border at the bottom of the row (no vertical borders)
  doc.save();
  doc.strokeColor('#e5e7eb').lineWidth(0.5);
  doc.moveTo(MARGIN, y + rowH).lineTo(PAGE_W - MARGIN, y + rowH).stroke();
  doc.restore();

  return y + rowH;
}

function drawInvoiceTotalsAndWords(doc, y, subTotal, taxAmount, taxLabel, rounding, total) {
  const lx = 325;
  const rx = PAGE_W - MARGIN;
  const cardW = rx - lx;

  const labelX = lx;
  const labelW = 120;
  const valueX = lx + labelW + 10;
  const rightPadding = 10;
  const valueW = rx - valueX - rightPadding;

  const formattedRaw = (val) => (val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formattedRupees = (val) => '₹' + (val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const rows = [
    ['Sub Total', formattedRaw(subTotal)],
    [taxLabel, formattedRaw(taxAmount)],
    ['Rounding', formattedRaw(rounding)],
    ['Total', formattedRupees(total)]
  ];

  const rowH = 18;
  let ty = y + 8;

  for (const [label, value] of rows) {
    const isTotal = label === 'Total';
    doc.fontSize(SIZE_REG)
       .font(isTotal ? FONT_BOLD : FONT_REG)
       .fillColor('#1a1a1a');
    doc.text(label, labelX, ty, { width: labelW, align: 'right' });
    doc.text(value, valueX, ty, { width: valueW, align: 'right' });
    ty += rowH;
  }

  // Invoice Amount row with a gray background banner
  const bannerY = ty - 4;
  const bannerH = 22;
  doc.save();
  doc.fillColor('#f3f4f6').rect(lx, bannerY, rx - lx, bannerH).fill();
  doc.restore();

  doc.fontSize(SIZE_REG).font(FONT_BOLD).fillColor('#1a1a1a');
  doc.text('Invoice Amount', labelX, ty + 2, { width: labelW, align: 'right' });
  doc.text(formattedRupees(total), valueX, ty + 2, { width: valueW, align: 'right' });

  ty += bannerH + 12;

  // Amount in words
  doc.fontSize(SIZE_REG).font(FONT_REG).fillColor('#333333');
  doc.text('Total In Words: ', lx, ty, { continued: true });
  doc.font('Helvetica-BoldOblique').fillColor('#1a1a1a').text(amountInWords(total));

  return ty + 25;
}

function drawBankDetails(doc, y, orgSettings) {
  const bank = orgSettings?.bank || {};
  const accountNo = bank.accountNo || '771305000395';
  const bankName = bank.name || bank.bankName || 'ICICI Bank';
  const ifsc = bank.ifsc || 'ICIC0004611';
  const beneficiaryName = bank.accountName || orgSettings?.companyName || 'CLOUD TRUCK PVT LTD';

  y += 8;

  doc.fontSize(SIZE_BOLD).font(FONT_BOLD).fillColor('#000000').text('Bank Details', MARGIN, y);
  y += 16;

  const rows = [
    ['Beneficiary Name', beneficiaryName],
    ['Bank Name', bankName],
    ['Account No.', accountNo],
    ['IFSC Code', ifsc],
  ];

  for (const [label, value] of rows) {
    doc.fontSize(SIZE_REG).font(FONT_REG).fillColor('#000000')
      .text(label + ':', MARGIN, y, { continued: true })
      .font(FONT_BOLD).fillColor('#000000')
      .text(' ' + value);
    y += 13;
  }

  return y + 8;
}

function drawTerms(doc, y) {
  y += 8;

  doc.fontSize(SIZE_BOLD).font(FONT_BOLD).fillColor('#000000').text('Terms & Conditions', MARGIN, y);
  y += 16;

  const lineH = 14;

  for (const line of TERMS_AND_CONDITIONS) {
    doc.fontSize(SIZE_REG).font(FONT_REG).fillColor('#000000')
      .text(`•  ${line}`, MARGIN, y, { width: PAGE_W - MARGIN * 2 });
    y += lineH;
  }
  return y + 12;
}

function drawNotes(doc, y, note) {
  if (!note) return y;
  y += 8;
  doc.fontSize(SIZE_BOLD).font(FONT_BOLD).fillColor('#000000').text('Notes', MARGIN, y);
  y += 16;
  doc.fontSize(SIZE_REG).font(FONT_REG).fillColor('#000000').text(note, MARGIN, y, { width: PAGE_W - MARGIN * 2 });
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

function drawCapabilityIcon(doc, type, cx, cy, color = NAVY) {
  doc.save();
  doc.strokeColor(color).fillColor(color).lineWidth(1);
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
      doc.fontSize(8).font(FONT_BOLD).fillColor(color).text('Rs', cx - r * 0.55, cy - r * 0.55);
      break;
    case 'bars':
      doc.rect(cx - r, cy + r * 0.2, r * 0.5, r * 0.8).fillAndStroke(color, color);
      doc.rect(cx - r * 0.2, cy - r * 0.3, r * 0.5, r * 1.3).fillAndStroke(color, color);
      doc.rect(cx + r * 0.6, cy - r, r * 0.5, r * 2).fillAndStroke(color, color);
      break;
  }
  doc.restore();
}

function drawCapabilityStrip(doc, y) {
  const stripH = 36;
  const innerW = PAGE_W - MARGIN * 2;
  const colW2 = innerW / CAPABILITIES.length;

  doc.save();
  doc.lineWidth(1.2).roundedRect(MARGIN, y, innerW, stripH, 3).fillAndStroke('#ffffff', BLUE_THEME);
  doc.restore();

  CAPABILITIES.forEach((cap, i) => {
    const cx = MARGIN + colW2 * i + colW2 / 2;
    drawCapabilityIcon(doc, cap.icon, cx, y + 13, NAVY);
    doc.fillColor(NAVY).fontSize(SIZE_BOLD).font(FONT_BOLD)
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

  doc.strokeColor('#000000').lineWidth(0.5).moveTo(MARGIN, y).lineTo(PAGE_W - MARGIN, y).stroke();
  doc.fontSize(SIZE_REG).font(FONT_REG).fillColor('#000000')
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
    doc.fontSize(SIZE_REG - 1.5).font(FONT_REG).fillColor('#000000')
      .text(`Page ${i + 1} of ${range.count}`, MARGIN, PAGE_H - 30, {
        align: 'right', width: PAGE_W - MARGIN * 2,
      });
    doc.page.margins.bottom = oldBottom;
  }
}

function buildDoc(renderFn, options = {}) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: MARGIN, size: 'A4', bufferPages: true, ...options });
    
    // Register Calibri-Light and Calibri-Bold fonts if they exist
    const CALIBRI_LIGHT_PATH = path.resolve(__dirname, '../assets/calibril.ttf');
    if (fs.existsSync(CALIBRI_LIGHT_PATH)) {
      doc.registerFont('Calibri-Light', CALIBRI_LIGHT_PATH);
    }
    const CALIBRI_BOLD_PATH = path.resolve(__dirname, '../assets/calibrib.ttf');
    if (fs.existsSync(CALIBRI_BOLD_PATH)) {
      doc.registerFont('Calibri-Bold', CALIBRI_BOLD_PATH);
    }

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
      y = bottomY + 8;

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
      y = bottomY + 8;

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
        doc.fontSize(SIZE_BOLD).font(FONT_BOLD).fillColor('#000000').text('Payment History', MARGIN, y);
        doc.strokeColor('#000000').lineWidth(0.5).moveTo(MARGIN, y + 10).lineTo(MARGIN + 200, y + 10).stroke();
        y += 15;

        // Table Header
        doc.save();
        doc.strokeColor('#000000').lineWidth(0.5);
        doc.rect(MARGIN, y, PAGE_W - MARGIN * 2, 18).stroke();
        doc.restore();
        doc.fontSize(SIZE_BOLD).font(FONT_BOLD).fillColor('#000000')
          .text('Date', MARGIN + 8, y + 5)
          .text('Method / Reference', MARGIN + 100, y + 5)
          .text('Amount', 0, y + 5, { align: 'right', width: PAGE_W - MARGIN - 8 });
        y += 18;

        for (const [i, p] of summary.payments.entries()) {
          const rowH = 16;
          const date = p.paidAt ? format(new Date(p.paidAt), 'dd-MMM-yy') : '-';
          const ref = [p.paymentMethod, p.referenceNumber || p.transactionId].filter(Boolean).join(' / ');
          
          doc.save();
          doc.strokeColor('#000000').lineWidth(0.5);
          // Left border
          doc.moveTo(MARGIN, y).lineTo(MARGIN, y + rowH).stroke();
          // Right border
          doc.moveTo(PAGE_W - MARGIN, y).lineTo(PAGE_W - MARGIN, y + rowH).stroke();
          doc.restore();

          doc.fontSize(SIZE_REG).font(FONT_REG).fillColor('#000000')
            .text(date, MARGIN + 8, y + 4)
            .text(ref || '-', MARGIN + 100, y + 4)
            .text(rupees(p.amount), 0, y + 4, { align: 'right', width: PAGE_W - MARGIN - 8 });
          y += rowH;
          doc.strokeColor('#000000').lineWidth(0.5).moveTo(MARGIN, y).lineTo(PAGE_W - MARGIN, y).stroke();
        }

        y += 10;
        doc.strokeColor('#000000').lineWidth(0.5).moveTo(325, y).lineTo(PAGE_W - MARGIN, y).stroke();
        doc.fontSize(SIZE_BOLD).font(FONT_BOLD).fillColor('#000000')
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
      doc.fontSize(SIZE_BOLD).font(FONT_BOLD).fillColor('#000000').text('DRIVER', MARGIN, y);
      y += 13;
      doc.fontSize(SIZE_REG).font(FONT_REG).fillColor('#000000')
        .text(`Name: ${na(booking.driver?.name)}`, MARGIN, y)
        .text(`Phone: ${na(booking.driver?.phone)}`, MARGIN, y + 12);
      y += 30;

      doc.fontSize(SIZE_BOLD).font(FONT_BOLD).fillColor('#000000').text('VEHICLE', MARGIN, y);
      y += 13;
      doc.fontSize(SIZE_REG).font(FONT_REG).fillColor('#000000')
        .text(`Number: ${na(booking.vehicle?.vehicleNumber)}`, MARGIN, y)
        .text(`Type: ${na(booking.vehicle?.truckType)}`, MARGIN, y + 12);
      y += 35;

      hr(doc, y, '#000000');
      y += 10;

      // Route
      doc.fontSize(SIZE_BOLD).font(FONT_BOLD).fillColor('#000000').text('FROM', MARGIN, y).text('TO', 300, y);
      y += 13;
      doc.fontSize(SIZE_REG).font(FONT_REG).fillColor('#000000')
        .text(na(booking.pickup?.city), MARGIN, y, { width: 230 })
        .text(na(booking.drop?.city), 300, y, { width: 230 });
      y += 13;
      doc.fontSize(SIZE_REG).font(FONT_REG).fillColor('#000000')
        .text(na(booking.pickup?.address), MARGIN, y, { width: 230 })
        .text(na(booking.drop?.address), 300, y, { width: 230 });
      y += 28;

      hr(doc, y, '#000000');
      y += 10;

      // Cargo
      doc.fontSize(SIZE_BOLD).font(FONT_BOLD).fillColor('#000000').text('CARGO DETAILS', MARGIN, y);
      y += 14;
      const weightStr = booking.weight?.value
        ? `${booking.weight.value} ${booking.weight.unit || ''}`.trim()
        : na(null);
      doc.fontSize(SIZE_REG).font(FONT_REG).fillColor('#000000')
        .text(`Material: ${na(booking.materialType)}`, MARGIN, y)
        .text(`Weight: ${weightStr}`, 200, y)
        .text(`Distance: ${booking.estimatedDistance ? booking.estimatedDistance + ' km' : 'N/A'}`, 370, y);
      y += 13;
      doc.text(`Truck Type: ${na(booking.truckTypeNeeded)}`, MARGIN, y)
        .text(`Body Type: ${na(booking.bodyType)}`, 200, y);
      y += 25;

      hr(doc, y, '#000000');
      y += 10;

      // Freight breakdown table
      doc.fontSize(SIZE_BOLD).font(FONT_BOLD).fillColor('#000000').text('FREIGHT BREAKDOWN', MARGIN, y);
      y += 8;
      hr(doc, y, '#000000');
      y += 10;

      const fRows = [
        ['Total Freight', rupees(freight), false],
        ['Advance Paid', rupees(advance), false],
        ['Balance Due', rupees(balance), true],
      ];
      for (const [label, value, bold] of fRows) {
        doc.fontSize(SIZE_REG)
          .font(bold ? FONT_BOLD : FONT_REG)
          .fillColor('#000000')
          .text(label + ':', COL_RIGHT, y)
          .text(value, 0, y, { align: 'right', width: PAGE_W - MARGIN - 2 });
        y += bold ? 20 : 16;
      }

      // POD delivery confirmation
      if (booking.podDetails?.receiverName) {
        y += 8;
        hr(doc, y, '#000000');
        y += 10;
        doc.fontSize(SIZE_BOLD).font(FONT_BOLD).fillColor('#000000').text('DELIVERY CONFIRMATION', MARGIN, y);
        y += 14;
        doc.fontSize(SIZE_REG).font(FONT_REG).fillColor('#000000')
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
    }, { margin: { top: 20, bottom: 20, left: 30, right: 30 } });
  }
}

function drawSingleCopy(doc, yStart, booking, orgSettings, copyType) {
  const company = orgSettings || {};
  const addr = company.companyAddress || {};
  const contact = company.contactDetails || {};

  // Register and use Calibri Light & Bold fonts
  const fontName = 'Calibri-Light';
  const boldFontName = 'Calibri-Bold';
  const boldFontSize = 8;
  const CALIBRI_LIGHT_PATH = path.resolve(__dirname, '../assets/calibril.ttf');
  const CALIBRI_BOLD_PATH = path.resolve(__dirname, '../assets/calibrib.ttf');
  try {
    if (fs.existsSync(CALIBRI_LIGHT_PATH)) {
      doc.registerFont(fontName, CALIBRI_LIGHT_PATH);
    }
    if (fs.existsSync(CALIBRI_BOLD_PATH)) {
      doc.registerFont(boldFontName, CALIBRI_BOLD_PATH);
    }
  } catch (err) {}

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

  // Move the address next to logo vertically (underneath the logo)
  const companyX = 40;
  let yHeader = yStart + 15;
  if (logoDrawn) {
    yHeader = yStart + 12 + logoRenderH + 6;
  }

  const streetLines = [];
  if (addr.street) {
    const parts = addr.street.split(',');
    if (parts.length >= 3) {
      const mid = Math.ceil(parts.length / 2);
      streetLines.push(parts.slice(0, mid).join(',').trim() + ',');
      streetLines.push(parts.slice(mid).join(',').trim());
    } else {
      streetLines.push(addr.street);
    }
  }

  const headerAddr = [
    'Corporate Office Address:',
    ...streetLines,
    addr.city && addr.state ? `${addr.city}, ${addr.state} - ${addr.pincode || ''}` : addr.city,
  ].filter(Boolean);

  for (const line of headerAddr) {
    const isLabel = line === 'Corporate Office Address:';
    doc.fontSize(9).font(isLabel ? boldFontName : fontName).fillColor('#000000').text(line, companyX, yHeader);
    yHeader += 13;
  }

  // Right side of header: Company Name (Bold), then CIN, GST No., Phone, Email (Light) — right-aligned
  const headerRightPad = 8;
  const headerRightW = 230;
  const headerRightX = PAGE_W - 30 - headerRightPad - headerRightW;
  const headerRight = [
    company.companyName || 'Cloud Truck Private Limited',
    company.cinNumber ? `CIN: ${company.cinNumber}` : null,
    company.gstNumber ? `GST No: ${company.gstNumber}` : null,
    contact.phone ? `Phone: ${contact.phone}` : null,
    contact.email ? `Email: ${contact.email}` : null,
  ].filter(Boolean);

  let yHeaderRight = yStart + 15;
  for (let i = 0; i < headerRight.length; i++) {
    const line = headerRight[i];
    const currentFont = (i === 0) ? boldFontName : fontName;
    const currentSize = (i === 0) ? boldFontSize : 9;
    doc.fontSize(currentSize).font(currentFont).fillColor('#000000')
      .text(line, headerRightX, yHeaderRight, { align: 'right', width: headerRightW });
    yHeaderRight += 13;
  }

  const yHeaderMax = Math.max(yHeader, yHeaderRight);

  // --- 2. Consignment Note Bar ---
  const barY = Math.max(yStart + 85, yHeaderMax + 5);
  doc.save();
  doc.strokeColor('#000000').lineWidth(0.5).rect(30, barY, PAGE_W - 60, 18).stroke();
  doc.fontSize(boldFontSize).font(boldFontName).fillColor('#000000')
     .text('Consignment Note', 30, barY + 4, { align: 'center', width: PAGE_W - 60 });
  doc.restore();

  // --- 3. First Meta Grid (CN Details) ---
  const gridY = barY + 18;
  doc.save();
  doc.strokeColor('#000000').lineWidth(0.5);
  // Grid outer boundary
  doc.rect(30, gridY, PAGE_W - 60, 48).stroke();
  // Horizontal dividing line
  doc.moveTo(30, gridY + 24).lineTo(PAGE_W - 30, gridY + 24).stroke();
  
  // Row 1 vertical dividers: CN Number, Date, Delivery Type, Origin, Destination, Payment, Copy For
  const cols1 = [30, 110, 180, 250, 320, 390, 465, PAGE_W - 30];
  for (let i = 1; i < cols1.length - 1; i++) {
    doc.moveTo(cols1[i], gridY).lineTo(cols1[i], gridY + 24).stroke();
  }
  doc.restore();

  // Row 1 text (Labels Bold, Values Light)
  const labels1 = ['CN Number', 'Date', 'Delivery Type', 'Origin', 'Destination', 'Payment', 'Copy For'];
  const values1 = [
    booking.lrDetails?.lrNumber || booking.bookingId || '-',
    booking.lrDetails?.lrDate ? format(new Date(booking.lrDetails.lrDate), 'dd-MM-yyyy') : (booking.loadDateTime ? format(new Date(booking.loadDateTime), 'dd-MM-yyyy') : '-'),
    'Road',
    toTitleCase(booking.pickup?.city || '-'),
    toTitleCase(booking.drop?.city || '-'),
    'To Be Billed',
    toTitleCase(copyType)
  ];
  for (let i = 0; i < labels1.length; i++) {
    doc.fontSize(boldFontSize).font(boldFontName).fillColor('#000000')
       .text(labels1[i], cols1[i], gridY + 2, { align: 'center', width: cols1[i+1] - cols1[i] });
    doc.fontSize(9).font(fontName).fillColor('#000000')
       .text(values1[i], cols1[i], gridY + 12, { align: 'center', width: cols1[i+1] - cols1[i] });
  }

  // Row 2 vertical dividers: Vehicle No, Door Delivery, Shipping Charge, Driver
  const cols2 = [30, 180, 300, 420, PAGE_W - 30];
  doc.save();
  doc.strokeColor('#000000').lineWidth(0.5);
  for (let i = 1; i < cols2.length - 1; i++) {
    doc.moveTo(cols2[i], gridY + 24).lineTo(cols2[i], gridY + 48).stroke();
  }
  doc.restore();

  // Row 2 text (Labels Bold, Values Light)
  const labels2 = ['Vehicle No', 'Door Delivery', 'Shipping Charge', 'Driver:'];
  const values2 = [
    booking.vehicle?.vehicleNumber || 'N/A',
    booking.bodyType ? toTitleCase(booking.bodyType) : 'Door Delivery',
    'To Be Billed',
    booking.driver?.name || 'N/A'
  ];
  for (let i = 0; i < labels2.length; i++) {
    doc.fontSize(boldFontSize).font(boldFontName).fillColor('#000000')
       .text(labels2[i], cols2[i], gridY + 26, { align: 'center', width: cols2[i+1] - cols2[i] });
    doc.fontSize(9).font(fontName).fillColor('#000000')
       .text(values2[i], cols2[i], gridY + 36, { align: 'center', width: cols2[i+1] - cols2[i] });
  }

  // --- 4. Address block grid (Consignor / Consignee / Shipping Address) ---
  const addrY = gridY + 48;
  const addrBlockH = 96;
  const colWidth = (PAGE_W - 60) / 3;
  doc.save();
  doc.strokeColor('#000000').lineWidth(0.5);
  // Bounding box
  doc.rect(30, addrY, PAGE_W - 60, addrBlockH).stroke();
  // Dividers
  doc.moveTo(30 + colWidth, addrY).lineTo(30 + colWidth, addrY + addrBlockH).stroke();
  doc.moveTo(30 + colWidth * 2, addrY).lineTo(30 + colWidth * 2, addrY + addrBlockH).stroke();
  doc.restore();

  // Consignor info
  const consignor = booking.customer || {};
  const pickupContact = booking.pickup?.contactPerson || {};
  const cAddr = (booking.pickup?.address || booking.pickup?.city) 
    ? booking.pickup 
    : (consignor.billingAddress || consignor.address || {});
  const consignorName = pickupContact.name || consignor.companyName || 'N/A';
  const consignorGst = pickupContact.gstNumber || consignor.gst || 'N/A';
  
  const extractPan = (gst) => {
    if (!gst || gst === 'N/A') return 'N/A';
    const clean = gst.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    return clean.length === 15 ? clean.substring(2, 12) : 'N/A';
  };
  
  const consignorPan = consignor.pan || extractPan(consignorGst);

  doc.fontSize(boldFontSize).font(boldFontName).fillColor('#000000')
     .text('Consignor:', 35, addrY + 3);
  doc.fontSize(boldFontSize).font(boldFontName).fillColor('#000000')
     .text(consignorName, 35, addrY + 15, { width: colWidth - 10, height: 14 });

  const consignorAddress = [
    cAddr.address || cAddr.street,
    [cAddr.city, cAddr.state].filter(Boolean).join(', ') + (cAddr.pincode ? ` - ${cAddr.pincode}` : '')
  ].filter(Boolean).join('\n');
  doc.fontSize(9).font(fontName).fillColor('#000000')
     .text(consignorAddress || 'N/A', 35, addrY + 28, { width: colWidth - 10, height: 42 });
  doc.fontSize(9).font(fontName).fillColor('#000000')
     .text(`GST: ${consignorGst}\nPAN: ${consignorPan}`, 35, addrY + 68, { width: colWidth - 10 });

  // Consignee info
  const dropContact = booking.drop?.contactPerson || {};
  const consigneeName = dropContact.name || 'N/A';
  const consigneeGst = dropContact.gstNumber || 'N/A';
  const consigneePan = extractPan(consigneeGst);
  const dropAddr = booking.drop || {};
  const consigneeAddress = [
    dropAddr.address,
    [dropAddr.city, dropAddr.state].filter(Boolean).join(', ') + (dropAddr.pincode ? ` - ${dropAddr.pincode}` : '')
  ].filter(Boolean).join('\n');
  doc.fontSize(boldFontSize).font(boldFontName).fillColor('#000000')
     .text('Consignee:', 35 + colWidth, addrY + 4);
  doc.fontSize(boldFontSize).font(boldFontName).fillColor('#000000')
     .text(consigneeName, 35 + colWidth, addrY + 15, { width: colWidth - 10, height: 14 });
  doc.fontSize(9).font(fontName).fillColor('#000000')
     .text(consigneeAddress || 'N/A', 35 + colWidth, addrY + 28, { width: colWidth - 10, height: 42 });
  doc.fontSize(9).font(fontName).fillColor('#000000')
     .text(`GST: ${consigneeGst}\nPAN: ${consigneePan}`, 35 + colWidth, addrY + 68, { width: colWidth - 10 });

  // Shipping Address
  doc.fontSize(boldFontSize).font(boldFontName).fillColor('#000000')
     .text('Shipping Address:', 35 + colWidth * 2, addrY + 4);
  doc.fontSize(boldFontSize).font(boldFontName).fillColor('#000000')
     .text(consigneeName, 35 + colWidth * 2, addrY + 15, { width: colWidth - 10, height: 14 });
  doc.fontSize(9).font(fontName).fillColor('#000000')
     .text(consigneeAddress || 'N/A', 35 + colWidth * 2, addrY + 28, { width: colWidth - 10, height: 42 });
  doc.fontSize(9).font(fontName).fillColor('#000000')
     .text(`GST: ${consigneeGst}\nPAN: ${consigneePan}`, 35 + colWidth * 2, addrY + 68, { width: colWidth - 10 });

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

  const rowHeight = 16;
  const headerHeight = 16;
  const totalRowHeight = 24;
  const tableHeight = headerHeight + (items.length * rowHeight) + totalRowHeight;
  const chargesHeight = 120; // CGST, SGST, IGST as separate rows

  const containerHeight = Math.max(tableHeight, chargesHeight);
  const refY = itemY + containerHeight;

  doc.save();
  doc.strokeColor('#000000').lineWidth(0.5);
  // Main container
  doc.rect(30, itemY, PAGE_W - 60, containerHeight).stroke();
  // Sidebar vertical divider
  doc.moveTo(30 + leftW, itemY).lineTo(30 + leftW, itemY + containerHeight).stroke();
  
  // Divider lines inside left header
  const itemCols = [30, 150, 195, 225, 265, 305, 335, 30 + leftW];
  for (let i = 1; i < itemCols.length - 1; i++) {
    doc.moveTo(itemCols[i], itemY).lineTo(itemCols[i], itemY + containerHeight - totalRowHeight).stroke();
  }
  doc.restore();

  // Left header labels (Bold)
  const itemLabels = ['Item', 'Pkg Type', 'Qty', 'N.Wt', 'G.Wt', 'Rate Type', 'Amount'];
  for (let i = 0; i < itemLabels.length; i++) {
    doc.fontSize(boldFontSize).font(boldFontName).fillColor('#000000')
       .text(itemLabels[i], itemCols[i], itemY + 4, { align: 'center', width: itemCols[i+1] - itemCols[i] });
  }

  // Left Row values (Dynamic items loop - Light)
  let curRowY = itemY + 20;
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
      doc.fontSize(9).font(fontName).fillColor('#000000')
         .text(itemVals[i], itemCols[i], curRowY, { align: 'center', width: itemCols[i+1] - itemCols[i] });
    }
    curRowY += rowHeight;
  }

  // Left Total Row
  doc.save();
  doc.strokeColor('#000000').lineWidth(0.5);
  doc.moveTo(30, itemY + containerHeight - totalRowHeight).lineTo(30 + leftW, itemY + containerHeight - totalRowHeight).stroke();
  doc.restore();

  const totalWeightStr = items.length === 1 ? items[0].nwt : '-';
  doc.fontSize(boldFontSize).font(boldFontName).fillColor('#000000')
     .text('Total', 35, itemY + containerHeight - totalRowHeight + 4);
  doc.fontSize(9).font(fontName).fillColor('#000000')
     .text(String(items.length), 195, itemY + containerHeight - totalRowHeight + 4, { align: 'center', width: 30 })
     .text(totalWeightStr, 225, itemY + containerHeight - totalRowHeight + 4, { align: 'center', width: 40 })
     .text(totalWeightStr, 265, itemY + containerHeight - totalRowHeight + 4, { align: 'center', width: 40 })
     .text('To Be Billed', 335, itemY + containerHeight - totalRowHeight + 4, { align: 'center', width: 55 });

  // Right Charges Sidebar
  doc.save();
  doc.strokeColor('#000000').lineWidth(0.5);
  const chargeColX = 30 + leftW + 115;
  doc.moveTo(chargeColX, itemY).lineTo(chargeColX, itemY + containerHeight).stroke();
  
  // Header texts (Bold)
  doc.fontSize(boldFontSize).font(boldFontName).fillColor('#000000')
     .text('Charges', 30 + leftW, itemY + 4, { align: 'center', width: 115 })
     .text('Amount', chargeColX, itemY + 4, { align: 'center', width: rightW - 115 });
  
  // Draw inner rows of charges (CGST, SGST, IGST as separate rows)
  const chargesList = [
    ['St. Charge', '0'],
    ['Hold & Waiting Cha.', '0'],
    ['Sub Total', 'To Be Billed'],
    ['CGST 2.5%', '0.00'],
    ['SGST 2.5%', '0.00'],
    ['IGST 5%', '0.00'],
    ['Insurance', '0.00'],
    ['Grand Total', 'To Be Billed']
  ];
  
  let cy = itemY + 20;
  for (const [chg, amt] of chargesList) {
    const isBold = chg === 'Sub Total' || chg === 'Grand Total';
    const currentFont = isBold ? boldFontName : fontName;
    const currentSize = isBold ? boldFontSize : 9;
    doc.fontSize(currentSize).font(currentFont).fillColor('#000000').text(chg, 30 + leftW + 5, cy);
    doc.fontSize(currentSize).font(currentFont).fillColor('#000000').text(amt, chargeColX, cy, { align: 'center', width: rightW - 115 });
    cy += 12;
  }
  doc.restore();

  // --- 6. Lower Info/Reference Row ---
  doc.save();
  doc.strokeColor('#000000').lineWidth(0.5);
  doc.rect(30, refY, PAGE_W - 60, 80).stroke();
  
  // Horiz divides
  doc.moveTo(30, refY + 20).lineTo(PAGE_W - 30, refY + 20).stroke();
  doc.moveTo(30, refY + 40).lineTo(PAGE_W - 30, refY + 40).stroke();
  doc.moveTo(30, refY + 60).lineTo(PAGE_W - 30, refY + 60).stroke();
  
  // Vert divides
  doc.moveTo(200, refY).lineTo(200, refY + 40).stroke();
  doc.moveTo(340, refY).lineTo(340, refY + 40).stroke();
  doc.moveTo(340, refY + 40).lineTo(340, refY + 80).stroke();
  doc.restore();

  // Row 1: Invoice No / Date / Value (Labels Bold, Values Light)
  const freightVal = booking.finalAmount || booking.expectedAmount || 0;
  doc.fontSize(boldFontSize).font(boldFontName).fillColor('#000000')
     .text('Invoice No:', 35, refY + 5)
     .text('Date:', 205, refY + 5)
     .text('Value:', 345, refY + 5);
  doc.fontSize(9).font(fontName).fillColor('#000000')
     .text(booking.invoiceNo || 'N/A', 115, refY + 5)
     .text(booking.loadDateTime ? format(new Date(booking.loadDateTime), 'dd-MM-yyyy') : 'N/A', 245, refY + 5)
     .text(freightVal ? rupees(freightVal) : 'To Be Billed', 390, refY + 5);

  // Row 2: E-Way Bill No / Date / Tax Paid by Consignor
  doc.fontSize(boldFontSize).font(boldFontName).fillColor('#000000')
     .text('E-Way Bill No:', 35, refY + 25)
     .text('Date:', 205, refY + 25);
  doc.fontSize(9).font(fontName).fillColor('#000000')
     .text(booking.ewayBillNo || 'N/A', 125, refY + 25)
     .text(booking.loadDateTime ? format(new Date(booking.loadDateTime), 'dd-MM-yyyy') : 'N/A', 245, refY + 25);
  
  doc.fontSize(boldFontSize).font(boldFontName).fillColor('#000000')
     .text('Tax Paid by Consignor', 340, refY + 25, { align: 'center', width: PAGE_W - 60 - 340 });

  // Row 3: Private Mark
  doc.fontSize(boldFontSize).font(boldFontName).fillColor('#000000')
     .text('Private Mark:', 35, refY + 45);
  doc.fontSize(9).font(fontName).fillColor('#000000')
     .text('N/A', 125, refY + 45);

  // Row 4: Remarks / Claim Amount / Amount in Words
  const amtInWords = freightVal ? amountInWordsLR(freightVal) : 'To Be Billed';
  doc.fontSize(boldFontSize).font(boldFontName).fillColor('#000000')
     .text('Remarks:', 35, refY + 65)
     .text('Amount in Words:', 345, refY + 45)
     .text('Claim Amount:', 345, refY + 65);
  doc.fontSize(9).font(fontName).fillColor('#000000')
     .text(booking.remarks || 'None', 105, refY + 65)
     .text(amtInWords, 440, refY + 45)
     .text('N/A', 440, refY + 65);

  // --- 7. Notes and Signature Footer ---
  const footY = refY + 80;

  // Stamp and signature
  doc.fontSize(boldFontSize).font(boldFontName).fillColor('#000000')
     .text(`For ${company.companyName || 'Hira Singh Transport'}`, 380, footY + 5, { align: 'center', width: 170 });
  
  doc.fontSize(boldFontSize).font(boldFontName).fillColor('#000000')
     .text('Digitally Signed', 380, footY + 20, { align: 'center', width: 170 });

  doc.fontSize(9).font(fontName).fillColor('#000000')
     .text('Note: Digitally Generated CN/LR, Signature Not Required', 30, footY + 36, { width: PAGE_W - 60 });

  const copyHeight = (footY - yStart) + 52;

  // Draw outer border box now that we have copyHeight (excluding the top header portion)
  doc.save();
  doc.strokeColor('#000000').lineWidth(0.5).rect(30, barY, PAGE_W - 60, (yStart + copyHeight) - barY).stroke();
  doc.restore();

  return copyHeight;
}

export default PDFService;
