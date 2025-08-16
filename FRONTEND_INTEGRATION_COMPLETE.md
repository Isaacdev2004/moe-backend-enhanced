# 🚀 MOE FRONTEND INTEGRATION - COMPLETE GUIDE

## **📋 PREREQUISITES**
- Your React/Vite frontend project ready
- Backend deployed at: `https://moe-backend-enhanced-1.onrender.com`
- Environment variables configured

---

## **🔧 STEP 1: ENVIRONMENT SETUP**

### **Create `.env` file in your frontend:**
```bash
# Frontend Environment Variables
VITE_API_BASE_URL=https://moe-backend-enhanced-1.onrender.com
VITE_STRIPE_PUBLIC_KEY=pk_test_your_stripe_key_here
VITE_APP_NAME=Moe - Your Mozaik Expert
```

---

## **🔗 STEP 2: API SERVICE LAYER**

### **Create `src/services/api.js`:**
```javascript
const API_BASE = import.meta.env.VITE_API_BASE_URL;

// Helper function to get auth token
const getToken = () => localStorage.getItem('moe_token');

// Helper function to handle API responses
const handleResponse = async (response) => {
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `HTTP ${response.status}`);
  }
  return response.json();
};

export const api = {
  // Authentication
  login: async (email, password) => {
    const response = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await handleResponse(response);
    localStorage.setItem('moe_token', data.token);
    return data;
  },

  signup: async (name, email, password) => {
    const response = await fetch(`${API_BASE}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });
    const data = await handleResponse(response);
    localStorage.setItem('moe_token', data.token);
    return data;
  },

  logout: () => {
    localStorage.removeItem('moe_token');
  },

  // Chat with usage tracking
  sendMessage: async (message, platform = 'mozaik', version = null) => {
    const response = await fetch(`${API_BASE}/api/chat/message`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
      },
      body: JSON.stringify({ message, platform, version })
    });
    return handleResponse(response);
  },

  // File upload (paid only)
  uploadFile: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch(`${API_BASE}/api/specialized/upload`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${getToken()}` },
      body: formData
    });
    return handleResponse(response);
  },

  // Usage tracking
  getUsage: async () => {
    const response = await fetch(`${API_BASE}/api/usage`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    return handleResponse(response);
  },

  // Voting system
  vote: async (answerId, vote, reason = null) => {
    const response = await fetch(`${API_BASE}/api/votes/${answerId}/vote`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
      },
      body: JSON.stringify({ vote, reason })
    });
    return handleResponse(response);
  },

  // Get plans
  getPlans: async () => {
    const response = await fetch(`${API_BASE}/api/plans`);
    return handleResponse(response);
  },

  // Health check
  health: async () => {
    const response = await fetch(`${API_BASE}/health`);
    return handleResponse(response);
  }
};
```

---

## **🔐 STEP 3: AUTHENTICATION CONTEXT**

### **Create `src/contexts/AuthContext.jsx`:**
```jsx
import { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [usage, setUsage] = useState(null);

  // Check if user is logged in on mount
  useEffect(() => {
    const token = localStorage.getItem('moe_token');
    if (token) {
      // You could verify the token here
      setUser({ token }); // Simplified for now
    }
    setLoading(false);
  }, []);

  // Load usage stats when user changes
  useEffect(() => {
    if (user) {
      loadUsage();
    }
  }, [user]);

  const loadUsage = async () => {
    try {
      const usageData = await api.getUsage();
      setUsage(usageData);
    } catch (error) {
      console.error('Failed to load usage:', error);
    }
  };

  const login = async (email, password) => {
    try {
      const data = await api.login(email, password);
      setUser(data.user);
      return data;
    } catch (error) {
      throw error;
    }
  };

  const signup = async (name, email, password) => {
    try {
      const data = await api.signup(name, email, password);
      setUser(data.user);
      return data;
    } catch (error) {
      throw error;
    }
  };

  const logout = () => {
    api.logout();
    setUser(null);
    setUsage(null);
  };

  const value = {
    user,
    usage,
    loading,
    login,
    signup,
    logout,
    loadUsage
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
```

---

## **💬 STEP 4: ENHANCED CHAT COMPONENT**

### **Create `src/components/ChatInterface.jsx`:**
```jsx
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import VoteButtons from './VoteButtons';
import UsageIndicator from './UsageIndicator';
import UpgradePrompt from './UpgradePrompt';

export default function ChatInterface() {
  const { user, usage, loadUsage } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = { role: 'user', content: input, timestamp: new Date() };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await api.sendMessage(input);
      
      const assistantMessage = {
        role: 'assistant',
        content: response.response,
        model: response.model_used,
        answerId: response.answer_id,
        upgradeBlurb: response.upgrade_blurb,
        usage: response.usage,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
      
      // Update usage stats
      if (response.usage) {
        loadUsage();
      }

    } catch (error) {
      console.error('Failed to send message:', error);
      
      const errorMessage = {
        role: 'system',
        content: error.message === 'HTTP 402' 
          ? 'You\'ve reached your daily limit. Upgrade to continue chatting!'
          : 'Failed to send message. Please try again.',
        isError: true,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const isLimitReached = usage?.usage?.daily?.remaining === 0;

  return (
    <div className="chat-interface">
      {/* Usage Indicator */}
      <UsageIndicator usage={usage} />

      {/* Messages */}
      <div className="messages-container">
        {messages.length === 0 ? (
          <div className="empty-state">
            <h3>Welcome to Moe!</h3>
            <p>Ask me anything about Mozaik software. I can help with:</p>
            <ul>
              <li>File parsing and diagnostics</li>
              <li>Step-by-step tutorials</li>
              <li>Error troubleshooting</li>
              <li>Best practices</li>
            </ul>
          </div>
        ) : (
          messages.map((message, index) => (
            <div key={index} className={`message ${message.role}`}>
              <div className="message-content">
                {message.content}
              </div>
              
              {message.model && (
                <div className="message-meta">
                  <span className="model-badge">{message.model}</span>
                  {message.model === 'cache' && (
                    <span className="cache-badge">From Knowledge Base</span>
                  )}
                </div>
              )}

              {message.answerId && (
                <VoteButtons answerId={message.answerId} />
              )}

              {message.upgradeBlurb && (
                <UpgradePrompt message={message.upgradeBlurb} />
              )}

              {message.isError && (
                <div className="error-message">
                  {message.content}
                </div>
              )}
            </div>
          ))
        )}
        
        {loading && (
          <div className="message assistant">
            <div className="loading-indicator">
              <div className="typing-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="input-container">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={isLimitReached 
            ? "Daily limit reached. Upgrade to continue..." 
            : "Ask Moe anything about Mozaik..."
          }
          disabled={isLimitReached || loading}
          rows={1}
          className="message-input"
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim() || loading || isLimitReached}
          className="send-button"
        >
          Send
        </button>
      </div>
    </div>
  );
}
```

---

## **🗳️ STEP 5: VOTING COMPONENT**

### **Create `src/components/VoteButtons.jsx`:**
```jsx
import { useState } from 'react';
import { api } from '../services/api';

export default function VoteButtons({ answerId }) {
  const [vote, setVote] = useState(null);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ ups: 0, downs: 0 });

  const handleVote = async (voteType) => {
    if (loading) return;
    
    setLoading(true);
    try {
      const response = await api.vote(answerId, voteType);
      setVote(voteType);
      setStats(response.score);
    } catch (error) {
      console.error('Vote failed:', error);
      alert('Failed to record vote. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="vote-buttons">
      <button
        onClick={() => handleVote('up')}
        disabled={loading}
        className={`vote-btn up ${vote === 'up' ? 'active' : ''}`}
        title="This answer was helpful"
      >
        👍 {stats.ups}
      </button>
      
      <button
        onClick={() => handleVote('down')}
        disabled={loading}
        className={`vote-btn down ${vote === 'down' ? 'active' : ''}`}
        title="This answer was not helpful"
      >
        👎 {stats.downs}
      </button>
      
      {loading && <span className="vote-loading">...</span>}
    </div>
  );
}
```

---

## **📊 STEP 6: USAGE INDICATOR**

### **Create `src/components/UsageIndicator.jsx`:**
```jsx
export default function UsageIndicator({ usage }) {
  if (!usage) return null;

  const { plan, usage: usageData } = usage;
  const dailyPercent = (usageData.daily.used / usageData.daily.limit) * 100;
  const monthlyPercent = (usageData.monthly.used / usageData.monthly.limit) * 100;

  return (
    <div className="usage-indicator">
      <div className="usage-header">
        <span className="plan-name">{plan.name} Plan</span>
        <span className="plan-price">{plan.price}</span>
      </div>
      
      <div className="usage-bars">
        <div className="usage-bar">
          <div className="usage-label">Daily</div>
          <div className="usage-progress">
            <div 
              className="usage-fill daily" 
              style={{ width: `${Math.min(dailyPercent, 100)}%` }}
            ></div>
          </div>
          <div className="usage-text">
            {usageData.daily.used}/{usageData.daily.limit}
          </div>
        </div>
        
        <div className="usage-bar">
          <div className="usage-label">Monthly</div>
          <div className="usage-progress">
            <div 
              className="usage-fill monthly" 
              style={{ width: `${Math.min(monthlyPercent, 100)}%` }}
            ></div>
          </div>
          <div className="usage-text">
            {usageData.monthly.used}/{usageData.monthly.limit}
          </div>
        </div>
      </div>
      
      {dailyPercent >= 80 && (
        <div className="usage-warning">
          ⚠️ Daily limit almost reached. Consider upgrading.
        </div>
      )}
    </div>
  );
}
```

---

## **⬆️ STEP 7: UPGRADE PROMPT**

### **Create `src/components/UpgradePrompt.jsx`:**
```jsx
export default function UpgradePrompt({ message }) {
  const handleUpgrade = () => {
    // Navigate to pricing page or open upgrade modal
    window.location.href = '/pricing';
  };

  return (
    <div className="upgrade-prompt">
      <div className="upgrade-content">
        <div className="upgrade-icon">🚀</div>
        <div className="upgrade-text">
          <p>{message}</p>
        </div>
        <button onClick={handleUpgrade} className="upgrade-button">
          Upgrade Now
        </button>
      </div>
    </div>
  );
}
```

---

## **📁 STEP 8: FILE UPLOAD COMPONENT**

### **Create `src/components/FileUpload.jsx`:**
```jsx
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';

export default function FileUpload({ onUploadComplete }) {
  const { usage } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const plan = usage?.plan?.current || 'free';
  const canUpload = plan !== 'free';

  const handleUpload = async (file) => {
    if (!canUpload) {
      alert('Upgrade to Pro for file parsing and diagnostics. Pro analyzes .cab, .cabx, .mzb, and .xml with step-by-step fix plans.');
      return;
    }

    setUploading(true);
    try {
      const response = await api.uploadFile(file);
      onUploadComplete?.(response);
    } catch (error) {
      console.error('Upload failed:', error);
      if (error.message.includes('402')) {
        alert('Upgrade required for file upload.');
      } else {
        alert('Upload failed. Please try again.');
      }
    } finally {
      setUploading(false);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleUpload(e.target.files[0]);
    }
  };

  return (
    <div className="file-upload">
      <div
        className={`upload-area ${dragActive ? 'drag-active' : ''} ${!canUpload ? 'disabled' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        {!canUpload ? (
          <div className="upload-locked">
            <div className="lock-icon">🔒</div>
            <h3>File Upload Locked</h3>
            <p>Upgrade to Pro for file parsing and diagnostics</p>
            <button 
              onClick={() => window.location.href = '/pricing'}
              className="upgrade-btn"
            >
              Upgrade Now
            </button>
          </div>
        ) : (
          <div className="upload-content">
            <div className="upload-icon">📁</div>
            <h3>Upload Mozaik File</h3>
            <p>Drag & drop or click to select</p>
            <p className="file-types">Supported: .cab, .cabx, .mzb, .xml, .moz, .dat, .des</p>
            
            <input
              type="file"
              accept=".cab,.cabx,.mzb,.xml,.moz,.dat,.des"
              onChange={handleFileSelect}
              disabled={uploading}
              className="file-input"
            />
            
            {uploading && (
              <div className="upload-progress">
                <div className="spinner"></div>
                <span>Analyzing file...</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

---

## **🎨 STEP 9: CSS STYLES**

### **Create `src/styles/components.css`:**
```css
/* Chat Interface */
.chat-interface {
  display: flex;
  flex-direction: column;
  height: 100vh;
  max-width: 800px;
  margin: 0 auto;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.1);
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.message {
  margin-bottom: 20px;
  padding: 12px 16px;
  border-radius: 12px;
  max-width: 80%;
}

.message.user {
  background: #007AFF;
  color: white;
  margin-left: auto;
}

.message.assistant {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
}

.message.system {
  background: #fff3cd;
  border: 1px solid #ffeaa7;
  color: #856404;
}

.message-meta {
  margin-top: 8px;
  font-size: 12px;
  opacity: 0.7;
}

.model-badge {
  background: #28a745;
  color: white;
  padding: 2px 6px;
  border-radius: 4px;
  margin-right: 8px;
}

.cache-badge {
  background: #17a2b8;
  color: white;
  padding: 2px 6px;
  border-radius: 4px;
}

/* Input */
.input-container {
  padding: 20px;
  border-top: 1px solid #e9ecef;
  display: flex;
  gap: 12px;
}

.message-input {
  flex: 1;
  padding: 12px 16px;
  border: 1px solid #e9ecef;
  border-radius: 24px;
  resize: none;
  font-family: inherit;
}

.send-button {
  padding: 12px 24px;
  background: #007AFF;
  color: white;
  border: none;
  border-radius: 24px;
  cursor: pointer;
  font-weight: 600;
}

.send-button:disabled {
  background: #6c757d;
  cursor: not-allowed;
}

/* Vote Buttons */
.vote-buttons {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.vote-btn {
  padding: 6px 12px;
  border: 1px solid #e9ecef;
  background: white;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.vote-btn.active {
  background: #007AFF;
  color: white;
  border-color: #007AFF;
}

.vote-btn:hover:not(.active) {
  background: #f8f9fa;
}

/* Usage Indicator */
.usage-indicator {
  padding: 16px 20px;
  background: #f8f9fa;
  border-bottom: 1px solid #e9ecef;
}

.usage-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 12px;
}

.plan-name {
  font-weight: 600;
}

.plan-price {
  color: #6c757d;
}

.usage-bars {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.usage-bar {
  display: flex;
  align-items: center;
  gap: 12px;
}

.usage-label {
  width: 60px;
  font-size: 12px;
  color: #6c757d;
}

.usage-progress {
  flex: 1;
  height: 6px;
  background: #e9ecef;
  border-radius: 3px;
  overflow: hidden;
}

.usage-fill {
  height: 100%;
  transition: width 0.3s;
}

.usage-fill.daily {
  background: #28a745;
}

.usage-fill.monthly {
  background: #007AFF;
}

.usage-text {
  font-size: 12px;
  color: #6c757d;
  width: 60px;
  text-align: right;
}

.usage-warning {
  margin-top: 8px;
  padding: 8px 12px;
  background: #fff3cd;
  border: 1px solid #ffeaa7;
  border-radius: 6px;
  font-size: 12px;
  color: #856404;
}

/* Upgrade Prompt */
.upgrade-prompt {
  margin-top: 12px;
  padding: 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  color: white;
}

.upgrade-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.upgrade-icon {
  font-size: 24px;
}

.upgrade-text {
  flex: 1;
  font-size: 14px;
}

.upgrade-button {
  padding: 8px 16px;
  background: white;
  color: #667eea;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
}

/* File Upload */
.file-upload {
  margin: 20px 0;
}

.upload-area {
  border: 2px dashed #e9ecef;
  border-radius: 12px;
  padding: 40px;
  text-align: center;
  transition: all 0.3s;
  cursor: pointer;
}

.upload-area.drag-active {
  border-color: #007AFF;
  background: #f8f9ff;
}

.upload-area.disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.upload-locked {
  color: #6c757d;
}

.lock-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.upload-content {
  color: #6c757d;
}

.upload-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.file-types {
  font-size: 12px;
  margin-top: 8px;
}

.file-input {
  display: none;
}

.upload-progress {
  margin-top: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid #e9ecef;
  border-top: 2px solid #007AFF;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* Loading Animation */
.loading-indicator {
  padding: 20px;
  text-align: center;
}

.typing-dots {
  display: inline-flex;
  gap: 4px;
}

.typing-dots span {
  width: 8px;
  height: 8px;
  background: #6c757d;
  border-radius: 50%;
  animation: typing 1.4s infinite ease-in-out;
}

.typing-dots span:nth-child(1) { animation-delay: -0.32s; }
.typing-dots span:nth-child(2) { animation-delay: -0.16s; }

@keyframes typing {
  0%, 80%, 100% { transform: scale(0.8); opacity: 0.5; }
  40% { transform: scale(1); opacity: 1; }
}
```

---

## **🚀 STEP 10: MAIN APP INTEGRATION**

### **Update your `src/App.jsx`:**
```jsx
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ChatInterface from './components/ChatInterface';
import FileUpload from './components/FileUpload';
import Login from './components/Login';
import Signup from './components/Signup';
import Pricing from './components/Pricing';
import './styles/components.css';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="app">
          <Routes>
            <Route path="/" element={<ChatInterface />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/pricing" element={<Pricing />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
```

---

## **✅ STEP 11: TESTING CHECKLIST**

### **Backend Tests:**
- [ ] `GET /health` - Should return healthy status
- [ ] `GET /api/plans` - Should return plan tiers
- [ ] `POST /api/auth/signup` - Should create user
- [ ] `POST /api/auth/login` - Should return token
- [ ] `GET /api/usage` - Should return usage stats (with auth)
- [ ] `POST /api/chat/message` - Should return response (with auth)

### **Frontend Tests:**
- [ ] Login/signup flow works
- [ ] Chat interface loads
- [ ] Messages send and receive
- [ ] Usage indicator shows correctly
- [ ] File upload is blocked for free tier
- [ ] Voting buttons work
- [ ] Upgrade prompts appear
- [ ] Responsive design works

---

## **🎯 DEPLOYMENT**

1. **Deploy Frontend** to Vercel/Netlify
2. **Set Environment Variables** in deployment platform
3. **Test All Features** in production
4. **Monitor Usage** and performance

**Your full-stack Moe application is now ready!** 🚀 