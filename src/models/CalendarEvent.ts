import mongoose, { Schema } from 'mongoose';
import { ICalendarEvent } from '../types';

const calendarEventSchema = new Schema<ICalendarEvent>({
  title: {
    type: String,
    required: [true, 'Event title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters'],
    default: ''
  },
  startDate: {
    type: Date,
    required: [true, 'Start date is required']
  },
  endDate: {
    type: Date,
    required: [true, 'End date is required']
  },
  type: {
    type: String,
    enum: ['consultation', 'document-review', 'follow-up', 'deadline', 'other'],
    default: 'consultation'
  },
  status: {
    type: String,
    enum: ['scheduled', 'confirmed', 'completed', 'cancelled', 'rescheduled'],
    default: 'scheduled'
  },
  organizer: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  participants: [{
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    status: {
      type: String,
      enum: ['invited', 'accepted', 'declined', 'tentative'],
      default: 'invited'
    },
    notified: {
      type: Boolean,
      default: false
    }
  }],
  location: {
    type: {
      type: String,
      enum: ['video-call', 'phone', 'in-person', 'online'],
      default: 'video-call'
    },
    details: {
      type: String,
      default: ''
    }
  },
  relatedTo: {
    type: {
      type: String,
      enum: ['case', 'proposal', 'visa-request', 'general']
    },
    id: {
      type: Schema.Types.ObjectId
    }
  },
  reminderSettings: {
    enabled: {
      type: Boolean,
      default: true
    },
    intervals: [{
      type: String,
      enum: ['15min', '30min', '1hour', '2hours', '1day', '1week']
    }]
  },
  recurring: {
    enabled: {
      type: Boolean,
      default: false
    },
    pattern: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'yearly']
    },
    endDate: Date,
    exceptions: [Date]
  },
  meetingLink: {
    type: String,
    default: ''
  },
  agenda: [{
    item: String,
    duration: Number,
    completed: {
      type: Boolean,
      default: false
    }
  }],
  notes: {
    type: String,
    default: ''
  },
  attachments: [{
    type: String
  }],
  isPrivate: {
    type: Boolean,
    default: false
  },
  color: {
    type: String,
    default: '#3B82F6'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better performance
calendarEventSchema.index({ organizer: 1, startDate: 1 });
calendarEventSchema.index({ 'participants.user': 1, startDate: 1 });
calendarEventSchema.index({ startDate: 1, endDate: 1 });
calendarEventSchema.index({ type: 1, status: 1 });

// Virtual for duration in minutes
calendarEventSchema.virtual('duration').get(function() {
  const startTime = new Date(this.startDate).getTime();
  const endTime = new Date(this.endDate).getTime();
  return Math.round((endTime - startTime) / (1000 * 60));
});

// Pre-save middleware to validate dates
calendarEventSchema.pre('save', function(next) {
  if (new Date(this.endDate) <= new Date(this.startDate)) {
    next(new Error('End date must be after start date'));
  } else {
    next();
  }
});

export default mongoose.model<ICalendarEvent>('CalendarEvent', calendarEventSchema);
