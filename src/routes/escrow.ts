import express, { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { protect, authorize } from '../middleware/auth';
import { ApiResponse } from '../types';
import Escrow from '../models/Escrow';
import Proposal from '../models/Proposal';
import Case from '../models/Case';
import VisaRequest from '../models/VisaRequest';
import notificationService from '../services/notificationService';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// @desc    Fund escrow when proposal is accepted
// @route   POST /api/escrow/fund
// @access  Private (Client only)
router.post('/fund', protect, authorize('client'), [
  body('proposalId').isMongoId().withMessage('Valid proposal ID is required'),
  body('amount').isNumeric().isFloat({ min: 0 }).withMessage('Amount must be positive'),
  body('paymentMethod').isIn(['stripe', 'paypal', 'bank_transfer']).withMessage('Valid payment method required')
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

    const { proposalId, amount, paymentMethod } = req.body;

    // Find the proposal and related data
    const proposal = await Proposal.findById(proposalId)
      .populate('requestId')
      .populate('agentId');

    if (!proposal) {
      return res.status(404).json({
        success: false,
        error: 'Proposal not found'
      });
    }

    // Check if escrow already exists for this proposal
    const existingEscrow = await Escrow.findOne({ proposal: proposalId });
    if (existingEscrow) {
      return res.status(400).json({
        success: false,
        error: 'Escrow already exists for this proposal'
      });
    }

    // Create escrow with milestones from proposal
    const milestones = proposal.milestones.map((milestone: any, index: number) => ({
      id: uuidv4(),
      description: milestone.title,
      amount: milestone.amount,
      status: 'pending' as const,
      order: index + 1
    }));

    const escrow = new Escrow({
      client: req.user.id,
      agent: proposal.agentId,
      proposal: proposalId,
      visaRequest: proposal.requestId,
      amount,
      currency: 'USD',
      status: 'deposited',
      paymentMethod,
      paymentIntentId: `pi_demo_${Date.now()}`,
      milestones,
      timeline: [{
        event: 'escrow_funded',
        description: 'Escrow funded by client',
        date: new Date(),
        by: req.user.id
      }],
      fees: {
        platform: amount * 0.05, // 5% platform fee
        payment: amount * 0.029, // 2.9% payment processing
        total: amount * 0.079
      },
      metadata: {
        fundedAt: new Date(),
        paymentDetails: {
          method: paymentMethod,
          demo: true
        }
      }
    });

    await escrow.save();

    // Update proposal status to accepted and create case
    await Proposal.findByIdAndUpdate(proposalId, { 
      status: 'accepted',
      acceptedAt: new Date()
    });

    // Create a case from the accepted proposal
    const caseData = {
      client: req.user.id,
      agent: proposal.agentId,
      visaRequest: proposal.requestId,
      proposal: proposalId,
      escrow: escrow._id,
      status: 'active',
      budget: proposal.budget,
      timeline: proposal.timeline,
      milestones: proposal.milestones.map((milestone: any, index: number) => ({
        title: milestone.title,
        description: milestone.description,
        amount: milestone.amount,
        order: index + 1,
        status: index === 0 ? 'in-progress' : 'pending',
        isActive: index === 0,
        dueDate: milestone.dueDate
      })),
      notes: `Case created from accepted proposal. Initial milestone activated.`
    };

    const newCase = new Case(caseData);
    await newCase.save();

    // Update escrow with case reference (if case field exists in schema)
    if ('case' in escrow) {
      (escrow as any).case = newCase._id;
      await escrow.save();
    }

    // Send notifications
    await notificationService.createNotification({
      recipient: proposal.agentId,
      sender: req.user.id,
      type: 'system',
      title: 'Proposal Accepted!',
      message: `Your proposal has been accepted and escrow has been funded with $${amount}`,
      data: { proposalId, escrowId: escrow._id, caseId: newCase._id },
      link: `/dashboard/cases/${newCase._id}`,
      priority: 'high',
      category: 'success',
      channels: ['in_app', 'email']
    });

    const response: ApiResponse = {
      success: true,
      data: {
        escrow,
        case: newCase,
        proposal
      },
      message: 'Escrow funded successfully and case created'
    };

    res.status(201).json(response);
  } catch (error) {
    console.error('Fund escrow error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Error funding escrow'
    };
    res.status(500).json(response);
  }
});

