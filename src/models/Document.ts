import mongoose, { Schema, Document as MongoDocument } from 'mongoose';

export interface IDocument extends MongoDocument {
  _id: string;
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
  path: string;
  cloudinaryUrl?: string;
  cloudinaryPublicId?: string;
  uploadedBy: mongoose.Types.ObjectId;
  relatedTo: {
    type: 'visa_request' | 'proposal' | 'user' | 'general';
    id: string;
  };
  category: 'passport' | 'visa' | 'photo' | 'financial' | 'educational' | 'work' | 'other';
  status: 'pending' | 'verified' | 'rejected';
  verifiedBy?: mongoose.Types.ObjectId;
  verificationDate?: Date;
  verificationNotes?: string;
  isPublic: boolean;
  tags: string[];
  metadata?: {
    pages?: number;
    language?: string;
    country?: string;
    expiryDate?: Date;
    [key: string]: any;
  };
  createdAt: Date;
  updatedAt: Date;
}

const DocumentSchema = new Schema<IDocument>({
  filename: {
    type: String,
    required: true
  },
  originalName: {
    type: String,
    required: true
  },
  mimetype: {
    type: String,
    required: true
  },
  size: {
    type: Number,
    required: true
  },
  path: {
    type: String,
    required: true
  },
  cloudinaryUrl: {
    type: String
  },
  cloudinaryPublicId: {
    type: String
  },
  uploadedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  relatedTo: {
    type: {
      type: String,
      enum: ['visa_request', 'proposal', 'user', 'general'],
      required: true
    },
    id: {
      type: Schema.Types.ObjectId,
      required: true
    }
  },
  category: {
    type: String,
    enum: ['passport', 'visa', 'photo', 'financial', 'educational', 'work', 'other'],
    default: 'other'
  },
  status: {
    type: String,
    enum: ['pending', 'verified', 'rejected'],
    default: 'pending'
  },
  verifiedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  verificationDate: {
    type: Date
  },
  verificationNotes: {
    type: String
  },
  isPublic: {
    type: Boolean,
    default: false
  },
  tags: [{
    type: String
  }],
  metadata: {
    type: Schema.Types.Mixed
  }
}, {
  timestamps: true
});

// Indexes
DocumentSchema.index({ uploadedBy: 1 });
DocumentSchema.index({ 'relatedTo.type': 1, 'relatedTo.id': 1 });
DocumentSchema.index({ status: 1 });
DocumentSchema.index({ category: 1 });
DocumentSchema.index({ createdAt: -1 });

export default mongoose.model<IDocument>('Document', DocumentSchema);
