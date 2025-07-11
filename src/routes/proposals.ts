import express, { Request, Response } from 'express';
import mongoose from 'mongoose';
import { body, query, validationResult } from 'express-validator';
import Proposal from '../models/Proposal';
import VisaRequest from '../models/VisaRequest';
import { protect, authorize } from '../middleware/auth';
import { 
  ApiResponse, 
  PaginatedResponse, 
  CreateProposalData,
  ProposalQueryParams,
  IProposal 
} from '../types';

const router = express.Router();

// Test auth endpoint
router.get('/test-auth', protect, (req: any, res: Response) => {
  res.json({
    success: true,
    user: {
      id: req.user.id,
      name: req.user.name,
      userType: req.user.userType
    }
  });
});

// Test agent auth endpoint
router.get('/test-agent-auth', protect, authorize('agent', 'organization'), (req: any, res: Response) => {
  res.json({
    success: true,
    message: 'Agent/Organization auth successful',
    user: {
      id: req.user.id,
      name: req.user.name,
      userType: req.user.userType
    }
  });
});

// Debug endpoint to check current user
router.get('/debug/current-user', protect, (req: any, res: Response) => {
  res.json({
    success: true,
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      userType: req.user.userType,
      isActive: req.user.isActive
    }
  });
});

// Debug endpoint to test client authorization  
router.get('/debug/client-auth', protect, authorize('client'), (req: any, res: Response) => {
  res.json({
    success: true,
    message: 'Client authorization successful',
    user: {
      id: req.user._id,
      name: req.user.name,
      userType: req.user.userType
    }
  });
});

// @desc    Get proposals with filters and pagination
// @route   GET /api/proposals
// @access  Private (Role-based access)
router.get('/', protect, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('sort').optional().isIn(['submittedAt', 'budget', 'status']),
  query('order').optional().isIn(['asc', 'desc']),
  query('requestId').optional().isMongoId(),
  query('agentId').optional().isMongoId(),
  query('status').optional().isIn(['pending', 'accepted', 'rejected', 'withdrawn'])
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

    const {
      page = 1,
      limit = 10,
      sort = 'submittedAt',
      order = 'desc',
      requestId,
      agentId,
      status
    }: ProposalQueryParams = req.query;

    // Build query with role-based access control
    const query: any = {};
    
    console.log('=== GET PROPOSALS DEBUG ===');
    console.log('User:', { id: req.user._id, userType: req.user.userType });
    console.log('Query params:', { requestId, agentId, status });
    
    // Role-based access control
    if (req.user.userType === 'admin') {
      // Admins can see all proposals
      if (requestId) query.requestId = requestId;
      if (agentId) query.agentId = agentId;
      if (status) query.status = status;
    } else if (req.user.userType === 'agent') {
      // Agents can only see their own proposals
      query.agentId = req.user._id;
      if (requestId) query.requestId = requestId;
      if (status) query.status = status;
    } else if (req.user.userType === 'client') {
      // Clients can see proposals for their requests
      if (requestId) {
        // Verify the request belongs to the client
        const visaRequest = await VisaRequest.findOne({ 
          _id: requestId, 
          userId: req.user._id 
        });
        console.log('VisaRequest found for client:', !!visaRequest);
        if (visaRequest) {
          query.requestId = requestId;
          if (status) query.status = status;
        } else {
          const response: ApiResponse = {
            success: false,
            error: 'Access denied to this visa request'
          };
          return res.status(403).json(response);
        }
      } else {
        // Get all requests for this client first
        const clientRequests = await VisaRequest.find({ 
          userId: req.user._id 
        }, '_id');
        console.log('Client requests found:', clientRequests.length);
        query.requestId = { $in: clientRequests.map(r => r._id) };
        if (status) query.status = status;
      }
    } else if (req.user.userType === 'organization') {
      // Organizations can see proposals for their members' requests
      const orgRequests = await VisaRequest.find({ 
        organizationId: req.user._id 
      }, '_id');
      query.requestId = { $in: orgRequests.map(r => r._id) };
      if (status) query.status = status;
    } else {
      const response: ApiResponse = {
        success: false,
        error: 'Access denied'
      };
      return res.status(403).json(response);
    }

    // Calculate pagination
    const pageNum = parseInt(page.toString());
    const limitNum = parseInt(limit.toString());
    const skip = (pageNum - 1) * limitNum;

    // Build sort object
    const sortObj: any = {};
    sortObj[sort] = order === 'desc' ? -1 : 1;

    console.log('Final query:', JSON.stringify(query, null, 2));
    console.log('Pagination:', { page: pageNum, limit: limitNum, skip });

    // Execute query
    const [proposals, total] = await Promise.all([
      Proposal.find(query)
        .populate('agent', 'name avatar isVerified')
        .populate('request', 'title visaType country budget')
        .sort(sortObj)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Proposal.countDocuments(query)
    ]);

    console.log('Query results:', { proposalsCount: proposals.length, total });

    const totalPages = Math.ceil(total / limitNum);

    const response: ApiResponse<PaginatedResponse<IProposal>> = {
      success: true,
      data: {
        data: proposals,
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
    console.error('Get proposals error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Error fetching proposals'
    };
    res.status(500).json(response);
  }
});

