import express, { Request, Response } from 'express';
import { body, query, validationResult } from 'express-validator';
import VisaRequest from '../models/VisaRequest';
import Proposal from '../models/Proposal';
import { protect, authorize } from '../middleware/auth';
import { 
  ApiResponse, 
  PaginatedResponse, 
  CreateVisaRequestData, 
  UpdateVisaRequestData,
  VisaRequestQueryParams,
  IVisaRequest 
} from '../types';

const router = express.Router();

// @desc    Get all visa requests with filters and pagination
// @route   GET /api/visa-requests
// @access  Public (with optional auth)
router.get('/', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('sort').optional().isIn(['createdAt', 'updatedAt', 'budget', 'priority']).withMessage('Invalid sort field'),
  query('order').optional().isIn(['asc', 'desc']).withMessage('Order must be asc or desc'),
  query('visaType').optional().trim(),
  query('country').optional().trim(),
  query('priority').optional().isIn(['low', 'medium', 'high', 'urgent']),
  query('status').optional().isIn(['pending', 'in-progress', 'completed', 'rejected', 'cancelled'])
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
      search,
      visaType,
      country,
      priority,
      status = 'pending',
      userId
    }: VisaRequestQueryParams = req.query;

    // Build query
    const query: any = {};
    
    // If userId is specified, show all statuses for that user
    // Otherwise, only show pending requests for public access
    if (userId) {
      query.userId = userId;
      // For user's own requests, include all statuses unless specifically filtered
      if (status && status !== 'all') {
        query.status = status;
      }
    } else {
      // For public access, only show pending requests by default
      query.status = status || 'pending';
    }

    if (visaType) query.visaType = visaType;
    if (country) query.country = new RegExp(country, 'i');
    if (priority) query.priority = priority;

    if (search) {
      query.$or = [
        { title: new RegExp(search, 'i') },
        { description: new RegExp(search, 'i') }
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
    const [requests, total] = await Promise.all([
      VisaRequest.find(query)
        .populate('user', 'name avatar isVerified')
        .sort(sortObj)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      VisaRequest.countDocuments(query)
    ]);

    const totalPages = Math.ceil(total / limitNum);

    const response: ApiResponse<PaginatedResponse<IVisaRequest>> = {
      success: true,
      data: {
        data: requests,
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
    console.error('Get visa requests error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Error fetching visa requests'
    };
    res.status(500).json(response);
  }
});

// @desc    Get single visa request
// @route   GET /api/visa-requests/:id
// @access  Public
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const request = await VisaRequest.findById(req.params.id)
      .populate('user', 'name avatar isVerified createdAt')
      .populate('assignedAgent', 'name avatar isVerified')
      .lean();

    if (!request) {
      const response: ApiResponse = {
        success: false,
        error: 'Visa request not found'
      };
      return res.status(404).json(response);
    }

    // Get proposal count
    const proposalCount = await Proposal.countDocuments({ requestId: req.params.id });
    
    const response: ApiResponse = {
      success: true,
      data: {
        ...request,
        proposalCount
      }
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Get visa request error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Error fetching visa request'
    };
    res.status(500).json(response);
  }
});

// @desc    Create new visa request
// @route   POST /api/visa-requests
// @access  Private (Client only)
router.post('/', protect, authorize('client'), [
  body('title').trim().isLength({ min: 5, max: 200 }).withMessage('Title must be between 5 and 200 characters'),
  body('visaType').isIn([
    'student-visa', 'work-permit', 'permanent-residence', 'visitor-visa', 
    'business-visa', 'family-visa', 'refugee-protection', 'citizenship', 'other'
  ]).withMessage('Invalid visa type'),
  body('country').trim().isLength({ min: 2, max: 100 }).withMessage('Country is required'),
  body('description').trim().isLength({ min: 20, max: 2000 }).withMessage('Description must be between 20 and 2000 characters'),
  body('budget').isIn([
    'under-500', '500-1000', '1000-2500', '2500-5000', '5000-10000', 'above-10000'
  ]).withMessage('Invalid budget range'),
  body('timeline').isIn([
    'urgent', '1-week', '2-weeks', '1-month', '2-3-months', '3-6-months', 'flexible'
  ]).withMessage('Invalid timeline'),
  body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']).withMessage('Invalid priority')
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

    const requestData: CreateVisaRequestData = req.body;
    
    const visaRequest = await VisaRequest.create({
      ...requestData,
      userId: req.user.id
    });

    const populatedRequest = await VisaRequest.findById(visaRequest._id)
      .populate('user', 'name avatar isVerified');

    const response: ApiResponse = {
      success: true,
      data: populatedRequest,
      message: 'Visa request created successfully'
    };

    res.status(201).json(response);
  } catch (error) {
    console.error('Create visa request error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Error creating visa request'
    };
    res.status(500).json(response);
  }
});

