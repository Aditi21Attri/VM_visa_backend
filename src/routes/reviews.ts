import express, { Request, Response } from 'express';
import { body, query, validationResult } from 'express-validator';
import { protect } from '../middleware/auth';
import { ApiResponse, PaginatedResponse, IReview } from '../types';
import Review from '../models/Review';

const router = express.Router();

// @desc    Create review
// @route   POST /api/reviews
// @access  Private
router.post('/', protect, [
  body('requestId').isMongoId().withMessage('Valid request ID is required'),
  body('revieweeId').isMongoId().withMessage('Valid reviewee ID is required'),
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('comment').trim().isLength({ min: 10, max: 1000 }).withMessage('Comment must be between 10 and 1000 characters'),
  body('isPublic').optional().isBoolean().withMessage('isPublic must be boolean')
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

    const { requestId, revieweeId, rating, comment, isPublic = true } = req.body;

    // Check if user is trying to review themselves
    if (revieweeId === req.user.id) {
      const response: ApiResponse = {
        success: false,
        error: 'Cannot review yourself'
      };
      return res.status(400).json(response);
    }

    // Check if review already exists for this request
    const existingReview = await Review.findOne({
      requestId,
      reviewerId: req.user.id
    });

    if (existingReview) {
      const response: ApiResponse = {
        success: false,
        error: 'You have already reviewed this request'
      };
      return res.status(400).json(response);
    }

    // Create review
    const review = await Review.create({
      requestId,
      reviewerId: req.user.id,
      revieweeId,
      rating,
      comment,
      isPublic
    });

    const populatedReview = await Review.findById(review._id)
      .populate('reviewer', 'name avatar')
      .populate('reviewee', 'name avatar')
      .populate('request', 'title visaType');

    // Send notification to reviewee
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${revieweeId}`).emit('reviewNotification', {
        type: 'review_received',
        requestId,
        rating,
        reviewerId: req.user.id,
        timestamp: new Date()
      });
    }

    const response: ApiResponse = {
      success: true,
      data: populatedReview,
      message: 'Review created successfully'
    };

    res.status(201).json(response);
  } catch (error) {
    console.error('Create review error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Error creating review'
    };
    res.status(500).json(response);
  }
});

// @desc    Get reviews for a user
// @route   GET /api/reviews/user/:userId
// @access  Public
router.get('/user/:userId', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 }),
  query('rating').optional().isInt({ min: 1, max: 5 })
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

    const { userId } = req.params;
    const { page = 1, limit = 10, rating } = req.query;

    const query: any = {
      revieweeId: userId,
      isPublic: true
    };

    if (rating) query.rating = rating;

    const pageNum = parseInt(page.toString());
    const limitNum = parseInt(limit.toString());
    const skip = (pageNum - 1) * limitNum;

    const [reviews, total] = await Promise.all([
      Review.find(query)
        .populate('reviewer', 'name avatar isVerified')
        .populate('request', 'title visaType')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean() as unknown as IReview[],
      Review.countDocuments(query)
    ]);

    // Calculate rating statistics
    const ratingStats = await Review.aggregate([
      { $match: { revieweeId: userId, isPublic: true } },
      {
        $group: {
          _id: null,
          avgRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 },
          ratingDistribution: {
            $push: {
              $switch: {
                branches: [
                  { case: { $eq: ['$rating', 1] }, then: '1' },
                  { case: { $eq: ['$rating', 2] }, then: '2' },
                  { case: { $eq: ['$rating', 3] }, then: '3' },
                  { case: { $eq: ['$rating', 4] }, then: '4' },
                  { case: { $eq: ['$rating', 5] }, then: '5' }
                ]
              }
            }
          }
        }
      }
    ]);

    const totalPages = Math.ceil(total / limitNum);

    const response: ApiResponse<PaginatedResponse<IReview> & { stats: any }> = {
      success: true,
      data: {
        data: reviews,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
        stats: ratingStats[0] || { avgRating: 0, totalReviews: 0, ratingDistribution: [] }
      }
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Get user reviews error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Error fetching reviews'
    };
    res.status(500).json(response);
  }
});

// @desc    Get reviews given by a user
// @route   GET /api/reviews/given
// @access  Private
router.get('/given', protect, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 })
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

    const { page = 1, limit = 10 } = req.query;

    const pageNum = parseInt(page.toString());
    const limitNum = parseInt(limit.toString());
    const skip = (pageNum - 1) * limitNum;

    const [reviews, total] = await Promise.all([
      Review.find({ reviewerId: req.user.id })
        .populate('reviewee', 'name avatar')
        .populate('request', 'title visaType')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean() as unknown as IReview[],
      Review.countDocuments({ reviewerId: req.user.id })
    ]);

    const totalPages = Math.ceil(total / limitNum);

    const response: ApiResponse<PaginatedResponse<IReview>> = {
      success: true,
      data: {
        data: reviews,
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
    console.error('Get given reviews error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Error fetching given reviews'
    };
    res.status(500).json(response);
  }
});

// @desc    Update review
// @route   PUT /api/reviews/:id
// @access  Private (Review owner only)
router.put('/:id', protect, [
  body('rating').optional().isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('comment').optional().trim().isLength({ min: 10, max: 1000 }).withMessage('Comment must be between 10 and 1000 characters'),
  body('isPublic').optional().isBoolean().withMessage('isPublic must be boolean')
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

    const review = await Review.findById(req.params.id) as unknown as IReview;

    if (!review) {
      const response: ApiResponse = {
        success: false,
        error: 'Review not found'
      };
      return res.status(404).json(response);
    }

    // Check ownership
    if (review.reviewerId !== req.user.id) {
      const response: ApiResponse = {
        success: false,
        error: 'Not authorized to update this review'
      };
      return res.status(403).json(response);
    }

    const { rating, comment, isPublic } = req.body;
    const updateData: any = {};
    if (rating) updateData.rating = rating;
    if (comment) updateData.comment = comment;
    if (isPublic !== undefined) updateData.isPublic = isPublic;

    const updatedReview = await Review.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('reviewer', 'name avatar')
     .populate('reviewee', 'name avatar')
     .populate('request', 'title visaType');

    const response: ApiResponse = {
      success: true,
      data: updatedReview,
      message: 'Review updated successfully'
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Update review error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Error updating review'
    };
    res.status(500).json(response);
  }
});

// @desc    Delete review
// @route   DELETE /api/reviews/:id
// @access  Private (Review owner only)
router.delete('/:id', protect, async (req: any, res: Response) => {
  try {
    const review = await Review.findById(req.params.id) as unknown as IReview;

    if (!review) {
      const response: ApiResponse = {
        success: false,
        error: 'Review not found'
      };
      return res.status(404).json(response);
    }

    // Check ownership
    if (review.reviewerId !== req.user.id) {
      const response: ApiResponse = {
        success: false,
        error: 'Not authorized to delete this review'
      };
      return res.status(403).json(response);
    }

    await Review.findByIdAndDelete(req.params.id);

    const response: ApiResponse = {
      success: true,
      message: 'Review deleted successfully'
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Delete review error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Error deleting review'
    };
    res.status(500).json(response);
  }
});

// @desc    Get single review
// @route   GET /api/reviews/:id
// @access  Public
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const review = await Review.findById(req.params.id)
      .populate('reviewer', 'name avatar isVerified')
      .populate('reviewee', 'name avatar')
      .populate('request', 'title visaType') as unknown as IReview;

    if (!review) {
      const response: ApiResponse = {
        success: false,
        error: 'Review not found'
      };
      return res.status(404).json(response);
    }

    // Only show public reviews unless user is involved
    if (!review.isPublic) {
      const response: ApiResponse = {
        success: false,
        error: 'Review is not public'
      };
      return res.status(403).json(response);
    }

    const response: ApiResponse = {
      success: true,
      data: review
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Get review error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Error fetching review'
    };
    res.status(500).json(response);
  }
});

export default router;