// @desc    Get single proposal
// @route   GET /api/proposals/:id
// @access  Private (Agent, Client who owns the request, or Admin)
router.get('/:id', protect, async (req: any, res: Response) => {
  try {
    const proposal = await Proposal.findById(req.params.id)
      .populate('agentId', 'name avatar isVerified bio location')
      .populate('requestId', 'title visaType country budget timeline userId')
      .lean();

    if (!proposal) {
      const response: ApiResponse = {
        success: false,
        error: 'Proposal not found'
      };
      return res.status(404).json(response);
    }

    // Check access rights
    const hasAccess = 
      proposal.agentId === req.user.id || // Proposal owner
      (proposal.requestId as any).userId === req.user.id || // Request owner
      req.user.userType === 'admin'; // Admin

    if (!hasAccess) {
      const response: ApiResponse = {
        success: false,
        error: 'Not authorized to view this proposal'
      };
      return res.status(403).json(response);
    }

    const response: ApiResponse = {
      success: true,
      data: proposal
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Get proposal error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Error fetching proposal'
    };
    res.status(500).json(response);
  }
});

// @desc    Create new proposal (simplified version)
// @route   POST /api/proposals/simple
// @access  Private (Agent or Organization only)
router.post('/simple', protect, authorize('agent', 'organization'), async (req: any, res: Response) => {
  try {
    console.log('=== SIMPLE PROPOSAL SUBMISSION ===');
    console.log('Headers:', req.headers.authorization ? 'Token present' : 'No token');
    console.log('User info:', req.user ? { id: req.user.id, name: req.user.name, userType: req.user.userType } : 'No user');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    
    const { requestId, budget, timeline, coverLetter, proposalText } = req.body;
    
    // Basic validation
    if (!requestId || !budget || !timeline || !coverLetter || !proposalText) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }
    
    // Check if visa request exists
    const visaRequest = await VisaRequest.findById(requestId);
    if (!visaRequest) {
      return res.status(404).json({
        success: false,
        error: 'Visa request not found'
      });
    }
    
    // Create simple proposal without complex validation
    const proposal = await Proposal.create({
      requestId,
      agentId: req.user.id,
      budget: Number(budget),
      timeline,
      coverLetter,
      proposalText,
      milestones: [{
        title: "Complete Visa Application",
        description: "Full visa application processing",
        amount: Number(budget),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }],
      portfolio: []
    });
    
    // Update proposal count
    await VisaRequest.findByIdAndUpdate(requestId, { $inc: { proposalCount: 1 } });
    
    res.status(201).json({
      success: true,
      data: proposal,
      message: 'Proposal submitted successfully'
    });
    
  } catch (error) {
    console.error('Simple proposal error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit proposal'
    });
  }
});

