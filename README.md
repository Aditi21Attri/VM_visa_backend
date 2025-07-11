# VM Visa Backend API

## Overview

The VM Visa Backend is a comprehensive Node.js/Express API server that powers the VM Visa immigration services platform. It provides a complete case management system with proposal acceptance workflows, real-time notifications, document management, and user authentication.

## 🏗️ Architecture

### Technology Stack
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT (JSON Web Tokens)
- **File Upload**: Multer
- **Real-time**: Socket.io
- **Validation**: Express Validator
- **Language**: TypeScript

### Project Structure

```
backend/
├── src/
│   ├── config/
│   │   └── database.ts          # MongoDB connection configuration
│   ├── middleware/
│   │   ├── auth.ts              # Authentication & authorization middleware
│   │   ├── errorHandler.ts     # Global error handling middleware
│   │   └── notFound.ts         # 404 not found middleware
│   ├── models/
│   │   ├── Case.ts             # Case management data model
│   │   ├── Document.ts         # Document storage model
│   │   ├── Escrow.ts           # Escrow transaction model
│   │   ├── Message.ts          # Messaging system model
│   │   ├── Notification.ts     # Notification model
│   │   ├── Organization.ts     # Organization model
│   │   ├── Proposal.ts         # Proposal management model
│   │   ├── Review.ts           # Review/rating system model
│   │   ├── User.ts             # User authentication model
│   │   └── VisaRequest.ts      # Visa request model
│   ├── routes/
│   │   ├── admin.ts            # Admin-only endpoints
│   │   ├── auth.ts             # Authentication routes
│   │   ├── cases.ts            # Case management API
│   │   ├── dashboard.ts        # Dashboard statistics
│   │   ├── documents.ts        # Document management API
│   │   ├── escrow.ts           # Escrow transaction API
│   │   ├── messages.ts         # Messaging API
│   │   ├── proposals.ts        # Proposal management API
│   │   ├── reviews.ts          # Review system API
│   │   ├── users.ts            # User management API
│   │   └── visaRequests.ts     # Visa request API
│   ├── services/
│   │   ├── emailService.ts     # Email notification service
│   │   ├── fileUploadService.ts # File upload handling
│   │   ├── notificationService.ts # Real-time notifications
│   │   └── paymentService.ts   # Payment processing
│   ├── sockets/
│   │   └── socketHandler.ts    # Socket.io real-time handlers
│   ├── types/
│   │   └── index.ts            # TypeScript type definitions
│   ├── dev-build.ts            # Development build script
│   └── index.ts                # Main application entry point
├── uploads/                     # File upload storage directory
├── dist/                       # Compiled JavaScript output
├── package.json                # Dependencies and scripts
├── tsconfig.json              # TypeScript configuration
└── .env                       # Environment variables
```

## 🔐 Authentication & Authorization

### User Types
- **Client**: Users seeking visa services
- **Agent**: Immigration agents providing services
- **Organization**: Agencies or companies
- **Admin**: Platform administrators

### Authentication Flow
1. **Registration**: `POST /api/auth/register`
2. **Login**: `POST /api/auth/login`
3. **Profile**: `GET /api/auth/me`
4. **JWT Token**: Included in `Authorization: Bearer <token>` header

### Middleware
- **protect**: Validates JWT token and attaches user to request
- **authorize(roles)**: Restricts access to specific user roles

## 📊 Core Workflows

### 1. Proposal Acceptance Workflow

When a client accepts a proposal, the system executes a comprehensive workflow:

```typescript
// Key endpoint: PUT /api/proposals/:id/accept
```

**Workflow Steps:**
1. **Validation**: Verify proposal exists and user authorization
2. **Transaction Begin**: Start MongoDB transaction for data integrity
3. **Proposal Update**: Mark accepted proposal as 'accepted'
4. **Case Creation**: Create new active case from accepted proposal
5. **Other Proposals**: Mark competing proposals as 'rejected'
6. **Visa Request Update**: Change status from 'pending' to 'in-progress'
7. **Notifications**: Send real-time notifications to all parties
8. **Transaction Commit**: Ensure all changes are saved atomically

**Database Changes:**
- Proposal status: `pending` → `accepted`
- VisaRequest status: `pending` → `in-progress`
- New Case created with milestones
- Other proposals: `pending` → `rejected`

