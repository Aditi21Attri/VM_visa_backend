import mongoose, { Schema, Document as MongoDocument } from 'mongoose';

export interface IOrganization extends MongoDocument {
  _id: string;
  name: string;
  type: 'law_firm' | 'consultancy' | 'corporate' | 'government' | 'ngo' | 'other';
  registrationNumber?: string;
  licenseNumber?: string;
  description: string;
  website?: string;
  email: string;
  phone: string;
  address: {
    street: string;
    city: string;
    state: string;
    country: string;
    zipCode: string;
  };
  logo?: string;
  documents: {
    type: 'license' | 'certificate' | 'registration' | 'other';
    name: string;
    url: string;
    verified: boolean;
    verifiedAt?: Date;
    verifiedBy?: mongoose.Types.ObjectId;
  }[];
  services: string[];
  specializations: string[];
  languages: string[];
  members: {
    user: mongoose.Types.ObjectId;
    role: 'admin' | 'manager' | 'agent' | 'staff';
    permissions: string[];
    joinedAt: Date;
    isActive: boolean;
  }[];
  settings: {
    allowPublicProfile: boolean;
    requireApprovalForJoining: boolean;
    enableTeamChat: boolean;
    autoAssignClients: boolean;
  };
  statistics: {
    totalCases: number;
    successRate: number;
    averageRating: number;
    totalReviews: number;
    responseTime: number;
  };
  subscription: {
    plan: 'basic' | 'premium' | 'enterprise';
    status: 'active' | 'inactive' | 'suspended';
    startDate: Date;
    endDate: Date;
    features: string[];
  };
  verificationStatus: 'pending' | 'verified' | 'rejected';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const OrganizationSchema = new Schema<IOrganization>({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  type: {
    type: String,
    enum: ['law_firm', 'consultancy', 'corporate', 'government', 'ngo', 'other'],
    required: true
  },
  registrationNumber: {
    type: String,
    trim: true
  },
  licenseNumber: {
    type: String,
    trim: true
  },
  description: {
    type: String,
    required: true,
    maxlength: 1000
  },
  website: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  phone: {
    type: String,
    required: true,
    trim: true
  },
  address: {
    street: {
      type: String,
      required: true
    },
    city: {
      type: String,
      required: true
    },
    state: {
      type: String,
      required: true
    },
    country: {
      type: String,
      required: true
    },
    zipCode: {
      type: String,
      required: true
    }
  },
  logo: {
    type: String
  },
  documents: [{
    type: {
      type: String,
      enum: ['license', 'certificate', 'registration', 'other'],
      required: true
    },
    name: {
      type: String,
      required: true
    },
    url: {
      type: String,
      required: true
    },
    verified: {
      type: Boolean,
      default: false
    },
    verifiedAt: {
      type: Date
    },
    verifiedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  services: [{
    type: String
  }],
  specializations: [{
    type: String
  }],
  languages: [{
    type: String
  }],
  members: [{
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    role: {
      type: String,
      enum: ['admin', 'manager', 'agent', 'staff'],
      required: true
    },
    permissions: [{
      type: String
    }],
    joinedAt: {
      type: Date,
      default: Date.now
    },
    isActive: {
      type: Boolean,
      default: true
    }
  }],
  settings: {
    allowPublicProfile: {
      type: Boolean,
      default: true
    },
    requireApprovalForJoining: {
      type: Boolean,
      default: true
    },
    enableTeamChat: {
      type: Boolean,
      default: true
    },
    autoAssignClients: {
      type: Boolean,
      default: false
    }
  },
  statistics: {
    totalCases: {
      type: Number,
      default: 0
    },
    successRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    totalReviews: {
      type: Number,
      default: 0
    },
    responseTime: {
      type: Number,
      default: 0
    }
  },
  subscription: {
    plan: {
      type: String,
      enum: ['basic', 'premium', 'enterprise'],
      default: 'basic'
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'suspended'],
      default: 'active'
    },
    startDate: {
      type: Date,
      default: Date.now
    },
    endDate: {
      type: Date
    },
    features: [{
      type: String
    }]
  },
  verificationStatus: {
    type: String,
    enum: ['pending', 'verified', 'rejected'],
    default: 'pending'
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes
OrganizationSchema.index({ name: 1 });
OrganizationSchema.index({ type: 1 });
OrganizationSchema.index({ verificationStatus: 1 });
OrganizationSchema.index({ 'address.country': 1 });
OrganizationSchema.index({ 'address.city': 1 });
OrganizationSchema.index({ services: 1 });
OrganizationSchema.index({ specializations: 1 });
OrganizationSchema.index({ 'members.user': 1 });

export default mongoose.model<IOrganization>('Organization', OrganizationSchema);
