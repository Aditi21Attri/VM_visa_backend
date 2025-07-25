import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import notificationService from '../services/notificationService';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userType?: string;
}

export const initializeSocket = (io: Server) => {
  // Set the io instance in notification service
  notificationService.setIO(io);

  // Authentication middleware for socket connections
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        console.log('Socket auth: No token provided');
        return next(new Error('Authentication required'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;
      const user = await User.findById(decoded.id).select('-password');
      
      if (!user) {
        console.log('Socket auth: User not found for ID:', decoded.id);
        return next(new Error('User not found'));
      }

      if (!user.isActive) {
        console.log('Socket auth: User account deactivated:', user.name);
        return next(new Error('Account deactivated'));
      }

      socket.userId = user._id.toString();
      socket.userType = user.userType;
      
      console.log('Socket auth: Success for user:', user.name, user.userType);
      next();
    } catch (error) {
      console.error('Socket authentication error:', error);
      if (error.name === 'TokenExpiredError') {
        next(new Error('Session expired'));
      } else if (error.name === 'JsonWebTokenError') {
        next(new Error('Invalid token'));
      } else {
        next(new Error('Authentication failed'));
      }
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    console.log(`User ${socket.userId} connected via socket`);

    // Join user to their personal room for notifications
    if (socket.userId) {
      socket.join(`user_${socket.userId}`);
      console.log(`User ${socket.userId} joined personal room`);

      // Update user online status
      User.findByIdAndUpdate(socket.userId, { lastSeen: new Date() }).exec();
    }

    // Handle joining conversation rooms
    socket.on('joinConversation', (conversationId: string) => {
      socket.join(`conversation_${conversationId}`);
      console.log(`User ${socket.userId} joined conversation ${conversationId}`);
    });

    // Handle leaving conversation rooms
    socket.on('leaveConversation', (conversationId: string) => {
      socket.leave(`conversation_${conversationId}`);
      console.log(`User ${socket.userId} left conversation ${conversationId}`);
    });

    // Handle typing indicators
    socket.on('typing', (data: { conversationId: string; receiverId: string }) => {
      socket.to(`user_${data.receiverId}`).emit('userTyping', {
        conversationId: data.conversationId,
        userId: socket.userId,
        isTyping: true
      });
    });

    socket.on('stopTyping', (data: { conversationId: string; receiverId: string }) => {
      socket.to(`user_${data.receiverId}`).emit('userTyping', {
        conversationId: data.conversationId,
        userId: socket.userId,
        isTyping: false
      });
    });

    // Handle marking messages as read
    socket.on('markAsRead', (data: { conversationId: string; messageIds: string[] }) => {
      // Broadcast to other participants that messages have been read
      socket.to(`conversation_${data.conversationId}`).emit('messagesRead', {
        conversationId: data.conversationId,
        messageIds: data.messageIds,
        readBy: socket.userId
      });
    });

    // Handle proposal notifications
    socket.on('proposalUpdate', (data: { requestId: string; clientId: string; type: string }) => {
      socket.to(`user_${data.clientId}`).emit('proposalNotification', {
        type: data.type,
        requestId: data.requestId,
        timestamp: new Date()
      });
    });

    // Handle escrow notifications with enhanced functionality
    socket.on('escrowUpdate', (data: { escrowId: string; clientId: string; agentId: string; type: string; amount?: number; reason?: string }) => {
      // Notify both client and agent
      socket.to(`user_${data.clientId}`).emit('escrowNotification', {
        type: data.type,
        escrowId: data.escrowId,
        amount: data.amount,
        reason: data.reason,
        timestamp: new Date()
      });

      socket.to(`user_${data.agentId}`).emit('escrowNotification', {
        type: data.type,
        escrowId: data.escrowId,
        amount: data.amount,
        reason: data.reason,
        timestamp: new Date()
      });
    });

    // Enhanced escrow events
    socket.on('escrow:fund', async (data) => {
      try {
        // Emit to agent that escrow has been funded
        io.to(`user_${data.agentId}`).emit('escrow:funded', {
          escrowId: data.escrowId,
          amount: data.amount,
          clientId: socket.userId,
          message: 'Escrow has been funded for your proposal'
        });
      } catch (error) {
        console.error('Error handling escrow fund event:', error);
      }
    });

    socket.on('escrow:release', async (data) => {
      try {
        // Emit to both parties about escrow release
        io.to(`user_${data.agentId}`).emit('escrow:released', {
          escrowId: data.escrowId,
          amount: data.amount,
          message: 'Escrow funds have been released to you'
        });
        
        io.to(`user_${data.clientId}`).emit('escrow:released', {
          escrowId: data.escrowId,
          amount: data.amount,
          message: 'Escrow funds have been released to agent'
        });
      } catch (error) {
        console.error('Error handling escrow release event:', error);
      }
    });

    socket.on('escrow:dispute', async (data) => {
      try {
        // Emit to other party about dispute
        const otherPartyId = data.raisedBy === data.clientId ? data.agentId : data.clientId;
        io.to(`user_${otherPartyId}`).emit('escrow:disputed', {
          escrowId: data.escrowId,
          reason: data.reason,
          raisedBy: data.raisedBy,
          message: 'A dispute has been raised for your escrow'
        });
      } catch (error) {
        console.error('Error handling escrow dispute event:', error);
      }
    });

    // Enhanced milestone updates
    socket.on('milestoneUpdate', (data: { 
      escrowId: string; 
      milestoneId: string; 
      clientId: string; 
      agentId: string; 
      type: string;
      status: string;
      amount?: number;
      milestoneTitle?: string;
    }) => {
      const notification = {
        type: data.type,
        escrowId: data.escrowId,
        milestoneId: data.milestoneId,
        status: data.status,
        amount: data.amount,
        milestoneTitle: data.milestoneTitle,
        timestamp: new Date()
      };

      // Notify both parties
      socket.to(`user_${data.clientId}`).emit('milestoneNotification', notification);
      socket.to(`user_${data.agentId}`).emit('milestoneNotification', notification);
    });

    // Handle milestone completion events
    socket.on('milestone:completed', async (data) => {
      try {
        // Emit to client that milestone is completed and needs approval
        io.to(`user_${data.clientId}`).emit('milestone:needs_approval', {
          caseId: data.caseId,
          milestoneId: data.milestoneId,
          milestoneTitle: data.milestoneTitle,
          amount: data.amount,
          message: `Milestone "${data.milestoneTitle}" has been completed and needs your approval`
        });
      } catch (error) {
        console.error('Error handling milestone completed event:', error);
      }
    });

    socket.on('milestone:approved', async (data) => {
      try {
        // Emit to agent that milestone is approved and payment released
        io.to(`user_${data.agentId}`).emit('milestone:payment_released', {
          caseId: data.caseId,
          milestoneId: data.milestoneId,
          milestoneTitle: data.milestoneTitle,
          amount: data.amount,
          message: `Milestone "${data.milestoneTitle}" approved! $${data.amount} has been released to you`
        });
      } catch (error) {
        console.error('Error handling milestone approved event:', error);
      }
    });

    // Handle document upload events
    socket.on('document:uploaded', async (data) => {
      try {
        // Emit to other party about new document
        const otherPartyId = data.uploadedBy === data.clientId ? data.agentId : data.clientId;
        io.to(`user_${otherPartyId}`).emit('document:new', {
          caseId: data.caseId,
          documentId: data.documentId,
          documentName: data.documentName,
          uploadedBy: data.uploadedBy,
          message: `New document "${data.documentName}" has been uploaded to your case`
        });
      } catch (error) {
        console.error('Error handling document upload event:', error);
      }
    });

    // Handle case status updates
    socket.on('case:status_update', async (data) => {
      try {
        // Emit to all case participants
        const participants = [data.clientId, data.agentId];
        participants.forEach(participantId => {
          if (participantId !== socket.userId) {
            io.to(`user_${participantId}`).emit('case:status_changed', {
              caseId: data.caseId,
              oldStatus: data.oldStatus,
              newStatus: data.newStatus,
              message: `Case status changed from ${data.oldStatus} to ${data.newStatus}`
            });
          }
        });
      } catch (error) {
        console.error('Error handling case status update:', error);
      }
    });

    // Handle review notifications
    socket.on('reviewCreated', (data: { revieweeId: string; requestId: string; rating: number }) => {
      socket.to(`user_${data.revieweeId}`).emit('reviewNotification', {
        type: 'review_received',
        requestId: data.requestId,
        rating: data.rating,
        timestamp: new Date()
      });
    });

    // Handle document verification notifications
    socket.on('documentVerified', (data: { userId: string; documentId: string; status: string }) => {
      socket.to(`user_${data.userId}`).emit('documentNotification', {
        type: 'document_verified',
        documentId: data.documentId,
        status: data.status,
        timestamp: new Date()
      });
    });

    // Handle admin notifications
    socket.on('adminNotification', (data: { 
      type: string; 
      message: string; 
      targetUsers?: string[]; 
      userType?: string;
    }) => {
      if (socket.userType === 'admin') {
        if (data.targetUsers) {
          // Send to specific users
          data.targetUsers.forEach(userId => {
            socket.to(`user_${userId}`).emit('adminNotification', {
              type: data.type,
              message: data.message,
              timestamp: new Date()
            });
          });
        } else if (data.userType) {
          // Broadcast to all users of a specific type
          socket.broadcast.emit('adminNotification', {
            type: data.type,
            message: data.message,
            userType: data.userType,
            timestamp: new Date()
          });
        }
      }
    });

    // Handle user status updates
    socket.on('updateStatus', (status: 'online' | 'away' | 'busy') => {
      // Update user status in database if needed
      // For now, just broadcast to connected users
      socket.broadcast.emit('userStatusUpdate', {
        userId: socket.userId,
        status,
        timestamp: new Date()
      });
    });

    // Handle disconnect
    socket.on('disconnect', (reason) => {
      console.log(`User ${socket.userId} disconnected: ${reason}`);
      
      // Update user last seen
      if (socket.userId) {
        User.findByIdAndUpdate(socket.userId, { lastSeen: new Date() }).exec();
        
        // Broadcast user offline status
        socket.broadcast.emit('userStatusUpdate', {
          userId: socket.userId,
          status: 'offline',
          timestamp: new Date()
        });
      }
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error(`Socket error for user ${socket.userId}:`, error);
    });

    // Handle escrow events
    socket.on('escrow:fund', async (data) => {
      try {
        // Emit to agent that escrow has been funded
        io.to(`user_${data.agentId}`).emit('escrow:funded', {
          escrowId: data.escrowId,
          amount: data.amount,
          clientId: socket.userId,
          message: 'Escrow has been funded for your proposal'
        });
      } catch (error) {
        console.error('Error handling escrow fund event:', error);
      }
    });

    socket.on('escrow:release', async (data) => {
      try {
        // Emit to both parties about escrow release
        io.to(`user_${data.agentId}`).emit('escrow:released', {
          escrowId: data.escrowId,
          amount: data.amount,
          message: 'Escrow funds have been released to you'
        });
        
        io.to(`user_${data.clientId}`).emit('escrow:released', {
          escrowId: data.escrowId,
          amount: data.amount,
          message: 'Escrow funds have been released to agent'
        });
      } catch (error) {
        console.error('Error handling escrow release event:', error);
      }
    });

    socket.on('escrow:dispute', async (data) => {
      try {
        // Emit to other party about dispute
        const otherPartyId = data.raisedBy === data.clientId ? data.agentId : data.clientId;
        io.to(`user_${otherPartyId}`).emit('escrow:disputed', {
          escrowId: data.escrowId,
          reason: data.reason,
          raisedBy: data.raisedBy,
          message: 'A dispute has been raised for your escrow'
        });
      } catch (error) {
        console.error('Error handling escrow dispute event:', error);
      }
    });

    // Handle milestone events
    socket.on('milestone:completed', async (data) => {
      try {
        // Emit to client that milestone is completed and needs approval
        io.to(`user_${data.clientId}`).emit('milestone:needs_approval', {
          caseId: data.caseId,
          milestoneId: data.milestoneId,
          milestoneTitle: data.milestoneTitle,
          amount: data.amount,
          message: `Milestone "${data.milestoneTitle}" has been completed and needs your approval`
        });
      } catch (error) {
        console.error('Error handling milestone completed event:', error);
      }
    });

    socket.on('milestone:approved', async (data) => {
      try {
        // Emit to agent that milestone is approved and payment released
        io.to(`user_${data.agentId}`).emit('milestone:payment_released', {
          caseId: data.caseId,
          milestoneId: data.milestoneId,
          milestoneTitle: data.milestoneTitle,
          amount: data.amount,
          message: `Milestone "${data.milestoneTitle}" approved! $${data.amount} has been released to you`
        });
      } catch (error) {
        console.error('Error handling milestone approved event:', error);
      }
    });

    // Handle document upload events
    socket.on('document:uploaded', async (data) => {
      try {
        // Emit to other party about new document
        const otherPartyId = data.uploadedBy === data.clientId ? data.agentId : data.clientId;
        io.to(`user_${otherPartyId}`).emit('document:new', {
          caseId: data.caseId,
          documentId: data.documentId,
          documentName: data.documentName,
          uploadedBy: data.uploadedBy,
          message: `New document "${data.documentName}" has been uploaded to your case`
        });
      } catch (error) {
        console.error('Error handling document upload event:', error);
      }
    });

    // Handle case status updates
    socket.on('case:status_update', async (data) => {
      try {
        // Emit to all case participants
        const participants = [data.clientId, data.agentId];
        participants.forEach(participantId => {
          if (participantId !== socket.userId) {
            io.to(`user_${participantId}`).emit('case:status_changed', {
              caseId: data.caseId,
              oldStatus: data.oldStatus,
              newStatus: data.newStatus,
              message: `Case status changed from ${data.oldStatus} to ${data.newStatus}`
            });
          }
        });
      } catch (error) {
        console.error('Error handling case status update:', error);
      }
    });

    // Helper function to send notification to specific user
    const sendNotificationToUser = (userId: string, notification: any) => {
      io.to(`user_${userId}`).emit('notification', notification);
    };

    // Helper function to send notification to multiple users
    const sendNotificationToUsers = (userIds: string[], notification: any) => {
      userIds.forEach(userId => {
        io.to(`user_${userId}`).emit('notification', notification);
      });
    };

    // Helper function to broadcast to all users of a specific type
    const broadcastToUserType = (userType: string, notification: any) => {
      io.emit('notification', { ...notification, targetUserType: userType });
    };

    // Export helper functions for use in other parts of the application
    return {
      sendNotificationToUser,
      sendNotificationToUsers,
      broadcastToUserType
    };
  });
};