### 2. Case Management System

**Case Lifecycle:**
```
Proposal Accepted → Active Case → Milestone Progress → Completion
```

**Key Features:**
- **Milestone Tracking**: Progress-based project management
- **Document Sharing**: Secure file exchange
- **Timeline Auditing**: Complete activity history
- **Progress Calculation**: Automatic completion percentage
- **Real-time Updates**: Live status synchronization

### 3. Document Management

**Upload Workflow:**
1. **Validation**: File type and size checks
2. **Storage**: Secure local storage with unique naming
3. **Database**: Metadata stored in MongoDB
4. **Permissions**: Role-based access control
5. **Verification**: Admin approval system

**Supported File Types:**
- Images: JPEG, PNG, GIF
- Documents: PDF, DOC, DOCX, TXT
- Size Limit: 10MB (configurable)

## 🗄️ Database Models

### User Model
```typescript
interface IUser {
  name: string;
  email: string;
  password: string;
  userType: 'client' | 'agent' | 'organization' | 'admin';
  isVerified: boolean;
  isActive: boolean;
  // ... additional fields
}
```

### Case Model
```typescript
interface ICase {
  requestId: string;
  clientId: string;
  agentId: string;
  proposalId: string;
  status: 'active' | 'completed' | 'on-hold' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  milestones: ICaseMilestone[];
  totalAmount: number;
  progress: number; // Auto-calculated
  timeline: ICaseTimelineEntry[];
  // ... additional fields
}
```

### Proposal Model
```typescript
interface IProposal {
  requestId: string;
  agentId: string;
  budget: number;
  timeline: string;
  status: 'pending' | 'accepted' | 'rejected';
  milestones: IMilestone[];
  coverLetter: string;
  proposalText: string;
  // ... additional fields
}
```

## 🚀 API Endpoints

### Authentication Routes (`/api/auth`)
- `POST /register` - User registration
- `POST /login` - User login
- `GET /me` - Get current user profile
- `PUT /profile` - Update user profile
- `POST /logout` - User logout

### Case Management (`/api/cases`)
- `GET /` - Get user's cases
- `GET /:id` - Get specific case details
- `PUT /:id/milestone/:milestoneId` - Update milestone status
- `PUT /:id/milestone/:milestoneId/approve` - Approve milestone (client only)
- `POST /:id/timeline` - Add timeline entry
- `POST /:id/documents` - Upload case document

### Proposal Management (`/api/proposals`)
- `GET /` - Get proposals (filtered by user role)
- `POST /` - Create new proposal (agents only)
- `PUT /:id/accept` - Accept proposal (clients only)
- `PUT /:id/reject` - Reject proposal (clients only)
- `GET /:id` - Get proposal details

### Document Management (`/api/documents`)
- `POST /upload` - Upload document
- `GET /` - Get user documents
- `GET /:id` - Get document details
- `GET /:id/download` - Download document
- `PUT /:id` - Update document metadata
- `DELETE /:id` - Delete document
- `PUT /:id/verify` - Verify document (admin only)

### Review System (`/api/reviews`)
- `POST /` - Create review
- `GET /user/:userId` - Get user reviews
- `GET /given` - Get reviews given by user
- `PUT /:id` - Update review
- `DELETE /:id` - Delete review

## 🔧 Configuration

### Environment Variables
```bash
# Server Configuration
NODE_ENV=development
PORT=5000
FRONTEND_URL=http://localhost:8080

# Database
MONGODB_URI=mongodb://localhost:27017/vm-visa

# JWT Authentication
JWT_SECRET=your-secret-key
JWT_EXPIRE=30d

# File Upload
MAX_FILE_SIZE=10485760  # 10MB

# Email Service (Optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_EMAIL=your-email@gmail.com
SMTP_PASSWORD=your-password
```

### Database Connection
```typescript
// src/config/database.ts
import mongoose from 'mongoose';

const connectDB = async () => {
  const conn = await mongoose.connect(process.env.MONGODB_URI!);
  console.log(`MongoDB Connected: ${conn.connection.host}`);
};
```

## 🚦 Development

### Installation
```bash
# Install dependencies
npm install

# Install TypeScript globally (if needed)
npm install -g typescript ts-node nodemon
```