// @desc    Get user's escrow transactions
// @route   GET /api/escrow/my-transactions
// @access  Private
router.get('/my-transactions', protect, async (req: any, res: Response) => {
  try {
    // Placeholder implementation
    const transactions = [
      {
        id: 'escrow_1',
        requestId: 'req_1',
        amount: 1500,
        status: 'deposited',
        createdAt: new Date(Date.now() - 86400000) // 1 day ago
      },
      {
        id: 'escrow_2',
        requestId: 'req_2', 
        amount: 2000,
        status: 'pending',
        createdAt: new Date()
      }
    ];

    const response: ApiResponse = {
      success: true,
      data: transactions,
      message: 'Demo escrow transactions'
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Get escrow transactions error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Error fetching escrow transactions'
    };
    res.status(500).json(response);
  }
});

// @desc    Release escrow funds
// @route   POST /api/escrow/:id/release
// @access  Private (Client, Agent, Admin)
router.post('/:id/release', protect, [
  body('milestoneId').optional().isString().withMessage('Valid milestone ID required'),
  body('amount').optional().isNumeric().isFloat({ min: 0 }).withMessage('Amount must be positive'),
  body('reason').optional().isString().withMessage('Reason must be a string')
], async (req: any, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: errors.array().map(err => err.msg).join(', ')
      });
    }

    const { id } = req.params;
    const { milestoneId, amount, reason = 'Milestone completed' } = req.body;

    const escrow = await Escrow.findById(id)
      .populate('client', 'name email')
      .populate('agent', 'name email')
      .populate('case');

    if (!escrow) {
      return res.status(404).json({
        success: false,
        error: 'Escrow not found'
      });
    }

    // Check authorization
    const isAuthorized = escrow.client._id.toString() === req.user.id || 
                        escrow.agent._id.toString() === req.user.id ||
                        req.user.userType === 'admin';

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to release escrow funds'
      });
    }

    // Check if escrow can be released
    if (!['deposited', 'in_progress'].includes(escrow.status)) {
      return res.status(400).json({
        success: false,
        error: 'Escrow cannot be released in current status'
      });
    }

    let releaseAmount = amount || escrow.amount;
    let updateData: any = {};

    if (milestoneId) {
      // Release specific milestone
      const milestone = escrow.milestones.find(m => m.id === milestoneId);
      if (!milestone) {
        return res.status(404).json({
          success: false,
          error: 'Milestone not found'
        });
      }

      if (milestone.status === 'completed') {
        return res.status(400).json({
          success: false,
          error: 'Milestone already completed'
        });
      }

      // Update milestone status
      milestone.status = 'completed';
      milestone.completedAt = new Date();
      releaseAmount = milestone.amount;

      // Check if all milestones are completed
      const allCompleted = escrow.milestones.every(m => m.status === 'completed');
      updateData.status = allCompleted ? 'completed' : 'in_progress';
    } else {
      // Release entire escrow
      updateData.status = 'completed';
      escrow.milestones.forEach(m => {
        if (m.status !== 'completed') {
          m.status = 'completed';
          m.completedAt = new Date();
        }
      });
    }

    // Add timeline entry
    escrow.timeline.push({
      event: milestoneId ? 'milestone_released' : 'escrow_released',
      description: `${reason} - $${releaseAmount} released to agent`,
      date: new Date(),
      by: req.user.id
    });

    // Update escrow
    Object.assign(escrow, updateData);
    await escrow.save();

    // Update case milestones if case reference exists
    if ('case' in escrow && (escrow as any).case) {
      const caseDoc = await Case.findById((escrow as any).case);
      if (caseDoc && milestoneId) {
        const caseMilestone = caseDoc.milestones.find(m => m.title === 
          escrow.milestones.find(em => em.id === milestoneId)?.description);
        if (caseMilestone) {
          caseMilestone.status = 'approved';
          caseMilestone.approvedAt = new Date();
          await caseDoc.save();
        }
      }
    }

    // Send notifications
    const recipientId = req.user.id === escrow.client._id.toString() ? 
                       escrow.agent._id : escrow.client._id;

    await notificationService.createNotification({
      recipient: recipientId.toString(),
      sender: req.user.id,
      type: 'payment',
      title: 'Funds Released',
      message: `$${releaseAmount} has been released from escrow${milestoneId ? ' for milestone completion' : ''}`,
      data: { escrowId: escrow._id, amount: releaseAmount, milestoneId },
      link: `/dashboard/escrow/${escrow._id}`,
      priority: 'high',
      category: 'success',
      channels: ['in_app', 'email']
    });

    const response: ApiResponse = {
      success: true,
      data: escrow,
      message: `Escrow funds released successfully`
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Release escrow error:', error);
    res.status(500).json({
      success: false,
      error: 'Error releasing escrow funds'
    });
  }
});