// @desc    Create new proposal
// @route   POST /api/proposals
// @access  Private (Agent or Organization only)
router.post('/', protect, authorize('agent', 'organization'), [
  body('requestId').isMongoId().withMessage('Valid request ID is required'),
  body('budget').isNumeric().isFloat({ min: 0 }).withMessage('Budget must be a positive number'),
  body('timeline').isIn([
    'urgent', '1-week', '2-weeks', '1-month', '2-3-months', '3-6-months', 'flexible'
  ]).withMessage('Invalid timeline'),
  body('coverLetter').trim().isLength({ min: 10, max: 1000 }).withMessage('Cover letter must be between 10 and 1000 characters'),
  body('proposalText').trim().isLength({ min: 50, max: 3000 }).withMessage('Proposal text must be between 50 and 3000 characters'),
  body('milestones').optional().isArray({ min: 1 }).withMessage('At least one milestone is required'),
  body('milestones.*.title').optional().trim().isLength({ min: 3, max: 100 }).withMessage('Milestone title must be between 3 and 100 characters'),
  body('milestones.*.description').optional().trim().isLength({ min: 10, max: 500 }).withMessage('Milestone description must be between 10 and 500 characters'),
  body('milestones.*.amount').optional().isNumeric().isFloat({ min: 0 }).withMessage('Milestone amount must be positive'),
  body('milestones.*.dueDate').optional().isISO8601().withMessage('Invalid due date format'),
  body('milestones.*.deliverables').optional().isArray().withMessage('Deliverables must be an array'),
  body('portfolio').optional().isArray().withMessage('Portfolio must be an array')
], async (req: any, res: Response) => {
  try {
    console.log('Received proposal data:', JSON.stringify(req.body, null, 2));
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Validation errors:', errors.array());
      const response: ApiResponse = {
        success: false,
        error: errors.array().map(err => err.msg).join(', ')
      };
      return res.status(400).json(response);
    }

    const proposalData: CreateProposalData = req.body;

    // Check if visa request exists and is open for proposals
    const visaRequest = await VisaRequest.findById(proposalData.requestId);
    if (!visaRequest) {
      const response: ApiResponse = {
        success: false,
        error: 'Visa request not found'
      };
      return res.status(404).json(response);
    }

    if (visaRequest.status !== 'pending') {
      const response: ApiResponse = {
        success: false,
        error: 'This visa request is no longer accepting proposals'
      };
      return res.status(400).json(response);
    }

    // Check if agent already submitted a proposal for this request
    const existingProposal = await Proposal.findOne({
      requestId: proposalData.requestId,
      agentId: req.user.id
    });

    if (existingProposal) {
      const response: ApiResponse = {
        success: false,
        error: 'You have already submitted a proposal for this request'
      };
      return res.status(400).json(response);
    }

    // Validate milestone amounts sum equals budget (if milestones are provided)
    if (proposalData.milestones && proposalData.milestones.length > 0) {
      const totalMilestoneAmount = proposalData.milestones.reduce((sum, milestone) => sum + milestone.amount, 0);
      if (Math.abs(totalMilestoneAmount - proposalData.budget) > 0.01) {
        const response: ApiResponse = {
          success: false,
          error: 'Sum of milestone amounts must equal the total budget'
        };
        return res.status(400).json(response);
      }
    }

    // Create proposal
    const proposal = await Proposal.create({
      ...proposalData,
      agentId: req.user.id
    });

    // Update proposal count in visa request
    await VisaRequest.findByIdAndUpdate(
      proposalData.requestId,
      { $inc: { proposalCount: 1 } }
    );

    // Populate the proposal with agent details
    const populatedProposal = await Proposal.findById(proposal._id)
      .populate('agent', 'name avatar isVerified')
      .populate('request', 'title visaType country');

    const response: ApiResponse = {
      success: true,
      data: populatedProposal,
      message: 'Proposal submitted successfully'
    };

    res.status(201).json(response);
  } catch (error) {
    console.error('Create proposal error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Error creating proposal'
    };
    res.status(500).json(response);
  }
});

// @desc    Update proposal
// @route   PUT /api/proposals/:id
// @access  Private (Proposal owner only, and only if pending)
router.put('/:id', protect, [
  body('budget').optional().isNumeric().isFloat({ min: 0 }).withMessage('Budget must be a positive number'),
  body('timeline').optional().isIn([
    'urgent', '1-week', '2-weeks', '1-month', '2-3-months', '3-6-months', 'flexible'
  ]).withMessage('Invalid timeline'),
  body('coverLetter').optional().trim().isLength({ min: 10, max: 1000 }).withMessage('Cover letter must be between 10 and 1000 characters'),
  body('proposalText').optional().trim().isLength({ min: 50, max: 3000 }).withMessage('Proposal text must be between 50 and 3000 characters'),
  body('milestones').optional().isArray({ min: 1 }).withMessage('At least one milestone is required'),
  body('portfolio').optional().isArray().withMessage('Portfolio must be an array')
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

    const proposal = await Proposal.findById(req.params.id);
    
    if (!proposal) {
      const response: ApiResponse = {
        success: false,
        error: 'Proposal not found'
      };
      return res.status(404).json(response);
    }

    // Check ownership
    if (proposal.agentId !== req.user.id) {
      const response: ApiResponse = {
        success: false,
        error: 'Not authorized to update this proposal'
      };
      return res.status(403).json(response);
    }

    // Can only update pending proposals
    if (proposal.status !== 'pending') {
      const response: ApiResponse = {
        success: false,
        error: 'Can only update pending proposals'
      };
      return res.status(400).json(response);
    }

    // Validate milestone amounts if provided
    if (req.body.milestones && req.body.budget) {
      const totalMilestoneAmount = req.body.milestones.reduce((sum: number, milestone: any) => sum + milestone.amount, 0);
      if (Math.abs(totalMilestoneAmount - req.body.budget) > 0.01) {
        const response: ApiResponse = {
          success: false,
          error: 'Sum of milestone amounts must equal the total budget'
        };
        return res.status(400).json(response);
      }
    }

    const updatedProposal = await Proposal.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('agent', 'name avatar isVerified')
     .populate('request', 'title visaType country');

    const response: ApiResponse = {
      success: true,
      data: updatedProposal,
      message: 'Proposal updated successfully'
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Update proposal error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Error updating proposal'
    };
    res.status(500).json(response);
  }
});

