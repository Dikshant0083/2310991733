import express from 'express';
import notificationController from '../controllers/NotificationController.js';

const router = express.Router();

// Routes
router.get('/notifications/stats', notificationController.getStats.bind(notificationController));
router.get('/notifications/top', notificationController.getTopNotifications.bind(notificationController));
router.get('/notifications', notificationController.getNotifications.bind(notificationController));
router.get('/notifications/:id', notificationController.getNotificationById.bind(notificationController));
router.patch('/notifications/:id/read', notificationController.markAsRead.bind(notificationController));
router.patch('/notifications/read-all', notificationController.markAllAsRead.bind(notificationController));
router.delete('/notifications/:id', notificationController.deleteNotification.bind(notificationController));
router.post('/notifications', notificationController.createNotifications.bind(notificationController));

export default router;
