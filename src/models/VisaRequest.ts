import mongoose, { Schema } from 'mongoose';
import { IVisaRequest } from '../types';

const visaRequestSchema = new Schema<IVisaRequest>({
  userId: {
    type: String,
    required: [true, 'User ID is required'],
    ref: 'User'
  },
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  visaType: {
    type: String,
    required: [true, 'Visa type is required'],
    enum: [
      'student-visa',
      'work-permit',
      'permanent-residence',
      'visitor-visa',
      'business-visa',
      'family-visa',
      'refugee-protection',
      'citizenship',
      'other'
    ]
  },
  country: {
    type: String,
    required: [true, 'Country is required'],
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    maxlength: [2000, 'Description cannot exceed 2000 characters']
  },
  budget: {
    type: String,
    required: [true, 'Budget is required'],
    enum: [
      'under-500',
      '500-1000',
      '1000-2500',
      '2500-5000',
      '5000-10000',
      'above-10000'
    ]
  },
  timeline: {
    type: String,
    required: [true, 'Timeline is required'],
    enum: [
      'urgent',
      '1-week',
      '2-weeks',
      '1-month',
      '2-3-months',
      '3-6-months',
      'flexible'
    ]
  },
  priority: {
    type: String,
    required: [true, 'Priority is required'],
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['pending', 'in-progress', 'completed', 'rejected', 'cancelled'],
    default: 'pending'
  },
  proposalCount: {
    type: Number,
    default: 0
  },
  assignedAgentId: {
    type: String,
    ref: 'User',
    default: null
  },
  escrowId: {
    type: String,
    ref: 'EscrowTransaction',
    default: null
  },
  requirements: [{
    type: String,
    trim: true
  }],
  attachments: [{
    type: String
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better performance
visaRequestSchema.index({ userId: 1 });
visaRequestSchema.index({ status: 1 });
visaRequestSchema.index({ visaType: 1 });
visaRequestSchema.index({ country: 1 });
visaRequestSchema.index({ priority: 1 });
visaRequestSchema.index({ createdAt: -1 });
visaRequestSchema.index({ budget: 1 });

// Virtual for user details
visaRequestSchema.virtual('user', {
  ref: 'User',
  localField: 'userId',
  foreignField: '_id',
  justOne: true
});

// Virtual for assigned agent details
visaRequestSchema.virtual('assignedAgent', {
  ref: 'User',
  localField: 'assignedAgentId',
  foreignField: '_id',
  justOne: true
});

// Virtual for proposals
visaRequestSchema.virtual('proposals', {
  ref: 'Proposal',
  localField: '_id',
  foreignField: 'requestId'
});

// Virtual for escrow transaction
visaRequestSchema.virtual('escrow', {
  ref: 'EscrowTransaction',
  localField: 'escrowId',
  foreignField: '_id',
  justOne: true
});

// Pre-save middleware to update proposalCount
visaRequestSchema.pre('save', async function(next) {
  if (this.isModified('status') && this.status === 'in-progress') {
    // Update user's request count if needed
  }
  next();
});

export default mongoose.model<IVisaRequest>('VisaRequest', visaRequestSchema);
