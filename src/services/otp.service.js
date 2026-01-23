import axios from 'axios';

// MSG91 API Configuration
const MSG91_AUTH_KEY = process.env.MSG91_AUTH_KEY;
const MSG91_TEMPLATE_ID = process.env.MSG91_TEMPLATE_ID || 'otp1';
const MSG91_BASE_URL = 'https://control.msg91.com/api/v5/otp';

/**
 * Generate a random 6-digit OTP
 * @returns {string} 6-digit OTP
 */
export const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Format phone number to international format if needed
 * @param {string} phoneNumber - Phone number (can be with or without country code)
 * @returns {string} Formatted phone number with country code
 */
export const formatPhoneNumber = (phoneNumber) => {
  // Remove any non-numeric characters except +
  let cleaned = phoneNumber.replace(/[^\d+]/g, '');
  
  // If it doesn't start with +, assume India and add +91
  if (!cleaned.startsWith('+')) {
    // If it's 10 digits, it's likely Indian number without country code
    if (cleaned.length === 10) {
      cleaned = '+91' + cleaned;
    } else if (cleaned.length === 12 && cleaned.startsWith('91')) {
      // If it starts with 91 but no +, add it
      cleaned = '+' + cleaned;
    } else {
      // Default to adding +91
      cleaned = '+91' + cleaned;
    }
  }
  
  return cleaned;
};

/**
 * Send OTP via MSG91 service
 * @param {string} phoneNumber - User's phone number
 * @param {string} otp - Optional OTP value to send
 * @returns {Promise<{success: boolean, message: string, phoneNumber: string}>}
 */
export const sendOTP = async (phoneNumber, otp = null) => {
  try {
    // Validate API key
    if (!MSG91_AUTH_KEY) {
      throw new Error('MSG91 Auth Key not configured. Please set MSG91_AUTH_KEY in environment variables.');
    }

    // Format phone number (MSG91 expects 91XXXXXXXXXX)
    const formattedPhone = formatPhoneNumber(phoneNumber).replace('+', '');
    
    const options = {
      method: 'POST',
      url: MSG91_BASE_URL,
      params: {
        mobile: formattedPhone,
        authkey: MSG91_AUTH_KEY,
        template_id: MSG91_TEMPLATE_ID,
        realTimeResponse: '1'
      },
      headers: {
        'Content-Type': 'application/json'
      },
      data: {}
    };

    // If specific OTP is provided, add it to params
    if (otp) {
      options.params.otp = otp;
    }

    console.log(`Sending OTP to ${formattedPhone} via MSG91...`);
    
    // Call MSG91 API
    const response = await axios.request(options);
    
    if (response.data.type === 'success') {
      return {
        success: true,
        message: 'OTP sent successfully',
        phoneNumber: formattedPhone,
        sessionId: response.data.message // Map MSG91 message (request ID) to sessionId for backward compatibility
      };
    } else {
      throw new Error(response.data.message || 'Failed to send OTP');
    }
  } catch (error) {
    console.error('Error sending OTP:', error.message);
    
    // Handle specific axios errors
    if (error.response) {
      // MSG91 API returned an error
      throw new Error(error.response.data?.message || 'Failed to send OTP via MSG91 service');
    } else if (error.request) {
      // Network error
      throw new Error('Network error while contacting MSG91 service');
    } else {
      // Other errors
      throw error;
    }
  }
};

/**
 * Verify OTP via MSG91 service
 * @param {string} phoneNumber - User's phone number
 * @param {string} otp - OTP entered by user
 * @returns {Promise<{success: boolean, message: string}>}
 */
export const verifyOTP = async (phoneNumber, otp) => {
  try {
    // Validate API key
    if (!MSG91_AUTH_KEY) {
      throw new Error('MSG91 Auth Key not configured');
    }

    // Format phone number (MSG91 expects 91XXXXXXXXXX)
    const formattedPhone = formatPhoneNumber(phoneNumber).replace('+', '');
    
    const options = {
      method: 'GET',
      url: `${MSG91_BASE_URL}/verify`,
      params: {
        otp: otp,
        mobile: formattedPhone
      },
      headers: {
        authkey: MSG91_AUTH_KEY
      }
    };

    console.log(`Verifying OTP for ${formattedPhone} via MSG91...`);
    
    // Call MSG91 API
    const response = await axios.request(options);
    
    if (response.data.type === 'success') {
      return {
        success: true,
        message: response.data.message || 'OTP verified successfully',
      };
    } else {
      return {
        success: false,
        message: response.data.message || 'Invalid OTP',
      };
    }
  } catch (error) {
    console.error('Error verifying OTP:', error.message);
    
    // Handle specific axios errors
    if (error.response) {
      const errorMsg = error.response.data?.message || 'OTP verification failed';
      return {
        success: false,
        message: errorMsg,
      };
    } else if (error.request) {
      throw new Error('Network error while contacting MSG91 service');
    } else {
      throw error;
    }
  }
};

/**
 * Resend OTP via MSG91 service
 * @param {string} phoneNumber - User's phone number
 * @param {string} retryType - Type of retry (text/voice)
 * @returns {Promise<{success: boolean, message: string}>}
 */
export const resendOTP = async (phoneNumber, retryType = 'text') => {
  try {
    // Validate API key
    if (!MSG91_AUTH_KEY) {
      throw new Error('MSG91 Auth Key not configured');
    }

    // Format phone number (MSG91 expects 91XXXXXXXXXX)
    const formattedPhone = formatPhoneNumber(phoneNumber).replace('+', '');
    
    const options = {
      method: 'GET',
      url: `${MSG91_BASE_URL}/retry`,
      params: {
        mobile: formattedPhone,
        authkey: MSG91_AUTH_KEY,
        retrytype: retryType
      }
    };

    console.log(`Resending OTP to ${formattedPhone} via MSG91...`);
    
    // Call MSG91 API
    const response = await axios.request(options);
    
    if (response.data.type === 'success') {
      return {
        success: true,
        message: 'OTP resent successfully',
      };
    } else {
      throw new Error(response.data.message || 'Failed to resend OTP');
    }
  } catch (error) {
    console.error('Error resending OTP:', error.message);
    
    if (error.response) {
      throw new Error(error.response.data?.message || 'Failed to resend OTP via MSG91 service');
    } else if (error.request) {
      throw new Error('Network error while contacting MSG91 service');
    } else {
      throw error;
    }
  }
};

export default {
  generateOTP,
  sendOTP,
  verifyOTP,
  resendOTP,
  formatPhoneNumber,
};