// @desc    Put escrow funds on hold (for disputes)
// @route   POST /api/escrow/:id/hold
// @access  Private (Client, Agent, Admin)
router.post('/:id/hold', protect, [
  body('reason').isString().isLength({ min: 10 }).withMessage('Reason is required (minimum 10 characters)'),
  body('description').isString().isLength({ min: 20 }).withMessage('Description is required (minimum 20 characters)'),
  body('evidence').optional().isArray().withMessage('Evidence must be an array of strings')
], async (req: any, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: errors.array().map(err => err.msg).join(', ')
      });
    }

    const { id } = req.params;
    const { reason, description, evidence = [] } = req.body;

    const escrow = await Escrow.findById(id)
      .populate('client', 'name email')
      .populate('agent', 'name email');

    if (!escrow) {
      return res.status(404).json({
        success: false,
        error: 'Escrow not found'
      });
    }

    // Check authorization
    const isAuthorized = escrow.client._id.toString() === req.user.id || 
                        escrow.agent._id.toString() === req.user.id ||
                        req.user.userType === 'admin';

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to put escrow on hold'
      });
    }

    // Check if escrow can be disputed
    if (!['deposited', 'in_progress'].includes(escrow.status)) {
      return res.status(400).json({
        success: false,
        error: 'Escrow cannot be disputed in current status'
      });
    }

    // Update escrow status and add dispute
    escrow.status = 'disputed';
    escrow.dispute = {
      reason,
      description,
      evidence,
      createdBy: req.user.id,
      status: 'open'
    };

    // Add timeline entry
    escrow.timeline.push({
      event: 'dispute_raised',
      description: `Dispute raised: ${reason}`,
      date: new Date(),
      by: req.user.id
    });

    await escrow.save();

    // Send notifications to all parties
    const otherPartyId = req.user.id === escrow.client._id.toString() ? 
                        escrow.agent._id : escrow.client._id;

    await notificationService.createNotification({
      recipient: otherPartyId.toString(),
      sender: req.user.id,
      type: 'system',
      title: 'Escrow Dispute Raised',
      message: `A dispute has been raised for escrow funds: ${reason}`,
      data: { escrowId: escrow._id, disputeReason: reason },
      link: `/dashboard/escrow/${escrow._id}`,
      priority: 'high',
      category: 'error',
      channels: ['in_app', 'email']
    });

    // Notify admin
    await notificationService.createNotification({
      recipient: 'admin', // This would need to be handled to find admin users
      sender: req.user.id,
      type: 'system',
      title: 'New Escrow Dispute',
      message: `New dispute raised for escrow ${escrow._id}`,
      data: { escrowId: escrow._id },
      link: `/admin/disputes/${escrow._id}`,
      priority: 'high',
      category: 'warning',
      channels: ['in_app', 'email']
    });

    const response: ApiResponse = {
      success: true,
      data: escrow,
      message: 'Escrow funds put on hold due to dispute'
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Hold escrow error:', error);
    res.status(500).json({
      success: false,
      error: 'Error putting escrow on hold'
    });
  }
});

