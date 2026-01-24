/**
 * GST Configuration
 * ClearTax API integration settings
 */
export const GST_CONFIG = {
  enabled: process.env.GST_VERIFICATION_ENABLED === 'true' || false,
  apiKey: process.env.CLEARTAX_API_KEY,
  apiUrl: process.env.CLEARTAX_API_URL || 'https://api.cleartax.in',
  timeout: 10000 // 10 seconds
};

export default GST_CONFIG;
