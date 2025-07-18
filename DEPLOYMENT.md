# Deployment Guide for Moe Command Console Backend

## Prerequisites

1. **GitHub Repository**: Ensure your code is pushed to GitHub
2. **Render Account**: Sign up at [render.com](https://render.com)
3. **Environment Variables**: Prepare your production environment variables

## Step-by-Step Deployment

### 1. Prepare Your Repository

Ensure your repository contains:
- ✅ `package.json` with correct scripts
- ✅ `render.yaml` for Render configuration
- ✅ `src/` directory with TypeScript source
- ✅ `uploads/.gitkeep` file
- ✅ `.gitignore` excluding sensitive files

### 2. Deploy to Render

1. **Login to Render Dashboard**
2. **Click "New +" → "Web Service"**
3. **Connect your GitHub repository**
4. **Configure the service:**

   **Basic Settings:**
   - **Name**: `moe-command-console-backend`
   - **Environment**: `Node`
   - **Region**: Choose closest to your users
   - **Branch**: `main` (or your default branch)
   - **Root Directory**: Leave empty (if backend is in root)

   **Build & Deploy:**
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Health Check Path**: `/health`

### 3. Environment Variables

Set these in Render dashboard under "Environment":

```env
NODE_ENV=production
PORT=10000
JWT_SECRET=your-super-secure-production-jwt-secret
FRONTEND_URL=https://your-frontend-app.onrender.com
MAX_FILE_SIZE=10485760
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

**Important Notes:**
- Generate a strong JWT_SECRET (use a password generator)
- Update FRONTEND_URL to your actual frontend URL
- PORT should be 10000 for Render free tier

### 4. Advanced Settings

**Disk:**
- **Name**: `uploads`
- **Mount Path**: `/opt/render/project/src/uploads`
- **Size**: 1 GB

**Auto-Deploy:**
- Enable auto-deploy from your main branch

### 5. Deploy

Click "Create Web Service" and wait for deployment.

## Post-Deployment

### 1. Verify Deployment

1. **Check Health Endpoint**: Visit `https://your-app.onrender.com/health`
2. **Test API Endpoints**: Use Postman or curl to test your endpoints
3. **Check Logs**: Monitor logs in Render dashboard

### 2. Update Frontend

Update your frontend's API base URL to point to your Render backend:
```javascript
const API_BASE_URL = 'https://your-backend-app.onrender.com';
```

### 3. Test File Uploads

Test file upload functionality to ensure the uploads directory works correctly.

## Troubleshooting

### Common Issues

1. **Build Fails**
   - Check Node.js version compatibility
   - Verify all dependencies are in package.json
   - Check TypeScript compilation errors

2. **Start Fails**
   - Verify start command in package.json
   - Check environment variables are set
   - Review logs for specific errors

3. **Health Check Fails**
   - Ensure /health endpoint returns 200
   - Check if server is listening on correct port

4. **CORS Errors**
   - Verify FRONTEND_URL is set correctly
   - Check CORS configuration in index.ts

### Useful Commands

```bash
# Test locally before deployment
npm run build
npm start

# Check if all files are committed
git status

# Verify package.json scripts
cat package.json | grep -A 10 '"scripts"'
```

## Security Checklist

- [ ] JWT_SECRET is strong and unique
- [ ] NODE_ENV is set to production
- [ ] CORS is configured for your frontend domain
- [ ] Rate limiting is enabled
- [ ] File upload size limits are set
- [ ] Environment variables are not in code

## Monitoring

- **Health Checks**: Monitor `/health` endpoint
- **Logs**: Check Render dashboard logs regularly
- **Performance**: Monitor response times and errors
- **File Storage**: Monitor disk usage for uploads

## Next Steps

1. **Database Integration**: Replace in-memory storage with a database
2. **Cloud Storage**: Use AWS S3 or similar for file storage
3. **Logging**: Implement proper logging with Winston
4. **Monitoring**: Add application monitoring
5. **SSL**: Ensure HTTPS is working correctly 