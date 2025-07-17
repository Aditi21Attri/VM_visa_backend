import express, { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { Payment, PaymentMethod } from '../models/Payment';
import Case from '../models/Case';
import Proposal from '../models/Proposal';
import { protect, authorize } from '../middleware/auth';

const router = express.Router();

// @desc    Get user's payment methods
// @route   GET /api/payments/methods
// @access  Private
router.get('/methods', protect, async (req: any, res: Response) => {
  try {
    const paymentMethods = await PaymentMethod.find({ 
      userId: req.user._id,
      isActive: true 
    }).sort({ isDefault: -1, createdAt: -1 });

    res.status(200).json({
      success: true,
      data: paymentMethods
    });
  } catch (error) {
    console.error('Get payment methods error:', error);
    res.status(500).json({
      success: false,
      error: 'Error fetching payment methods'
    });
  }
});

// @desc    Add new payment method
// @route   POST /api/payments/methods
// @access  Private
router.post('/methods', protect, [
  body('type').isIn(['card', 'bank_account', 'paypal']).withMessage('Invalid payment method type'),
  body('last4').optional().isLength({ min: 4, max: 4 }).withMessage('Last4 must be 4 digits'),
  body('brand').optional().trim().isLength({ min: 1, max: 50 }),
  body('expiryMonth').optional().isInt({ min: 1, max: 12 }),
  body('expiryYear').optional().isInt({ min: new Date().getFullYear() }),
  body('bankName').optional().trim().isLength({ min: 1, max: 100 }),
  body('accountType').optional().isIn(['checking', 'savings']),
  body('isDefault').optional().isBoolean()
], async (req: any, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: errors.array().map(err => err.msg).join(', ')
      });
    }

    const {
      type,
      last4,
      brand,
      expiryMonth,
      expiryYear,
      bankName,
      accountType,
      isDefault = false
    } = req.body;

    // Check if this is the user's first payment method
    const existingMethods = await PaymentMethod.countDocuments({ 
      userId: req.user._id,
      isActive: true 
    });
    
    const shouldBeDefault = existingMethods === 0 || isDefault;

    const paymentMethod = new PaymentMethod({
      userId: req.user._id,
      type,
      last4,
      brand,
      expiryMonth,
      expiryYear,
      bankName,
      accountType,
      isDefault: shouldBeDefault
    });

    await paymentMethod.save();

    res.status(201).json({
      success: true,
      data: paymentMethod,
      message: 'Payment method added successfully'
    });
  } catch (error) {
    console.error('Add payment method error:', error);
    res.status(500).json({
      success: false,
      error: 'Error adding payment method'
    });
  }
});

// @desc    Set default payment method
// @route   PUT /api/payments/methods/:id/default
// @access  Private
router.put('/methods/:id/default', protect, async (req: any, res: Response) => {
  try {
    const paymentMethod = await PaymentMethod.findOne({
      _id: req.params.id,
      userId: req.user._id,
      isActive: true
    });

    if (!paymentMethod) {
      return res.status(404).json({
        success: false,
        error: 'Payment method not found'
      });
    }

    paymentMethod.isDefault = true;
    await paymentMethod.save();

    res.status(200).json({
      success: true,
      data: paymentMethod,
      message: 'Default payment method updated'
    });
  } catch (error) {
    console.error('Set default payment method error:', error);
    res.status(500).json({
      success: false,
      error: 'Error updating default payment method'
    });
  }
});

