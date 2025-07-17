import mongoose, { Schema } from 'mongoose';
import { ICase, ICaseMilestone } from '../types';

const caseMilestoneSchema = new Schema<ICaseMilestone>({
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
  order: {
    type: Number,
    required: [true, 'Milestone order is required'],
    min: [1, 'Order must be at least 1']
  },
  status: {
    type: String,
    enum: ['pending', 'in-progress', 'completed', 'approved', 'rejected'],
    default: 'pending'
  },
  isActive: {
    type: Boolean,
    default: false
  },
  dueDate: {
    type: Date,
    required: [true, 'Due date is required']
  },
  startedAt: {
    type: Date,
    default: null
  },
  completedAt: {
    type: Date,
    default: null
  },
  approvedAt: {
    type: Date,
    default: null
  },
  deliverables: [{
    type: String,
    trim: true
  }],
  submittedFiles: [{
    name: String,
    url: String,
    uploadedAt: { type: Date, default: Date.now }
  }],
  clientFeedback: {
    type: String,
    maxlength: [1000, 'Feedback cannot exceed 1000 characters']
  },
  agentNotes: {
    type: String,
    maxlength: [1000, 'Notes cannot exceed 1000 characters']
  },
  isPaid: {
    type: Boolean,
    default: false
  }
}, { _id: false });

const caseSchema = new Schema<ICase>({
  requestId: {
    type: String,
    required: [true, 'Request ID is required'],
    ref: 'VisaRequest'
  },
  proposalId: {
    type: String,
    required: [true, 'Proposal ID is required'],
    ref: 'Proposal'
  },
  clientId: {
    type: String,
    required: [true, 'Client ID is required'],
    ref: 'User'
  },
  agentId: {
    type: String,
    required: [true, 'Agent ID is required'],
    ref: 'User'
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'cancelled', 'disputed', 'on-hold'],
    default: 'active'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  milestones: [caseMilestoneSchema],
  currentMilestone: {
    type: Number,
    default: 1,
    min: [1, 'Current milestone must be at least 1']
  },
  progress: {
    type: Number,
    default: 0,
    min: [0, 'Progress cannot be negative'],
    max: [100, 'Progress cannot exceed 100']
  },
  totalAmount: {
    type: Number,
    required: [true, 'Total amount is required'],
    min: [0, 'Total amount must be positive']
  },
  paidAmount: {
    type: Number,
    default: 0,
    min: [0, 'Paid amount cannot be negative']
  },
  escrowId: {
    type: String,
    ref: 'EscrowTransaction',
    default: null
  },
  startDate: {
    type: Date,
    required: [true, 'Start date is required']
  },
  estimatedCompletionDate: {
    type: Date,
    required: [true, 'Estimated completion date is required']
  },
  actualCompletionDate: {
    type: Date,
    default: null
  },
  lastActivity: {
    type: Date,
    default: Date.now
  },
  clientNotes: {
    type: String,
    maxlength: [2000, 'Client notes cannot exceed 2000 characters']
  },
  agentNotes: {
    type: String,
    maxlength: [2000, 'Agent notes cannot exceed 2000 characters']
  },
  documents: [{
    name: String,
    url: String,
    type: String,
    uploadedBy: String,
    uploadedAt: { type: Date, default: Date.now }
  }],
  timeline: [{
    action: String,
    description: String,
    performedBy: String,
    performedAt: { type: Date, default: Date.now },
    data: Schema.Types.Mixed
  }],
  reminders: [{
    title: String,
    description: String,
    dueDate: Date,
    isCompleted: { type: Boolean, default: false },
    createdBy: String,
    createdAt: { type: Date, default: Date.now }
  }],
  tags: [{
    type: String,
    trim: true
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better performance
caseSchema.index({ requestId: 1 });
caseSchema.index({ proposalId: 1 });
caseSchema.index({ clientId: 1 });
caseSchema.index({ agentId: 1 });
caseSchema.index({ status: 1 });
caseSchema.index({ priority: 1 });
caseSchema.index({ startDate: -1 });
caseSchema.index({ lastActivity: -1 });

// Compound indexes
caseSchema.index({ agentId: 1, status: 1 });
caseSchema.index({ clientId: 1, status: 1 });
caseSchema.index({ status: 1, priority: 1 });

// Virtual for completion percentage based on milestones
caseSchema.virtual('completionPercentage').get(function(this: ICase) {
  if (!this.milestones || this.milestones.length === 0) return 0;
  
  const completedMilestones = this.milestones.filter((m: ICaseMilestone) => m.status === 'approved').length;
  return Math.round((completedMilestones / this.milestones.length) * 100);
});

// Virtual for next milestone
caseSchema.virtual('nextMilestone').get(function(this: ICase) {
  if (!this.milestones || this.milestones.length === 0) return null;
  
  return this.milestones.find((m: ICaseMilestone) => m.status === 'pending' || m.status === 'in-progress') || null;
});

// Virtual for overdue milestones
caseSchema.virtual('overdueMilestones').get(function(this: ICase) {
  if (!this.milestones || this.milestones.length === 0) return [];
  
  const now = new Date();
  return this.milestones.filter((m: ICaseMilestone) => 
    (m.status === 'pending' || m.status === 'in-progress') && 
    new Date(m.dueDate) < now
  );
});

// Pre-save middleware to update progress and last activity
caseSchema.pre('save', function(next) {
  this.lastActivity = new Date();
  
  // Calculate progress based on completed milestones
  if (this.milestones && Array.isArray(this.milestones) && this.milestones.length > 0) {
    const completedMilestones = this.milestones.filter((m: ICaseMilestone) => m.status === 'approved').length;
    this.progress = Math.round((completedMilestones / this.milestones.length) * 100);
  }
  
  next();
});

// Static method to find active cases by agent
caseSchema.statics.findActiveByAgent = function(agentId: string) {
  return this.find({ agentId, status: 'active' })
    .populate('requestId', 'title visaType country')
    .populate('clientId', 'name email avatar')
    .sort({ lastActivity: -1 });
};

// Static method to find active cases by client
caseSchema.statics.findActiveByClient = function(clientId: string) {
  return this.find({ clientId, status: 'active' })
    .populate('requestId', 'title visaType country')
    .populate('agentId', 'name email avatar isVerified')
    .sort({ lastActivity: -1 });
};

const Case = mongoose.model<ICase>('Case', caseSchema);

export default Case;
