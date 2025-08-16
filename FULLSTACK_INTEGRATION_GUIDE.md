# 🚀 MOE FULL-STACK INTEGRATION GUIDE

## **Project Structure Overview**

```
moe-backend-enhanced/
├── backend/                    # Current backend code
│   ├── src/
│   │   ├── config/            # Plans, environment config
│   │   ├── middleware/        # Usage tracking, auth
│   │   ├── models/            # User, AnswerCache, Vote
│   │   ├── routes/            # API endpoints
│   │   ├── services/          # Business logic
│   │   └── utils/             # Canonicalization, helpers
│   ├── package.json
│   └── tsconfig.json
├── frontend/                   # React/Vite frontend
│   ├── src/
│   │   ├── components/        # UI components
│   │   ├── pages/             # Page components
│   │   ├── services/          # API calls
│   │   └── utils/             # Frontend utilities
│   ├── package.json
│   └── vite.config.ts
└── shared/                     # Shared types and utilities
    ├── types/
    └── constants/
```

---

## **🔧 BACKEND ENHANCEMENTS IMPLEMENTED**

### **1. Tiered Plan System**
- **Free**: 5 queries/day, gpt-4o-mini, no file upload
- **Hobbyist**: 100 queries/month, gpt-4o, file upload enabled
- **Professional**: 600 queries/month, gpt-4o, all features
- **Enterprise**: 5000 queries/month, gpt-4o, priority support

### **2. Answer Caching System**
- **Canonicalization**: Normalizes similar questions
- **Platform/Version Awareness**: Mozaik v13 vs v14
- **Quality Gates**: Thumbs up/down voting
- **Auto-Publishing**: High-quality answers become public pages

### **3. Usage Tracking**
- **Daily/Monthly Limits**: Automatic reset
- **Model Routing**: Free vs paid models
- **File Upload Gating**: Restricted for free tier
- **Device Fingerprinting**: Anti-abuse protection

### **4. Enhanced Chat System**
- **Cache-First**: Check cache before generating
- **Fallback Responses**: If RAG fails, use simple OpenAI
- **Upgrade Prompts**: Encourage paid tier upgrades
- **Usage Statistics**: Track tokens, processing time

---

## **🎯 FRONTEND INTEGRATION STEPS**

### **Step 1: Environment Setup**
```bash
# Backend environment variables
OPENAI_API_KEY=your_openai_key
MONGODB_URI=your_mongodb_uri
JWT_SECRET=your_jwt_secret
FRONTEND_URL=http://localhost:3000

# Frontend environment variables
VITE_API_BASE_URL=http://localhost:10000
VITE_STRIPE_PUBLIC_KEY=your_stripe_key
```

### **Step 2: API Integration**
```javascript
// Frontend API service
const API_BASE = import.meta.env.VITE_API_BASE_URL;

export const api = {
  // Authentication
  login: (credentials) => fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials)
  }),

  // Chat with usage tracking
  sendMessage: (message, platform, version) => fetch(`${API_BASE}/api/chat/message`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getToken()}`
    },
    body: JSON.stringify({ message, platform, version })
  }),

  // File upload (paid only)
  uploadFile: (file) => fetch(`${API_BASE}/api/specialized/upload`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${getToken()}` },
    body: new FormData().append('file', file)
  }),

  // Usage tracking
  getUsage: () => fetch(`${API_BASE}/api/usage`, {
    headers: { 'Authorization': `Bearer ${getToken()}` }
  }),

  // Voting system
  vote: (answerId, vote) => fetch(`${API_BASE}/api/votes/${answerId}/vote`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getToken()}`
    },
    body: JSON.stringify({ vote })
  })
};
```

### **Step 3: Component Integration**

#### **Chat Component with Plan Awareness**
```jsx
import { useState, useEffect } from 'react';
import { api } from '../services/api';

