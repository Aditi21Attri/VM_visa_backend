# VM Visa Backend - Escrow Workflow & Button Flow Integration

This implementation provides a comprehensive escrow workflow and full button flow integration for the VM Visa platform. All dashboard buttons are now connected to backend endpoints with real-time updates.

## 🏦 Escrow Workflow Features

### Core Endpoints

#### 1. Fund Escrow
- **Endpoint:** `POST /api/escrow/fund`
- **Access:** Client only
- **Purpose:** Fund escrow when a proposal is accepted
- **Features:**
  - Creates escrow with milestones from proposal
  - Automatically creates a case from accepted proposal
  - Sends notifications to agent
  - Updates proposal status to 'accepted'

```javascript
// Example request
POST /api/escrow/fund
{
  "proposalId": "64a7b8c9d1e2f3a4b5c6d7e8",
  "amount": 2000,
  "paymentMethod": "stripe"
}
```

#### 2. Release Escrow Funds
- **Endpoint:** `POST /api/escrow/:id/release`
- **Access:** Client, Agent, Admin
- **Purpose:** Release funds for milestone completion or full project
- **Features:**
  - Can release specific milestone or entire escrow
  - Updates milestone status to 'completed'
  - Sends notifications to all parties
  - Integrates with case milestone tracking

```javascript
// Example request
POST /api/escrow/64a7b8c9d1e2f3a4b5c6d7e8/release
{
  "milestoneId": "milestone_uuid_here",
  "amount": 500,
  "reason": "Milestone completed successfully"
}
```

#### 3. Hold Escrow (Dispute)
- **Endpoint:** `POST /api/escrow/:id/hold`
- **Access:** Client, Agent, Admin
- **Purpose:** Put funds on hold due to disputes
- **Features:**
  - Creates dispute record with evidence
  - Changes escrow status to 'disputed'
  - Notifies all parties and admin
  - Integrates with case dispute system

```javascript
// Example request
POST /api/escrow/64a7b8c9d1e2f3a4b5c6d7e8/hold
{
  "reason": "Quality concerns",
  "description": "Deliverables don't meet specifications",
  "evidence": ["screenshot1.png", "document.pdf"]
}
```

#### 4. Get Escrow Status
- **Endpoint:** `GET /api/escrow/:id/status`
- **Access:** Client, Agent, Admin
- **Purpose:** Get detailed escrow status and history
- **Features:**
  - Shows progress percentage
  - Lists all milestones with status
  - Provides timeline of events
  - Calculates remaining amounts

## 📋 Case & Milestone Management

### Milestone Endpoints

#### 1. Complete Milestone
- **Endpoint:** `POST /api/cases/:id/milestone/:milestoneId/complete`
- **Access:** Agent only
- **Purpose:** Mark milestone as complete with evidence
- **Features:**
  - Allows evidence submission
  - Notifies client for approval
  - Auto-activates next milestone
  - Updates case timeline

#### 2. Approve Milestone
- **Endpoint:** `POST /api/cases/:id/milestone/:milestoneId/approve`
- **Access:** Client only
- **Purpose:** Approve completed milestone and release payment
- **Features:**
  - Triggers escrow release
  - Updates milestone status
  - Sends payment notification to agent
  - Records approval in timeline

#### 3. Raise Case Dispute
- **Endpoint:** `POST /api/cases/:id/dispute`
- **Access:** Client, Agent
- **Purpose:** Raise dispute for case issues
- **Features:**
  - Puts escrow on hold
  - Creates dispute record
  - Notifies all parties
  - Updates case status

## 💬 Chat/Message Integration

### Chat Endpoints

#### 1. Get/Create Conversation
- **Endpoint:** `POST /api/messages/conversation`
- **Access:** Private
- **Purpose:** Get existing or create new conversation for a case
- **Features:**
  - Links conversations to cases
  - Handles participant management
  - Returns recent message history

#### 2. Get Case Conversation
- **Endpoint:** `GET /api/messages/case/:caseId`
- **Access:** Private
- **Purpose:** Get conversation thread for specific case
- **Features:**
  - Case-specific messaging
  - Chronological message order
  - Participant validation

#### 3. Send Message
- **Endpoint:** `POST /api/messages/send`
- **Access:** Private
- **Purpose:** Send message in conversation
- **Features:**
  - Real-time delivery
  - File attachment support
  - Read status tracking

## 📄 Document Upload Integration

### Upload Endpoints

#### 1. Single Document Upload
- **Endpoint:** `POST /api/documents/upload`
- **Access:** Private
- **Purpose:** Upload document with case integration
- **Features:**
  - File validation and storage
  - Case/request linking
  - Automatic notifications
  - Metadata management

#### 2. Multiple Document Upload
- **Endpoint:** `POST /api/documents/upload-multiple`
- **Access:** Private
- **Purpose:** Batch upload multiple documents
- **Features:**
  - Bulk file processing
  - Category tagging
  - Progress tracking
  - Error handling

## 🔔 Notification System

