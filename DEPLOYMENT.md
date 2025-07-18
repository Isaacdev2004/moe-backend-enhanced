# Deployment Guide

This guide will help you deploy your Moe Command Console Backend to GitHub and Render.

## Prerequisites

- GitHub account
- Render account
- Node.js 18+ installed locally

## Step 1: Prepare for GitHub

### 1.1 Initialize Git Repository (if not already done)

```bash
git init
git add .
git commit -m "Initial commit: Moe Command Console Backend"
```

### 1.2 Create GitHub Repository

1. Go to [GitHub](https://github.com) and create a new repository
2. Name it: `moe-command-console-backend`
3. Make it public or private (your choice)
4. Don't initialize with README (we already have one)

### 1.3 Push to GitHub

```bash
git remote add origin https://github.com/YOUR_USERNAME/moe-command-console-backend.git
git branch -M main
git push -u origin main
```

## Step 2: Deploy to Render

### 2.1 Connect to Render

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click "New +" and select "Web Service"
3. Connect your GitHub account if not already connected
4. Select your `moe-command-console-backend` repository

### 2.2 Configure Web Service

**Basic Settings:**
- **Name**: `moe-command-console-backend`
- **Environment**: `Node`
- **Region**: Choose closest to your users
- **Branch**: `main`
- **Root Directory**: Leave empty (root of repo)

**Build & Deploy:**
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm start`
- **Auto-Deploy**: ✅ Enabled

**Health Check:**
- **Health Check Path**: `/health`

### 2.3 Environment Variables

Add these environment variables in Render dashboard:

```
NODE_ENV=production
PORT=10000
JWT_SECRET=your-super-secure-production-jwt-secret-key-here
FRONTEND_URL=https://your-frontend-app.onrender.com
MAX_FILE_SIZE=10485760
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

**Important Notes:**
- Generate a strong JWT_SECRET (you can use: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`)
- Update FRONTEND_URL to your actual frontend URL
- The PORT will be automatically set by Render

### 2.4 Advanced Settings

**Disk:**
- **Name**: `uploads`
- **Mount Path**: `/opt/render/project/src/uploads`
- **Size**: 1 GB

### 2.5 Deploy

Click "Create Web Service" and wait for deployment to complete.

## Step 3: Verify Deployment

### 3.1 Check Health Endpoint

Visit: `https://your-app-name.onrender.com/health`

You should see:
```json
{
  "status": "OK",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "environment": "production",
  "uptime": 123.456
}
```

### 3.2 Test API Endpoints

Use Postman or curl to test:

```bash
# Health check
curl https://your-app-name.onrender.com/health

# Status endpoint
curl https://your-app-name.onrender.com/api/status
```

## Step 4: Update Frontend Configuration

Update your frontend's API base URL to point to your Render deployment:

```javascript
// In your frontend config
const API_BASE_URL = 'https://your-app-name.onrender.com';
```

## Step 5: Continuous Deployment

Every time you push to the `main` branch on GitHub, Render will automatically:
1. Pull the latest code
2. Install dependencies
3. Build the TypeScript
4. Deploy the new version

## Troubleshooting

### Build Failures

1. **Node version issues**: Ensure `engines.node` in package.json is set to `>=18.0.0`
2. **Missing dependencies**: Check all dependencies are in `package.json`
3. **TypeScript errors**: Fix any TypeScript compilation errors locally first

### Runtime Errors

1. **Port issues**: Render sets PORT automatically, don't override it
2. **Environment variables**: Ensure all required env vars are set in Render
3. **File permissions**: The uploads directory should be writable

### Health Check Failures

1. **Endpoint not responding**: Check if `/health` endpoint is working
2. **Server not starting**: Check logs in Render dashboard
3. **Database connection**: If using database, ensure connection string is correct

### Common Issues

1. **CORS errors**: Update FRONTEND_URL in environment variables
2. **JWT errors**: Ensure JWT_SECRET is set and consistent
3. **File upload fails**: Check uploads directory permissions

## Monitoring

### Render Dashboard

- Monitor logs in real-time
- Check deployment status
- View resource usage

### Health Monitoring

The `/health` endpoint provides:
- Server status
- Uptime
- Environment info
- Timestamp

## Security Considerations

1. **JWT Secret**: Use a strong, unique secret
2. **Environment Variables**: Never commit secrets to Git
3. **CORS**: Restrict to your frontend domain only
4. **Rate Limiting**: Already configured in the app
5. **File Uploads**: Validate file types and sizes

## Scaling

For higher traffic:
1. Upgrade to paid Render plan
2. Add database (PostgreSQL, MongoDB)
3. Use cloud storage for files (AWS S3, etc.)
4. Implement caching (Redis)
5. Add load balancing

## Support

- Render Documentation: https://render.com/docs
- GitHub Issues: Create issues in your repository
- Application Logs: Check Render dashboard logs 