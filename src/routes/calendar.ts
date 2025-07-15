import express, { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import CalendarEvent from '../models/CalendarEvent';
import { protect } from '../middleware/auth';
import { ApiResponse } from '../types';

const router = express.Router();

// @desc    Get calendar events for user
// @route   GET /api/calendar
// @access  Private
router.get('/', protect, async (req: any, res: Response) => {
  try {
    const { start, end, type, status } = req.query;
    const userId = req.user.id;

    let query: any = {
      $or: [
        { organizer: userId },
        { 'participants.user': userId }
      ]
    };

    // Add date range filter
    if (start || end) {
      query.startDate = {};
      if (start) query.startDate.$gte = new Date(start as string);
      if (end) query.startDate.$lte = new Date(end as string);
    }

    // Add type filter
    if (type && type !== 'all') {
      query.type = type;
    }

    // Add status filter
    if (status && status !== 'all') {
      query.status = status;
    }

    const events = await CalendarEvent.find(query)
      .populate('organizer', 'name email avatar userType')
      .populate('participants.user', 'name email avatar userType')
      .sort({ startDate: 1 });

    const response: ApiResponse = {
      success: true,
      data: events,
      message: 'Calendar events fetched successfully'
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Get calendar events error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Error fetching calendar events'
    };
    res.status(500).json(response);
  }
});

// @desc    Create calendar event
// @route   POST /api/calendar
// @access  Private
router.post('/', protect, [
  body('title').trim().isLength({ min: 1, max: 200 }).withMessage('Title is required and must be under 200 characters'),
  body('startDate').isISO8601().withMessage('Valid start date is required'),
  body('endDate').isISO8601().withMessage('Valid end date is required'),
  body('type').optional().isIn(['consultation', 'document-review', 'follow-up', 'deadline', 'other']),
  body('participants').optional().isArray().withMessage('Participants must be an array')
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
      title,
      description,
      startDate,
      endDate,
      type,
      participants,
      location,
      relatedTo,
      reminderSettings,
      recurring,
      meetingLink,
      agenda,
      isPrivate,
      color
    } = req.body;

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (end <= start) {
      const response: ApiResponse = {
        success: false,
        error: 'End date must be after start date'
      };
      return res.status(400).json(response);
    }

    // Create event
    const event = await CalendarEvent.create({
      title,
      description,
      startDate: start,
      endDate: end,
      type: type || 'consultation',
      organizer: req.user.id,
      participants: participants || [],
      location,
      relatedTo,
      reminderSettings,
      recurring,
      meetingLink,
      agenda,
      isPrivate: isPrivate || false,
      color: color || '#3B82F6'
    });

    const populatedEvent = await CalendarEvent.findById(event._id)
      .populate('organizer', 'name email avatar userType')
      .populate('participants.user', 'name email avatar userType');

    const response: ApiResponse = {
      success: true,
      data: populatedEvent,
      message: 'Calendar event created successfully'
    };

    res.status(201).json(response);
  } catch (error) {
    console.error('Create calendar event error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Error creating calendar event'
    };
    res.status(500).json(response);
  }
});

// @desc    Update calendar event
// @route   PUT /api/calendar/:id
// @access  Private
router.put('/:id', protect, [
  body('title').optional().trim().isLength({ min: 1, max: 200 }),
  body('startDate').optional().isISO8601(),
  body('endDate').optional().isISO8601()
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

    const event = await CalendarEvent.findById(req.params.id);
    
    if (!event) {
      const response: ApiResponse = {
        success: false,
        error: 'Calendar event not found'
      };
      return res.status(404).json(response);
    }

    // Check if user is organizer or participant
    const isOrganizer = event.organizer.toString() === req.user.id;
    const isParticipant = event.participants.some((p: any) => p.user.toString() === req.user.id);

    if (!isOrganizer && !isParticipant) {
      const response: ApiResponse = {
        success: false,
        error: 'Not authorized to update this event'
      };
      return res.status(403).json(response);
    }

    // Update event
    const updateData = { ...req.body };
    
    // Validate dates if provided
    if (updateData.startDate && updateData.endDate) {
      const start = new Date(updateData.startDate);
      const end = new Date(updateData.endDate);
      
      if (end <= start) {
        const response: ApiResponse = {
          success: false,
          error: 'End date must be after start date'
        };
        return res.status(400).json(response);
      }
    }

    const updatedEvent = await CalendarEvent.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate('organizer', 'name email avatar userType')
      .populate('participants.user', 'name email avatar userType');

    const response: ApiResponse = {
      success: true,
      data: updatedEvent,
      message: 'Calendar event updated successfully'
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Update calendar event error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Error updating calendar event'
    };
    res.status(500).json(response);
  }
});

// @desc    Delete calendar event
// @route   DELETE /api/calendar/:id
// @access  Private
router.delete('/:id', protect, async (req: any, res: Response) => {
  try {
    const event = await CalendarEvent.findById(req.params.id);
    
    if (!event) {
      const response: ApiResponse = {
        success: false,
        error: 'Calendar event not found'
      };
      return res.status(404).json(response);
    }

    // Only organizer can delete
    if (event.organizer.toString() !== req.user.id) {
      const response: ApiResponse = {
        success: false,
        error: 'Not authorized to delete this event'
      };
      return res.status(403).json(response);
    }

    await CalendarEvent.findByIdAndDelete(req.params.id);

    const response: ApiResponse = {
      success: true,
      message: 'Calendar event deleted successfully'
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Delete calendar event error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Error deleting calendar event'
    };
    res.status(500).json(response);
  }
});

// @desc    Update participant status
// @route   PUT /api/calendar/:id/participants/:participantId
// @access  Private
router.put('/:id/participants/:participantId', protect, [
  body('status').isIn(['accepted', 'declined', 'tentative']).withMessage('Invalid status')
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

    const { status } = req.body;
    const event = await CalendarEvent.findById(req.params.id);
    
    if (!event) {
      const response: ApiResponse = {
        success: false,
        error: 'Calendar event not found'
      };
      return res.status(404).json(response);
    }

    // Find participant
    const participantIndex = event.participants.findIndex(
      (p: any) => p.user.toString() === req.params.participantId
    );

    if (participantIndex === -1) {
      const response: ApiResponse = {
        success: false,
        error: 'Participant not found'
      };
      return res.status(404).json(response);
    }

    // Only the participant can update their own status
    if (req.params.participantId !== req.user.id) {
      const response: ApiResponse = {
        success: false,
        error: 'Not authorized to update this participant status'
      };
      return res.status(403).json(response);
    }

    // Update status
    event.participants[participantIndex].status = status;
    await event.save();

    const populatedEvent = await CalendarEvent.findById(event._id)
      .populate('organizer', 'name email avatar userType')
      .populate('participants.user', 'name email avatar userType');

    const response: ApiResponse = {
      success: true,
      data: populatedEvent,
      message: 'Participant status updated successfully'
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Update participant status error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Error updating participant status'
    };
    res.status(500).json(response);
  }
});

export default router;