### Scripts
```bash
# Development server with auto-reload
npm run dev

# Build TypeScript to JavaScript
npm run build

# Production server
npm start

# Type checking
npm run lint

# Database seeding
npm run seed
```

### Development Workflow
1. **Start Development Server**: `npm run dev`
2. **Code Changes**: Auto-reloads with nodemon
3. **Testing**: Use Postman or frontend for API testing
4. **Build**: `npm run build` for production

## 🔄 Real-time Features

### Socket.io Integration
```typescript
// Real-time events
io.to(`user_${userId}`).emit('proposalNotification', data);
io.to(`user_${userId}`).emit('caseUpdate', data);
io.to(`user_${userId}`).emit('documentNotification', data);
```

### Notification Types
- **Proposal Updates**: New proposals, acceptance, rejection
- **Case Updates**: Milestone progress, status changes
- **Document Updates**: Upload, verification status
- **Message Notifications**: New messages in case chat

## 🛠️ API Response Format

### Standard Response Structure
```typescript
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// Paginated responses
interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}
```

### Error Handling
- **400**: Bad Request (validation errors)
- **401**: Unauthorized (authentication required)
- **403**: Forbidden (insufficient permissions)
- **404**: Not Found
- **500**: Internal Server Error

## 🔒 Security Features

### Data Protection
- **Password Hashing**: bcryptjs with salt rounds
- **JWT Tokens**: Secure authentication
- **Input Validation**: Express validator sanitization
- **File Upload Security**: Type and size restrictions
- **CORS Configuration**: Cross-origin request handling

### Access Control
- **Role-based Permissions**: User type restrictions
- **Resource Ownership**: Users can only access their data
- **Admin Privileges**: Special access for platform management

## 📈 Performance Considerations

### Database Optimization
- **Indexes**: Strategic indexing on frequently queried fields
- **Aggregation**: Efficient data processing for statistics
- **Pagination**: Limit data transfer with pagination
- **Population**: Selective field population

### Caching Strategy
- **MongoDB Indexes**: Fast query execution
- **Lean Queries**: Reduced memory usage
- **Connection Pooling**: Efficient database connections

## 🚀 Deployment

### Production Setup
1. **Environment**: Set `NODE_ENV=production`
2. **Database**: Use MongoDB Atlas or dedicated server
3. **SSL**: Enable HTTPS with certificates
4. **Process Manager**: Use PM2 for process management
5. **Monitoring**: Add logging and error tracking

### Docker Deployment (Optional)
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 5000
CMD ["node", "dist/index.js"]
```

## 🐛 Troubleshooting

### Common Issues

**1. Mongoose Model Overwrite Error**
```bash
OverwriteModelError: Cannot overwrite `Model` model once compiled
```
**Solution**: Ensure models are imported only from `/models` directory, not redefined in routes.

**2. JWT Token Issues**
```bash
JsonWebTokenError: invalid token
```
**Solution**: Check token format and ensure it's properly included in headers.

**3. File Upload Failures**
```bash
Error: File too large
```
**Solution**: Check `MAX_FILE_SIZE` environment variable and multer configuration.

**4. Database Connection Issues**
```bash
MongooseError: Operation timed out
```
**Solution**: Verify `MONGODB_URI` and network connectivity.

## 📚 API Documentation

For detailed API documentation with examples, refer to the generated OpenAPI/Swagger documentation or use tools like Postman with the provided collection.

### Testing Endpoints
```bash
# Health check
GET http://localhost:5000/api/health

# Authentication test
POST http://localhost:5000/api/auth/login
Content-Type: application/json
{
  "email": "user@example.com",
  "password": "password123"
}
```

## 🤝 Contributing

1. **Code Style**: Follow TypeScript best practices
2. **Validation**: Always validate input data
3. **Error Handling**: Use try-catch blocks and proper error responses
4. **Documentation**: Update this README for new features
5. **Testing**: Test all endpoints before deployment

## 📞 Support

For technical support or questions about the backend implementation, refer to:
- **Issues**: GitHub repository issues
- **Documentation**: This README and inline code comments
- **Logs**: Check console output for debugging information

---

**Last Updated**: July 11, 2025
**Version**: 1.0.0
**Maintainer**: VM Visa Development Team
