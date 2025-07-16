# Backend Build & Deployment Guide

## 🔍 Checking if Backend is Building

### 1. **Quick Build Check**
```bash
npm run build
```
- ✅ **Success**: No errors, `dist/` folder created with compiled JavaScript files
- ❌ **Failure**: TypeScript compilation errors will be displayed

### 2. **Development Server Check**
```bash
npm run dev
```
- Should start nodemon and watch for file changes
- Check console for any startup errors

### 3. **Production Start Check**
```bash
npm run build && npm start
```
- Tests the complete production flow

### 4. **Common Build Issues & Solutions**

#### TypeScript Errors
- Check `tsconfig.json` configuration
- Ensure all imports have proper types
- Run `npm run lint` to check for code issues

#### Missing Dependencies
- Run `npm install` to ensure all packages are installed
- Check for peer dependency warnings

#### Port Conflicts
- Ensure PORT environment variable is set correctly
- Default port is 5000 for development

## 🚀 Deploying to Render

### Step 1: Prepare Your Repository

1. **Ensure your code is in a Git repository**
```bash
git add .
git commit -m "Prepare for Render deployment"
git push origin main
```

2. **Verify build works locally**
```bash
npm run build
npm start
```

### Step 2: Render Configuration

Your project now includes a `render.yaml` file for automatic configuration.

**Key files for deployment:**
- `package.json` - Contains build and start scripts
- `render.yaml` - Render service configuration
- `dist/` - Compiled JavaScript (created by build)

### Step 3: Deploy on Render

1. **Go to [Render Dashboard](https://dashboard.render.com)**

2. **Create New Web Service**
   - Click "New +"
   - Select "Web Service"
   - Connect your GitHub repository

3. **Configuration Settings:**
   ```
   Name: vm-visa-backend
   Environment: Node
   Region: Select closest to your users
   Branch: main
   Build Command: npm install && npm run build
   Start Command: npm start
   ```

4. **Environment Variables (Critical!):**
   Set these in Render dashboard:
   ```
   NODE_ENV=production
   PORT=5000 (Render will override this)
   MONGODB_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret
   FRONTEND_URL=your_frontend_url
   EMAIL_USER=your_email
   EMAIL_PASS=your_email_password
   STRIPE_SECRET_KEY=your_stripe_key
   CLOUDINARY_CLOUD_NAME=your_cloudinary_name
   CLOUDINARY_API_KEY=your_cloudinary_key
   CLOUDINARY_API_SECRET=your_cloudinary_secret
   ```

### Step 4: Monitor Deployment

1. **Check Build Logs**
   - Render will show real-time build logs
   - Look for any errors during npm install or build

2. **Check Deploy Logs**
   - Monitor server startup
   - Verify database connections
   - Check for any runtime errors

3. **Test Health Endpoint**
   - Visit: `https://your-app.onrender.com/api/health`
   - Should return: `{"status":"OK","timestamp":"...","uptime":...}`

4. **Test Root Endpoint**
   - Visit: `https://your-app.onrender.com/`
   - Should return API information and available endpoints

5. **Test API Info Endpoint**
   - Visit: `https://your-app.onrender.com/api`
   - Should return list of all available API endpoints

### Step 5: Common Deployment Issues & Solutions

#### Build Failures
- **Issue**: TypeScript compilation errors
- **Solution**: Fix errors locally first, test with `npm run build`

#### Environment Variables
- **Issue**: Missing or incorrect environment variables
- **Solution**: Double-check all required env vars in Render dashboard

#### Database Connection
- **Issue**: Cannot connect to MongoDB
- **Solution**: Ensure MONGODB_URI is correct and database accepts connections

#### CORS Issues
- **Issue**: Frontend cannot connect to backend
- **Solution**: Update FRONTEND_URL environment variable

#### Cold Starts
- **Issue**: First request takes long time
- **Solution**: Normal for free tier, consider paid plans for better performance

#### "Not found" Error at Root
- **Issue**: `{"success":false,"error":"Not found - /"}` when visiting root URL
- **Solution**: ✅ **Fixed!** Root route now shows API information
- **Test**: Visit `https://your-app.onrender.com/` - should show API endpoints

#### API Endpoints Not Working
- **Issue**: 404 errors on API calls
- **Solution**: Ensure all API calls include `/api` prefix
- **Example**: Use `/api/auth/login` not `/auth/login`

### Step 6: Continuous Deployment

- **Auto-deploy**: Render automatically deploys when you push to main branch
- **Manual deploy**: Use "Manual Deploy" button in Render dashboard
- **Rollback**: Use previous deployment from Render dashboard

## 🔧 Local Development vs Production

### Development (npm run dev)
- Uses nodemon for hot reload
- TypeScript files run directly via ts-node
- Development environment variables

### Production (npm start)
- Uses compiled JavaScript from dist/
- No hot reload
- Production environment variables
- Better performance and security

## 📋 Pre-Deployment Checklist

- [ ] Code builds successfully (`npm run build`)
- [ ] All tests pass (`npm test`)
- [ ] Environment variables documented
- [ ] Database connection string ready
- [ ] Frontend URL configured
- [ ] CORS origins set correctly
- [ ] Git repository up to date
- [ ] Health endpoint working
- [ ] Error handling implemented
- [ ] Logging configured

## 🔗 Useful Commands

```bash
# Build check
npm run build

# Development server
npm run dev

# Production simulation
npm run build && npm start

# Run tests
npm test

# Code linting
npm run lint

# Database seeding (if needed)
npm run seed
```

## 📞 Support

If deployment fails:
1. Check Render build/deploy logs
2. Verify all environment variables
3. Test build locally first
4. Check database connectivity
5. Review CORS configuration

## 🌐 Frontend Environment Variables (VITE_API_URL)

When deploying your frontend, you need to configure `VITE_API_URL` to point to your backend:

### Development (Local)
In your `frontend/.env` file:
```env
VITE_API_URL=http://localhost:5000/api
```

### Production (After Backend Deployed to Render)
In your `frontend/.env.production` or build settings:
```env
VITE_API_URL=https://your-backend-app-name.onrender.com/api
```

**Important Notes:**
- Replace `your-backend-app-name` with your actual Render service name
- The `/api` suffix is important as all your backend routes are prefixed with `/api`
- For Netlify/Vercel frontend deployment, set this in their environment variables section

**Example with actual Render URL:**
```env
VITE_API_URL=https://vm-visa-backend-abc123.onrender.com/api
```
