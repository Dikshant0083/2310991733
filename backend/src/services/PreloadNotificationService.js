import notificationRepository from '../repositories/NotificationRepository.js';
import preloadedNotifications from '../data/preloadedNotifications.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('PreloadNotificationService');

export class PreloadNotificationService {
  async ensurePreloadedNotifications(options = {}) {
    const {
      force = false,
      enabled = (process.env.SEED_PRELOADED_NOTIFICATIONS || 'true').toLowerCase() === 'true',
    } = options;

    if (!enabled && !force) {
      logger.info('Preloaded notifications skipped', {
        reason: 'disabled_by_env',
      });
      return { insertedCount: 0, matchedCount: 0, skipped: true };
    }

    const result = await notificationRepository.upsertPreloaded(preloadedNotifications);
    const removedDuplicates = await notificationRepository.removePreloadedDuplicates(preloadedNotifications);

    logger.info('Preloaded notifications ready', {
      insertedCount: result.insertedCount,
      matchedCount: result.matchedCount,
      removedDuplicates,
      total: preloadedNotifications.length,
      forced: force,
    });

    return {
      ...result,
      removedDuplicates,
    };
  }
}

export default new PreloadNotificationService();
