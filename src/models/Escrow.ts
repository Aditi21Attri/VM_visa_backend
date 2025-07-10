import mongoose, { Schema, Document as MongoDocument } from 'mongoose';

export interface IEscrow extends MongoDocument {
  _id: string;
  client: mongoose.Types.ObjectId;
  agent: mongoose.Types.ObjectId;
  proposal: mongoose.Types.ObjectId;
  visaRequest: mongoose.Types.ObjectId;
  amount: number;
  currency: string;
  status: 'pending' | 'deposited' | 'in_progress' | 'completed' | 'disputed' | 'refunded' | 'cancelled';
  paymentMethod: 'stripe' | 'paypal' | 'bank_transfer' | 'other';
  paymentIntentId?: string;
  stripePaymentId?: string;
  milestones: {
    id: string;
    description: string;
    amount: number;
    status: 'pending' | 'completed' | 'disputed';
    completedAt?: Date;
    evidence?: string[];
  }[];
  timeline: {
    event: string;
    description: string;
    date: Date;
    by: mongoose.Types.ObjectId;
  }[];
  dispute?: {
    reason: string;
    description: string;
    evidence: string[];
    createdBy: mongoose.Types.ObjectId;
    status: 'open' | 'resolved' | 'escalated';
    resolution?: string;
    resolvedBy?: mongoose.Types.ObjectId;
    resolvedAt?: Date;
  };
  fees: {
    platform: number;
    payment: number;
    total: number;
  };
  refundDetails?: {
    amount: number;
    reason: string;
    processedAt: Date;
    refundId: string;
  };
  metadata: {
    [key: string]: any;
  };
  createdAt: Date;
  updatedAt: Date;
}

const EscrowSchema = new Schema<IEscrow>({
  client: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  agent: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  proposal: {
    type: Schema.Types.ObjectId,
    ref: 'Proposal',
    required: true
  },
  visaRequest: {
    type: Schema.Types.ObjectId,
    ref: 'VisaRequest',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    required: true,
    default: 'USD'
  },
  status: {
    type: String,
    enum: ['pending', 'deposited', 'in_progress', 'completed', 'disputed', 'refunded', 'cancelled'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['stripe', 'paypal', 'bank_transfer', 'other'],
    required: true
  },
  paymentIntentId: {
    type: String
  },
  stripePaymentId: {
    type: String
  },
  milestones: [{
    id: {
      type: String,
      required: true
    },
    description: {
      type: String,
      required: true
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'disputed'],
      default: 'pending'
    },
    completedAt: {
      type: Date
    },
    evidence: [{
      type: String
    }]
  }],
  timeline: [{
    event: {
      type: String,
      required: true
    },
    description: {
      type: String,
      required: true
    },
    date: {
      type: Date,
      default: Date.now
    },
    by: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  }],
  dispute: {
    reason: {
      type: String
    },
    description: {
      type: String
    },
    evidence: [{
      type: String
    }],
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    status: {
      type: String,
      enum: ['open', 'resolved', 'escalated']
    },
    resolution: {
      type: String
    },
    resolvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    resolvedAt: {
      type: Date
    }
  },
  fees: {
    platform: {
      type: Number,
      default: 0
    },
    payment: {
      type: Number,
      default: 0
    },
    total: {
      type: Number,
      default: 0
    }
  },
  refundDetails: {
    amount: {
      type: Number
    },
    reason: {
      type: String
    },
    processedAt: {
      type: Date
    },
    refundId: {
      type: String
    }
  },
  metadata: {
    type: Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Indexes
EscrowSchema.index({ client: 1 });
EscrowSchema.index({ agent: 1 });
EscrowSchema.index({ proposal: 1 });
EscrowSchema.index({ visaRequest: 1 });
EscrowSchema.index({ status: 1 });
EscrowSchema.index({ createdAt: -1 });
EscrowSchema.index({ paymentIntentId: 1 });

export default mongoose.model<IEscrow>('Escrow', EscrowSchema);
