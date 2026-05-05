import mongoose from 'mongoose';

const notificationPreferenceSchema = new mongoose.Schema(
  {
    studentId: {
      type: Number,
      required: true,
      unique: true,
      index: true
    },
    emailNotifications: {
      type: Boolean,
      default: true
    },
    pushNotifications: {
      type: Boolean,
      default: true
    },
    smsNotifications: {
      type: Boolean,
      default: false
    },
    notificationTypes: {
      placement: { type: Boolean, default: true },
      event: { type: Boolean, default: true },
      result: { type: Boolean, default: true }
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true,
    collection: 'notificationPreferences'
  }
);

const NotificationPreference = mongoose.model('NotificationPreference', notificationPreferenceSchema);

export default NotificationPreference;