// @desc    Accept proposal
// @route   PUT /api/proposals/:id/accept
// @access  Private (Request owner only)
router.put('/:id/accept', protect, authorize('client'), async (req: any, res: Response) => {
  try {
    console.log('=== ACCEPT PROPOSAL DEBUG ===');
    console.log('Proposal ID:', req.params.id);
    console.log('User ID:', req.user._id);

    const proposal = await Proposal.findById(req.params.id);

    if (!proposal) {
      console.log('Proposal not found');
      const response: ApiResponse = {
        success: false,
        error: 'Proposal not found'
      };
      return res.status(404).json(response);
    }

    console.log('Proposal found:', { requestId: proposal.requestId, status: proposal.status });

    // Get the visa request separately
    const visaRequest = await VisaRequest.findById(proposal.requestId);
    if (!visaRequest) {
      console.log('Visa request not found');
      const response: ApiResponse = {
        success: false,
        error: 'Associated visa request not found'
      };
      return res.status(404).json(response);
    }

    console.log('Visa request found:', { userId: visaRequest.userId, status: visaRequest.status });

    // Check if user owns the request
    if (visaRequest.userId !== req.user._id) {
      console.log('User not authorized:', { visaRequestUserId: visaRequest.userId, currentUserId: req.user._id });
      const response: ApiResponse = {
        success: false,
        error: 'Not authorized to accept this proposal'
      };
      return res.status(403).json(response);
    }

    // Check if proposal is pending
    if (proposal.status !== 'pending') {
      console.log('Proposal not pending:', proposal.status);
      const response: ApiResponse = {
        success: false,
        error: 'Proposal is no longer pending'
      };
      return res.status(400).json(response);
    }

    // Check if request is still pending
    if (visaRequest.status !== 'pending') {
      console.log('Visa request not pending:', visaRequest.status);
      const response: ApiResponse = {
        success: false,
        error: 'This visa request is no longer accepting proposals'
      };
      return res.status(400).json(response);
    }

    console.log('All checks passed, accepting proposal...');

    // Accept the proposal
    proposal.status = 'accepted';
    await proposal.save();

    // Update the visa request status
    visaRequest.status = 'in-progress';
    await visaRequest.save();

    // Reject all other proposals for this request
    await Proposal.updateMany(
      { 
        requestId: proposal.requestId, 
        _id: { $ne: proposal._id },
        status: 'pending'
      }, 
      { status: 'rejected' }
    );

    // Get the updated proposal with populated fields
    const updatedProposal = await Proposal.findById(proposal._id);
    if (!updatedProposal) {
      console.error('Failed to retrieve updated proposal');
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve updated proposal'
      });
    }

    const agent = await mongoose.model('User').findById(proposal.agentId, 'name avatar isVerified');

    console.log('Proposal accepted successfully');

    const response: ApiResponse = {
      success: true,
      data: {
        ...updatedProposal.toObject(),
        agent,
        request: visaRequest
      },
      message: 'Proposal accepted successfully'
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Accept proposal error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Error accepting proposal'
    };
    res.status(500).json(response);
  }
});