### Notification Endpoints

#### 1. Get Notifications
- **Endpoint:** `GET /api/dashboard/notifications`
- **Access:** Private
- **Features:**
  - Pagination support
  - Read/unread filtering
  - Sender information
  - Priority sorting

#### 2. Mark as Read
- **Endpoint:** `PUT /api/dashboard/notifications/:id/read`
- **Access:** Private
- **Purpose:** Mark specific notification as read

#### 3. Mark All as Read
- **Endpoint:** `PUT /api/dashboard/notifications/read-all`
- **Access:** Private
- **Purpose:** Mark all notifications as read

#### 4. Get Unread Count
- **Endpoint:** `GET /api/dashboard/notifications/unread-count`
- **Access:** Private
- **Purpose:** Get count of unread notifications for badge display

## 🔄 Real-Time Integration

### Socket Events

The system uses Socket.io for real-time updates:

#### Escrow Events
- `escrow:funded` - When escrow is funded
- `escrow:released` - When funds are released
- `escrow:disputed` - When dispute is raised

#### Milestone Events
- `milestone:needs_approval` - When milestone needs client approval
- `milestone:payment_released` - When payment is released to agent

#### Document Events
- `document:new` - When new document is uploaded

#### Case Events
- `case:status_changed` - When case status changes

## 🎯 Button Flow Mapping

### Dashboard Button Integration

| Button | Endpoint | Purpose | Real-time Update |
|--------|----------|---------|------------------|
| **Chat/Message** | `POST /api/messages/conversation` | Create/get conversation | ✅ Socket events |
| **Upload Document** | `POST /api/documents/upload` | Upload with case linking | ✅ Notifications |
| **Approve Release** | `POST /api/escrow/:id/release` | Release milestone payment | ✅ Payment notifications |
| **Raise Dispute** | `POST /api/escrow/:id/hold` | Put funds on hold | ✅ Dispute alerts |
| **Mark Complete** | `POST /api/cases/:id/milestone/:id/complete` | Complete milestone | ✅ Approval requests |
| **View Details** | `GET /api/escrow/:id/status` | Get detailed status | ✅ Live updates |
| **Notifications** | `GET /api/dashboard/notifications` | Get notifications | ✅ Real-time count |
| **Profile/Settings** | `GET /api/auth/me` | Get user profile | ✅ Status updates |

## 🧪 Testing

### Run Tests

```bash
# Install dependencies if needed
npm install axios

# Run comprehensive test suite
node test-escrow-workflow.js
```

### Test Coverage

The test script covers:
- ✅ Escrow funding workflow
- ✅ Milestone completion and approval
- ✅ Dispute management
- ✅ Chat functionality
- ✅ Document upload simulation
- ✅ Notification system

### Sample Test Data

```javascript
// Create test users first (or use existing ones)
const testUsers = {
  client: { email: 'client@test.com', password: 'password123' },
  agent: { email: 'agent@test.com', password: 'password123' },
  admin: { email: 'admin@test.com', password: 'password123' }
};
```

## 🚀 Deployment Notes

### Environment Variables

Ensure these are set in your `.env`:

```env
# Escrow Settings
STRIPE_SECRET_KEY=your_stripe_key
MAX_FILE_SIZE=10485760
UPLOAD_PATH=./uploads/

# Socket Settings
FRONTEND_URL=http://localhost:8080
```

### Database Collections

The implementation uses these MongoDB collections:
- `escrows` - Escrow transactions and milestones
- `cases` - Case management and timelines
- `notifications` - Notification system
- `messages` - Chat messages
- `conversations` - Chat conversations
- `documents` - File uploads

## 🔧 Integration Points

### Frontend Integration

The backend provides all necessary data for frontend routing:

```javascript
// Example response includes navigation data
{
  "success": true,
  "data": {
    "conversation": { "_id": "...", "participants": [...] },
    "messages": [...],
    "caseId": "...",
    "threadId": "..."
  }
}
```

### Real-time Features

All actions emit socket events for immediate UI updates:

```javascript
// Frontend socket listeners
socket.on('escrow:funded', (data) => {
  // Update escrow status in UI
  // Show success notification
  // Redirect to case dashboard
});

socket.on('milestone:needs_approval', (data) => {
  // Show approval request
  // Update milestone status
  // Increment notification count
});
```

## 📊 Monitoring & Analytics

The system logs all actions for monitoring:
- Escrow funding and releases
- Milestone completions and approvals
- Dispute activity
- Chat engagement
- Document uploads
- Notification delivery

## 🔒 Security Features

- JWT authentication on all endpoints
- Role-based access control
- File type validation
- Input sanitization
- Rate limiting (configured in main app)
- Secure file upload handling

## 📈 Performance Considerations

- Pagination on all list endpoints
- Efficient database queries with indexes
- File size limits on uploads
- Socket.io room management for scalability
- Background processing for notifications

This implementation ensures that every dashboard button is fully functional with proper backend integration, real-time updates, and comprehensive error handling.
