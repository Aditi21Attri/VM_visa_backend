import express, { Request, Response } from 'express';
import { protect } from '../middleware/auth';
import { ApiResponse, UserDashboardStats, AgentDashboardStats } from '../types';
import Notification from '../models/Notification';
import Case from '../models/Case';
import VisaRequest from '../models/VisaRequest';
import { Message } from '../models/Message';

const router = express.Router();

// @desc    Get user dashboard statistics
// @route   GET /api/dashboard/stats
// @access  Private
router.get('/stats', protect, async (req: any, res: Response) => {
  try {
    // Import models here to avoid circular dependencies
    const VisaRequest = require('../models/VisaRequest').default;
    const Proposal = require('../models/Proposal').default;
    const { Message } = require('../models/Message');

    let stats: any = {};

    if (req.user.userType === 'client') {
      // Client dashboard stats
      const [
        totalRequests,
        activeRequests,
        completedRequests,
        cancelledRequests,
        activeCases,
        completedCases,
        sentMessages,
        receivedMessages
      ] = await Promise.all([
        VisaRequest.countDocuments({ userId: req.user.id }),
        VisaRequest.countDocuments({ 
          userId: req.user.id, 
          status: { $in: ['pending', 'in-progress'] } 
        }),
        VisaRequest.countDocuments({ 
          userId: req.user.id, 
          status: 'completed' 
        }),
        VisaRequest.countDocuments({ 
          userId: req.user.id, 
          status: 'cancelled' 
        }),
        Case.countDocuments({ clientId: req.user.id, status: { $in: ['active', 'in-progress'] } }),
        Case.countDocuments({ clientId: req.user.id, status: 'completed' }),
        Message.countDocuments({ senderId: req.user.id }),
        Message.countDocuments({ receiverId: req.user.id })
      ]);

      // Get recent requests
      const recentRequests = await VisaRequest.find({ userId: req.user.id })
        .select('title visaType country status createdAt proposalCount')
        .sort({ createdAt: -1 })
        .limit(5)
        .lean();

      stats = {
        userType: 'client',
        totalRequests,
        activeRequests,
        completedRequests,
        cancelledRequests,
        activeCases,
        completedCases,
        completionRate: totalRequests > 0 ? ((completedRequests / totalRequests) * 100).toFixed(1) : 0,
        communication: {
          sentMessages,
          receivedMessages
        },
        recentRequests
      };

    } else if (req.user.userType === 'agent' || req.user.userType === 'organization') {
      // Agent/Organization dashboard stats
      const [
        totalProposals,
        pendingProposals,
        acceptedProposals,
        rejectedProposals,
        completedCases,
        sentMessages,
        receivedMessages
      ] = await Promise.all([
        Proposal.countDocuments({ agentId: req.user.id }),
        Proposal.countDocuments({ 
          agentId: req.user.id, 
          status: 'pending' 
        }),
        Proposal.countDocuments({ 
          agentId: req.user.id, 
          status: 'accepted' 
        }),
        Proposal.countDocuments({ 
          agentId: req.user.id, 
          status: 'rejected' 
        }),
        VisaRequest.countDocuments({ 
          assignedAgentId: req.user.id, 
          status: 'completed' 
        }),
        Message.countDocuments({ senderId: req.user.id }),
        Message.countDocuments({ receiverId: req.user.id })
      ]);

      // Get recent proposals
      const recentProposals = await Proposal.find({ agentId: req.user.id })
        .populate('request', 'title visaType country')
        .select('budget timeline status submittedAt')
        .sort({ submittedAt: -1 })
        .limit(5)
        .lean();

      stats = {
        userType: req.user.userType,
        totalProposals,
        pendingProposals,
        acceptedProposals,
        rejectedProposals,
        completedCases,
        acceptanceRate: totalProposals > 0 ? ((acceptedProposals / totalProposals) * 100).toFixed(1) : 0,
        successRate: acceptedProposals > 0 ? ((completedCases / acceptedProposals) * 100).toFixed(1) : 0,
        communication: {
          sentMessages,
          receivedMessages
        },
        recentProposals
      };
    }

    // Get unread messages count
    const unreadMessages = await Message.countDocuments({
      receiverId: req.user.id,
      isRead: false
    });

    stats.unreadMessages = unreadMessages;

    const response: ApiResponse = {
      success: true,
      data: stats
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Error fetching dashboard statistics'
    };
    res.status(500).json(response);
  }
});

