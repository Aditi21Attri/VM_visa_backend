import express, { Request, Response } from 'express';
import { query, validationResult } from 'express-validator';
import User from '../models/User';
import { protect, authorize } from '../middleware/auth';
import { ApiResponse, PaginatedResponse, QueryParams } from '../types';

const router = express.Router();

// @desc    Get all users (Admin only)
// @route   GET /api/users
// @access  Private (Admin only)
router.get('/', protect, authorize('admin'), [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('sort').optional().isIn(['createdAt', 'name', 'email', 'userType']),
  query('order').optional().isIn(['asc', 'desc']),
  query('userType').optional().isIn(['client', 'agent', 'organization', 'admin']),
  query('isVerified').optional().isBoolean(),
  query('isActive').optional().isBoolean(),
  query('search').optional().trim()
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const response: ApiResponse = {
        success: false,
        error: errors.array().map(err => err.msg).join(', ')
      };
      return res.status(400).json(response);
    }

    const {
      page = 1,
      limit = 10,
      sort = 'createdAt',
      order = 'desc',
      userType,
      isVerified,
      isActive,
      search
    }: QueryParams & {
      userType?: string;
      isVerified?: boolean;
      isActive?: boolean;
    } = req.query;

    // Build query
    const query: any = {};
    if (userType) query.userType = userType;
    if (isVerified !== undefined) query.isVerified = isVerified;
    if (isActive !== undefined) query.isActive = isActive;

    if (search) {
      query.$or = [
        { name: new RegExp(search, 'i') },
        { email: new RegExp(search, 'i') }
      ];
    }

    // Calculate pagination
    const pageNum = parseInt(page.toString());
    const limitNum = parseInt(limit.toString());
    const skip = (pageNum - 1) * limitNum;

    // Build sort object
    const sortObj: any = {};
    sortObj[sort] = order === 'desc' ? -1 : 1;

    // Execute query
    const [users, total] = await Promise.all([
      User.find(query)
        .select('-password -resetPasswordToken -resetPasswordExpire -verificationToken')
        .sort(sortObj)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      User.countDocuments(query)
    ]);

    const totalPages = Math.ceil(total / limitNum);

    const response: ApiResponse<PaginatedResponse<any>> = {
      success: true,
      data: {
        data: users,
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
    console.error('Get users error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Error fetching users'
    };
    res.status(500).json(response);
  }
});

// @desc    Get single user
// @route   GET /api/users/:id
// @access  Private (Admin or self)
router.get('/:id', protect, async (req: any, res: Response) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password -resetPasswordToken -resetPasswordExpire -verificationToken');

    if (!user) {
      const response: ApiResponse = {
        success: false,
        error: 'User not found'
      };
      return res.status(404).json(response);
    }

    // Check if user can access this profile (admin or self)
    if (req.user.userType !== 'admin' && req.user.id !== req.params.id) {
      const response: ApiResponse = {
        success: false,
        error: 'Not authorized to access this user profile'
      };
      return res.status(403).json(response);
    }

    const response: ApiResponse = {
      success: true,
      data: { user }
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Get user error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Error fetching user'
    };
    res.status(500).json(response);
  }
});

