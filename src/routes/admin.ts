import express, { Request, Response } from 'express';
import { protect, authorize } from '../middleware/auth';
import { ApiResponse, DashboardStats } from '../types';

const router = express.Router();

// @desc    Get admin dashboard statistics
// @route   GET /api/admin/stats
// @access  Private (Admin only)
router.get('/stats', protect, authorize('admin'), async (req: Request, res: Response) => {
  try {
    // Import models here to avoid circular dependencies
    const User = require('../models/User').default;
    const VisaRequest = require('../models/VisaRequest').default;
    const Proposal = require('../models/Proposal').default;
    const { Message } = require('../models/Message');

    // Get basic counts
    const [
      totalUsers,
      totalClients,
      totalAgents,
      totalOrganizations,
      verifiedUsers,
      activeUsers,
      totalRequests,
      pendingRequests,
      inProgressRequests,
      completedRequests,
      totalProposals,
      pendingProposals,
      acceptedProposals,
      totalMessages
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ userType: 'client' }),
      User.countDocuments({ userType: 'agent' }),
      User.countDocuments({ userType: 'organization' }),
      User.countDocuments({ isVerified: true }),
      User.countDocuments({ isActive: true }),
      VisaRequest.countDocuments(),
      VisaRequest.countDocuments({ status: 'pending' }),
      VisaRequest.countDocuments({ status: 'in-progress' }),
      VisaRequest.countDocuments({ status: 'completed' }),
      Proposal.countDocuments(),
      Proposal.countDocuments({ status: 'pending' }),
      Proposal.countDocuments({ status: 'accepted' }),
      Message.countDocuments()
    ]);

    // Get recent activity
    const recentUsers = await User.find({ isActive: true })
      .select('name email userType createdAt')
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    const recentRequests = await VisaRequest.find()
      .populate('user', 'name email')
      .select('title visaType country status createdAt')
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    const stats: DashboardStats = {
      totalUsers,
      totalRequests,
      totalProposals,
      totalEscrowAmount: 0, // Placeholder
      recentActivity: []
    };

    const detailedStats = {
      users: {
        total: totalUsers,
        clients: totalClients,
        agents: totalAgents,
        organizations: totalOrganizations,
        verified: verifiedUsers,
        active: activeUsers
      },
      requests: {
        total: totalRequests,
        pending: pendingRequests,
        inProgress: inProgressRequests,
        completed: completedRequests
      },
      proposals: {
        total: totalProposals,
        pending: pendingProposals,
        accepted: acceptedProposals
      },
      communication: {
        totalMessages
      },
      recentActivity: {
        users: recentUsers,
        requests: recentRequests
      }
    };

    const response: ApiResponse = {
      success: true,
      data: detailedStats
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Get admin stats error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Error fetching admin statistics'
    };
    res.status(500).json(response);
  }
});

// @desc    Get system health
// @route   GET /api/admin/health
// @access  Private (Admin only)
router.get('/health', protect, authorize('admin'), async (req: Request, res: Response) => {
  try {
    const healthData = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      environment: process.env.NODE_ENV || 'development',
      database: 'connected' // You could add actual DB health check here
    };

    const response: ApiResponse = {
      success: true,
      data: healthData
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Get system health error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Error fetching system health'
    };
    res.status(500).json(response);
  }
});

// @desc    Send system notification
// @route   POST /api/admin/notifications
// @access  Private (Admin only)
router.post('/notifications', protect, authorize('admin'), async (req: any, res: Response) => {
  try {
    const { message, userType, targetUsers } = req.body;

    if (!message) {
      const response: ApiResponse = {
        success: false,
        error: 'Message is required'
      };
      return res.status(400).json(response);
    }

    // Send notification via socket
    const io = req.app.get('io');
    if (io) {
      if (targetUsers && Array.isArray(targetUsers)) {
        // Send to specific users
        targetUsers.forEach((userId: string) => {
          io.to(`user_${userId}`).emit('adminNotification', {
            type: 'system',
            message,
            timestamp: new Date()
          });
        });
      } else if (userType) {
        // Broadcast to all users of specific type
        io.emit('adminNotification', {
          type: 'system',
          message,
          userType,
          timestamp: new Date()
        });
      } else {
        // Broadcast to all users
        io.emit('adminNotification', {
          type: 'system',
          message,
          timestamp: new Date()
        });
      }
    }

    const response: ApiResponse = {
      success: true,
      message: 'Notification sent successfully'
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Send notification error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Error sending notification'
    };
    res.status(500).json(response);
  }
});

export default router;
