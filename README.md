# Moe Command Console Backend

A Node.js/Express backend with TypeScript for the Moe Command Console web application.

## Features

- 🔐 JWT Authentication
- 📁 File Upload Support
- 🛡️ Security Middleware (Helmet, CORS, Rate Limiting)
- 📝 Input Validation
- 🔄 TypeScript Support
- 🚀 Production Ready

## Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Create environment file:
```bash
cp env.example .env
```

3. Update `.env` with your configuration:
```env
PORT=3001
NODE_ENV=development
JWT_SECRET=your-super-secret-jwt-key
FRONTEND_URL=http://localhost:5173
```

4. Create uploads directory:
```bash
mkdir uploads
```

5. Start development server:
```bash
npm run dev
```

The server will start on `http://localhost:3001`

## API Endpoints

### Authentication
- `POST /api/auth/signup` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user (protected)

### File Upload
- `POST /api/upload/single` - Upload single file (protected)
- `POST /api/upload/multiple` - Upload multiple files (protected)
- `GET /api/upload/files` - Get user's files (protected)
- `DELETE /api/upload/files/:fileId` - Delete file (protected)

### General API
- `GET /api/status` - Application status
- `GET /api/protected` - Protected route example
- `GET /api/profile` - Get user profile (protected)
- `PUT /api/profile` - Update user profile (protected)
- `GET /api/data` - Sample data (protected)

### Health Check
- `GET /health` - Health check endpoint

## Deployment to Render

### 1. Prepare for Deployment

1. Build the application:
```bash
npm run build
```

2. Ensure your `package.json` has the correct scripts:
```json
{
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js"
  }
}
```

### 2. Deploy to Render

1. **Connect Repository**: Link your GitHub repository to Render

2. **Create Web Service**:
   - **Name**: `moe-command-console-backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`

3. **Environment Variables** (in Render dashboard):
   ```
   NODE_ENV=production
   PORT=10000
   JWT_SECRET=your-production-jwt-secret
   FRONTEND_URL=https://your-frontend-url.onrender.com
   ```

4. **Advanced Settings**:
   - **Auto-Deploy**: Enabled
   - **Health Check Path**: `/health`

### 3. Environment Variables for Production

Set these in your Render dashboard:

```env
NODE_ENV=production
PORT=10000
JWT_SECRET=your-super-secure-production-jwt-secret
FRONTEND_URL=https://your-frontend-app.onrender.com
```

## Development

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm test` - Run tests (placeholder)

### Project Structure

```
backend/
├── src/
│   ├── routes/
│   │   ├── auth.ts      # Authentication routes
│   │   ├── upload.ts    # File upload routes
│   │   └── api.ts       # General API routes
│   └── index.ts         # Main server file
├── uploads/             # File upload directory
├── dist/               # Compiled JavaScript
├── package.json
├── tsconfig.json
└── env.example
```

## Security Features

- **Helmet**: Security headers
- **CORS**: Cross-origin resource sharing
- **Rate Limiting**: Request throttling
- **Input Validation**: Request data validation
- **JWT Authentication**: Secure token-based auth
- **File Upload Security**: File type and size validation

## Error Handling

The application includes comprehensive error handling:
- Global error middleware
- Input validation errors
- Authentication errors
- File upload errors

## Production Considerations

1. **Database**: Replace in-memory storage with a proper database
2. **File Storage**: Use cloud storage (AWS S3, etc.) instead of local files
3. **Logging**: Implement proper logging (Winston, etc.)
4. **Monitoring**: Add health checks and monitoring
5. **SSL**: Ensure HTTPS in production
6. **Environment Variables**: Use secure environment variables

## Troubleshooting

### Common Issues

1. **Port already in use**: Change PORT in .env
2. **CORS errors**: Update FRONTEND_URL in .env
3. **JWT errors**: Ensure JWT_SECRET is set
4. **File upload fails**: Check uploads directory exists

### Render Deployment Issues

1. **Build fails**: Check Node.js version compatibility
2. **Start fails**: Verify start command in package.json
3. **Health check fails**: Ensure /health endpoint works
4. **Environment variables**: Check all required vars are set

## Support

For issues and questions, please check the logs in your Render dashboard or local console output. 