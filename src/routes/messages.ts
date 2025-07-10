import express, { Request, Response } from 'express';
import { body, query, validationResult } from 'express-validator';
import { Message, Conversation } from '../models/Message';
import { protect } from '../middleware/auth';
import { 
  ApiResponse, 
  PaginatedResponse, 
  CreateMessageData,
  MessageQueryParams,
  IMessage,
  IConversation 
} from '../types';

const router = express.Router();

// @desc    Get user's conversations
// @route   GET /api/messages/conversations
// @access  Private
router.get('/conversations', protect, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 })
], async (req: any, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const response: ApiResponse = {
        success: false,
        error: errors.array().map(err => err.msg).join(', ')
      };
      return res.status(400).json(response);
    }

    const { page = 1, limit = 20 } = req.query;
    const pageNum = parseInt(page.toString());
    const limitNum = parseInt(limit.toString());
    const skip = (pageNum - 1) * limitNum;

    // Get conversations where user is a participant
    const [conversations, total] = await Promise.all([
      Conversation.find({
        participants: req.user.id,
        isActive: true
      })
      .populate('participantDetails', 'name avatar isVerified')
      .populate('request', 'title visaType country status')
      .sort({ lastMessageAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
      Conversation.countDocuments({
        participants: req.user.id,
        isActive: true
      })
    ]);

    // Get unread message count for each conversation
    const conversationsWithUnread = await Promise.all(
      conversations.map(async (conv: any) => {
        const unreadCount = await Message.countDocuments({
          conversationId: conv._id,
          receiverId: req.user.id,
          isRead: false
        });

        // Get the other participant (not the current user)
        const otherParticipant = (conv.participantDetails as any[]).find(
          (participant: any) => participant._id.toString() !== req.user.id
        );

        return {
          ...conv,
          unreadCount,
          otherParticipant
        };
      })
    );

    const totalPages = Math.ceil(total / limitNum);

    const response: ApiResponse<PaginatedResponse<IConversation>> = {
      success: true,
      data: {
        data: conversationsWithUnread,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1
      }
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Get conversations error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Error fetching conversations'
    };
    res.status(500).json(response);
  }
});

// @desc    Get messages in a conversation
// @route   GET /api/messages/conversations/:conversationId
// @access  Private
router.get('/conversations/:conversationId', protect, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 })
], async (req: any, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const response: ApiResponse = {
        success: false,
        error: errors.array().map(err => err.msg).join(', ')
      };
      return res.status(400).json(response);
    }

    const { conversationId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    // Check if user is part of the conversation
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      const response: ApiResponse = {
        success: false,
        error: 'Conversation not found'
      };
      return res.status(404).json(response);
    }

    if (!conversation.participants.includes(req.user.id)) {
      const response: ApiResponse = {
        success: false,
        error: 'Not authorized to access this conversation'
      };
      return res.status(403).json(response);
    }

    const pageNum = parseInt(page.toString());
    const limitNum = parseInt(limit.toString());
    const skip = (pageNum - 1) * limitNum;

    // Get messages (newest first)
    const [messages, total] = await Promise.all([
      Message.find({ conversationId })
        .populate('sender', 'name avatar')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Message.countDocuments({ conversationId })
    ]);

    // Mark messages as read for the current user
    await Message.updateMany(
      {
        conversationId,
        receiverId: req.user.id,
        isRead: false
      },
      { isRead: true }
    );

    const totalPages = Math.ceil(total / limitNum);

    const response: ApiResponse<PaginatedResponse<IMessage>> = {
      success: true,
      data: {
        data: messages.reverse(), // Reverse to show oldest first in response
        total,
        page: pageNum,
        limit: limitNum,
        totalPages,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1
      }
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Get messages error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Error fetching messages'
    };
    res.status(500).json(response);
  }
});

