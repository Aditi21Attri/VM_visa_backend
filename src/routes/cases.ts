import express, { Response } from 'express';
import mongoose from 'mongoose';
import Case from '../models/Case';
import Proposal from '../models/Proposal';
import VisaRequest from '../models/VisaRequest';
import { protect, authorize } from '../middleware/auth';
import { ApiResponse } from '../types';

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

export default router;