// @desc    Get escrow status and history
// @route   GET /api/escrow/:id/status
// @access  Private (Client, Agent, Admin)
router.get('/:id/status', protect, async (req: any, res: Response) => {
  try {
    const { id } = req.params;

    const escrow = await Escrow.findById(id)
      .populate('client', 'name email avatar')
      .populate('agent', 'name email avatar')
      .populate('proposal', 'title budget timeline')
      .populate('visaRequest', 'title status')
      .populate('case', 'status');

    if (!escrow) {
      return res.status(404).json({
        success: false,
        error: 'Escrow not found'
      });
    }

    // Check authorization
    const isAuthorized = escrow.client._id.toString() === req.user.id || 
                        escrow.agent._id.toString() === req.user.id ||
                        req.user.userType === 'admin';

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to view escrow details'
      });
    }

    // Calculate progress
    const completedMilestones = escrow.milestones.filter(m => m.status === 'completed').length;
    const progress = escrow.milestones.length > 0 ? 
                    (completedMilestones / escrow.milestones.length) * 100 : 0;

    // Calculate remaining amount
    const releasedAmount = escrow.milestones
      .filter(m => m.status === 'completed')
      .reduce((sum, m) => sum + m.amount, 0);
    
    const remainingAmount = escrow.amount - releasedAmount;

    const escrowStatus = {
      ...escrow.toObject(),
      progress,
      releasedAmount,
      remainingAmount,
      completedMilestones,
      totalMilestones: escrow.milestones.length
    };

    const response: ApiResponse = {
      success: true,
      data: escrowStatus,
      message: 'Escrow status retrieved successfully'
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Get escrow status error:', error);
    res.status(500).json({
      success: false,
      error: 'Error retrieving escrow status'
    });
  }
});

// @desc    Get user's escrow transactions
// @route   GET /api/escrow/my-transactions
// @access  Private
router.get('/my-transactions', protect, async (req: any, res: Response) => {
  try {
    const query: any = {};
    
    // Filter based on user type and role
    if (req.user.userType === 'client') {
      query.client = req.user.id;
    } else if (req.user.userType === 'agent') {
      query.agent = req.user.id;
    } else if (req.user.userType === 'admin') {
      // Admin can see all transactions
    } else {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to view escrow transactions'
      });
    }

    const transactions = await Escrow.find(query)
      .populate('client', 'name email avatar')
      .populate('agent', 'name email avatar')
      .populate('proposal', 'title budget')
      .populate('visaRequest', 'title visaType')
      .sort({ createdAt: -1 })
      .limit(50);

    const response: ApiResponse = {
      success: true,
      data: transactions,
      message: 'Escrow transactions retrieved successfully'
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Get escrow transactions error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Error fetching escrow transactions'
    };
    res.status(500).json(response);
  }
});

// @desc    Get all escrow transactions (admin only)
// @route   GET /api/escrow/all
// @access  Private (Admin only)
router.get('/all', protect, authorize('admin'), async (req: any, res: Response) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const query: any = {};
    
    if (status) {
      query.status = status;
    }

    if (search) {
      // Search in client/agent names or proposal titles
      const searchRegex = { $regex: search, $options: 'i' };
      query.$or = [
        { 'client.name': searchRegex },
        { 'agent.name': searchRegex },
        { 'proposal.title': searchRegex }
      ];
    }

    const [transactions, total] = await Promise.all([
      Escrow.find(query)
        .populate('client', 'name email avatar')
        .populate('agent', 'name email avatar')
        .populate('proposal', 'title budget')
        .populate('visaRequest', 'title visaType')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Escrow.countDocuments(query)
    ]);

    const response: ApiResponse = {
      success: true,
      data: {
        transactions,
        pagination: {
          current: Number(page),
          pages: Math.ceil(total / Number(limit)),
          total,
          limit: Number(limit)
        }
      },
      message: 'All escrow transactions retrieved successfully'
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Get all escrow transactions error:', error);
    res.status(500).json({
      success: false,
      error: 'Error fetching all escrow transactions'
    });
  }
});

export default router;
