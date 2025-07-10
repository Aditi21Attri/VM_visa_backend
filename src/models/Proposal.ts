import mongoose, { Schema } from 'mongoose';
import { IProposal, IMilestone } from '../types';

const milestoneSchema = new Schema<IMilestone>({
  title: {
    type: String,
    required: [true, 'Milestone title is required'],
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Milestone description is required'],
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  amount: {
    type: Number,
    required: [true, 'Milestone amount is required'],
    min: [0, 'Amount must be positive']
  },
  dueDate: {
    type: Date,
    required: [true, 'Due date is required']
  },
  deliverables: [{
    type: String,
    trim: true
  }]
}, { _id: false });

const proposalSchema = new Schema<IProposal>({
  requestId: {
    type: String,
    required: [true, 'Request ID is required'],
    ref: 'VisaRequest'
  },
  agentId: {
    type: String,
    required: [true, 'Agent ID is required'],
    ref: 'User'
  },
  budget: {
    type: Number,
    required: [true, 'Budget is required'],
    min: [0, 'Budget must be positive']
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
  coverLetter: {
    type: String,
    required: [true, 'Cover letter is required'],
    maxlength: [1000, 'Cover letter cannot exceed 1000 characters']
  },
  proposalText: {
    type: String,
    required: [true, 'Proposal text is required'],
    maxlength: [3000, 'Proposal text cannot exceed 3000 characters']
  },
  milestones: [milestoneSchema],
  portfolio: [{
    type: String
  }],
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'withdrawn'],
    default: 'pending'
  },
  submittedAt: {
    type: Date,
    default: Date.now
  },
  respondedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better performance
proposalSchema.index({ requestId: 1 });
proposalSchema.index({ agentId: 1 });
proposalSchema.index({ status: 1 });
proposalSchema.index({ submittedAt: -1 });
proposalSchema.index({ budget: 1 });

// Compound indexes
proposalSchema.index({ requestId: 1, agentId: 1 }, { unique: true });
proposalSchema.index({ agentId: 1, status: 1 });

// Virtual for request details
proposalSchema.virtual('request', {
  ref: 'VisaRequest',
  localField: 'requestId',
  foreignField: '_id',
  justOne: true
});

// Virtual for agent details
proposalSchema.virtual('agent', {
  ref: 'User',
  localField: 'agentId',
  foreignField: '_id',
  justOne: true
});

// Virtual for agent profile
proposalSchema.virtual('agentProfile', {
  ref: 'AgentProfile',
  localField: 'agentId',
  foreignField: 'userId',
  justOne: true
});

// Pre-save middleware
proposalSchema.pre('save', async function(next) {
  if (this.isModified('status')) {
    this.respondedAt = new Date();
    
    // If proposal is accepted, update the visa request
    if (this.status === 'accepted') {
      await mongoose.model('VisaRequest').findByIdAndUpdate(
        this.requestId,
        { 
          status: 'in-progress',
          assignedAgentId: this.agentId
        }
      );
      
      // Reject other proposals for this request
      await mongoose.model('Proposal').updateMany(
        { 
          requestId: this.requestId,
          _id: { $ne: this._id },
          status: 'pending'
        },
        { 
          status: 'rejected',
          respondedAt: new Date()
        }
      );
    }
  }
  next();
});

// Static method to get proposals with agent details
proposalSchema.statics.getProposalsWithDetails = function(requestId: string) {
  return this.find({ requestId })
    .populate('agent', 'name avatar email')
    .populate('agentProfile', 'experienceYears successRate responseTime rating totalReviews')
    .sort({ submittedAt: -1 });
};

export default mongoose.model<IProposal>('Proposal', proposalSchema);
