import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    studentId: {
      type: Number,
      required: true,
      index: true
    },
    type: {
      type: String,
      enum: ['placement', 'event', 'result'],
      required: true,
      index: true
    },
    title: {
      type: String,
      required: true,
      minlength: 5,
      maxlength: 200
    },
    description: {
      type: String,
      maxlength: 1000
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium'
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true
    },
    readAt: {
      type: Date,
      default: null
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true
    },
    updatedAt: {
      type: Date,
      default: Date.now
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90 days
    },
    metadata: {
      companyId: String,
      positionId: String,
      link: String,
      imageUrl: String,
      tags: [String]
    },
    sender: {
      adminId: Number,
      adminName: String
    }
  },
  {
    timestamps: true,
    collection: 'notifications'
  }
);

// Composite indexes for common queries
notificationSchema.index({ studentId: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ studentId: 1, type: 1, isRead: 1 });
notificationSchema.index({ type: 1, createdAt: -1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

// Full-text search index
notificationSchema.index({ title: 'text', description: 'text' });

// Text search method
notificationSchema.statics.search = function(searchText, studentId = null) {
  const query = { $text: { $search: searchText } };
  if (studentId) {
    query.studentId = studentId;
  }
  return this.find(query).sort({ score: { $meta: 'textScore' } });
};

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;
