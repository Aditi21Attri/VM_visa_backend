import express, { Request, Response } from 'express';
import { protect } from '../middleware/auth';
import { ApiResponse, UserDashboardStats, AgentDashboardStats } from '../types';

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
    // Placeholder for notifications
    // In a real app, you'd have a notifications model
    const notifications = [
      {
        id: '1',
        type: 'proposal',
        title: 'New Proposal Received',
        message: 'You have received a new proposal for your visa request',
        isRead: false,
        createdAt: new Date(Date.now() - 3600000) // 1 hour ago
      },
      {
        id: '2',
        type: 'message',
        title: 'New Message',
        message: 'You have a new message from an agent',
        isRead: false,
        createdAt: new Date(Date.now() - 7200000) // 2 hours ago
      },
      {
        id: '3',
        type: 'system',
        title: 'Account Verified',
        message: 'Your account has been successfully verified',
        isRead: true,
        createdAt: new Date(Date.now() - 86400000) // 1 day ago
      }
    ];

    const response: ApiResponse = {
      success: true,
      data: notifications
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

export default router;
