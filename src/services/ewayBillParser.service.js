import { PDFParse } from 'pdf-parse';
import ApiError from '../utils/ApiError.js';

/**
 * Removes whitespace govt e-way bill PDFs insert inside GSTINs/numbers
 * (e.g. "27ABK CS557 2R1ZA" -> "27ABKCS5572R1ZA").
 */
function collapseSpaces(value) {
  return value ? value.replace(/\s+/g, '') : value;
}

function matchFirst(text, regex) {
  const match = text.match(regex);
  return match ? match[1].trim() : undefined;
}

function joinAddressLines(block) {
  return block
    .split('\n')
    .map((line) => line.trim().replace(/,+$/, ''))
    .filter(Boolean)
    .join(', ');
}

/**
 * Parses text extracted from a government e-way bill PDF into structured fields.
 * Field extraction is regex-based against the standard NIC e-way bill layout and is
 * best-effort — callers must treat the result as a prefill, not a guaranteed-accurate parse.
 */
function extractFields(text) {
  const normalized = text.replace(/\r/g, '');

  const ewayBillNo = collapseSpaces(
    matchFirst(normalized, /eWay Bill No:\s*([\d\s]+?)\s+Generated Date/i)
  );

  const generatedDate = matchFirst(normalized, /Generated Date:\s*([\d/]+\s+[\d:]+\s*[AP]M)/i);
  const validUpto = matchFirst(normalized, /Valid Upto:\s*([\d/]+)/i);
  const approxDistanceKm = matchFirst(normalized, /Approx Distance:\s*(\d+)\s*km/i);

  const documentMatch = normalized.match(
    /Document Details:\s*([A-Za-z ]+?)\s*-\s*([A-Za-z0-9/\-]+)\s*-\s*([\d/]+)/i
  );
  const documentType = documentMatch ? documentMatch[1].trim() : undefined;
  const invoiceNo = documentMatch ? documentMatch[2].trim() : undefined;
  const invoiceDate = documentMatch ? documentMatch[3].trim() : undefined;

  const vehicleNumber = collapseSpaces(
    matchFirst(normalized, /Vehicle\s*\/\s*Trans\s*Doc No & Dt\.?\s*\n?\s*Road\s+([A-Z0-9]+)/i) ||
      matchFirst(normalized, /Road\s+([A-Z]{2}\d{2}[A-Z]{1,2}\d{4})/i)
  );

  const transporterMatch = normalized.match(
    /Transporter ID & Name\s*:\s*([A-Z0-9]+)\s*&\s*([^\n]+?)\s+Transporter Doc/i
  );
  const transporterId = transporterMatch ? collapseSpaces(transporterMatch[1]) : undefined;
  const transporterName = transporterMatch ? transporterMatch[2].trim() : undefined;

  // "From" block: GSTIN, company name, state, then dispatch address lines until "To"
  const fromBlockMatch = normalized.match(
    /\nFrom\s*\n\s*GSTIN\s*:\s*([A-Z0-9\s]+?)\n([^\n]+)\n([^\n]+)\n\s*::\s*Dispatch From\s*::\s*\n([\s\S]*?)\n\s*To\s*\n/i
  );

  const consignorGst = fromBlockMatch ? collapseSpaces(fromBlockMatch[1]) : undefined;
  const consignorName = fromBlockMatch ? fromBlockMatch[2].trim() : undefined;
  const consignorAddress = fromBlockMatch ? joinAddressLines(fromBlockMatch[4]) : undefined;

  // "To" block: GSTIN, company name, state, then ship-to address lines until "Transporter ID"
  const toBlockMatch = normalized.match(
    /\nTo\s*\n\s*GSTIN\s*:\s*([A-Z0-9\s]+?)\n([^\n]+)\n([^\n]+)\n\s*::\s*Ship To\s*::\s*\n([\s\S]*?)\n\s*Transporter ID/i
  );

  const consigneeGst = toBlockMatch ? collapseSpaces(toBlockMatch[1]) : undefined;
  const consigneeName = toBlockMatch ? toBlockMatch[2].trim() : undefined;
  const consigneeAddress = toBlockMatch ? joinAddressLines(toBlockMatch[4]) : undefined;

  return {
    ewayBillNo,
    generatedDate,
    validUpto,
    approxDistanceKm: approxDistanceKm ? Number(approxDistanceKm) : undefined,
    documentType,
    invoiceNo,
    invoiceDate,
    vehicleNumber,
    transporterId,
    transporterName,
    consignorName,
    consignorGst,
    consignorAddress,
    consigneeName,
    consigneeGst,
    consigneeAddress
  };
}

class EwayBillParserService {
  /**
   * @param {Buffer} fileBuffer - Raw bytes of the uploaded e-way bill PDF
   * @returns {Promise<Object>} Extracted, best-effort fields for prefilling the Indent form
   */
  static async parsePdf(fileBuffer) {
    let parser;
    try {
      parser = new PDFParse({ data: fileBuffer });
      const result = await parser.getText();

      if (!result?.text?.trim()) {
        throw new ApiError(422, 'Could not extract any text from the uploaded PDF');
      }

      return extractFields(result.text);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(422, `Failed to parse e-way bill PDF: ${error.message}`);
    } finally {
      if (parser) await parser.destroy();
    }
  }
}

export default EwayBillParserService;