// @desc    Update visa request
// @route   PUT /api/visa-requests/:id
// @access  Private (Owner or Admin)
router.put('/:id', protect, [
  body('title').optional().trim().isLength({ min: 5, max: 200 }).withMessage('Title must be between 5 and 200 characters'),
  body('visaType').optional().isIn([
    'student-visa', 'work-permit', 'permanent-residence', 'visitor-visa', 
    'business-visa', 'family-visa', 'refugee-protection', 'citizenship', 'other'
  ]).withMessage('Invalid visa type'),
  body('country').optional().trim().isLength({ min: 2, max: 100 }).withMessage('Country is required'),
  body('description').optional().trim().isLength({ min: 20, max: 2000 }).withMessage('Description must be between 20 and 2000 characters'),
  body('budget').optional().isIn([
    'under-500', '500-1000', '1000-2500', '2500-5000', '5000-10000', 'above-10000'
  ]).withMessage('Invalid budget range'),
  body('timeline').optional().isIn([
    'urgent', '1-week', '2-weeks', '1-month', '2-3-months', '3-6-months', 'flexible'
  ]).withMessage('Invalid timeline'),
  body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']).withMessage('Invalid priority'),
  body('status').optional().isIn(['pending', 'in-progress', 'completed', 'rejected', 'cancelled']).withMessage('Invalid status')
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

    const request = await VisaRequest.findById(req.params.id);
    
    if (!request) {
      const response: ApiResponse = {
        success: false,
        error: 'Visa request not found'
      };
      return res.status(404).json(response);
    }

    // Check ownership or admin
    if (request.userId !== req.user.id && req.user.userType !== 'admin') {
      const response: ApiResponse = {
        success: false,
        error: 'Not authorized to update this request'
      };
      return res.status(403).json(response);
    }

    const updateData: UpdateVisaRequestData = req.body;
    
    console.log('Updating visa request:', req.params.id, 'with data:', updateData);
    
    const updatedRequest = await VisaRequest.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('user', 'name avatar isVerified');

    const response: ApiResponse = {
      success: true,
      data: updatedRequest,
      message: 'Visa request updated successfully'
    };

    res.status(200).json(response);
  } catch (error: any) {
    console.error('Update visa request error:', error);
    
    // More detailed error logging
    if (error.name === 'ValidationError') {
      console.error('Validation errors:', error.errors);
    }
    
    const response: ApiResponse = {
      success: false,
      error: error.name === 'ValidationError' 
        ? Object.values(error.errors).map((err: any) => err.message).join(', ')
        : 'Error updating visa request'
    };
    res.status(500).json(response);
  }
});

// @desc    Delete visa request
// @route   DELETE /api/visa-requests/:id
// @access  Private (Owner or Admin)
router.delete('/:id', protect, async (req: any, res: Response) => {
  try {
    const request = await VisaRequest.findById(req.params.id);
    
    if (!request) {
      const response: ApiResponse = {
        success: false,
        error: 'Visa request not found'
      };
      return res.status(404).json(response);
    }

    // Check ownership or admin
    if (request.userId !== req.user.id && req.user.userType !== 'admin') {
      const response: ApiResponse = {
        success: false,
        error: 'Not authorized to delete this request'
      };
      return res.status(403).json(response);
    }

    // Check if request has active proposals or is in progress
    if (request.status === 'in-progress') {
      const response: ApiResponse = {
        success: false,
        error: 'Cannot delete request that is in progress'
      };
      return res.status(400).json(response);
    }

    await VisaRequest.findByIdAndDelete(req.params.id);

    // Also delete associated proposals
    await Proposal.deleteMany({ requestId: req.params.id });

    const response: ApiResponse = {
      success: true,
      message: 'Visa request deleted successfully'
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Delete visa request error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Error deleting visa request'
    };
    res.status(500).json(response);
  }
});

// @desc    Get proposals for a visa request
// @route   GET /api/visa-requests/:id/proposals
// @access  Private (Owner, assigned agent, or admin)
router.get('/:id/proposals', protect, async (req: any, res: Response) => {
  try {
    const request = await VisaRequest.findById(req.params.id);
    
    if (!request) {
      const response: ApiResponse = {
        success: false,
        error: 'Visa request not found'
      };
      return res.status(404).json(response);
    }

    // Check access rights
    const hasAccess = 
      request.userId === req.user.id || // Owner
      request.assignedAgentId === req.user.id || // Assigned agent
      req.user.userType === 'admin'; // Admin

    if (!hasAccess) {
      const response: ApiResponse = {
        success: false,
        error: 'Not authorized to view proposals for this request'
      };
      return res.status(403).json(response);
    }

    const proposals = await Proposal.find({ requestId: req.params.id })
      .populate('agent', 'name avatar isVerified')
      .sort({ submittedAt: -1 });

    const response: ApiResponse = {
      success: true,
      data: proposals
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Get proposals error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Error fetching proposals'
    };
    res.status(500).json(response);
  }
});

// @desc    Get user's own visa requests
// @route   GET /api/visa-requests/my/requests
// @access  Private
router.get('/my/requests', protect, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isIn(['pending', 'in-progress', 'completed', 'rejected', 'cancelled'])
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

    const { page = 1, limit = 10, status } = req.query;

    const query: any = { userId: req.user.id };
    if (status) query.status = status;

    const pageNum = parseInt(page.toString());
    const limitNum = parseInt(limit.toString());
    const skip = (pageNum - 1) * limitNum;

    const [requests, total] = await Promise.all([
      VisaRequest.find(query)
        .populate('assignedAgent', 'name avatar isVerified')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      VisaRequest.countDocuments(query)
    ]);

    const totalPages = Math.ceil(total / limitNum);

    const response: ApiResponse<PaginatedResponse<IVisaRequest>> = {
      success: true,
      data: {
        data: requests,
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
    console.error('Get my requests error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Error fetching your requests'
    };
    res.status(500).json(response);
  }
});

export default router;