// @desc    Update user (Admin only)
// @route   PUT /api/users/:id
// @access  Private (Admin only)
router.put('/:id', protect, authorize('admin'), async (req: Request, res: Response) => {
  try {
    const { isVerified, isActive, userType } = req.body;

    const updateData: any = {};
    if (isVerified !== undefined) updateData.isVerified = isVerified;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (userType) updateData.userType = userType;

    const user = await User.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password -resetPasswordToken -resetPasswordExpire -verificationToken');

    if (!user) {
      const response: ApiResponse = {
        success: false,
        error: 'User not found'
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse = {
      success: true,
      data: { user },
      message: 'User updated successfully'
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Update user error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Error updating user'
    };
    res.status(500).json(response);
  }
});

// @desc    Delete user (Admin only)
// @route   DELETE /api/users/:id
// @access  Private (Admin only)
router.delete('/:id', protect, authorize('admin'), async (req: any, res: Response) => {
  try {
    // Prevent deleting the last admin
    if (req.params.id === req.user.id) {
      const response: ApiResponse = {
        success: false,
        error: 'Cannot delete your own account'
      };
      return res.status(400).json(response);
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      const response: ApiResponse = {
        success: false,
        error: 'User not found'
      };
      return res.status(404).json(response);
    }

    // Check if it's the last admin
    if (user.userType === 'admin') {
      const adminCount = await User.countDocuments({ userType: 'admin', isActive: true });
      if (adminCount <= 1) {
        const response: ApiResponse = {
          success: false,
          error: 'Cannot delete the last admin account'
        };
        return res.status(400).json(response);
      }
    }

    await User.findByIdAndDelete(req.params.id);

    const response: ApiResponse = {
      success: true,
      message: 'User deleted successfully'
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Delete user error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Error deleting user'
    };
    res.status(500).json(response);
  }
});

// @desc    Get user statistics
// @route   GET /api/users/:id/stats
// @access  Private (Admin or self)
router.get('/:id/stats', protect, async (req: any, res: Response) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      const response: ApiResponse = {
        success: false,
        error: 'User not found'
      };
      return res.status(404).json(response);
    }

    // Check access rights
    if (req.user.userType !== 'admin' && req.user.id !== req.params.id) {
      const response: ApiResponse = {
        success: false,
        error: 'Not authorized to access these statistics'
      };
      return res.status(403).json(response);
    }

    // Import models here to avoid circular dependencies
    const VisaRequest = require('../models/VisaRequest').default;
    const Proposal = require('../models/Proposal').default;
    const { Message } = require('../models/Message');

    let stats: any = {
      userType: user.userType,
      joinedAt: user.createdAt,
      isVerified: user.isVerified,
      isActive: user.isActive
    };

    if (user.userType === 'client') {
      // Client statistics
      const [totalRequests, activeRequests, completedRequests] = await Promise.all([
        VisaRequest.countDocuments({ userId: req.params.id }),
        VisaRequest.countDocuments({ userId: req.params.id, status: { $in: ['pending', 'in-progress'] } }),
        VisaRequest.countDocuments({ userId: req.params.id, status: 'completed' })
      ]);

      stats = {
        ...stats,
        totalRequests,
        activeRequests,
        completedRequests,
        completionRate: totalRequests > 0 ? ((completedRequests / totalRequests) * 100).toFixed(1) : 0
      };
    } else if (user.userType === 'agent' || user.userType === 'organization') {
      // Agent/Organization statistics
      const [totalProposals, acceptedProposals, rejectedProposals, completedCases] = await Promise.all([
        Proposal.countDocuments({ agentId: req.params.id }),
        Proposal.countDocuments({ agentId: req.params.id, status: 'accepted' }),
        Proposal.countDocuments({ agentId: req.params.id, status: 'rejected' }),
        VisaRequest.countDocuments({ assignedAgentId: req.params.id, status: 'completed' })
      ]);

      stats = {
        ...stats,
        totalProposals,
        acceptedProposals,
        rejectedProposals,
        completedCases,
        acceptanceRate: totalProposals > 0 ? ((acceptedProposals / totalProposals) * 100).toFixed(1) : 0,
        successRate: acceptedProposals > 0 ? ((completedCases / acceptedProposals) * 100).toFixed(1) : 0
      };
    }

    // Common stats for all users
    const [sentMessages, receivedMessages] = await Promise.all([
      Message.countDocuments({ senderId: req.params.id }),
      Message.countDocuments({ receiverId: req.params.id })
    ]);

    stats.communication = {
      sentMessages,
      receivedMessages,
      totalMessages: sentMessages + receivedMessages
    };

    const response: ApiResponse = {
      success: true,
      data: stats
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Get user stats error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Error fetching user statistics'
    };
    res.status(500).json(response);
  }
});