// @desc    Process payment for accepted proposal
// @route   POST /api/payments/proposal/:proposalId
// @access  Private (Client only)
router.post('/proposal/:proposalId', protect, authorize('client'), [
  body('paymentMethodId').notEmpty().withMessage('Payment method is required'),
  body('amount').isFloat({ min: 1 }).withMessage('Amount must be greater than 0')
], async (req: any, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: errors.array().map(err => err.msg).join(', ')
      });
    }

    const { proposalId } = req.params;
    const { paymentMethodId, amount } = req.body;

    // Verify proposal exists and is accepted
    const proposal = await Proposal.findById(proposalId);
    if (!proposal) {
      return res.status(404).json({
        success: false,
        error: 'Proposal not found'
      });
    }

    if (proposal.status !== 'accepted') {
      return res.status(400).json({
        success: false,
        error: 'Proposal must be accepted before payment'
      });
    }

    // Verify payment method belongs to user
    const paymentMethod = await PaymentMethod.findOne({
      _id: paymentMethodId,
      userId: req.user._id,
      isActive: true
    });

    if (!paymentMethod) {
      return res.status(404).json({
        success: false,
        error: 'Payment method not found'
      });
    }

    // Check if payment already exists for this proposal
    const existingPayment = await Payment.findOne({ proposalId });
    if (existingPayment) {
      return res.status(400).json({
        success: false,
        error: 'Payment already processed for this proposal'
      });
    }

    // Find the associated case
    const caseDoc = await Case.findOne({ proposalId });
    if (!caseDoc) {
      return res.status(404).json({
        success: false,
        error: 'Associated case not found'
      });
    }

    // Create payment record
    const payment = new Payment({
      userId: req.user._id,
      caseId: caseDoc._id,
      proposalId,
      amount,
      type: 'proposal_payment',
      status: 'completed', // For demo - in real implementation this would be 'processing'
      paymentMethod: paymentMethodId,
      escrowStatus: 'held',
      description: `Payment for proposal: ${proposal.proposalText.substring(0, 100)}...`
    });

    // In a real implementation, you would integrate with Stripe here
    payment.paidAt = new Date();
    payment.stripePaymentIntentId = `pi_demo_${Date.now()}`;

    await payment.save();

    // Update case status to indicate payment received
    caseDoc.status = 'active';
    await caseDoc.save();

    res.status(200).json({
      success: true,
      data: {
        payment,
        case: caseDoc,
        message: 'Payment processed successfully. Funds are held in escrow.'
      }
    });
  } catch (error) {
    console.error('Process payment error:', error);
    res.status(500).json({
      success: false,
      error: 'Error processing payment'
    });
  }
});

// @desc    Get payment history
// @route   GET /api/payments/history
// @access  Private
router.get('/history', protect, async (req: any, res: Response) => {
  try {
    const payments = await Payment.find({ userId: req.user._id })
      .populate('proposalId', 'proposalText budget')
      .populate('caseId', 'status')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: payments
    });
  } catch (error) {
    console.error('Get payment history error:', error);
    res.status(500).json({
      success: false,
      error: 'Error fetching payment history'
    });
  }
});

// @desc    Release milestone payment (for demo purposes)
// @route   POST /api/payments/release-milestone
// @access  Private (Agent or Admin)
router.post('/release-milestone', protect, [
  body('caseId').notEmpty().withMessage('Case ID is required'),
  body('milestoneId').notEmpty().withMessage('Milestone ID is required')
], async (req: any, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: errors.array().map(err => err.msg).join(', ')
      });
    }

    const { caseId, milestoneId } = req.body;

    // Find the case and verify access
    const caseDoc = await Case.findById(caseId);
    if (!caseDoc) {
      return res.status(404).json({
        success: false,
        error: 'Case not found'
      });
    }

    // Find the specific milestone by order number
    const milestoneOrder = parseInt(milestoneId);
    const milestone = caseDoc.milestones.find(m => m.order === milestoneOrder);
    if (!milestone) {
      return res.status(404).json({
        success: false,
        error: 'Milestone not found'
      });
    }

    if (milestone.status !== 'completed') {
      return res.status(400).json({
        success: false,
        error: 'Milestone must be completed before payment release'
      });
    }

    // Create milestone payment record
    const milestonePayment = new Payment({
      userId: caseDoc.clientId,
      caseId,
      proposalId: caseDoc.proposalId,
      amount: milestone.amount,
      type: 'milestone_payment',
      status: 'completed',
      paymentMethod: 'escrow_release',
      escrowStatus: 'released',
      milestoneId,
      description: `Milestone payment: ${milestone.title}`,
      paidAt: new Date(),
      releasedAt: new Date()
    });

    await milestonePayment.save();

    // Update milestone status
    milestone.status = 'approved';
    milestone.approvedAt = new Date();
    milestone.isPaid = true;
    await caseDoc.save();

    res.status(200).json({
      success: true,
      data: {
        payment: milestonePayment,
        milestone,
        message: 'Milestone payment released successfully'
      }
    });
  } catch (error) {
    console.error('Release milestone payment error:', error);
    res.status(500).json({
      success: false,
      error: 'Error releasing milestone payment'
    });
  }
});

export default router;
