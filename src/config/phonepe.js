export const PHONEPE_CONFIG = {
  merchantId: process.env.PHONEPE_MERCHANT_ID,
  saltKey: process.env.PHONEPE_SALT_KEY,
  saltIndex: process.env.PHONEPE_SALT_INDEX || '1',
  apiUrl: process.env.PHONEPE_API_URL || 'https://api-preprod.phonepe.com/apis/pg-sandbox',
  redirectMode: 'REDIRECT',
  callbackMode: 'POST'
};

export default PHONEPE_CONFIG;
