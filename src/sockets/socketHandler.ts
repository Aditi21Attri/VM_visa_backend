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
        return next(new Error('Authentication error: No token provided'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;
      const user = await User.findById(decoded.id).select('-password');
      
      if (!user || !user.isActive) {
        return next(new Error('Authentication error: Invalid or inactive user'));
      }

      socket.userId = user._id.toString();
      socket.userType = user.userType;
      
      next();
    } catch (error) {
      console.error('Socket authentication error:', error);
      next(new Error('Authentication error: Invalid token'));
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

    // Handle escrow notifications
    socket.on('escrowUpdate', (data: { escrowId: string; clientId: string; agentId: string; type: string }) => {
      // Notify both client and agent
      socket.to(`user_${data.clientId}`).emit('escrowNotification', {
        type: data.type,
        escrowId: data.escrowId,
        timestamp: new Date()
      });

      socket.to(`user_${data.agentId}`).emit('escrowNotification', {
        type: data.type,
        escrowId: data.escrowId,
        timestamp: new Date()
      });
    });

    // Handle milestone updates
    socket.on('milestoneUpdate', (data: { 
      escrowId: string; 
      milestoneId: string; 
      clientId: string; 
      agentId: string; 
      type: string;
      status: string;
    }) => {
      const notification = {
        type: data.type,
        escrowId: data.escrowId,
        milestoneId: data.milestoneId,
        status: data.status,
        timestamp: new Date()
      };

      // Notify both parties
      socket.to(`user_${data.clientId}`).emit('milestoneNotification', notification);
      socket.to(`user_${data.agentId}`).emit('milestoneNotification', notification);
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
};
