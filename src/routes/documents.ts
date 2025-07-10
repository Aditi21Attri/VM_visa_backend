import express, { Request, Response } from 'express';
import { body, query, validationResult } from 'express-validator';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { protect, authorize } from '../middleware/auth';
import { ApiResponse, PaginatedResponse } from '../types';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(process.cwd(), 'uploads/documents');
    // Create directory if it doesn't exist
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req: any, file, cb) => {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    cb(null, `${req.user.id}-${uniqueSuffix}${extension}`);
  }
});

const fileFilter = (req: any, file: any, cb: any) => {
  // Allow specific file types
  const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only images, PDFs, and documents are allowed.'));
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760') // 10MB default
  },
  fileFilter: fileFilter
});

// Document model (we'll create this inline for now)
import mongoose, { Schema } from 'mongoose';
import { IDocument } from '../types';

const documentSchema = new Schema<IDocument>({
  userId: {
    type: String,
    required: [true, 'User ID is required'],
    ref: 'User'
  },
  requestId: {
    type: String,
    ref: 'VisaRequest',
    default: null
  },
  name: {
    type: String,
    required: [true, 'Document name is required']
  },
  originalName: {
    type: String,
    required: [true, 'Original filename is required']
  },
  type: {
    type: String,
    required: [true, 'File type is required']
  },
  size: {
    type: Number,
    required: [true, 'File size is required']
  },
  url: {
    type: String,
    required: [true, 'File URL is required']
  },
  cloudinaryPublicId: {
    type: String,
    default: null
  },
  category: {
    type: String,
    enum: ['passport', 'visa', 'education', 'employment', 'financial', 'other'],
    default: 'other'
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  verifiedBy: {
    type: String,
    ref: 'User',
    default: null
  },
  verifiedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: { createdAt: 'uploadedAt', updatedAt: true },
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
documentSchema.index({ userId: 1 });
documentSchema.index({ requestId: 1 });
documentSchema.index({ category: 1 });
documentSchema.index({ isVerified: 1 });

// Virtual for user details
documentSchema.virtual('user', {
  ref: 'User',
  localField: 'userId',
  foreignField: '_id',
  justOne: true
});

// Virtual for request details
documentSchema.virtual('request', {
  ref: 'VisaRequest',
  localField: 'requestId',
  foreignField: '_id',
  justOne: true
});

const Document = mongoose.model<IDocument>('Document', documentSchema);

// @desc    Upload document
// @route   POST /api/documents/upload
// @access  Private
router.post('/upload', protect, upload.single('document'), [
  body('name').optional().trim().isLength({ min: 1, max: 200 }).withMessage('Document name must be between 1 and 200 characters'),
  body('category').optional().isIn(['passport', 'visa', 'education', 'employment', 'financial', 'other']).withMessage('Invalid category'),
  body('requestId').optional().isMongoId().withMessage('Invalid request ID')
], async (req: any, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      // Clean up uploaded file if validation fails
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      const response: ApiResponse = {
        success: false,
        error: errors.array().map(err => err.msg).join(', ')
      };
      return res.status(400).json(response);
    }

    if (!req.file) {
      const response: ApiResponse = {
        success: false,
        error: 'No file uploaded'
      };
      return res.status(400).json(response);
    }

    const { name, category = 'other', requestId } = req.body;

    // Create document record
    const document = await Document.create({
      userId: req.user.id,
      requestId: requestId || null,
      name: name || req.file.originalname,
      originalName: req.file.originalname,
      type: req.file.mimetype,
      size: req.file.size,
      url: `/uploads/documents/${req.file.filename}`,
      category
    });

    const response: ApiResponse = {
      success: true,
      data: document,
      message: 'Document uploaded successfully'
    };

    res.status(201).json(response);
  } catch (error) {
    // Clean up uploaded file on error
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    console.error('Upload document error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Error uploading document'
    };
    res.status(500).json(response);
  }
});

// @desc    Get user's documents
// @route   GET /api/documents/my-documents
// @access  Private
router.get('/my-documents', protect, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('category').optional().isIn(['passport', 'visa', 'education', 'employment', 'financial', 'other']),
  query('requestId').optional().isMongoId(),
  query('isVerified').optional().isBoolean()
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

    const { page = 1, limit = 20, category, requestId, isVerified } = req.query;

    const query: any = { userId: req.user.id };
    if (category) query.category = category;
    if (requestId) query.requestId = requestId;
    if (isVerified !== undefined) query.isVerified = isVerified;

    const pageNum = parseInt(page.toString());
    const limitNum = parseInt(limit.toString());
    const skip = (pageNum - 1) * limitNum;

    const [documents, total] = await Promise.all([
      Document.find(query)
        .populate('request', 'title visaType')
        .populate('verifiedBy', 'name')
        .sort({ uploadedAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Document.countDocuments(query)
    ]);

    const totalPages = Math.ceil(total / limitNum);

    const response: ApiResponse<PaginatedResponse<IDocument>> = {
      success: true,
      data: {
        data: documents,
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
    console.error('Get documents error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Error fetching documents'
    };
    res.status(500).json(response);
  }
});

// @desc    Get single document
// @route   GET /api/documents/:id
// @access  Private
router.get('/:id', protect, async (req: any, res: Response) => {
  try {
    const document = await Document.findById(req.params.id)
      .populate('user', 'name avatar')
      .populate('request', 'title visaType')
      .populate('verifiedBy', 'name');

    if (!document) {
      const response: ApiResponse = {
        success: false,
        error: 'Document not found'
      };
      return res.status(404).json(response);
    }

    // Check access rights
    const hasAccess = 
      document.userId === req.user.id || // Owner
      req.user.userType === 'admin' || // Admin
      (document.requestId && req.user.userType === 'agent'); // Agent for specific request

    if (!hasAccess) {
      const response: ApiResponse = {
        success: false,
        error: 'Not authorized to access this document'
      };
      return res.status(403).json(response);
    }

    const response: ApiResponse = {
      success: true,
      data: document
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Get document error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Error fetching document'
    };
    res.status(500).json(response);
  }
});

// @desc    Download document
// @route   GET /api/documents/:id/download
// @access  Private
router.get('/:id/download', protect, async (req: any, res: Response) => {
  try {
    const document = await Document.findById(req.params.id);

    if (!document) {
      const response: ApiResponse = {
        success: false,
        error: 'Document not found'
      };
      return res.status(404).json(response);
    }

    // Check access rights
    const hasAccess = 
      document.userId === req.user.id || // Owner
      req.user.userType === 'admin' || // Admin
      (document.requestId && req.user.userType === 'agent'); // Agent for specific request

    if (!hasAccess) {
      const response: ApiResponse = {
        success: false,
        error: 'Not authorized to download this document'
      };
      return res.status(403).json(response);
    }

    const filePath = path.join(process.cwd(), document.url);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      const response: ApiResponse = {
        success: false,
        error: 'File not found on server'
      };
      return res.status(404).json(response);
    }

    // Set headers for download
    res.setHeader('Content-Disposition', `attachment; filename="${document.originalName}"`);
    res.setHeader('Content-Type', document.type);

    // Stream file to response
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error('Download document error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Error downloading document'
    };
    res.status(500).json(response);
  }
});

// @desc    Update document
// @route   PUT /api/documents/:id
// @access  Private (Owner only)
router.put('/:id', protect, [
  body('name').optional().trim().isLength({ min: 1, max: 200 }).withMessage('Document name must be between 1 and 200 characters'),
  body('category').optional().isIn(['passport', 'visa', 'education', 'employment', 'financial', 'other']).withMessage('Invalid category')
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

    const document = await Document.findById(req.params.id);

    if (!document) {
      const response: ApiResponse = {
        success: false,
        error: 'Document not found'
      };
      return res.status(404).json(response);
    }

    // Check ownership
    if (document.userId !== req.user.id) {
      const response: ApiResponse = {
        success: false,
        error: 'Not authorized to update this document'
      };
      return res.status(403).json(response);
    }

    const { name, category } = req.body;
    const updateData: any = {};
    if (name) updateData.name = name;
    if (category) updateData.category = category;

    const updatedDocument = await Document.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('request', 'title visaType');

    const response: ApiResponse = {
      success: true,
      data: updatedDocument,
      message: 'Document updated successfully'
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Update document error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Error updating document'
    };
    res.status(500).json(response);
  }
});

// @desc    Delete document
// @route   DELETE /api/documents/:id
// @access  Private (Owner or Admin)
router.delete('/:id', protect, async (req: any, res: Response) => {
  try {
    const document = await Document.findById(req.params.id);

    if (!document) {
      const response: ApiResponse = {
        success: false,
        error: 'Document not found'
      };
      return res.status(404).json(response);
    }

    // Check ownership or admin
    if (document.userId !== req.user.id && req.user.userType !== 'admin') {
      const response: ApiResponse = {
        success: false,
        error: 'Not authorized to delete this document'
      };
      return res.status(403).json(response);
    }

    // Delete file from filesystem
    const filePath = path.join(process.cwd(), document.url);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Delete document record
    await Document.findByIdAndDelete(req.params.id);

    const response: ApiResponse = {
      success: true,
      message: 'Document deleted successfully'
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Delete document error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Error deleting document'
    };
    res.status(500).json(response);
  }
});

// @desc    Verify document (Admin only)
// @route   PUT /api/documents/:id/verify
// @access  Private (Admin only)
router.put('/:id/verify', protect, authorize('admin'), async (req: any, res: Response) => {
  try {
    const document = await Document.findByIdAndUpdate(
      req.params.id,
      {
        isVerified: true,
        verifiedBy: req.user.id,
        verifiedAt: new Date()
      },
      { new: true }
    ).populate('user', 'name avatar')
     .populate('verifiedBy', 'name');

    if (!document) {
      const response: ApiResponse = {
        success: false,
        error: 'Document not found'
      };
      return res.status(404).json(response);
    }

    // Send notification to document owner
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${document.userId}`).emit('documentNotification', {
        type: 'document_verified',
        documentId: document._id,
        documentName: document.name,
        timestamp: new Date()
      });
    }

    const response: ApiResponse = {
      success: true,
      data: document,
      message: 'Document verified successfully'
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Verify document error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Error verifying document'
    };
    res.status(500).json(response);
  }
});

// @desc    Unverify document (Admin only)
// @route   PUT /api/documents/:id/unverify
// @access  Private (Admin only)
router.put('/:id/unverify', protect, authorize('admin'), async (req: Request, res: Response) => {
  try {
    const document = await Document.findByIdAndUpdate(
      req.params.id,
      {
        isVerified: false,
        verifiedBy: null,
        verifiedAt: null
      },
      { new: true }
    ).populate('user', 'name avatar');

    if (!document) {
      const response: ApiResponse = {
        success: false,
        error: 'Document not found'
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse = {
      success: true,
      data: document,
      message: 'Document verification removed successfully'
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Unverify document error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Error removing document verification'
    };
    res.status(500).json(response);
  }
});

// @desc    Get all documents (Admin only)
// @route   GET /api/documents
// @access  Private (Admin only)
router.get('/', protect, authorize('admin'), [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('category').optional().isIn(['passport', 'visa', 'education', 'employment', 'financial', 'other']),
  query('isVerified').optional().isBoolean(),
  query('userId').optional().isMongoId(),
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
      limit = 20, 
      category, 
      isVerified, 
      userId, 
      search 
    } = req.query;

    const query: any = {};
    if (category) query.category = category;
    if (isVerified !== undefined) query.isVerified = isVerified;
    if (userId) query.userId = userId;

    if (search) {
      query.$or = [
        { name: new RegExp(search as string, 'i') },
        { originalName: new RegExp(search as string, 'i') }
      ];
    }

    const pageNum = parseInt(page.toString());
    const limitNum = parseInt(limit.toString());
    const skip = (pageNum - 1) * limitNum;

    const [documents, total] = await Promise.all([
      Document.find(query)
        .populate('user', 'name avatar email')
        .populate('request', 'title visaType')
        .populate('verifiedBy', 'name')
        .sort({ uploadedAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Document.countDocuments(query)
    ]);

    const totalPages = Math.ceil(total / limitNum);

    const response: ApiResponse<PaginatedResponse<IDocument>> = {
      success: true,
      data: {
        data: documents,
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
    console.error('Get all documents error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Error fetching documents'
    };
    res.status(500).json(response);
  }
});

export default router;
