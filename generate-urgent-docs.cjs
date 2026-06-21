const fs = require('fs');
const PDFDocument = require('pdfkit');
const { format } = require('date-fns');

// --- Helpers ---

function rupees(n) {
  return '₹' + (n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

function hr(doc, y, color = '#cccccc') {
  doc.strokeColor(color).lineWidth(0.5).moveTo(40, y).lineTo(595.28 - 40, y).stroke();
}

// --- Data ---

const mockBooking = {
  bookingId: 'BK-SMT010',
  customer: {
    companyName: 'WELSPUN MICHIGAN ENGINEERS LIMITED',
    gst: '09AAACM2806P1Z7',
    address: {
      city: 'Varanasi',
      state: 'Uttar Pradesh',
      pincode: '221002'
    }
  },
  pickup: {
    city: 'Rajkot',
    state: 'Gujarat',
    address: 'Veraval Rajkot, GUJARAT - 360024'
  },
  drop: {
    city: 'Varanasi',
    state: 'Uttar Pradesh',
    address: 'Varanasi, UTTAR PRADESH - 221002'
  },
  materialType: 'SM04N - Smart Ops BioDAYBL',
  weight: { value: 140, unit: 'kg' },
  vehicle: { vehicleNumber: 'GJ27V9563' },
  lrDetails: {
    lrNumber: '622129999669',
    lrDate: new Date('2026-06-17')
  },
  customerPrice: 649070.80,
  payable: 550060.00,
  gstAmount: 99010.80,
  gstRate: 18,
  invoiceNo: 'SMT/26-27/010',
  ewayBillNo: '622129999669',
  loadDateTime: new Date('2026-06-17')
};

const orgSettings = {
  companyName: 'CLOUD TRUCK PRIVATE LIMITED',
  gstNumber: '24AAHCS5254D1Z2',
  companyAddress: {
    street: 'Plot No. 1, Phase 1, GIDC',
    city: 'Ahmedabad',
    state: 'Gujarat',
    pincode: '382445'
  },
  phone: '9892523292',
  email: 'ops@cloudtruck.in',
  bank: {
    name: 'S.V.C CO-OPERATIVE BANK LTD.',
    accountNo: '300002000003951',
    ifsc: 'SVCB0000039',
    branch: 'BHAYANDAR (W)'
  }
};

// --- Generation ---

async function generate() {
  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  const filename = 'Santosh_LR_SMT010.pdf';
  const stream = fs.createWriteStream(filename);
  doc.pipe(stream);

  const drawPage = (copyTitle) => {
    // Header
    doc.fillColor('#1a1a1a').fontSize(16).font('Helvetica-Bold').text(orgSettings.companyName, 40, 40);
    doc.fontSize(8.5).font('Helvetica').fillColor('#444444')
       .text('Head Office: ' + orgSettings.companyAddress.street + ', ' + orgSettings.companyAddress.city + ', ' + orgSettings.companyAddress.state + ' - ' + orgSettings.companyAddress.pincode, 40, 60)
       .text('Phone: ' + orgSettings.phone + ', Email: ' + orgSettings.email, 40, 72)
       .text('GST NO: ' + orgSettings.gstNumber + ', Website: santoshmovers.com', 40, 84);
    
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#1a1a1a').text('CONSIGNMENT NOTE', 0, 40, { align: 'right', width: 595.28 - 40 });
    
    hr(doc, 100);

    // Meta Grid
    let y = 110;
    const col1 = 40, col2 = 140, col3 = 240, col4 = 340, col5 = 440;
    
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#555555')
       .text('CN NUMBER', col1, y).text('DATE', col2, y).text('DELIVERY TYPE', col3, y).text('COPY FOR', col5, y);
    y += 12;
    doc.fontSize(9).font('Helvetica').fillColor('#1a1a1a')
       .text(mockBooking.lrDetails.lrNumber, col1, y).text(format(mockBooking.lrDetails.lrDate, 'dd-MM-yyyy'), col2, y).text('Road', col3, y).text(copyTitle, col5, y);
    
    y += 20;
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#555555')
       .text('ORIGIN', col1, y).text('DESTINATION', col2, y).text('VEHICLE NO', col3, y).text('PAYMENT', col5, y);
    y += 12;
    doc.fontSize(9).font('Helvetica')
       .text(mockBooking.pickup.city.toUpperCase(), col1, y).text(mockBooking.drop.city.toUpperCase(), col2, y).text(mockBooking.vehicle.vehicleNumber, col3, y).text('TO BE BILLED', col5, y);

    y += 25;
    hr(doc, y);
    y += 15;

    // Consignor / Consignee
    doc.fontSize(8.5).font('Helvetica-Bold').text('CONSIGNOR:', col1, y);
    doc.font('Helvetica').text('SANTOSH MOVERS AND PACKERS (AS AGENT)', col1 + 60, y, { width: 180 });
    doc.text('GST: ' + orgSettings.gstNumber, col1 + 60, doc.y + 2);
    
    const consigneeY = y;
    doc.font('Helvetica-Bold').text('CONSIGNEE:', col3 + 40, consigneeY);
    doc.font('Helvetica').text(mockBooking.customer.companyName, col3 + 100, consigneeY, { width: 180 });
    doc.text('GST: ' + mockBooking.customer.gst, col3 + 100, doc.y + 2);
    
    y = Math.max(doc.y, consigneeY + 45);
    hr(doc, y);
    y += 10;

    // Items
    doc.fontSize(8.5).font('Helvetica-Bold').text('ITEM', col1, y).text('PKG TYPE', col2 + 40, y).text('QTY', col3 + 20, y).text('G.WT', col4, y).text('RATE TYPE', col5, y);
    y += 15;
    doc.font('Helvetica').text(mockBooking.materialType, col1, y, { width: 140 })
       .text('Loose', col2 + 40, y)
       .text('1.00', col3 + 20, y)
       .text(mockBooking.weight.value + ' KGS', col4, y)
       .text('Weight', col5, y);
    
    y += 30;
    hr(doc, y);
    y += 10;

    // Details
    doc.fontSize(8.5).font('Helvetica-Bold')
       .text('INVOICE NO: ' + mockBooking.invoiceNo, col1, y)
       .text('DATE: ' + format(mockBooking.lrDetails.lrDate, 'dd-MM-yyyy'), col1 + 180, y)
       .text('VALUE: Rs.' + mockBooking.customerPrice, col1 + 300, y);
    y += 15;
    doc.text('E-WAY BILL NO: ' + mockBooking.ewayBillNo, col1, y);
    
    y += 20;
    hr(doc, y);
    
    // Bottom
    y += 15;
    doc.fontSize(7).font('Helvetica').fillColor('#555555')
       .text('NOTE:- 1) Luggage is transported at owner\'s risk. (2) Subject to Ahmedabad Jurisdiction.', col1, y, { width: 350 });
    
    const bankY = y;
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#1a1a1a')
       .text('BANK DETAILS:', col4 - 20, bankY);
    doc.fontSize(7.5).font('Helvetica')
       .text('A/C: ' + orgSettings.bank.accountNo, col4 - 20, bankY + 12)
       .text('Bank: ' + orgSettings.bank.name, col4 - 20, bankY + 22)
       .text('IFSC: ' + orgSettings.bank.ifsc, col4 - 20, bankY + 32);

    y = 720;
    doc.fontSize(9).font('Helvetica-Bold').text('For ' + orgSettings.companyName.toUpperCase(), col4, y);
    doc.fontSize(7).font('Helvetica').text('Note: Digitally Generated CN/LR, Signature Not Required', col4, y + 15);
  };

  drawPage('CONSIGNOR');
  doc.addPage();
  drawPage('CONSIGNEE');

  doc.end();
  console.log('Successfully generated: ' + filename);
}

generate();