// @desc    Send a message
// @route   POST /api/messages
// @access  Private
router.post('/', protect, [
  body('receiverId').isMongoId().withMessage('Valid receiver ID is required'),
  body('content').trim().isLength({ min: 1, max: 2000 }).withMessage('Message content must be between 1 and 2000 characters'),
  body('conversationId').optional().isMongoId().withMessage('Invalid conversation ID'),
  body('messageType').optional().isIn(['text', 'file']).withMessage('Invalid message type'),
  body('requestId').optional().isMongoId().withMessage('Invalid request ID'),
  body('attachments').optional().isArray().withMessage('Attachments must be an array')
], async (req: any, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const response: ApiResponse = {
        success: false,
        error: errors.array().map(err => err.msg).join(', ')
      };
      return res.status(400).json(response);
    }

    const { receiverId, content, conversationId, messageType = 'text', requestId, attachments = [] }: CreateMessageData = req.body;

    // Prevent sending message to self
    if (receiverId === req.user.id) {
      const response: ApiResponse = {
        success: false,
        error: 'Cannot send message to yourself'
      };
      return res.status(400).json(response);
    }

    let conversation: any;

    if (conversationId) {
      // Use existing conversation
      conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        const response: ApiResponse = {
          success: false,
          error: 'Conversation not found'
        };
        return res.status(404).json(response);
      }

      // Check if user is part of the conversation
      if (!conversation.participants.includes(req.user.id)) {
        const response: ApiResponse = {
          success: false,
          error: 'Not authorized to send message in this conversation'
        };
        return res.status(403).json(response);
      }
    } else {
      // Find or create conversation
      conversation = await (Conversation as any).findOrCreate(
        [req.user.id, receiverId],
        requestId
      );
    }

    // Create message
    const message = await Message.create({
      conversationId: conversation._id,
      senderId: req.user.id,
      receiverId,
      content,
      messageType,
      attachments
    });

    // Update conversation's last message
    await Conversation.findByIdAndUpdate(conversation._id, {
      lastMessage: content.substring(0, 100), // Store first 100 chars
      lastMessageAt: new Date()
    });

    // Populate sender details
    const populatedMessage = await Message.findById(message._id)
      .populate('sender', 'name avatar');

    // Emit socket event for real-time messaging
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${receiverId}`).emit('newMessage', {
        message: populatedMessage,
        conversationId: conversation._id
      });
    }

    const response: ApiResponse = {
      success: true,
      data: {
        message: populatedMessage,
        conversationId: conversation._id
      },
      message: 'Message sent successfully'
    };

    res.status(201).json(response);
  } catch (error) {
    console.error('Send message error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Error sending message'
    };
    res.status(500).json(response);
  }
});

// @desc    Mark messages as read
// @route   PUT /api/messages/conversations/:conversationId/read
// @access  Private
router.put('/conversations/:conversationId/read', protect, async (req: any, res: Response) => {
  try {
    const { conversationId } = req.params;

    // Check if user is part of the conversation
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      const response: ApiResponse = {
        success: false,
        error: 'Conversation not found'
      };
      return res.status(404).json(response);
    }

    if (!conversation.participants.includes(req.user.id)) {
      const response: ApiResponse = {
        success: false,
        error: 'Not authorized to access this conversation'
      };
      return res.status(403).json(response);
    }

    // Mark all unread messages as read
    const result = await Message.updateMany(
      {
        conversationId,
        receiverId: req.user.id,
        isRead: false
      },
      { isRead: true }
    );

    const response: ApiResponse = {
      success: true,
      data: {
        messagesMarkedRead: result.modifiedCount
      },
      message: 'Messages marked as read'
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Mark messages read error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Error marking messages as read'
    };
    res.status(500).json(response);
  }
});

// @desc    Get unread message count
// @route   GET /api/messages/unread-count
// @access  Private
router.get('/unread-count', protect, async (req: any, res: Response) => {
  try {
    const unreadCount = await Message.countDocuments({
      receiverId: req.user.id,
      isRead: false
    });

    const response: ApiResponse = {
      success: true,
      data: {
        unreadCount
      }
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Get unread count error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Error fetching unread count'
    };
    res.status(500).json(response);
  }
});

// @desc    Edit message
// @route   PUT /api/messages/:id
// @access  Private (Sender only)
router.put('/:id', protect, [
  body('content').trim().isLength({ min: 1, max: 2000 }).withMessage('Message content must be between 1 and 2000 characters')
], async (req: any, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const response: ApiResponse = {
        success: false,
        error: errors.array().map(err => err.msg).join(', ')
      };
      return res.status(400).json(response);
    }

    const message = await Message.findById(req.params.id);
    
    if (!message) {
      const response: ApiResponse = {
        success: false,
        error: 'Message not found'
      };
      return res.status(404).json(response);
    }

    // Check if user is the sender
    if (message.senderId !== req.user.id) {
      const response: ApiResponse = {
        success: false,
        error: 'Not authorized to edit this message'
      };
      return res.status(403).json(response);
    }

    // Check if message is recent (allow editing within 15 minutes)
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    if (message.createdAt < fifteenMinutesAgo) {
      const response: ApiResponse = {
        success: false,
        error: 'Message can only be edited within 15 minutes of sending'
      };
      return res.status(400).json(response);
    }

    // Update message
    const updatedMessage = await Message.findByIdAndUpdate(
      req.params.id,
      {
        content: req.body.content,
        isEdited: true,
        editedAt: new Date()
      },
      { new: true }
    ).populate('sender', 'name avatar');

    // Emit socket event for real-time update
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${message.receiverId}`).emit('messageEdited', {
        message: updatedMessage
      });
    }

    const response: ApiResponse = {
      success: true,
      data: updatedMessage,
      message: 'Message updated successfully'
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Edit message error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Error editing message'
    };
    res.status(500).json(response);
  }
});

