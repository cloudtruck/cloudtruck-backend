/**
 * Test script to verify staff API endpoint
 */
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const API_BASE = process.env.API_URL || 'http://localhost:5000/api/v1';

async function testStaffAPI() {
  try {
    console.log('🧪 Testing Staff API Endpoint...\n');
    
    // Test 1: Login to get token
    console.log('1️⃣ Logging in as admin...');
    
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@cloudtruck.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin1234';
    
    if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
      console.log('⚠️  Warning: Using default credentials. Set ADMIN_EMAIL and ADMIN_PASSWORD env variables for security.\n');
    }
    
    const loginResponse = await axios.post(`${API_BASE}/auth/login/staff`, {
      email: adminEmail,
      password: adminPassword
    });
    
    const token = loginResponse.data.data.tokens.accessToken;
    console.log('✓ Login successful\n');
    
    // Test 2: Fetch staff list
    console.log('2️⃣ Fetching staff list...');
    const staffResponse = await axios.get(`${API_BASE}/staff`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    
    console.log('\n📊 API Response Structure:');
    console.log(JSON.stringify(staffResponse.data, null, 2));
    
    console.log('\n✅ Staff API Test Results:');
    console.log(`- Success: ${staffResponse.data.success}`);
    console.log(`- Message: ${staffResponse.data.message}`);
    console.log(`- Has data: ${!!staffResponse.data.data}`);
    console.log(`- Has staff array: ${!!staffResponse.data.data?.staff}`);
    console.log(`- Staff count: ${staffResponse.data.data?.staff?.length || 0}`);
    console.log(`- Has pagination: ${!!staffResponse.data.data?.pagination}`);
    
    if (staffResponse.data.data?.staff?.length > 0) {
      console.log('\n👤 Sample Staff Record:');
      const sample = staffResponse.data.data.staff[0];
      console.log(`- Name: ${sample.name}`);
      console.log(`- Email: ${sample.user?.email || 'N/A'}`);
      console.log(`- Department: ${sample.department || 'N/A'}`);
      console.log(`- Active: ${sample.isActive}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

testStaffAPI();
