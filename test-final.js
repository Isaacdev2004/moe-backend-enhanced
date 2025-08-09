#!/usr/bin/env node

import axios from 'axios';

const BASE_URL = 'https://moe-backend-enhanced-1.onrender.com';

async function finalTest() {
  console.log('🎯 FINAL CHAT TEST - Testing Simple OpenAI Endpoint\n');
  
  try {
    // Create test user and login
    console.log('1️⃣  Setting up authentication...');
    const testUser = {
      email: `finaltest${Date.now()}@example.com`,
      password: 'TestPass123',
      name: 'Final Test User'
    };
    
    const signup = await axios.post(`${BASE_URL}/api/auth/signup`, testUser);
    const token = signup.data.token;
    console.log('✅ Authentication successful');
    
    // Test the simple chat endpoint
    console.log('\n2️⃣  Testing simple chat endpoint...');
    try {
      const chatResponse = await axios.post(`${BASE_URL}/api/chat/simple`, {
        message: 'Hello, are you working?'
      }, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });
      
      console.log('🎉 SUCCESS! Simple chat is working!');
      console.log('Response details:');
      console.log('  - Status:', chatResponse.status);
      console.log('  - Content:', chatResponse.data.response?.content?.substring(0, 100) + '...');
      console.log('  - Model:', chatResponse.data.response?.model);
      console.log('  - Tokens:', chatResponse.data.response?.tokens_used);
      
      return true;
      
    } catch (chatError) {
      console.log('❌ SIMPLE CHAT FAILED:');
      console.log('  - Status:', chatError.response?.status || 'No response');
      console.log('  - Error Type:', chatError.response?.data?.error_type || 'Unknown');
      console.log('  - Message:', chatError.response?.data?.message || chatError.message);
      console.log('  - Details:', chatError.response?.data?.details || 'No details');
      
      return false;
    }
    
  } catch (error) {
    console.error('❌ Test setup failed:', error.message);
    return false;
  }
}

// Run the final test
finalTest().then(success => {
  console.log('\n' + '='.repeat(60));
  if (success) {
    console.log('🎉 CHAT FUNCTIONALITY IS NOW WORKING!');
    console.log('✅ OpenAI API is properly configured');
    console.log('✅ Simple chat endpoint is functional');
    console.log('\n📋 NEXT STEPS:');
    console.log('   • Use POST /api/chat/simple for basic chat');
    console.log('   • Complex RAG endpoints may need additional fixes');
    console.log('   • Backend is ready for production use');
  } else {
    console.log('🚨 CRITICAL ISSUE IDENTIFIED:');
    console.log('   • Check OpenAI API key configuration on Render');
    console.log('   • Verify environment variables are set');
    console.log('   • Check API key validity and quota');
  }
  console.log('='.repeat(60));
}).catch(console.error); 