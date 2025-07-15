import mongoose, { Schema } from 'mongoose';

interface IPaymentMethod {
  type: 'card' | 'bank_account' | 'paypal';
  last4?: string; // Last 4 digits for cards
  brand?: string; // Visa, MasterCard, etc.
  expiryMonth?: number;
  expiryYear?: number;
  bankName?: string;
  accountType?: string;
  isDefault: boolean;
}

interface IPayment {
  _id: string;
  userId: string;
  caseId?: string;
  proposalId?: string;
  amount: number;
  currency: string;
  type: 'proposal_payment' | 'milestone_payment' | 'refund';
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';
  paymentMethod: string; // Reference to payment method
  escrowStatus: 'held' | 'released' | 'refunded';
  milestoneId?: string;
  stripePaymentIntentId?: string;
  stripeCustomerId?: string;
  description: string;
  metadata?: any;
  paidAt?: Date;
  releasedAt?: Date;
  refundedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface IPaymentMethodDoc {
  _id: string;
  userId: string;
  type: 'card' | 'bank_account' | 'paypal';
  stripePaymentMethodId?: string;
  last4?: string;
  brand?: string;
  expiryMonth?: number;
  expiryYear?: number;
  bankName?: string;
  accountType?: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const paymentMethodSchema = new Schema<IPaymentMethodDoc>({
  userId: {
    type: String,
    required: [true, 'User ID is required'],
    ref: 'User'
  },
  type: {
    type: String,
    enum: ['card', 'bank_account', 'paypal'],
    required: [true, 'Payment method type is required']
  },
  stripePaymentMethodId: {
    type: String,
    sparse: true // Allows multiple null values
  },
  last4: {
    type: String,
    maxlength: [4, 'Last4 must be 4 digits']
  },
  brand: {
    type: String,
    trim: true
  },
  expiryMonth: {
    type: Number,
    min: [1, 'Month must be 1-12'],
    max: [12, 'Month must be 1-12']
  },
  expiryYear: {
    type: Number,
    min: [new Date().getFullYear(), 'Year cannot be in the past']
  },
  bankName: {
    type: String,
    trim: true
  },
  accountType: {
    type: String,
    enum: ['checking', 'savings']
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

const paymentSchema = new Schema<IPayment>({
  userId: {
    type: String,
    required: [true, 'User ID is required'],
    ref: 'User'
  },
  caseId: {
    type: String,
    ref: 'Case'
  },
  proposalId: {
    type: String,
    ref: 'Proposal'
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [0, 'Amount must be positive']
  },
  currency: {
    type: String,
    default: 'USD',
    enum: ['USD', 'CAD', 'EUR', 'GBP']
  },
  type: {
    type: String,
    enum: ['proposal_payment', 'milestone_payment', 'refund'],
    required: [true, 'Payment type is required']
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'refunded'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    ref: 'PaymentMethod',
    required: [true, 'Payment method is required']
  },
  escrowStatus: {
    type: String,
    enum: ['held', 'released', 'refunded'],
    default: 'held'
  },
  milestoneId: {
    type: String
  },
  stripePaymentIntentId: {
    type: String,
    sparse: true
  },
  stripeCustomerId: {
    type: String
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  metadata: {
    type: Schema.Types.Mixed
  },
  paidAt: {
    type: Date
  },
  releasedAt: {
    type: Date
  },
  refundedAt: {
    type: Date
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
paymentMethodSchema.index({ userId: 1 });
paymentMethodSchema.index({ userId: 1, isDefault: 1 });
paymentMethodSchema.index({ stripePaymentMethodId: 1 });

paymentSchema.index({ userId: 1 });
paymentSchema.index({ caseId: 1 });
paymentSchema.index({ proposalId: 1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ escrowStatus: 1 });
paymentSchema.index({ createdAt: -1 });

// Ensure only one default payment method per user
paymentMethodSchema.pre('save', async function(next) {
  if (this.isDefault && this.isModified('isDefault')) {
    await (this.constructor as any).updateMany(
      { userId: this.userId, _id: { $ne: this._id } },
      { isDefault: false }
    );
  }
  next();
});

export const PaymentMethod = mongoose.model<IPaymentMethodDoc>('PaymentMethod', paymentMethodSchema);
export const Payment = mongoose.model<IPayment>('Payment', paymentSchema);

export { IPaymentMethod, IPayment, IPaymentMethodDoc };
