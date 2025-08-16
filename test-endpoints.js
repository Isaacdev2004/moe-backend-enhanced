// Test script for Moe Backend endpoints
import fetch from 'node-fetch';

const BASE_URL = 'https://moe-backend-enhanced-1.onrender.com';

async function testEndpoint(endpoint, method = 'GET', body = null) {
  try {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      }
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    console.log(`Testing ${method} ${endpoint}...`);
    const response = await fetch(`${BASE_URL}${endpoint}`, options);
    const data = await response.json();
    
    if (response.ok) {
      console.log(`✅ ${endpoint} - Status: ${response.status}`);
      console.log(`   Response:`, JSON.stringify(data, null, 2));
    } else {
      console.log(`❌ ${endpoint} - Status: ${response.status}`);
      console.log(`   Error:`, data);
    }
    
    return { success: response.ok, status: response.status, data };
  } catch (error) {
    console.log(`❌ ${endpoint} - Network Error:`, error.message);
    return { success: false, error: error.message };
  }
}

async function runTests() {
  console.log('🧪 Testing Moe Backend Endpoints\n');
  
  // Test basic endpoints
  await testEndpoint('/health');
  await testEndpoint('/');
  
  // Test new endpoints
  await testEndpoint('/api/plans');
  await testEndpoint('/api/specialized/supported-types');
  
  // Test existing endpoints
  await testEndpoint('/api/knowledge/status');
  
  console.log('\n✅ Endpoint testing complete!');
}

runTests().catch(console.error); 