// @desc    Reject proposal
// @route   PUT /api/proposals/:id/reject
// @access  Private (Request owner only)
router.put('/:id/reject', protect, authorize('client'), async (req: any, res: Response) => {
  try {
    const proposal = await Proposal.findById(req.params.id)
      .populate('request', 'userId');

    if (!proposal) {
      const response: ApiResponse = {
        success: false,
        error: 'Proposal not found'
      };
      return res.status(404).json(response);
    }

    // Check if user owns the request
    if ((proposal.requestId as any).userId !== req.user.id) {
      const response: ApiResponse = {
        success: false,
        error: 'Not authorized to reject this proposal'
      };
      return res.status(403).json(response);
    }

    // Check if proposal is pending
    if (proposal.status !== 'pending') {
      const response: ApiResponse = {
        success: false,
        error: 'Proposal is no longer pending'
      };
      return res.status(400).json(response);
    }

    // Reject the proposal
    proposal.status = 'rejected';
    await proposal.save();

    const response: ApiResponse = {
      success: true,
      message: 'Proposal rejected successfully'
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Reject proposal error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Error rejecting proposal'
    };
    res.status(500).json(response);
  }
});

// @desc    Withdraw proposal
// @route   PUT /api/proposals/:id/withdraw
// @access  Private (Proposal owner only)
router.put('/:id/withdraw', protect, async (req: any, res: Response) => {
  try {
    const proposal = await Proposal.findById(req.params.id);

    if (!proposal) {
      const response: ApiResponse = {
        success: false,
        error: 'Proposal not found'
      };
      return res.status(404).json(response);
    }

    // Check ownership
    if (proposal.agentId !== req.user.id) {
      const response: ApiResponse = {
        success: false,
        error: 'Not authorized to withdraw this proposal'
      };
      return res.status(403).json(response);
    }

    // Can only withdraw pending proposals
    if (proposal.status !== 'pending') {
      const response: ApiResponse = {
        success: false,
        error: 'Can only withdraw pending proposals'
      };
      return res.status(400).json(response);
    }

    // Withdraw the proposal
    proposal.status = 'withdrawn';
    await proposal.save();

    // Decrease proposal count in visa request
    await VisaRequest.findByIdAndUpdate(
      proposal.requestId,
      { $inc: { proposalCount: -1 } }
    );

    const response: ApiResponse = {
      success: true,
      message: 'Proposal withdrawn successfully'
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Withdraw proposal error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Error withdrawing proposal'
    };
    res.status(500).json(response);
  }
});

// @desc    Get agent's own proposals
// @route   GET /api/proposals/my/proposals
// @access  Private (Agent/Organization only)
router.get('/my/proposals', protect, authorize('agent', 'organization'), [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isIn(['pending', 'accepted', 'rejected', 'withdrawn'])
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

    const query: any = { agentId: req.user.id };
    if (status) query.status = status;

    const pageNum = parseInt(page.toString());
    const limitNum = parseInt(limit.toString());
    const skip = (pageNum - 1) * limitNum;

    const [proposals, total] = await Promise.all([
      Proposal.find(query)
        .populate('request', 'title visaType country budget timeline status')
        .sort({ submittedAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Proposal.countDocuments(query)
    ]);

    const totalPages = Math.ceil(total / limitNum);

    const response: ApiResponse<PaginatedResponse<IProposal>> = {
      success: true,
      data: {
        data: proposals,
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
    console.error('Get my proposals error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Error fetching your proposals'
    };
    res.status(500).json(response);
  }
});

// @desc    Delete proposal
// @route   DELETE /api/proposals/:id
// @access  Private (Proposal owner or Admin)
router.delete('/:id', protect, async (req: any, res: Response) => {
  try {
    const proposal = await Proposal.findById(req.params.id);
    
    if (!proposal) {
      const response: ApiResponse = {
        success: false,
        error: 'Proposal not found'
      };
      return res.status(404).json(response);
    }

    // Check ownership or admin
    if (proposal.agentId !== req.user.id && req.user.userType !== 'admin') {
      const response: ApiResponse = {
        success: false,
        error: 'Not authorized to delete this proposal'
      };
      return res.status(403).json(response);
    }

    // Cannot delete accepted proposals
    if (proposal.status === 'accepted') {
      const response: ApiResponse = {
        success: false,
        error: 'Cannot delete accepted proposals'
      };
      return res.status(400).json(response);
    }

    await Proposal.findByIdAndDelete(req.params.id);

    // Decrease proposal count in visa request if proposal was pending
    if (proposal.status === 'pending') {
      await VisaRequest.findByIdAndUpdate(
        proposal.requestId,
        { $inc: { proposalCount: -1 } }
      );
    }

    const response: ApiResponse = {
      success: true,
      message: 'Proposal deleted successfully'
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Delete proposal error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Error deleting proposal'
    };
    res.status(500).json(response);
  }
});

export default router;
