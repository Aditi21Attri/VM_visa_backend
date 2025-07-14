import express, { Response } from 'express';
import mongoose from 'mongoose';
import Case from '../models/Case';
import Proposal from '../models/Proposal';
import VisaRequest from '../models/VisaRequest';
import Escrow from '../models/Escrow';
import { protect, authorize } from '../middleware/auth';
import { ApiResponse } from '../types';
import notificationService from '../services/notificationService';
import { body, validationResult } from 'express-validator';

const router = express.Router();

// @desc    Get user's active cases
// @route   GET /api/cases
// @access  Private
router.get('/', protect, async (req: any, res: Response) => {
  try {
    let cases;
    
    if (req.user.userType === 'client') {
      cases = await Case.find({ clientId: req.user._id })
        .populate('requestId', 'title visaType country priority')
        .populate('agentId', 'name email avatar isVerified')
        .populate('proposalId', 'budget timeline')
        .sort({ lastActivity: -1 });
    } else if (req.user.userType === 'agent') {
      cases = await Case.find({ agentId: req.user._id })
        .populate('requestId', 'title visaType country priority')
        .populate('clientId', 'name email avatar')
        .populate('proposalId', 'budget timeline')
        .sort({ lastActivity: -1 });
    } else {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const response: ApiResponse = {
      success: true,
      data: cases
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Error fetching cases:', error);
    res.status(500).json({
      success: false,
      error: 'Error fetching cases'
    });
  }
});

// @desc    Get active cases with progress
// @route   GET /api/cases/active
// @access  Private
router.get('/active', protect, async (req: any, res: Response) => {
  try {
    let cases;
    
    if (req.user.userType === 'client') {
      cases = await Case.find({ 
        clientId: req.user._id,
        status: { $in: ['active', 'in-progress'] }
      })
        .populate('requestId', 'title visaType country priority')
        .populate('agentId', 'name email avatar isVerified')
        .populate('proposalId', 'budget timeline')
        .sort({ lastActivity: -1 });
    } else if (req.user.userType === 'agent') {
      cases = await Case.find({ 
        agentId: req.user._id,
        status: { $in: ['active', 'in-progress'] }
      })
        .populate('requestId', 'title visaType country priority')
        .populate('clientId', 'name email avatar')
        .populate('proposalId', 'budget timeline')
        .sort({ lastActivity: -1 });
    } else {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Calculate progress for each case
    const casesWithProgress = cases.map(caseItem => {
      const totalMilestones = caseItem.milestones.length;
      const completedMilestones = caseItem.milestones.filter(m => m.status === 'completed').length;
      const progress = totalMilestones > 0 ? Math.round((completedMilestones / totalMilestones) * 100) : 0;
      
      return {
        ...caseItem.toObject(),
        progress: {
          percentage: progress,
          completedMilestones,
          totalMilestones,
          currentMilestone: caseItem.milestones.find(m => m.isActive),
          nextMilestone: caseItem.milestones.find(m => m.status === 'pending' && !m.isActive)
        }
      };
    });

    const response: ApiResponse = {
      success: true,
      data: casesWithProgress
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Error fetching active cases:', error);
    res.status(500).json({
      success: false,
      error: 'Error fetching active cases'
    });
  }
});

// @desc    Get specific case details
// @route   GET /api/cases/:id
// @access  Private
router.get('/:id', protect, async (req: any, res: Response) => {
  try {
    const caseItem = await Case.findById(req.params.id)
      .populate('requestId', 'title visaType country priority description')
      .populate('clientId', 'name email avatar phone')
      .populate('agentId', 'name email avatar isVerified phone')
      .populate('proposalId', 'budget timeline coverLetter proposalText');

    if (!caseItem) {
      return res.status(404).json({
        success: false,
        error: 'Case not found'
      });
    }

    // Check if user has access to this case
    if (caseItem.clientId !== req.user._id && caseItem.agentId !== req.user._id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const response: ApiResponse = {
      success: true,
      data: caseItem
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Error fetching case:', error);
    res.status(500).json({
      success: false,
      error: 'Error fetching case'
    });
  }
});

// @desc    Update milestone status
// @route   PUT /api/cases/:id/milestones/:milestoneIndex
// @access  Private (Agent only)
router.put('/:id/milestones/:milestoneIndex', protect, authorize('agent'), async (req: any, res: Response) => {
  try {
    const { status, agentNotes, submittedFiles } = req.body;
    const milestoneIndex = parseInt(req.params.milestoneIndex);

    const caseItem = await Case.findById(req.params.id);

    if (!caseItem) {
      return res.status(404).json({
        success: false,
        error: 'Case not found'
      });
    }

    // Check if agent owns this case
    if (caseItem.agentId !== req.user._id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Validate milestone index
    if (milestoneIndex < 0 || milestoneIndex >= caseItem.milestones.length) {
      return res.status(400).json({
        success: false,
        error: 'Invalid milestone index'
      });
    }

    const milestone = caseItem.milestones[milestoneIndex];

    // Update milestone
    milestone.status = status;
    if (agentNotes) milestone.agentNotes = agentNotes;
    if (submittedFiles) milestone.submittedFiles = submittedFiles;

    // Set timestamps based on status
    if (status === 'in-progress' && !milestone.startedAt) {
      milestone.startedAt = new Date();
    }
    if (status === 'completed' && !milestone.completedAt) {
      milestone.completedAt = new Date();
    }

    // Update case timeline
    caseItem.timeline.push({
      action: 'milestone_updated',
      description: `Milestone "${milestone.title}" status changed to ${status}`,
      performedBy: req.user._id,
      performedAt: new Date(),
      data: { milestoneIndex, newStatus: status }
    });

    await caseItem.save();

    // Create notification for client
    const Notification = mongoose.model('Notification');
    await new Notification({
      userId: caseItem.clientId,
      title: 'Milestone Update',
      message: `Your agent has updated milestone "${milestone.title}" to ${status}`,
      type: 'milestone',
      data: {
        caseId: caseItem._id,
        milestoneIndex,
        status
      }
    }).save();

    const response: ApiResponse = {
      success: true,
      data: caseItem,
      message: 'Milestone updated successfully'
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Error updating milestone:', error);
    res.status(500).json({
      success: false,
      error: 'Error updating milestone'
    });
  }
});

// @desc    Approve milestone (Client only)
// @route   PUT /api/cases/:id/milestones/:milestoneIndex/approve
// @access  Private (Client only)
router.put('/:id/milestones/:milestoneIndex/approve', protect, authorize('client'), async (req: any, res: Response) => {
  try {
    const { clientFeedback } = req.body;
    const milestoneIndex = parseInt(req.params.milestoneIndex);

    const caseItem = await Case.findById(req.params.id);

    if (!caseItem) {
      return res.status(404).json({
        success: false,
        error: 'Case not found'
      });
    }

    // Check if client owns this case
    if (caseItem.clientId !== req.user._id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Validate milestone index
    if (milestoneIndex < 0 || milestoneIndex >= caseItem.milestones.length) {
      return res.status(400).json({
        success: false,
        error: 'Invalid milestone index'
      });
    }

    const milestone = caseItem.milestones[milestoneIndex];

    // Check if milestone is completed
    if (milestone.status !== 'completed') {
      return res.status(400).json({
        success: false,
        error: 'Milestone must be completed before approval'
      });
    }

    // Approve milestone
    milestone.status = 'approved';
    milestone.approvedAt = new Date();
    if (clientFeedback) milestone.clientFeedback = clientFeedback;

    // Activate next milestone if exists
    if (milestoneIndex + 1 < caseItem.milestones.length) {
      caseItem.milestones[milestoneIndex + 1].isActive = true;
      caseItem.currentMilestone = milestoneIndex + 2; // 1-based indexing
    }

    // Update case timeline
    caseItem.timeline.push({
      action: 'milestone_approved',
      description: `Milestone "${milestone.title}" approved by client`,
      performedBy: req.user._id,
      performedAt: new Date(),
      data: { milestoneIndex }
    });

    // Check if all milestones are approved (case completion)
    const allApproved = caseItem.milestones.every(m => m.status === 'approved');
    if (allApproved) {
      caseItem.status = 'completed';
      caseItem.actualCompletionDate = new Date();
      caseItem.timeline.push({
        action: 'case_completed',
        description: 'All milestones approved - case completed',
        performedBy: req.user._id,
        performedAt: new Date(),
        data: {}
      });
    }

    await caseItem.save();

    // Create notification for agent
    const Notification = mongoose.model('Notification');
    await new Notification({
      userId: caseItem.agentId,
      title: 'Milestone Approved',
      message: `Client has approved milestone "${milestone.title}"${allApproved ? ' - Case completed!' : ''}`,
      type: 'milestone',
      data: {
        caseId: caseItem._id,
        milestoneIndex,
        isCompleted: allApproved
      }
    }).save();

    const response: ApiResponse = {
      success: true,
      data: caseItem,
      message: allApproved ? 'Case completed successfully!' : 'Milestone approved successfully'
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Error approving milestone:', error);
    res.status(500).json({
      success: false,
      error: 'Error approving milestone'
    });
  }
});

// @desc    Add note to case
// @route   POST /api/cases/:id/notes
// @access  Private
router.post('/:id/notes', protect, async (req: any, res: Response) => {
  try {
    const { note } = req.body;

    const caseItem = await Case.findById(req.params.id);

    if (!caseItem) {
      return res.status(404).json({
        success: false,
        error: 'Case not found'
      });
    }

    // Check if user has access to this case
    if (caseItem.clientId !== req.user._id && caseItem.agentId !== req.user._id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Add note based on user type
    if (req.user.userType === 'client') {
      caseItem.clientNotes = note;
    } else if (req.user.userType === 'agent') {
      caseItem.agentNotes = note;
    }

    // Update timeline
    caseItem.timeline.push({
      action: 'note_added',
      description: `${req.user.userType} added a note`,
      performedBy: req.user._id,
      performedAt: new Date(),
      data: { noteType: req.user.userType }
    });

    await caseItem.save();

    const response: ApiResponse = {
      success: true,
      data: caseItem,
      message: 'Note added successfully'
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Error adding note:', error);
    res.status(500).json({
      success: false,
      error: 'Error adding note'
    });
  }
});

// @desc    Upload document to case
// @route   POST /api/cases/:id/documents
// @access  Private
router.post('/:id/documents', protect, async (req: any, res: Response) => {
  try {
    const { name, url, type } = req.body;

    const caseItem = await Case.findById(req.params.id);

    if (!caseItem) {
      return res.status(404).json({
        success: false,
        error: 'Case not found'
      });
    }

    // Check if user has access to this case
    if (caseItem.clientId !== req.user._id && caseItem.agentId !== req.user._id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Add document
    caseItem.documents.push({
      name,
      url,
      type,
      uploadedBy: req.user._id,
      uploadedAt: new Date()
    });

    // Update timeline
    caseItem.timeline.push({
      action: 'document_uploaded',
      description: `${req.user.name} uploaded document: ${name}`,
      performedBy: req.user._id,
      performedAt: new Date(),
      data: { documentName: name, documentType: type }
    });

    await caseItem.save();

    // Create notification for other party
    const otherPartyId = req.user.userType === 'client' ? caseItem.agentId : caseItem.clientId;
    const Notification = mongoose.model('Notification');
    await new Notification({
      userId: otherPartyId,
      title: 'New Document Uploaded',
      message: `${req.user.name} uploaded a new document: ${name}`,
      type: 'milestone',
      data: {
        caseId: caseItem._id,
        documentName: name
      }
    }).save();

    const response: ApiResponse = {
      success: true,
      data: caseItem,
      message: 'Document uploaded successfully'
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Error uploading document:', error);
    res.status(500).json({
      success: false,
      error: 'Error uploading document'
    });
  }
});

// @desc    Mark milestone as complete
// @route   POST /api/cases/:id/milestone/:milestoneId/complete
// @access  Private (Agent only)
router.post('/:id/milestone/:milestoneId/complete', protect, authorize('agent'), [
  body('evidence').optional().isArray().withMessage('Evidence must be an array'),
  body('notes').optional().isString().withMessage('Notes must be a string')
], async (req: any, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: errors.array().map(err => err.msg).join(', ')
      });
    }

    const { id, milestoneId } = req.params;
    const { evidence = [], notes } = req.body;

    const caseDoc = await Case.findById(id)
      .populate('clientId', 'name email')
      .populate('agentId', 'name email')
      .populate('escrowId');

    if (!caseDoc) {
      return res.status(404).json({
        success: false,
        error: 'Case not found'
      });
    }

    // Check if user is the assigned agent
    if (caseDoc.agentId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Only the assigned agent can mark milestones as complete'
      });
    }

    // Find the milestone by order (using milestoneId as order number)
    const milestoneOrder = parseInt(milestoneId);
    const milestone = caseDoc.milestones.find(m => m.order === milestoneOrder);
    if (!milestone) {
      return res.status(404).json({
        success: false,
        error: 'Milestone not found'
      });
    }

    // Check if milestone can be completed
    if (milestone.status === 'completed' || milestone.status === 'approved') {
      return res.status(400).json({
        success: false,
        error: 'Milestone is already completed'
      });
    }

    // Update milestone
    milestone.status = 'completed';
    milestone.completedAt = new Date();
    if (evidence.length > 0) {
      milestone.submittedFiles = evidence.map((file: any) => ({
        name: file.name || 'Evidence file',
        url: file.url || file,
        uploadedAt: new Date()
      }));
    }
    if (notes) {
      milestone.agentNotes = notes;
    }

    // Add timeline entry
    caseDoc.timeline.push({
      action: 'milestone_completed',
      description: `Milestone "${milestone.title}" marked as complete by agent`,
      performedBy: req.user.id,
      performedAt: new Date(),
      data: {
        milestoneOrder,
        milestoneTitle: milestone.title,
        evidence,
        notes
      }
    });

    caseDoc.lastActivity = new Date();
    await caseDoc.save();

    // Check if we should activate next milestone
    const currentOrder = milestone.order;
    const nextMilestone = caseDoc.milestones.find(m => m.order === currentOrder + 1);
    if (nextMilestone && nextMilestone.status === 'pending') {
      nextMilestone.status = 'in-progress';
      nextMilestone.isActive = true;
      nextMilestone.startedAt = new Date();
      await caseDoc.save();
    }

    // Send notification to client for approval
    await notificationService.createNotification({
      recipient: caseDoc.clientId.toString(),
      sender: req.user.id,
      type: 'system',
      title: 'Milestone Completed',
      message: `Agent has completed milestone: "${milestone.title}". Please review and approve for payment release.`,
      data: { 
        caseId: caseDoc._id, 
        milestoneOrder,
        milestoneTitle: milestone.title,
        amount: milestone.amount
      },
      link: `/dashboard/cases/${caseDoc._id}`,
      priority: 'high',
      category: 'info',
      channels: ['in_app', 'email']
    });

    const response: ApiResponse = {
      success: true,
      data: caseDoc,
      message: 'Milestone marked as complete successfully'
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Error completing milestone:', error);
    res.status(500).json({
      success: false,
      error: 'Error marking milestone as complete'
    });
  }
});

// @desc    Approve milestone (triggers escrow release)
// @route   POST /api/cases/:id/milestone/:milestoneId/approve
// @access  Private (Client only)
router.post('/:id/milestone/:milestoneId/approve', protect, authorize('client'), async (req: any, res: Response) => {
  try {
    const { id, milestoneId } = req.params;

    const caseDoc = await Case.findById(id)
      .populate('clientId', 'name email')
      .populate('agentId', 'name email')
      .populate('escrowId');

    if (!caseDoc) {
      return res.status(404).json({
        success: false,
        error: 'Case not found'
      });
    }

    // Check if user is the client
    if (caseDoc.clientId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Only the client can approve milestones'
      });
    }

    // Find the milestone by order
    const milestoneOrder = parseInt(milestoneId);
    const milestone = caseDoc.milestones.find(m => m.order === milestoneOrder);
    if (!milestone) {
      return res.status(404).json({
        success: false,
        error: 'Milestone not found'
      });
    }

    // Check if milestone can be approved
    if (milestone.status !== 'completed') {
      return res.status(400).json({
        success: false,
        error: 'Milestone must be completed before approval'
      });
    }

    // Update milestone
    milestone.status = 'approved';
    milestone.approvedAt = new Date();

    // Add timeline entry
    caseDoc.timeline.push({
      action: 'milestone_approved',
      description: `Milestone "${milestone.title}" approved by client`,
      performedBy: req.user.id,
      performedAt: new Date(),
      data: {
        milestoneOrder,
        milestoneTitle: milestone.title,
        amount: milestone.amount
      }
    });

    caseDoc.lastActivity = new Date();
    await caseDoc.save();

    // Trigger escrow release if escrow exists
    if (caseDoc.escrowId) {
      try {
        const escrow = await Escrow.findById(caseDoc.escrowId);
        if (escrow) {
          // Find corresponding escrow milestone
          const escrowMilestone = escrow.milestones.find(m => 
            m.description === milestone.title || m.amount === milestone.amount
          );
          
          if (escrowMilestone && escrowMilestone.status !== 'completed') {
            escrowMilestone.status = 'completed';
            escrowMilestone.completedAt = new Date();

            // Add timeline entry
            escrow.timeline.push({
              event: 'milestone_approved_release',
              description: `Milestone "${milestone.title}" approved, $${milestone.amount} released to agent`,
              date: new Date(),
              by: req.user.id
            });

            // Check if all milestones are completed
            const allCompleted = escrow.milestones.every(m => m.status === 'completed');
            if (allCompleted) {
              escrow.status = 'completed';
            } else {
              escrow.status = 'in_progress';
            }

            await escrow.save();
          }
        }
      } catch (escrowError) {
        console.error('Error updating escrow:', escrowError);
        // Continue even if escrow update fails
      }
    }

    // Send notification to agent
    await notificationService.createNotification({
      recipient: caseDoc.agentId.toString(),
      sender: req.user.id,
      type: 'payment',
      title: 'Milestone Approved - Payment Released!',
      message: `Client approved milestone: "${milestone.title}". $${milestone.amount} has been released to you.`,
      data: { 
        caseId: caseDoc._id, 
        milestoneOrder,
        milestoneTitle: milestone.title,
        amount: milestone.amount
      },
      link: `/dashboard/cases/${caseDoc._id}`,
      priority: 'high',
      category: 'success',
      channels: ['in_app', 'email']
    });

    const response: ApiResponse = {
      success: true,
      data: caseDoc,
      message: 'Milestone approved and payment released successfully'
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Error approving milestone:', error);
    res.status(500).json({
      success: false,
      error: 'Error approving milestone'
    });
  }
});

// @desc    Raise dispute for a case
// @route   POST /api/cases/:id/dispute
// @access  Private (Client, Agent)
router.post('/:id/dispute', protect, [
  body('reason').isString().isLength({ min: 10 }).withMessage('Reason is required (minimum 10 characters)'),
  body('description').isString().isLength({ min: 20 }).withMessage('Description is required (minimum 20 characters)'),
  body('evidence').optional().isArray().withMessage('Evidence must be an array')
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

    const caseDoc = await Case.findById(id)
      .populate('clientId', 'name email')
      .populate('agentId', 'name email')
      .populate('escrowId');

    if (!caseDoc) {
      return res.status(404).json({
        success: false,
        error: 'Case not found'
      });
    }

    // Check authorization
    const isAuthorized = caseDoc.clientId.toString() === req.user.id || 
                        caseDoc.agentId.toString() === req.user.id;

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to raise dispute for this case'
      });
    }

    // Update case status - using a field that exists in the schema
    caseDoc.status = 'disputed';
    
    // Add timeline entry
    caseDoc.timeline.push({
      action: 'dispute_raised',
      description: `Dispute raised: ${reason}`,
      performedBy: req.user.id,
      performedAt: new Date(),
      data: {
        reason,
        description,
        evidence
      }
    });

    caseDoc.lastActivity = new Date();
    await caseDoc.save();

    // Put escrow on hold if exists
    if (caseDoc.escrowId) {
      try {
        const escrow = await Escrow.findById(caseDoc.escrowId);
        if (escrow) {
          escrow.status = 'disputed';
          escrow.dispute = {
            reason,
            description,
            evidence,
            createdBy: req.user.id,
            status: 'open'
          };

          escrow.timeline.push({
            event: 'dispute_raised',
            description: `Dispute raised: ${reason}`,
            date: new Date(),
            by: req.user.id
          });

          await escrow.save();
        }
      } catch (escrowError) {
        console.error('Error updating escrow dispute:', escrowError);
      }
    }

    // Send notifications
    const otherPartyId = req.user.id === caseDoc.clientId.toString() ? 
                        caseDoc.agentId : caseDoc.clientId;

    await notificationService.createNotification({
      recipient: otherPartyId.toString(),
      sender: req.user.id,
      type: 'system',
      title: 'Dispute Raised',
      message: `A dispute has been raised for case: ${reason}`,
      data: { caseId: caseDoc._id, disputeReason: reason },
      link: `/dashboard/cases/${caseDoc._id}`,
      priority: 'high',
      category: 'error',
      channels: ['in_app', 'email']
    });

    const response: ApiResponse = {
      success: true,
      data: caseDoc,
      message: 'Dispute raised successfully'
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Error raising dispute:', error);
    res.status(500).json({
      success: false,
      error: 'Error raising dispute'
    });
  }
});

// @desc    Update case milestones (Agent only)
// @route   PUT /api/cases/:id/milestones
// @access  Private (Agent only)
router.put('/:id/milestones', protect, authorize('agent'), [
  body('milestones').isArray({ min: 1 }).withMessage('At least one milestone is required'),
  body('milestones.*.title').trim().isLength({ min: 3, max: 100 }).withMessage('Milestone title must be between 3 and 100 characters'),
  body('milestones.*.description').trim().isLength({ min: 10, max: 500 }).withMessage('Milestone description must be between 10 and 500 characters'),
  body('milestones.*.amount').isNumeric().isFloat({ min: 0 }).withMessage('Milestone amount must be positive'),
  body('milestones.*.dueDate').isISO8601().withMessage('Invalid due date format'),
  body('milestones.*.order').isInt({ min: 1 }).withMessage('Milestone order must be a positive integer')
], async (req: any, res: Response) => {
  try {
    console.log('🎯 UPDATING MILESTONES - Agent:', req.user._id);
    console.log('Case ID:', req.params.id);
    console.log('New milestones:', JSON.stringify(req.body.milestones, null, 2));

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const response: ApiResponse = {
        success: false,
        error: errors.array().map(err => err.msg).join(', ')
      };
      return res.status(400).json(response);
    }

    const caseData = await Case.findById(req.params.id);
    
    if (!caseData) {
      const response: ApiResponse = {
        success: false,
        error: 'Case not found'
      };
      return res.status(404).json(response);
    }

    // Check if agent owns this case
    if (caseData.agentId.toString() !== req.user._id.toString()) {
      const response: ApiResponse = {
        success: false,
        error: 'Not authorized to update this case'
      };
      return res.status(403).json(response);
    }

    // Validate total amount equals sum of milestone amounts
    const { milestones } = req.body;
    const totalMilestoneAmount = milestones.reduce((sum: number, milestone: any) => sum + milestone.amount, 0);
    
    if (Math.abs(totalMilestoneAmount - caseData.totalAmount) > 0.01) {
      const response: ApiResponse = {
        success: false,
        error: `Sum of milestone amounts (${totalMilestoneAmount}) must equal the total case amount (${caseData.totalAmount})`
      };
      return res.status(400).json(response);
    }

    // Preserve existing milestone statuses and data for milestones that haven't changed
    const updatedMilestones = milestones.map((newMilestone: any, index: number) => {
      const existingMilestone = caseData.milestones[index];
      
      return {
        ...newMilestone,
        status: existingMilestone?.status || 'pending',
        isActive: index === 0 && (!existingMilestone || existingMilestone.status === 'pending'), // First pending milestone is active
        startedAt: existingMilestone?.startedAt || null,
        completedAt: existingMilestone?.completedAt || null,
        approvedAt: existingMilestone?.approvedAt || null,
        submittedFiles: existingMilestone?.submittedFiles || [],
        clientFeedback: existingMilestone?.clientFeedback || '',
        agentNotes: existingMilestone?.agentNotes || '',
        deliverables: newMilestone.deliverables || []
      };
    });

    // Update milestones
    caseData.milestones = updatedMilestones;
    
    // Add timeline entry
    caseData.timeline.push({
      action: 'milestones_updated',
      description: 'Agent updated case milestones',
      performedBy: req.user._id,
      performedAt: new Date(),
      data: { milestoneCount: milestones.length }
    });

    await caseData.save();

    // Create notification for client
    const Notification = mongoose.model('Notification');
    await new Notification({
      recipient: caseData.clientId,
      title: 'Case Milestones Updated',
      message: 'Your agent has updated the milestones for your case. Please review the changes.',
      type: 'status_update',
      data: {
        caseId: caseData._id,
        action: 'milestones_updated'
      }
    }).save();

    console.log('✅ Milestones updated successfully');

    const response: ApiResponse = {
      success: true,
      data: caseData,
      message: 'Milestones updated successfully'
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Update milestones error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Error updating milestones'
    };
    res.status(500).json(response);
  }
});

// @desc    Update milestone status (Agent only)
// @route   PUT /api/cases/:id/milestones/:milestoneIndex/status
// @access  Private (Agent only)
router.put('/:id/milestones/:milestoneIndex/status', protect, authorize('agent'), [
  body('status').isIn(['pending', 'in-progress', 'completed']).withMessage('Invalid milestone status'),
  body('agentNotes').optional().isLength({ max: 1000 }).withMessage('Agent notes cannot exceed 1000 characters'),
  body('submittedFiles').optional().isArray().withMessage('Submitted files must be an array')
], async (req: any, res: Response) => {
  try {
    console.log('🔄 UPDATING MILESTONE STATUS - Agent:', req.user._id);
    console.log('Case ID:', req.params.id, 'Milestone:', req.params.milestoneIndex);
    console.log('New status:', req.body.status);

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const response: ApiResponse = {
        success: false,
        error: errors.array().map(err => err.msg).join(', ')
      };
      return res.status(400).json(response);
    }

    const { status, agentNotes, submittedFiles } = req.body;
    const milestoneIndex = parseInt(req.params.milestoneIndex);

    const caseData = await Case.findById(req.params.id);
    
    if (!caseData) {
      const response: ApiResponse = {
        success: false,
        error: 'Case not found'
      };
      return res.status(404).json(response);
    }

    // Check if agent owns this case
    if (caseData.agentId.toString() !== req.user._id.toString()) {
      const response: ApiResponse = {
        success: false,
        error: 'Not authorized to update this case'
      };
      return res.status(403).json(response);
    }

    // Validate milestone index
    if (milestoneIndex < 0 || milestoneIndex >= caseData.milestones.length) {
      const response: ApiResponse = {
        success: false,
        error: 'Invalid milestone index'
      };
      return res.status(400).json(response);
    }

    const milestone = caseData.milestones[milestoneIndex];
    const oldStatus = milestone.status;

    // Update milestone
    milestone.status = status;
    if (agentNotes) milestone.agentNotes = agentNotes;
    if (submittedFiles) milestone.submittedFiles = submittedFiles;

    // Set timestamps based on status
    if (status === 'in-progress' && !milestone.startedAt) {
      milestone.startedAt = new Date();
    } else if (status === 'completed' && !milestone.completedAt) {
      milestone.completedAt = new Date();
    }

    // Add timeline entry
    caseData.timeline.push({
      action: 'milestone_status_updated',
      description: `Milestone "${milestone.title}" status changed from ${oldStatus} to ${status}`,
      performedBy: req.user._id,
      performedAt: new Date(),
      data: { 
        milestoneIndex, 
        oldStatus, 
        newStatus: status,
        milestoneTitle: milestone.title
      }
    });

    await caseData.save();

    // Create notification for client
    const Notification = mongoose.model('Notification');
    await new Notification({
      recipient: caseData.clientId,
      title: 'Milestone Status Updated',
      message: `Milestone "${milestone.title}" status has been updated to ${status}.`,
      type: 'status_update',
      data: {
        caseId: caseData._id,
        milestoneIndex,
        status,
        action: 'milestone_status_updated'
      }
    }).save();

    console.log('✅ Milestone status updated successfully');

    const response: ApiResponse = {
      success: true,
      data: caseData,
      message: 'Milestone status updated successfully'
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Update milestone status error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Error updating milestone status'
    };
    res.status(500).json(response);
  }
});

// @desc    Approve/Reject milestone (Client only)
// @route   PUT /api/cases/:id/milestones/:milestoneIndex/approve
// @access  Private (Client only)
router.put('/:id/milestones/:milestoneIndex/approve', protect, authorize('client'), [
  body('action').isIn(['approve', 'reject']).withMessage('Action must be either approve or reject'),
  body('clientFeedback').optional().isLength({ max: 1000 }).withMessage('Client feedback cannot exceed 1000 characters')
], async (req: any, res: Response) => {
  try {
    console.log('✅ MILESTONE APPROVAL - Client:', req.user._id);
    console.log('Case ID:', req.params.id, 'Milestone:', req.params.milestoneIndex);
    console.log('Action:', req.body.action);

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const response: ApiResponse = {
        success: false,
        error: errors.array().map(err => err.msg).join(', ')
      };
      return res.status(400).json(response);
    }

    const { action, clientFeedback } = req.body;
    const milestoneIndex = parseInt(req.params.milestoneIndex);

    const caseData = await Case.findById(req.params.id);
    
    if (!caseData) {
      const response: ApiResponse = {
        success: false,
        error: 'Case not found'
      };
      return res.status(404).json(response);
    }

    // Check if client owns this case
    if (caseData.clientId.toString() !== req.user._id.toString()) {
      const response: ApiResponse = {
        success: false,
        error: 'Not authorized to update this case'
      };
      return res.status(403).json(response);
    }

    // Validate milestone index
    if (milestoneIndex < 0 || milestoneIndex >= caseData.milestones.length) {
      const response: ApiResponse = {
        success: false,
        error: 'Invalid milestone index'
      };
      return res.status(400).json(response);
    }

    const milestone = caseData.milestones[milestoneIndex];

    // Can only approve/reject completed milestones
    if (milestone.status !== 'completed') {
      const response: ApiResponse = {
        success: false,
        error: 'Can only approve or reject completed milestones'
      };
      return res.status(400).json(response);
    }

    // Update milestone
    milestone.status = action === 'approve' ? 'approved' : 'rejected';
    if (clientFeedback) milestone.clientFeedback = clientFeedback;
    
    if (action === 'approve') {
      milestone.approvedAt = new Date();
      
      // Activate next milestone if this one is approved
      const nextMilestoneIndex = milestoneIndex + 1;
      if (nextMilestoneIndex < caseData.milestones.length) {
        // Deactivate current milestone
        milestone.isActive = false;
        // Activate next milestone
        caseData.milestones[nextMilestoneIndex].isActive = true;
      }
    } else {
      // If rejected, milestone needs to be reworked, so set it back to in-progress
      milestone.status = 'in-progress';
      milestone.completedAt = undefined;
    }

    // Add timeline entry
    caseData.timeline.push({
      action: `milestone_${action}d`,
      description: `Milestone "${milestone.title}" has been ${action}d by client`,
      performedBy: req.user._id,
      performedAt: new Date(),
      data: { 
        milestoneIndex, 
        milestoneTitle: milestone.title,
        feedback: clientFeedback
      }
    });

    await caseData.save();

    // Create notification for agent
    const Notification = mongoose.model('Notification');
    await new Notification({
      recipient: caseData.agentId,
      title: `Milestone ${action === 'approve' ? 'Approved' : 'Rejected'}`,
      message: `Client has ${action}d milestone "${milestone.title}".${clientFeedback ? ` Feedback: ${clientFeedback}` : ''}`,
      type: 'status_update',
      data: {
        caseId: caseData._id,
        milestoneIndex,
        action,
        feedback: clientFeedback
      }
    }).save();

    console.log(`✅ Milestone ${action}d successfully`);

    const response: ApiResponse = {
      success: true,
      data: caseData,
      message: `Milestone ${action}d successfully`
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Approve milestone error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Error processing milestone approval'
    };
    res.status(500).json(response);
  }
});

// @desc    Make payment for milestone (Client only - Simulated)
// @route   POST /api/cases/:id/milestones/:milestoneIndex/payment
// @access  Private (Client only)
router.post('/:id/milestones/:milestoneIndex/payment', protect, authorize('client'), [
  body('paymentMethod').isIn(['credit_card', 'bank_transfer', 'paypal', 'crypto']).withMessage('Invalid payment method'),
  body('paymentDetails').optional().isObject().withMessage('Payment details must be an object')
], async (req: any, res: Response) => {
  try {
    console.log('💳 PROCESSING PAYMENT - Client:', req.user._id);
    console.log('Case ID:', req.params.id, 'Milestone:', req.params.milestoneIndex);
    console.log('Payment method:', req.body.paymentMethod);

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const response: ApiResponse = {
        success: false,
        error: errors.array().map(err => err.msg).join(', ')
      };
      return res.status(400).json(response);
    }

    const { paymentMethod, paymentDetails } = req.body;
    const milestoneIndex = parseInt(req.params.milestoneIndex);

    const caseData = await Case.findById(req.params.id);
    
    if (!caseData) {
      const response: ApiResponse = {
        success: false,
        error: 'Case not found'
      };
      return res.status(404).json(response);
    }

    // Check if client owns this case
    if (caseData.clientId.toString() !== req.user._id.toString()) {
      const response: ApiResponse = {
        success: false,
        error: 'Not authorized to make payment for this case'
      };
      return res.status(403).json(response);
    }

    // Validate milestone index
    if (milestoneIndex < 0 || milestoneIndex >= caseData.milestones.length) {
      const response: ApiResponse = {
        success: false,
        error: 'Invalid milestone index'
      };
      return res.status(400).json(response);
    }

    const milestone = caseData.milestones[milestoneIndex];

    // Can only pay for approved milestones
    if (milestone.status !== 'approved') {
      const response: ApiResponse = {
        success: false,
        error: 'Can only make payment for approved milestones'
      };
      return res.status(400).json(response);
    }

    // Check if milestone has already been paid
    const existingPayment = caseData.timeline.find(entry => 
      entry.action === 'payment_completed' && 
      entry.data?.milestoneIndex === milestoneIndex
    );
    
    if (existingPayment) {
      const response: ApiResponse = {
        success: false,
        error: 'Payment has already been made for this milestone'
      };
      return res.status(400).json(response);
    }

    // Simulate payment processing (2-second delay for realism)
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Generate payment ID
    const paymentId = `payment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create payment record (in a real app, this would integrate with payment processor)
    const paymentRecord = {
      paymentId,
      amount: milestone.amount,
      method: paymentMethod,
      status: 'completed', // Simulated success
      processedAt: new Date(),
      milestoneIndex,
      caseId: caseData._id,
      details: paymentDetails || {}
    };

    // Update case with payment info
    caseData.paidAmount += milestone.amount;
    
    // Add timeline entry
    caseData.timeline.push({
      action: 'payment_completed',
      description: `Payment of $${milestone.amount} completed for milestone "${milestone.title}"`,
      performedBy: req.user._id,
      performedAt: new Date(),
      data: { 
        paymentId,
        amount: milestone.amount,
        milestoneIndex,
        milestoneTitle: milestone.title,
        paymentMethod,
        paymentRecord
      }
    });

    await caseData.save();

    // Create notification for agent
    const Notification = mongoose.model('Notification');
    await new Notification({
      recipient: caseData.agentId,
      title: 'Payment Received',
      message: `Payment of $${milestone.amount} received for milestone "${milestone.title}".`,
      type: 'payment',
      data: {
        caseId: caseData._id,
        milestoneIndex,
        paymentId,
        amount: milestone.amount
      }
    }).save();

    console.log('💰 Payment processed successfully:', paymentId);

    const response: ApiResponse = {
      success: true,
      data: {
        case: caseData,
        payment: paymentRecord
      },
      message: 'Payment processed successfully'
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Process payment error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Error processing payment'
    };
    res.status(500).json(response);
  }
});

// @desc    Add notes to case
// @route   PUT /api/cases/:id/notes
// @access  Private (Case participants only)
router.put('/:id/notes', protect, [
  body('notes').trim().isLength({ min: 1, max: 2000 }).withMessage('Notes must be between 1 and 2000 characters'),
  body('type').isIn(['client', 'agent']).withMessage('Notes type must be either client or agent')
], async (req: any, res: Response) => {
  try {
    console.log('📝 UPDATING NOTES - User:', req.user._id, 'Type:', req.body.type);

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const response: ApiResponse = {
        success: false,
        error: errors.array().map(err => err.msg).join(', ')
      };
      return res.status(400).json(response);
    }

    const { notes, type } = req.body;

    const caseData = await Case.findById(req.params.id);
    
    if (!caseData) {
      const response: ApiResponse = {
        success: false,
        error: 'Case not found'
      };
      return res.status(404).json(response);
    }

    // Check access and type match
    const isClient = caseData.clientId.toString() === req.user._id.toString();
    const isAgent = caseData.agentId.toString() === req.user._id.toString();
    
    if (!isClient && !isAgent && req.user.userType !== 'admin') {
      const response: ApiResponse = {
        success: false,
        error: 'Not authorized to update this case'
      };
      return res.status(403).json(response);
    }

    // Validate user can update the specified type of notes
    if ((type === 'client' && !isClient) || (type === 'agent' && !isAgent)) {
      const response: ApiResponse = {
        success: false,
        error: 'Not authorized to update these notes'
      };
      return res.status(403).json(response);
    }

    // Update notes
    if (type === 'client') {
      caseData.clientNotes = notes;
    } else {
      caseData.agentNotes = notes;
    }

    // Add timeline entry
    caseData.timeline.push({
      action: 'notes_updated',
      description: `${type === 'client' ? 'Client' : 'Agent'} updated case notes`,
      performedBy: req.user._id,
      performedAt: new Date(),
      data: { noteType: type }
    });

    await caseData.save();

    console.log('✅ Notes updated successfully');

    const response: ApiResponse = {
      success: true,
      data: caseData,
      message: 'Notes updated successfully'
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Update notes error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Error updating notes'
    };
    res.status(500).json(response);
  }
});

// @desc    Get case timeline and payment history
// @route   GET /api/cases/:id/timeline
// @access  Private (Case participants only)
router.get('/:id/timeline', protect, async (req: any, res: Response) => {
  try {
    console.log('📋 FETCHING TIMELINE - User:', req.user._id);

    const caseData = await Case.findById(req.params.id)
      .populate('clientId', 'name avatar')
      .populate('agentId', 'name avatar');
    
    if (!caseData) {
      const response: ApiResponse = {
        success: false,
        error: 'Case not found'
      };
      return res.status(404).json(response);
    }

    // Check access
    const isClient = caseData.clientId.toString() === req.user._id.toString();
    const isAgent = caseData.agentId.toString() === req.user._id.toString();
    
    if (!isClient && !isAgent && req.user.userType !== 'admin') {
      const response: ApiResponse = {
        success: false,
        error: 'Not authorized to view this case timeline'
      };
      return res.status(403).json(response);
    }

    // Extract payments from timeline
    const payments = caseData.timeline
      .filter(entry => entry.action === 'payment_completed')
      .map(entry => ({
        paymentId: entry.data?.paymentId,
        amount: entry.data?.amount,
        milestoneTitle: entry.data?.milestoneTitle,
        milestoneIndex: entry.data?.milestoneIndex,
        paymentMethod: entry.data?.paymentMethod,
        processedAt: entry.performedAt,
        status: 'completed'
      }));

    // Calculate payment summary
    const paymentSummary = {
      totalPaid: caseData.paidAmount,
      totalAmount: caseData.totalAmount,
      remainingAmount: caseData.totalAmount - caseData.paidAmount,
      paymentsCount: payments.length,
      lastPaymentDate: payments.length > 0 ? payments[payments.length - 1].processedAt : null
    };

    const response: ApiResponse = {
      success: true,
      data: {
        case: {
          _id: caseData._id,
          status: caseData.status,
          progress: caseData.progress,
          milestones: caseData.milestones,
          client: caseData.clientId,
          agent: caseData.agentId
        },
        timeline: caseData.timeline,
        payments,
        paymentSummary
      }
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Get timeline error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Error fetching case timeline'
    };
    res.status(500).json(response);
  }
});

export default router;