// @desc    Delete message
// @route   DELETE /api/messages/:id
// @access  Private (Sender only)
router.delete('/:id', protect, async (req: any, res: Response) => {
  try {
    const message = await Message.findById(req.params.id);
    
    if (!message) {
      const response: ApiResponse = {
        success: false,
        error: 'Message not found'
      };
      return res.status(404).json(response);
    }

    // Check if user is the sender
    if (message.senderId !== req.user.id) {
      const response: ApiResponse = {
        success: false,
        error: 'Not authorized to delete this message'
      };
      return res.status(403).json(response);
    }

    // Check if message is recent (allow deletion within 1 hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    if (message.createdAt < oneHourAgo) {
      const response: ApiResponse = {
        success: false,
        error: 'Message can only be deleted within 1 hour of sending'
      };
      return res.status(400).json(response);
    }

    await Message.findByIdAndDelete(req.params.id);

    // Emit socket event for real-time update
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${message.receiverId}`).emit('messageDeleted', {
        messageId: req.params.id,
        conversationId: message.conversationId
      });
    }

    const response: ApiResponse = {
      success: true,
      message: 'Message deleted successfully'
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Delete message error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Error deleting message'
    };
    res.status(500).json(response);
  }
});

// @desc    Start conversation with agent for a request
// @route   POST /api/messages/start-conversation
// @access  Private
router.post('/start-conversation', protect, [
  body('agentId').isMongoId().withMessage('Valid agent ID is required'),
  body('requestId').isMongoId().withMessage('Valid request ID is required'),
  body('message').trim().isLength({ min: 1, max: 2000 }).withMessage('Initial message is required')
], async (req: any, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const response: ApiResponse = {
        success: false,
        error: errors.array().map(err => err.msg).join(', ')
      };
      return res.status(400).json(response);
    }

    const { agentId, requestId, message: messageContent } = req.body;

    // Find or create conversation
    const conversation = await (Conversation as any).findOrCreate(
      [req.user.id, agentId],
      requestId
    );

    // Send initial message
    const message = await Message.create({
      conversationId: conversation._id,
      senderId: req.user.id,
      receiverId: agentId,
      content: messageContent,
      messageType: 'text'
    });

    // Update conversation's last message
    await Conversation.findByIdAndUpdate(conversation._id, {
      lastMessage: messageContent.substring(0, 100),
      lastMessageAt: new Date()
    });

    // Populate message with sender details
    const populatedMessage = await Message.findById(message._id)
      .populate('sender', 'name avatar');

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${agentId}`).emit('newMessage', {
        message: populatedMessage,
        conversationId: conversation._id
      });
    }

    const response: ApiResponse = {
      success: true,
      data: {
        conversation,
        message: populatedMessage
      },
      message: 'Conversation started successfully'
    };

    res.status(201).json(response);
  } catch (error) {
    console.error('Start conversation error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Error starting conversation'
    };
    res.status(500).json(response);
  }
});

export default router;
