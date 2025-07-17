import mongoose, { Schema } from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';
import { IUser } from '../types';

const userSchema = new Schema<IUser>({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    match: [
      /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
      'Please provide a valid email'
    ]
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [50, 'Name cannot exceed 50 characters']
  },
  userType: {
    type: String,
    required: [true, 'User type is required'],
    enum: ['client', 'agent', 'organization', 'admin'],
    default: 'client'
  },
  avatar: {
    type: String,
    default: null
  },
  bio: {
    type: String,
    maxlength: [500, 'Bio cannot exceed 500 characters'],
    default: ''
  },
  location: {
    type: String,
    maxlength: [100, 'Location cannot exceed 100 characters'],
    default: ''
  },
  phone: {
    type: String,
    match: [/^\+?[\d\s\-\(\)]+$/, 'Please provide a valid phone number'],
    default: ''
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  verificationToken: {
    type: String,
    default: null
  },
  resetPasswordToken: {
    type: String,
    default: null
  },
  resetPasswordExpire: {
    type: Date,
    default: null
  },
  
  // Client-specific fields
  dateOfBirth: {
    type: String,
    default: ''
  },
  nationality: {
    type: String,
    default: ''
  },
  passportNumber: {
    type: String,
    default: ''
  },
  visaHistory: {
    type: String,
    default: ''
  },
  preferredCountries: [{
    type: String
  }],
  emergencyContact: {
    name: { type: String, default: '' },
    phone: { type: String, default: '' },
    relationship: { type: String, default: '' }
  },
  
  // Agent-specific fields
  title: {
    type: String,
    default: ''
  },
  website: {
    type: String,
    default: ''
  },
  experienceYears: {
    type: Number,
    default: 0,
    min: 0
  },
  specializations: [{
    type: String
  }],
  languages: [{
    type: String
  }],
  hourlyRate: {
    type: Number,
    default: 0,
    min: 0
  },
  licenseNumber: {
    type: String,
    default: ''
  },
  certifications: [{
    type: String
  }],
  portfolioItems: [{
    type: String
  }],
  availability: {
    type: String,
    default: 'full-time'
  },
  businessHours: {
    start: { type: String, default: '09:00' },
    end: { type: String, default: '17:00' },
    timezone: { type: String, default: 'America/Toronto' }
  },
  rates: {
    consultation: { type: Number, default: 0 },
    minimum: { type: Number, default: 1000 }
  },
  acceptsUrgentCases: {
    type: Boolean,
    default: true
  },
  
  // Additional agent fields for profile completion
  responseTime: {
    type: String,
    default: '24-hours'
  },
  minimumBudget: {
    type: Number,
    default: 1000,
    min: 0
  },
  consultationFee: {
    type: Number,
    default: 0,
    min: 0
  },
  portfolio: [{
    type: String
  }],
  
  // Organization-specific fields
  organizationName: {
    type: String,
    default: ''
  },
  organizationType: {
    type: String,
    default: ''
  },
  registrationNumber: {
    type: String,
    default: ''
  },
  establishedYear: {
    type: Number,
    default: null
  },
  teamSize: {
    type: Number,
    default: 0,
    min: 0
  },
  services: [{
    type: String
  }],
  
  // Notification settings
  notificationSettings: {
    proposalUpdates: { type: Boolean, default: true },
    messageAlerts: { type: Boolean, default: true },
    deadlineReminders: { type: Boolean, default: true },
    statusUpdates: { type: Boolean, default: true },
    email: { type: Boolean, default: true },
    push: { type: Boolean, default: true },
    sms: { type: Boolean, default: false }
  },
  
  // Privacy settings
  privacySettings: {
    profileVisibility: { type: String, default: 'public', enum: ['public', 'limited', 'private'] },
    showContactInfo: { type: Boolean, default: true },
    allowDirectMessages: { type: Boolean, default: true },
    shareProgressWithFamily: { type: Boolean, default: false }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better performance
userSchema.index({ userType: 1 });
userSchema.index({ isVerified: 1 });
userSchema.index({ createdAt: -1 });

// Encrypt password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    next();
  }
  
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Match user entered password to hashed password in database
userSchema.methods.matchPassword = async function(enteredPassword: string): Promise<boolean> {
  console.log('🔍 matchPassword called with:', { enteredPassword, storedHash: this.password?.substring(0, 10) + '...' });
  const result = await bcrypt.compare(enteredPassword, this.password);
  console.log('🔍 bcrypt.compare result:', result);
  return result;
};

// Sign JWT and return
userSchema.methods.getSignedJwtToken = function(): string {
  const payload = { id: this._id, userType: this.userType };
  const secret = process.env.JWT_SECRET as string;
  // Set a longer expiration time (30 days) and use a consistent value
  const options: SignOptions = { expiresIn: '30d' };
  
  console.log('Generating new JWT token for user:', this._id, 'with expiry:', options.expiresIn);
  return jwt.sign(payload, secret, options);
};

// Generate and hash password reset token
userSchema.methods.getResetPasswordToken = function(): string {
  // Generate token
  const resetToken = crypto.randomBytes(20).toString('hex');
  
  // Hash token and set to resetPasswordToken field
  this.resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  
  // Set expire
  this.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 minutes
  
  return resetToken;
};

// Remove password from JSON output
userSchema.methods.toJSON = function() {
  const userObject = this.toObject();
  delete userObject.password;
  delete userObject.resetPasswordToken;
  delete userObject.resetPasswordExpire;
  delete userObject.verificationToken;
  return userObject;
};

export default mongoose.model<IUser>('User', userSchema);
