import mongoose, { Schema, Document as MongoDocument } from 'mongoose';

export interface INotification extends MongoDocument {
  _id: string;
  recipient: mongoose.Types.ObjectId;
  sender?: mongoose.Types.ObjectId;
  type: 'message' | 'proposal' | 'visa_request' | 'payment' | 'review' | 'system' | 'document' | 'status_update';
  title: string;
  message: string;
  data?: {
    [key: string]: any;
  };
  link?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  isRead: boolean;
  readAt?: Date;
  category: 'info' | 'success' | 'warning' | 'error';
  expiresAt?: Date;
  channels: ('in_app' | 'email' | 'sms' | 'push')[];
  emailSent: boolean;
  smsSent: boolean;
  pushSent: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>({
  recipient: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sender: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  type: {
    type: String,
    enum: ['message', 'proposal', 'visa_request', 'payment', 'review', 'system', 'document', 'status_update'],
    required: true
  },
  title: {
    type: String,
    required: true,
    maxlength: 100
  },
  message: {
    type: String,
    required: true,
    maxlength: 500
  },
  data: {
    type: Schema.Types.Mixed
  },
  link: {
    type: String
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date
  },
  category: {
    type: String,
    enum: ['info', 'success', 'warning', 'error'],
    default: 'info'
  },
  expiresAt: {
    type: Date
  },
  channels: [{
    type: String,
    enum: ['in_app', 'email', 'sms', 'push']
  }],
  emailSent: {
    type: Boolean,
    default: false
  },
  smsSent: {
    type: Boolean,
    default: false
  },
  pushSent: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Indexes
NotificationSchema.index({ recipient: 1, isRead: 1 });
NotificationSchema.index({ recipient: 1, createdAt: -1 });
NotificationSchema.index({ type: 1 });
NotificationSchema.index({ priority: 1 });
NotificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model<INotification>('Notification', NotificationSchema);
