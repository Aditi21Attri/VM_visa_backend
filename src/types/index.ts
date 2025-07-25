/**
 * Shared types between client and server - Backend version
 */

import { Document } from 'mongoose';

export interface IUser extends Document {
  _id: string;
  email: string;
  password: string;
  name: string;
  userType: 'client' | 'agent' | 'organization' | 'admin';
  avatar?: string;
  bio?: string;
  location?: string;
  phone?: string;
  isVerified: boolean;
  isActive: boolean;
  verificationToken?: string;
  resetPasswordToken?: string;
  resetPasswordExpire?: Date;
  createdAt: Date;
  updatedAt: Date;
  
  // Client-specific fields (can be stored directly in User model for simplicity)
  dateOfBirth?: string;
  nationality?: string;
  passportNumber?: string;
  visaHistory?: string;
  preferredCountries?: string[];
  emergencyContact?: {
    name: string;
    phone: string;
    relationship: string;
  };
  
  // Agent-specific fields (basic ones, detailed ones in AgentProfile)
  title?: string;
  website?: string;
  experienceYears?: number;
  specializations?: string[];
  languages?: string[];
  hourlyRate?: number;
  licenseNumber?: string;
  certifications?: string[];
  portfolioItems?: string[];
  availability?: string;
  businessHours?: {
    start: string;
    end: string;
    timezone: string;
  };
  rates?: {
    consultation: number;
    minimum: number;
  };
  acceptsUrgentCases?: boolean;
  
  // Additional agent fields
  responseTime?: string;
  minimumBudget?: number;
  consultationFee?: number;
  portfolio?: string[];
  
  // Organization-specific fields (basic ones, detailed ones in OrganizationProfile)
  organizationName?: string;
  organizationType?: string;
  registrationNumber?: string;
  establishedYear?: number;
  teamSize?: number;
  services?: string[];
  
  // Notification settings
  notificationSettings?: {
    proposalUpdates: boolean;
    messageAlerts: boolean;
    deadlineReminders: boolean;
    statusUpdates: boolean;
    email: boolean;
    push: boolean;
    sms: boolean;
  };
  
  // Privacy settings
  privacySettings?: {
    profileVisibility: 'public' | 'limited' | 'private';
    showContactInfo: boolean;
    allowDirectMessages: boolean;
    shareProgressWithFamily: boolean;
  };
  
  // Methods
  matchPassword(password: string): Promise<boolean>;
  getSignedJwtToken(): string;
  getResetPasswordToken(): string;
}

export interface IAgentProfile extends Document {
  userId: string;
  experienceYears: number;
  successRate: number;
  responseTime: string;
  specializations: string[];
  languages: string[];
  certifications: string[];
  portfolio: string[];
  hourlyRate: number;
  availability: 'available' | 'busy' | 'unavailable';
  rating: number;
  totalReviews: number;
  completedCases: number;
}

export interface IOrganizationProfile extends Document {
  userId: string;
  companyName: string;
  licenseNumber: string;
  foundedYear: number;
  teamSize: number;
  specializations: string[];
  officeLocations: string[];
  certifications: string[];
  successRate: number;
  rating: number;
  totalReviews: number;
  completedCases: number;
  agents: string[]; // Array of agent user IDs
}