export function ChatComponent() {
  const [messages, setMessages] = useState([]);
  const [usage, setUsage] = useState(null);
  const [plan, setPlan] = useState('free');

  useEffect(() => {
    // Get user's usage stats
    api.getUsage().then(res => res.json()).then(setUsage);
  }, []);

  const sendMessage = async (message) => {
    // Add user message
    setMessages(prev => [...prev, { role: 'user', content: message }]);

    try {
      const response = await api.sendMessage(message, 'mozaik', 'v14');
      const data = await response.json();

      if (response.status === 402) {
        // Usage limit reached
        setMessages(prev => [...prev, { 
          role: 'system', 
          content: `Usage limit reached. Upgrade to continue.`,
          upgrade: true 
        }]);
        return;
      }

      // Add assistant response
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: data.response,
        model: data.model_used,
        answerId: data.answer_id,
        upgradeBlurb: data.upgrade_blurb
      }]);

      // Update usage
      setUsage(data.usage);

    } catch (error) {
      setMessages(prev => [...prev, { 
        role: 'system', 
        content: 'Error sending message. Please try again.' 
      }]);
    }
  };

  return (
    <div className="chat-container">
      {/* Messages */}
      {messages.map((msg, i) => (
        <div key={i} className={`message ${msg.role}`}>
          <div className="content">{msg.content}</div>
          {msg.model && <div className="meta">Model: {msg.model}</div>}
          {msg.upgradeBlurb && (
            <div className="upgrade-notice">{msg.upgradeBlurb}</div>
          )}
          {msg.answerId && (
            <VoteButtons answerId={msg.answerId} />
          )}
        </div>
      ))}

      {/* Usage indicator */}
      {usage && (
        <div className="usage-indicator">
          Daily: {usage.daily.used}/{usage.daily.limit}
          Monthly: {usage.monthly.used}/{usage.monthly.limit}
        </div>
      )}

      {/* Input */}
      <MessageInput onSend={sendMessage} disabled={usage?.daily.remaining === 0} />
    </div>
  );
}
```

#### **File Upload with Plan Gating**
```jsx
export function FileUpload({ plan }) {
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (file) => {
    if (plan === 'free') {
      alert('Upgrade to enable file parsing and diagnostics.');
      return;
    }

    setUploading(true);
    try {
      const response = await api.uploadFile(file);
      const data = await response.json();

      if (response.status === 402) {
        alert('Upgrade required for file upload.');
        return;
      }

      // Handle successful upload
      console.log('File uploaded:', data);

    } catch (error) {
      alert('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="file-upload">
      <input
        type="file"
        accept=".cab,.cabx,.mzb,.xml,.moz,.dat,.des"
        onChange={(e) => e.target.files[0] && handleUpload(e.target.files[0])}
        disabled={plan === 'free' || uploading}
      />
      {plan === 'free' && (
        <div className="upgrade-tooltip">
          Upgrade to Pro for file parsing and diagnostics
        </div>
      )}
    </div>
  );
}
```

#### **Voting Component**
```jsx
export function VoteButtons({ answerId }) {
  const [vote, setVote] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleVote = async (voteType) => {
    setLoading(true);
    try {
      const response = await api.vote(answerId, voteType);
      const data = await response.json();
      
      if (response.ok) {
        setVote(voteType);
        // Update UI with new vote counts
      }
    } catch (error) {
      console.error('Vote failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="vote-buttons">
      <button
        onClick={() => handleVote('up')}
        disabled={loading}
        className={vote === 'up' ? 'active' : ''}
      >
        👍
      </button>
      <button
        onClick={() => handleVote('down')}
        disabled={loading}
        className={vote === 'down' ? 'active' : ''}
      >
        👎
      </button>
    </div>
  );
}
```

---

## **🔗 DEPLOYMENT CONFIGURATION**

### **Backend Deployment (Render)**
```yaml
# render.yaml
services:
  - type: web
    name: moe-backend
    env: node
    buildCommand: npm install && npm run build
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: MONGODB_URI
        sync: false
      - key: OPENAI_API_KEY
        sync: false
      - key: JWT_SECRET
        sync: false
      - key: FRONTEND_URL
        value: https://your-frontend-domain.com
```

### **Frontend Deployment (Vercel)**
```json
// vercel.json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "env": {
    "VITE_API_BASE_URL": "https://moe-backend-enhanced-1.onrender.com"
  }
}
```

---

## **🧪 TESTING CHECKLIST**

### **Backend Tests**
- [ ] Authentication flow
- [ ] Usage tracking and limits
- [ ] Plan-based model routing
- [ ] File upload restrictions
- [ ] Answer caching system
- [ ] Voting system
- [ ] Knowledge base integration

### **Frontend Tests**
- [ ] Login/signup flow
- [ ] Chat with usage indicators
- [ ] File upload with plan gating
- [ ] Voting buttons
- [ ] Upgrade prompts
- [ ] Responsive design
- [ ] Error handling

### **Integration Tests**
- [ ] End-to-end chat flow
- [ ] Usage limit enforcement
- [ ] Plan upgrade flow
- [ ] File upload to analysis
- [ ] Caching effectiveness

---

## **📊 MONITORING & ANALYTICS**

### **Key Metrics to Track**
- **Usage Patterns**: Daily/monthly query counts
- **Cache Hit Rate**: Percentage of cached responses
- **Vote Quality**: Up/down vote ratios
- **Plan Conversions**: Free to paid upgrades
- **File Upload Usage**: Paid tier utilization
- **Error Rates**: API failures and timeouts

### **Logging Setup**
```javascript
// Enhanced logging for production
const logger = {
  info: (message, data) => console.log(`[INFO] ${message}`, data),
  error: (message, error) => console.error(`[ERROR] ${message}`, error),
  warn: (message, data) => console.warn(`[WARN] ${message}`, data),
  usage: (userId, plan, action) => console.log(`[USAGE] ${userId} (${plan}) - ${action}`)
};
```

---

## **🎯 NEXT STEPS**

1. **Deploy Backend**: Push enhanced backend to Render
2. **Update Frontend**: Integrate new API endpoints
3. **Test Integration**: Verify all features work together
4. **Monitor Performance**: Track usage and cache effectiveness
5. **Optimize**: Fine-tune based on real usage data

**The enhanced backend is now ready for full-stack integration!** 🚀 