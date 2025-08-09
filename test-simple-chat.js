#!/usr/bin/env node

import axios from 'axios';

const BASE_URL = 'https://moe-backend-enhanced-1.onrender.com';

async function testSimpleChat() {
  console.log('🔍 DETAILED SIMPLE CHAT TEST\n');
  
  try {
    // Step 1: Authenticate
    console.log('1️⃣  Authenticating...');
    const testUser = {
      email: `simplechat${Date.now()}@example.com`,
      password: 'TestPass123',
      name: 'Simple Chat Test'
    };
    
    const signup = await axios.post(`${BASE_URL}/api/auth/signup`, testUser);
    const token = signup.data.token;
    console.log('✅ Authentication successful');
    
    // Step 2: Test simple chat endpoint
    console.log('\n2️⃣  Testing POST /api/chat/simple...');
    
    try {
      const response = await axios.post(`${BASE_URL}/api/chat/simple`, {
        message: 'Test message'
      }, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000
      });
      
      console.log('🎉 SUCCESS! Simple chat is working!');
      console.log('Full response:');
      console.log(JSON.stringify(response.data, null, 2));
      
    } catch (error) {
      console.log('❌ SIMPLE CHAT FAILED - DETAILED ERROR:');
      console.log('Status Code:', error.response?.status);
      console.log('Status Text:', error.response?.statusText);
      console.log('Error Response:');
      console.log(JSON.stringify(error.response?.data, null, 2));
      console.log('\nAxios Error Details:');
      console.log('Message:', error.message);
      console.log('Code:', error.code);
      
      if (error.response?.data?.error_type) {
        console.log('\n🔍 DIAGNOSIS:');
        switch(error.response.data.error_type) {
          case 'api_key':
            console.log('❌ OpenAI API key is invalid or missing');
            break;
          case 'quota':
            console.log('❌ OpenAI API quota exceeded');
            break;
          case 'network':
            console.log('❌ Network connection to OpenAI failed');
            break;
          default:
            console.log('❌ Unknown OpenAI error');
        }
      }
    }
    
    // Step 3: Also test the regular chat endpoint for comparison
    console.log('\n3️⃣  Testing POST /api/chat/message for comparison...');
    
    try {
      const response = await axios.post(`${BASE_URL}/api/chat/message`, {
        message: 'Test message'
      }, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000
      });
      
      console.log('✅ Regular chat also working!');
      
    } catch (error) {
      console.log('❌ Regular chat failed (expected)');
      console.log('Error:', error.response?.data?.message || error.message);
    }
    
  } catch (setupError) {
    console.error('❌ Test setup failed:', setupError.message);
  }
}

testSimpleChat().catch(console.error); 