export interface IVisaRequest extends Document {
  _id: string;
  userId: string;
  title: string;
  visaType: string;
  country: string;
  description: string;
  budget: string;
  timeline: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in-progress' | 'completed' | 'rejected' | 'cancelled';
  proposalCount: number;
  assignedAgentId?: string;
  escrowId?: string;
  requirements: string[];
  attachments: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IProposal extends Document {
  _id: string;
  requestId: string;
  agentId: string;
  budget: number;
  timeline: string;
  coverLetter: string;
  proposalText: string;
  milestones: IMilestone[];
  portfolio: string[];
  status: 'pending' | 'accepted' | 'rejected' | 'withdrawn';
  submittedAt: Date;
  respondedAt?: Date;
}

export interface IMilestone {
  title: string;
  description: string;
  amount: number;
  dueDate: Date;
  deliverables: string[];
}

export interface IMessage extends Document {
  _id: string;
  conversationId: string;
  senderId: string;
  receiverId: string;
  content: string;
  messageType: 'text' | 'file' | 'system';
  attachments: IAttachment[];
  isRead: boolean;
  isEdited: boolean;
  editedAt?: Date;
  createdAt: Date;
}

export interface IConversation extends Document {
  _id: string;
  participants: string[];
  requestId?: string;
  lastMessage?: string;
  lastMessageAt: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAttachment {
  name: string;
  url: string;
  type: string;
  size: number;
}

export interface IDocument extends Document {
  _id: string;
  userId: string;
  requestId?: string;
  name: string;
  originalName: string;
  type: string;
  size: number;
  url: string;
  cloudinaryPublicId?: string;
  category: 'passport' | 'visa' | 'education' | 'employment' | 'financial' | 'other';
  isVerified: boolean;
  verifiedBy?: string;
  verifiedAt?: Date;
  uploadedAt: Date;
}

export interface IEscrowTransaction extends Document {
  _id: string;
  requestId: string;
  clientId: string;
  agentId: string;
  amount: number;
  platformFee: number;
  status: 'pending' | 'deposited' | 'released' | 'disputed' | 'refunded' | 'cancelled';
  stripePaymentIntentId?: string;
  milestones: IEscrowMilestone[];
  disputeReason?: string;
  disputeResolvedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IEscrowMilestone extends Document {
  title: string;
  description: string;
  amount: number;
  status: 'pending' | 'in-progress' | 'submitted' | 'approved' | 'disputed';
  dueDate: Date;
  completedAt?: Date;
  approvedAt?: Date;
  submittedFiles: string[];
  clientFeedback?: string;
}

export interface IReview extends Document {
  _id: string;
  requestId: string;
  reviewerId: string;
  revieweeId: string;
  rating: number;
  comment: string;
  isPublic: boolean;
  isVerified: boolean;
  helpfulVotes: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface INotification extends Document {
  _id: string;
  userId: string;
  title: string;
  message: string;
  type: 'proposal' | 'message' | 'payment' | 'milestone' | 'review' | 'system';
  data?: any;
  isRead: boolean;
  createdAt: Date;
}

export interface ICaseMilestone {
  title: string;
  description: string;
  amount: number;
  order: number;
  status: 'pending' | 'in-progress' | 'completed' | 'approved' | 'rejected';
  isActive: boolean;
  dueDate: Date;
  startedAt?: Date;
  completedAt?: Date;
  approvedAt?: Date;
  deliverables: string[];
  submittedFiles: {
    name: string;
    url: string;
    uploadedAt: Date;
  }[];
  clientFeedback?: string;
  agentNotes?: string;
  isPaid?: boolean;
}

export interface ICase extends Document {
  _id: string;
  requestId: string;
  proposalId: string;
  clientId: string;
  agentId: string;
  status: 'active' | 'completed' | 'cancelled' | 'disputed' | 'on-hold';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  milestones: ICaseMilestone[];
  currentMilestone: number;
  progress: number;
  totalAmount: number;
  paidAmount: number;
  escrowId?: string;
  startDate: Date;
  estimatedCompletionDate: Date;
  actualCompletionDate?: Date;
  lastActivity: Date;
  clientNotes?: string;
  agentNotes?: string;
  documents: {
    name: string;
    url: string;
    type: string;
    uploadedBy: string;
    uploadedAt: Date;
  }[];
  timeline: {
    action: string;
    description: string;
    performedBy: string;
    performedAt: Date;
    data?: any;
  }[];
  reminders: {
    title: string;
    description: string;
    dueDate: Date;
    isCompleted: boolean;
    createdBy: string;
    createdAt: Date;
  }[];
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface AuthResponse {
  success: boolean;
  token?: string;
  user?: any;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

// Request types
export interface CreateVisaRequestData {
  title: string;
  visaType: string;
  country: string;
  description: string;
  budget: string;
  timeline: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  requirements?: string[];
  attachments?: string[];
}

export interface UpdateVisaRequestData {
  title?: string;
  visaType?: string;
  country?: string;
  description?: string;
  budget?: string;
  timeline?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  status?: 'pending' | 'in-progress' | 'completed' | 'rejected' | 'cancelled';
  requirements?: string[];
  attachments?: string[];
  assignedAgentId?: string;
}

export interface CreateProposalData {
  requestId: string;
  budget: number;
  timeline: string;
  coverLetter: string;
  proposalText: string;
  milestones?: IMilestone[];
  portfolio?: string[];
}

export interface UpdateProfileData {
  name?: string;
  bio?: string;
  location?: string;
  phone?: string;
  avatar?: string;
}

export interface CreateMessageData {
  conversationId?: string;
  receiverId: string;
  content: string;
  messageType?: 'text' | 'file' | 'system';
  attachments?: IAttachment[];
  requestId?: string;
}

export interface LoginData {
  email: string;
  password: string;
  userType?: string; // Optional to match frontend expectations
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
  userType: 'client' | 'agent' | 'organization';
  phone?: string;
  location?: string;
}

export interface ChangePasswordData {
  currentPassword: string;
  newPassword: string;
}

export interface ForgotPasswordData {
  email: string;
}

export interface ResetPasswordData {
  token: string;
  password: string;
}

// Dashboard Analytics types
export interface DashboardStats {
  totalUsers: number;
  totalRequests: number;
  totalProposals: number;
  totalEscrowAmount: number;
  recentActivity: any[];
}

export interface UserDashboardStats {
  activeRequests: number;
  completedRequests: number;
  totalSpent: number;
  avgRating: number;
  recentActivity: any[];
}

export interface AgentDashboardStats {
  activeProposals: number;
  acceptedProposals: number;
  completedCases: number;
  totalEarnings: number;
  avgRating: number;
  responseTime: string;
  successRate: number;
  recentActivity: any[];
}

// Query parameters
export interface QueryParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  search?: string;
  filter?: any;
}

export interface VisaRequestQueryParams extends QueryParams {
  visaType?: string;
  country?: string;
  priority?: string;
  status?: string;
  minBudget?: number;
  maxBudget?: number;
  userId?: string;
}

export interface ProposalQueryParams extends QueryParams {
  requestId?: string;
  agentId?: string;
  status?: string;
  minBudget?: number;
  maxBudget?: number;
}

export interface MessageQueryParams extends QueryParams {
  conversationId?: string;
  senderId?: string;
  receiverId?: string;
  isRead?: boolean;
}

export interface ReviewQueryParams extends QueryParams {
  requestId?: string;
  reviewerId?: string;
  revieweeId?: string;
  minRating?: number;
  maxRating?: number;
}

// Calendar Event types
export interface ICalendarEvent extends Document {
  _id: string;
  title: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  type: 'consultation' | 'document-review' | 'follow-up' | 'deadline' | 'other';
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'rescheduled';
  organizer: string | IUser;
  participants: Array<{
    user: string | IUser;
    status: 'invited' | 'accepted' | 'declined' | 'tentative';
    notified: boolean;
  }>;
  location: {
    type: 'video-call' | 'phone' | 'in-person' | 'online';
    details?: string;
  };
  relatedTo?: {
    type: 'case' | 'proposal' | 'visa-request' | 'general';
    id: string;
  };
  reminderSettings: {
    enabled: boolean;
    intervals: Array<'15min' | '30min' | '1hour' | '2hours' | '1day' | '1week'>;
  };
  recurring: {
    enabled: boolean;
    pattern?: 'daily' | 'weekly' | 'monthly' | 'yearly';
    endDate?: Date;
    exceptions?: Date[];
  };
  meetingLink?: string;
  agenda?: Array<{
    item: string;
    duration: number;
    completed: boolean;
  }>;
  notes?: string;
  attachments?: string[];
  isPrivate: boolean;
  color: string;
  createdAt: Date;
  updatedAt: Date;
}
