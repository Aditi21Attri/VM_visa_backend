import mongoose, { Schema, Document as MongoDocument } from 'mongoose';

export interface IReview extends MongoDocument {
  _id: string;
  reviewer: mongoose.Types.ObjectId;
  reviewee: mongoose.Types.ObjectId;
  relatedTo: {
    type: 'visa_request' | 'proposal' | 'service';
    id: string;
  };
  rating: number;
  title: string;
  comment: string;
  aspects: {
    communication: number;
    expertise: number;
    timeliness: number;
    professionalism: number;
    value: number;
  };
  isVerified: boolean;
  isPublic: boolean;
  response?: {
    comment: string;
    date: Date;
  };
  helpfulVotes: number;
  reportedBy: mongoose.Types.ObjectId[];
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

const ReviewSchema = new Schema<IReview>({
  reviewer: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reviewee: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  relatedTo: {
    type: {
      type: String,
      enum: ['visa_request', 'proposal', 'service'],
      required: true
    },
    id: {
      type: Schema.Types.ObjectId,
      required: true
    }
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  title: {
    type: String,
    required: true,
    maxlength: 100
  },
  comment: {
    type: String,
    required: true,
    maxlength: 1000
  },
  aspects: {
    communication: {
      type: Number,
      min: 1,
      max: 5,
      required: true
    },
    expertise: {
      type: Number,
      min: 1,
      max: 5,
      required: true
    },
    timeliness: {
      type: Number,
      min: 1,
      max: 5,
      required: true
    },
    professionalism: {
      type: Number,
      min: 1,
      max: 5,
      required: true
    },
    value: {
      type: Number,
      min: 1,
      max: 5,
      required: true
    }
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  isPublic: {
    type: Boolean,
    default: true
  },
  response: {
    comment: {
      type: String,
      maxlength: 500
    },
    date: {
      type: Date
    }
  },
  helpfulVotes: {
    type: Number,
    default: 0
  },
  reportedBy: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],
  tags: [{
    type: String
  }]
}, {
  timestamps: true
});

// Indexes
ReviewSchema.index({ reviewer: 1 });
ReviewSchema.index({ reviewee: 1 });
ReviewSchema.index({ rating: -1 });
ReviewSchema.index({ 'relatedTo.type': 1, 'relatedTo.id': 1 });
ReviewSchema.index({ createdAt: -1 });
ReviewSchema.index({ isPublic: 1, isVerified: 1 });

// Prevent duplicate reviews for the same relationship
ReviewSchema.index(
  { reviewer: 1, reviewee: 1, 'relatedTo.type': 1, 'relatedTo.id': 1 },
  { unique: true }
);

export default mongoose.model<IReview>('Review', ReviewSchema);