// @desc    Verify user (Admin only)
// @route   PUT /api/users/:id/verify
// @access  Private (Admin only)
router.put('/:id/verify', protect, authorize('admin'), async (req: Request, res: Response) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isVerified: true },
      { new: true }
    ).select('-password -resetPasswordToken -resetPasswordExpire -verificationToken');

    if (!user) {
      const response: ApiResponse = {
        success: false,
        error: 'User not found'
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse = {
      success: true,
      data: { user },
      message: 'User verified successfully'
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Verify user error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Error verifying user'
    };
    res.status(500).json(response);
  }
});

// @desc    Unverify user (Admin only)
// @route   PUT /api/users/:id/unverify
// @access  Private (Admin only)
router.put('/:id/unverify', protect, authorize('admin'), async (req: Request, res: Response) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isVerified: false },
      { new: true }
    ).select('-password -resetPasswordToken -resetPasswordExpire -verificationToken');

    if (!user) {
      const response: ApiResponse = {
        success: false,
        error: 'User not found'
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse = {
      success: true,
      data: { user },
      message: 'User verification removed successfully'
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Unverify user error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Error removing user verification'
    };
    res.status(500).json(response);
  }
});

// @desc    Activate user (Admin only)
// @route   PUT /api/users/:id/activate
// @access  Private (Admin only)
router.put('/:id/activate', protect, authorize('admin'), async (req: Request, res: Response) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: true },
      { new: true }
    ).select('-password -resetPasswordToken -resetPasswordExpire -verificationToken');

    if (!user) {
      const response: ApiResponse = {
        success: false,
        error: 'User not found'
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse = {
      success: true,
      data: { user },
      message: 'User activated successfully'
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Activate user error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Error activating user'
    };
    res.status(500).json(response);
  }
});

// @desc    Deactivate user (Admin only)
// @route   PUT /api/users/:id/deactivate
// @access  Private (Admin only)
router.put('/:id/deactivate', protect, authorize('admin'), async (req: any, res: Response) => {
  try {
    // Prevent deactivating own account
    if (req.params.id === req.user.id) {
      const response: ApiResponse = {
        success: false,
        error: 'Cannot deactivate your own account'
      };
      return res.status(400).json(response);
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    ).select('-password -resetPasswordToken -resetPasswordExpire -verificationToken');

    if (!user) {
      const response: ApiResponse = {
        success: false,
        error: 'User not found'
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse = {
      success: true,
      data: { user },
      message: 'User deactivated successfully'
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Deactivate user error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Error deactivating user'
    };
    res.status(500).json(response);
  }
});

// @desc    Get agents/organizations for directory
// @route   GET /api/users/directory
// @access  Public
router.get('/directory/agents', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 }),
  query('search').optional().trim(),
  query('location').optional().trim(),
  query('specialization').optional().trim()
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const response: ApiResponse = {
        success: false,
        error: errors.array().map(err => err.msg).join(', ')
      };
      return res.status(400).json(response);
    }

    const {
      page = 1,
      limit = 12,
      search,
      location,
      specialization
    } = req.query;

    // Build query for agents and organizations only
    const query: any = {
      userType: { $in: ['agent', 'organization'] },
      isVerified: true,
      isActive: true
    };

    if (search) {
      query.$or = [
        { name: new RegExp(search as string, 'i') },
        { bio: new RegExp(search as string, 'i') }
      ];
    }

    if (location) {
      query.location = new RegExp(location as string, 'i');
    }

    const pageNum = parseInt(page.toString());
    const limitNum = parseInt(limit.toString());
    const skip = (pageNum - 1) * limitNum;

    // Get agents/organizations
    const [agents, total] = await Promise.all([
      User.find(query)
        .select('name avatar bio location userType isVerified createdAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      User.countDocuments(query)
    ]);

    const totalPages = Math.ceil(total / limitNum);

    const response: ApiResponse<PaginatedResponse<any>> = {
      success: true,
      data: {
        data: agents,
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
    console.error('Get agents directory error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Error fetching agents directory'
    };
    res.status(500).json(response);
  }
});

export default router;
