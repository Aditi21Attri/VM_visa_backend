# Environment Variables Reference

## 🔧 Backend Environment Variables (for Render)

Set these in your Render dashboard when deploying the backend:

```env
# Basic Configuration
NODE_ENV=production
PORT=5000

# Database
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database-name

# Authentication
JWT_SECRET=your-super-secret-jwt-key-here-make-it-long-and-random

# CORS & Frontend
FRONTEND_URL=https://your-frontend-domain.netlify.app

# Email Service (for notifications)
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-specific-password

# Payment Processing
STRIPE_SECRET_KEY=sk_test_... (or sk_live_... for production)

# File Upload (Cloudinary)
CLOUDINARY_CLOUD_NAME=your-cloudinary-cloud-name
CLOUDINARY_API_KEY=your-cloudinary-api-key
CLOUDINARY_API_SECRET=your-cloudinary-api-secret
```

## 🖥️ Frontend Environment Variables

### For Local Development (`frontend/.env`)
```env
VITE_API_URL=http://localhost:5000/api
```

### For Production (`frontend/.env.production` or hosting platform)
```env
VITE_API_URL=https://your-backend-name.onrender.com/api
```

## 📋 Where to Set Environment Variables

### Backend (Render)
1. Go to your Render dashboard
2. Select your web service
3. Go to "Environment" tab
4. Add each variable with key-value pairs

### Frontend (Netlify/Vercel)
1. Go to your hosting dashboard
2. Select your site/project
3. Go to "Environment Variables" or "Settings"
4. Add `VITE_API_URL` with your backend URL

## 🔗 Important URLs After Deployment

Once deployed, your URLs will look like:
- **Backend Health Check**: `https://your-backend.onrender.com/api/health`
- **Frontend**: `https://your-frontend.netlify.app`
- **API Base**: `https://your-backend.onrender.com/api`

## 🚨 Security Notes

- **Never commit `.env` files** to version control
- Use **strong, random secrets** for JWT_SECRET
- Use **app-specific passwords** for email services
- Use **test keys** for Stripe in development
- **Restrict CORS origins** to your actual frontend domain

## 🔄 Environment Variable Workflow

1. **Development**: Use `.env` files locally
2. **Staging**: Set staging values in hosting platform
3. **Production**: Set production values in hosting platform
4. **Testing**: Use separate test database and API keys

## 📞 Common Issues

### Backend can't connect to frontend
- Check `FRONTEND_URL` in backend environment
- Verify CORS configuration
- Ensure URLs don't have trailing slashes

### Frontend can't reach backend
- Check `VITE_API_URL` in frontend
- Verify backend is deployed and running
- Test backend health endpoint directly

### Database connection fails
- Verify `MONGODB_URI` format
- Check database whitelist/firewall settings
- Ensure database user has correct permissions
