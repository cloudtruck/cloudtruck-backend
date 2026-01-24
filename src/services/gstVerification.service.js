import axios from 'axios';
import { GST_CONFIG } from '../config/gst.config.js';
import logger from '../utils/logger.js';

/**
 * GST Verification Service
 * Integrates with ClearTax Public API for GSTIN verification
 */
class GSTVerificationService {
  /**
   * Validate GSTIN format
   * @param {string} gstin - GSTIN to validate
   * @returns {boolean} True if format is valid
   */
  static validateGstinFormat(gstin) {
    if (!gstin || typeof gstin !== 'string') {
      return false;
    }

    // GSTIN format: 22AAAAA0000A1Z5
    // 2 digits (state code) + 5 chars (PAN) + 4 digits + 1 char + 1 char/digit + Z + 1 char/digit
    const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    return gstinRegex.test(gstin.toUpperCase());
  }

  /**
   * Verify GSTIN via ClearTax API
   * @param {string} gstin - GSTIN to verify
   * @returns {Promise<Object>} Verification result
   */
  static async verifyGstin(gstin) {
    try {
      // Normalize GSTIN
      const normalizedGstin = gstin?.trim().toUpperCase();

      // Validate format first
      if (!this.validateGstinFormat(normalizedGstin)) {
        return {
          verified: false,
          error: 'Invalid GSTIN format',
          gstin: normalizedGstin
        };
      }

      // Check if verification is enabled
      if (!GST_CONFIG.enabled) {
        logger.warn('GST verification is disabled. Skipping API call.');
        return {
          verified: false,
          error: 'GST verification is disabled',
          gstin: normalizedGstin,
          skipped: true
        };
      }

      // Check API key
      if (!GST_CONFIG.apiKey) {
        logger.error('ClearTax API key not configured');
        return {
          verified: false,
          error: 'GST verification service not configured',
          gstin: normalizedGstin
        };
      }

      // Call ClearTax API
      logger.info(`Verifying GSTIN: ${normalizedGstin} via ClearTax API`);
      
      const response = await axios.get(
        `${GST_CONFIG.apiUrl}/v2/public/gstin/${normalizedGstin}`,
        {
          headers: {
            'Authorization': `Bearer ${GST_CONFIG.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: GST_CONFIG.timeout
        }
      );

      // Parse response
      if (response.data && response.data.gstin) {
        const data = response.data;
        
        logger.info(`GSTIN ${normalizedGstin} verified successfully`);
        
        return {
          verified: true,
          verifiedAt: new Date(),
          gstin: data.gstin,
          legalName: data.legalName || data.tradeNam || null,
          tradeName: data.tradeNam || data.legalName || null,
          status: data.sts || 'Active',
          registrationDate: data.rgdt || null,
          stateCode: data.stj || null,
          taxpayerType: data.dty || null,
          constitutionOfBusiness: data.ctb || null,
          address: data.pradr ? {
            building: data.pradr.bno || null,
            street: data.pradr.st || null,
            location: data.pradr.loc || null,
            district: data.pradr.dst || null,
            state: data.pradr.stcd || null,
            pincode: data.pradr.pncd || null
          } : null
        };
      } else {
        logger.warn(`GSTIN ${normalizedGstin} not found or invalid`);
        return {
          verified: false,
          error: 'GSTIN not found or invalid',
          gstin: normalizedGstin
        };
      }
    } catch (error) {
      logger.error(`Error verifying GSTIN ${gstin}:`, error.message);

      // Handle specific error cases
      if (error.response) {
        const status = error.response.status;
        const errorMessage = error.response.data?.message || error.response.data?.error || 'Verification failed';

        if (status === 404) {
          return {
            verified: false,
            error: 'GSTIN not found',
            gstin: gstin?.trim().toUpperCase()
          };
        } else if (status === 401 || status === 403) {
          return {
            verified: false,
            error: 'API authentication failed',
            gstin: gstin?.trim().toUpperCase()
          };
        } else if (status === 429) {
          return {
            verified: false,
            error: 'API rate limit exceeded',
            gstin: gstin?.trim().toUpperCase()
          };
        } else {
          return {
            verified: false,
            error: errorMessage,
            gstin: gstin?.trim().toUpperCase()
          };
        }
      } else if (error.request) {
        // Network error
        return {
          verified: false,
          error: 'Network error while contacting GST verification service',
          gstin: gstin?.trim().toUpperCase()
        };
      } else {
        // Other errors
        return {
          verified: false,
          error: error.message || 'Unknown error during verification',
          gstin: gstin?.trim().toUpperCase()
        };
      }
    }
  }

  /**
   * Bulk verify multiple GSTINs
   * @param {Array<string>} gstins - Array of GSTINs to verify
   * @returns {Promise<Array<Object>>} Array of verification results
   */
  static async verifyMultipleGstins(gstins) {
    if (!Array.isArray(gstins) || gstins.length === 0) {
      return [];
    }

    const results = [];
    
    for (const gstin of gstins) {
      const result = await this.verifyGstin(gstin);
      results.push(result);
      
      // Add delay to avoid rate limiting (500ms between requests)
      if (gstins.indexOf(gstin) < gstins.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    return results;
  }

  /**
   * Extract state code from GSTIN
   * @param {string} gstin - GSTIN
   * @returns {string|null} State code (first 2 digits)
   */
  static getStateCodeFromGstin(gstin) {
    if (!this.validateGstinFormat(gstin)) {
      return null;
    }
    return gstin.substring(0, 2);
  }

  /**
   * Check if transaction is inter-state or intra-state
   * @param {string} fromGstin - Supplier GSTIN
   * @param {string} toGstin - Recipient GSTIN
   * @returns {Object} {isInterState: boolean, fromState: string, toState: string}
   */
  static checkTransactionType(fromGstin, toGstin) {
    const fromState = this.getStateCodeFromGstin(fromGstin);
    const toState = this.getStateCodeFromGstin(toGstin);

    if (!fromState || !toState) {
      return {
        isInterState: null,
        fromState,
        toState,
        error: 'Invalid GSTIN format'
      };
    }

    return {
      isInterState: fromState !== toState,
      fromState,
      toState
    };
  }
}

export default GSTVerificationService;
