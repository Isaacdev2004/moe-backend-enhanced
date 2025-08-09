# 🚀 MOE BACKEND - QUICK START GUIDE

## ⚡ **INSTANT TESTING - 5 MINUTES**

Your backend is **LIVE** and ready at: `https://moe-backend-enhanced-1.onrender.com`

---

## 1️⃣ **HEALTH CHECK** (30 seconds)
```bash
curl https://moe-backend-enhanced-1.onrender.com/health
```
**Expected Response:**
```json
{
  "status": "healthy",
  "database": "connected",
  "knowledge_base": "12 documents loaded"
}
```

---

## 2️⃣ **CREATE USER** (1 minute)
```bash
curl -X POST https://moe-backend-enhanced-1.onrender.com/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "client@mozaik.com",
    "password": "SecurePass123",
    "name": "Client Test"
  }'
```
**Save the `token` from response!**

---

## 3️⃣ **TEST CHAT** (1 minute)
```bash
curl -X POST https://moe-backend-enhanced-1.onrender.com/api/chat/simple \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{"message": "Hello Moe! Help me with Mozaik software."}'
```

**Expected Response:**
```json
{
  "message": "Simple chat response generated successfully",
  "response": {
    "content": "Hello! I'm Moe, your AI assistant specialized in Mozaik software...",
    "model": "gpt-4o-mini",
    "tokens_used": 49
  }
}
```

---

## 4️⃣ **CHECK KNOWLEDGE BASE** (30 seconds)
```bash
curl https://moe-backend-enhanced-1.onrender.com/api/knowledge/status
```

**Expected Response:**
```json
{
  "status": "ready",
  "total_documents": 12,
  "scraping_enabled": true,
  "last_updated": "2025-08-09"
}
```

---

## 🎯 **SUCCESS CRITERIA**

✅ All 4 tests return successful responses  
✅ Chat responds with Mozaik-specialized content  
✅ Knowledge base shows 12+ documents  
✅ No "route not found" errors  

---

## 📋 **POSTMAN COLLECTION**

Import: **`Moe_Final_API_Collection.json`**

**Base URL:** `https://moe-backend-enhanced-1.onrender.com`

---

## 🔗 **FRONTEND INTEGRATION**

```javascript
const API_URL = 'https://moe-backend-enhanced-1.onrender.com';

// 1. Sign up user
const response = await fetch(`${API_URL}/api/auth/signup`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'SecurePass123',
    name: 'User Name'
  })
});

const { token } = await response.json();

// 2. Chat with Moe
const chatResponse = await fetch(`${API_URL}/api/chat/simple`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    message: 'Hello Moe!'
  })
});

const chat = await chatResponse.json();
console.log(chat.response.content);
```

---

## ✅ **READY FOR PRODUCTION!**

Your Moe backend is **100% operational** and ready for client use! 🎉 