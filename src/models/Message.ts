import mongoose, { Schema } from 'mongoose';
import { IMessage, IConversation, IAttachment } from '../types';

const attachmentSchema = new Schema<IAttachment>({
  name: {
    type: String,
    required: true
  },
  url: {
    type: String,
    required: true
  },
  type: {
    type: String,
    required: true
  },
  size: {
    type: Number,
    required: true
  }
}, { _id: false });

const messageSchema = new Schema<IMessage>({
  conversationId: {
    type: String,
    required: [true, 'Conversation ID is required'],
    ref: 'Conversation'
  },
  senderId: {
    type: String,
    required: [true, 'Sender ID is required'],
    ref: 'User'
  },
  receiverId: {
    type: String,
    required: [true, 'Receiver ID is required'],
    ref: 'User'
  },
  content: {
    type: String,
    required: [true, 'Message content is required'],
    maxlength: [2000, 'Message cannot exceed 2000 characters']
  },
  messageType: {
    type: String,
    enum: ['text', 'file', 'system'],
    default: 'text'
  },
  attachments: [attachmentSchema],
  isRead: {
    type: Boolean,
    default: false
  },
  isEdited: {
    type: Boolean,
    default: false
  },
  editedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
messageSchema.index({ conversationId: 1, createdAt: -1 });
messageSchema.index({ senderId: 1 });
messageSchema.index({ receiverId: 1 });
messageSchema.index({ isRead: 1 });

// Virtual for sender details
messageSchema.virtual('sender', {
  ref: 'User',
  localField: 'senderId',
  foreignField: '_id',
  justOne: true
});

// Virtual for receiver details
messageSchema.virtual('receiver', {
  ref: 'User',
  localField: 'receiverId',
  foreignField: '_id',
  justOne: true
});

const conversationSchema = new Schema<IConversation>({
  participants: [{
    type: String,
    ref: 'User',
    required: true
  }],
  requestId: {
    type: String,
    ref: 'VisaRequest',
    default: null
  },
  lastMessage: {
    type: String,
    default: ''
  },
  lastMessageAt: {
    type: Date,
    default: Date.now
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

// Indexes
conversationSchema.index({ participants: 1 });
conversationSchema.index({ requestId: 1 });
conversationSchema.index({ lastMessageAt: -1 });
conversationSchema.index({ isActive: 1 });

// Virtual for participant details
conversationSchema.virtual('participantDetails', {
  ref: 'User',
  localField: 'participants',
  foreignField: '_id'
});

// Virtual for request details
conversationSchema.virtual('request', {
  ref: 'VisaRequest',
  localField: 'requestId',
  foreignField: '_id',
  justOne: true
});

// Static method to find or create conversation
conversationSchema.statics.findOrCreate = async function(participants: string[], requestId?: string) {
  // Sort participants to ensure consistent ordering
  const sortedParticipants = participants.sort();
  
  let conversation = await this.findOne({
    participants: { $all: sortedParticipants, $size: sortedParticipants.length },
    requestId: requestId || null
  });

  if (!conversation) {
    conversation = await this.create({
      participants: sortedParticipants,
      requestId: requestId || null
    });
  }

  return conversation;
};

export const Message = mongoose.model<IMessage>('Message', messageSchema);
export const Conversation = mongoose.model<IConversation>('Conversation', conversationSchema);
