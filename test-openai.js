#!/usr/bin/env node

// Simple OpenAI API test script
import axios from 'axios';

const BASE_URL = 'https://moe-backend-enhanced-1.onrender.com';

async function testOpenAI() {
  console.log('🔑 Testing OpenAI API Configuration...\n');
  
  try {
    // First, signup and login to get a token
    console.log('1️⃣  Creating test user...');
    const testUser = {
      email: `openaitest${Date.now()}@example.com`,
      password: 'TestPass123',
      name: 'OpenAI Test User'
    };
    
    const signup = await axios.post(`${BASE_URL}/api/auth/signup`, testUser);
    const token = signup.data.token;
    console.log('✅ Test user created and logged in');
    
    // Test a very simple chat message
    console.log('\n2️⃣  Testing simple chat message...');
    try {
      const chatResponse = await axios.post(`${BASE_URL}/api/chat/message`, {
        message: 'Hi'
      }, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000
      });
      
      console.log('✅ Chat response received successfully!');
      console.log('Response details:');
      console.log('  - Status:', chatResponse.status);
      console.log('  - Message received:', chatResponse.data.conversation?.assistant_response?.content ? 'Yes' : 'No');
      console.log('  - Model used:', chatResponse.data.conversation?.context?.model_used || 'Unknown');
      
    } catch (chatError) {
      console.log('❌ Chat failed with detailed error:');
      console.log('  - Status:', chatError.response?.status || 'No response');
      console.log('  - Error:', chatError.response?.data?.message || chatError.message);
      console.log('  - Details:', chatError.response?.data?.error || 'No details');
      
      if (chatError.response?.data) {
        console.log('  - Full response:', JSON.stringify(chatError.response.data, null, 2));
      }
    }
    
    // Test with enhanced chat endpoint
    console.log('\n3️⃣  Testing enhanced chat endpoint...');
    try {
      const enhancedResponse = await axios.post(`${BASE_URL}/api/chat/enhanced-message`, {
        message: 'Hello'
      }, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000
      });
      
      console.log('✅ Enhanced chat response received successfully!');
      console.log('Response details:');
      console.log('  - Status:', enhancedResponse.status);
      console.log('  - Message received:', enhancedResponse.data.response?.assistant_message ? 'Yes' : 'No');
      
    } catch (enhancedError) {
      console.log('❌ Enhanced chat failed:');
      console.log('  - Status:', enhancedError.response?.status || 'No response');
      console.log('  - Error:', enhancedError.response?.data?.message || enhancedError.message);
    }
    
  } catch (error) {
    console.error('❌ Test setup failed:', error.message);
  }
}

testOpenAI().catch(console.error); 