// @desc    Get recent activity
// @route   GET /api/dashboard/activity
// @access  Private
router.get('/activity', protect, async (req: any, res: Response) => {
  try {
    const VisaRequest = require('../models/VisaRequest').default;
    const Proposal = require('../models/Proposal').default;
    const { Message } = require('../models/Message');

    let activities: any[] = [];

    if (req.user.userType === 'client') {
      // Get client's recent activities
      const [recentRequests, recentMessages] = await Promise.all([
        VisaRequest.find({ userId: req.user.id })
          .select('title status createdAt updatedAt')
          .sort({ updatedAt: -1 })
          .limit(10)
          .lean(),
        Message.find({ 
          $or: [
            { senderId: req.user.id },
            { receiverId: req.user.id }
          ]
        })
        .populate('sender', 'name')
        .populate('receiver', 'name')
        .select('content senderId receiverId createdAt')
        .sort({ createdAt: -1 })
        .limit(5)
        .lean()
      ]);

      activities = [
        ...recentRequests.map((req: any) => ({
          type: 'request',
          action: 'created',
          data: req,
          timestamp: req.createdAt
        })),
        ...recentMessages.map((msg: any) => ({
          type: 'message',
          action: msg.senderId === req.user.id ? 'sent' : 'received',
          data: msg,
          timestamp: msg.createdAt
        }))
      ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    } else if (req.user.userType === 'agent' || req.user.userType === 'organization') {
      // Get agent's recent activities
      const [recentProposals, recentMessages] = await Promise.all([
        Proposal.find({ agentId: req.user.id })
          .populate('request', 'title visaType')
          .select('budget status submittedAt respondedAt')
          .sort({ submittedAt: -1 })
          .limit(10)
          .lean(),
        Message.find({ 
          $or: [
            { senderId: req.user.id },
            { receiverId: req.user.id }
          ]
        })
        .populate('sender', 'name')
        .populate('receiver', 'name')
        .select('content senderId receiverId createdAt')
        .sort({ createdAt: -1 })
        .limit(5)
        .lean()
      ]);

      activities = [
        ...recentProposals.map((proposal: any) => ({
          type: 'proposal',
          action: 'submitted',
          data: proposal,
          timestamp: proposal.submittedAt
        })),
        ...recentMessages.map((msg: any) => ({
          type: 'message',
          action: msg.senderId === req.user.id ? 'sent' : 'received',
          data: msg,
          timestamp: msg.createdAt
        }))
      ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }

    const response: ApiResponse = {
      success: true,
      data: activities.slice(0, 20) // Limit to 20 most recent activities
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Get dashboard activity error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Error fetching dashboard activity'
    };
    res.status(500).json(response);
  }
});

// @desc    Get notifications
// @route   GET /api/dashboard/notifications
// @access  Private
router.get('/notifications', protect, async (req: any, res: Response) => {
  try {
    const { page = 1, limit = 20, isRead } = req.query;
    const pageNum = parseInt(page.toString());
    const limitNum = parseInt(limit.toString());
    const skip = (pageNum - 1) * limitNum;

    const query: any = { recipient: req.user.id };
    if (isRead !== undefined) {
      query.isRead = isRead === 'true';
    }

    const [notifications, total] = await Promise.all([
      Notification.find(query)
        .populate('sender', 'name avatar')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Notification.countDocuments(query)
    ]);

    const response: ApiResponse = {
      success: true,
      data: {
        notifications,
        pagination: {
          current: pageNum,
          pages: Math.ceil(total / limitNum),
          total,
          limit: limitNum
        }
      }
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Get notifications error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Error fetching notifications'
    };
    res.status(500).json(response);
  }
});

// @desc    Mark notification as read
// @route   PUT /api/dashboard/notifications/:id/read
// @access  Private
router.put('/notifications/:id/read', protect, async (req: any, res: Response) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user.id },
      { isRead: true, readAt: new Date() },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found'
      });
    }

    const response: ApiResponse = {
      success: true,
      data: notification,
      message: 'Notification marked as read'
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Mark notification as read error:', error);
    res.status(500).json({
      success: false,
      error: 'Error marking notification as read'
    });
  }
});

// @desc    Mark all notifications as read
// @route   PUT /api/dashboard/notifications/read-all
// @access  Private
router.put('/notifications/read-all', protect, async (req: any, res: Response) => {
  try {
    const result = await Notification.updateMany(
      { recipient: req.user.id, isRead: false },
      { isRead: true, readAt: new Date() }
    );

    const response: ApiResponse = {
      success: true,
      data: { modifiedCount: result.modifiedCount },
      message: `${result.modifiedCount} notifications marked as read`
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Mark all notifications as read error:', error);
    res.status(500).json({
      success: false,
      error: 'Error marking notifications as read'
    });
  }
});

// @desc    Delete notification
// @route   DELETE /api/dashboard/notifications/:id
// @access  Private
router.delete('/notifications/:id', protect, async (req: any, res: Response) => {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      recipient: req.user.id
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found'
      });
    }

    const response: ApiResponse = {
      success: true,
      message: 'Notification deleted successfully'
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({
      success: false,
      error: 'Error deleting notification'
    });
  }
});

// @desc    Get unread notifications count
// @route   GET /api/dashboard/notifications/unread-count
// @access  Private
router.get('/notifications/unread-count', protect, async (req: any, res: Response) => {
  try {
    const count = await Notification.countDocuments({
      recipient: req.user.id,
      isRead: false
    });

    const response: ApiResponse = {
      success: true,
      data: { count }
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({
      success: false,
      error: 'Error getting unread notifications count'
    });
  }
});

export default router;
