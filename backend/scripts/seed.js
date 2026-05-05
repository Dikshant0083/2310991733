import dotenv from 'dotenv';
import { connectMongoDB, disconnectMongoDB } from '../src/config/database.js';
import preloadNotificationService from '../src/services/PreloadNotificationService.js';

dotenv.config({ override: true });

const run = async () => {
  try {
    await connectMongoDB();
    await preloadNotificationService.ensurePreloadedNotifications({ force: true });
    await disconnectMongoDB();
    process.exit(0);
  } catch (error) {
    process.stderr.write(
      `[seed] Failed to preload notifications: ${error instanceof Error ? error.message : String(error)}\n`
    );
    await disconnectMongoDB().catch(() => null);
    process.exit(1);
  }
};

run();
