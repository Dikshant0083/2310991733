import amqp from 'amqplib';
import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('MessageQueue');

class MessageQueue {
  constructor() {
    this.mode = 'memory';
    this.queues = new Map();
    this.subscribers = new Map();
    this.processedKeys = new Map();
    this.connection = null;
    this.channel = null;
    this.initialized = false;
  }

  async connect() {
    if (this.initialized) {
      return;
    }

    const rabbitMqUrl = process.env.RABBITMQ_URL;
    if (!rabbitMqUrl) {
      this.initialized = true;
      logger.warn('RABBITMQ_URL not configured, using in-memory queue fallback');
      return;
    }

    try {
      this.connection = await amqp.connect(rabbitMqUrl);
      this.channel = await this.connection.createChannel();
      await this.channel.assertExchange('notification.dlx', 'direct', { durable: true });
      this.mode = 'rabbitmq';
      this.initialized = true;

      logger.info('RabbitMQ connected successfully');
    } catch (error) {
      this.mode = 'memory';
      this.initialized = true;
      logger.warn('RabbitMQ unavailable, continuing with in-memory queue', {
        error: error.message,
      });
    }
  }

  isDuplicate(idempotencyKey) {
    if (!idempotencyKey) {
      return false;
    }

    return this.processedKeys.has(idempotencyKey);
  }

  markProcessed(idempotencyKey) {
    if (!idempotencyKey) {
      return;
    }

    this.processedKeys.set(idempotencyKey, Date.now());

    if (this.processedKeys.size > 10000) {
      const oldestKey = this.processedKeys.keys().next().value;
      if (oldestKey) {
        this.processedKeys.delete(oldestKey);
      }
    }
  }

  async publish(queueName, payload, options = {}) {
    await this.connect();

    const message = {
      id: options.id || uuidv4(),
      idempotencyKey: options.idempotencyKey || payload.idempotencyKey || uuidv4(),
      payload,
      attempt: options.attempt || 0,
      maxRetries: options.maxRetries || 3,
      createdAt: new Date().toISOString(),
    };

    if (this.isDuplicate(message.idempotencyKey)) {
      logger.warn('Skipping duplicate background job', {
        queueName,
        idempotencyKey: message.idempotencyKey,
      });
      return { skipped: true, queueName };
    }

    logger.info('Background job queued', {
      queueName,
      messageId: message.id,
      mode: this.mode,
    });

    if (this.mode === 'rabbitmq' && this.channel) {
      await this.assertQueueTopology(queueName);
      this.channel.sendToQueue(queueName, Buffer.from(JSON.stringify(message)), {
        persistent: true,
      });
      return { queued: true, queueName, mode: this.mode };
    }

    if (!this.queues.has(queueName)) {
      this.queues.set(queueName, []);
    }

    this.queues.get(queueName).push(message);
    this.dispatchMemory(queueName);
    return { queued: true, queueName, mode: this.mode };
  }

  async assertQueueTopology(queueName, deadLetterQueue = `${queueName}.dlq`) {
    if (!this.channel) {
      return;
    }

    await this.channel.assertQueue(deadLetterQueue, { durable: true });
    await this.channel.bindQueue(deadLetterQueue, 'notification.dlx', deadLetterQueue);
    await this.channel.assertQueue(queueName, {
      durable: true,
      deadLetterExchange: 'notification.dlx',
      deadLetterRoutingKey: deadLetterQueue,
    });
  }

  async dispatchMemory(queueName) {
    const subscribers = this.subscribers.get(queueName) || [];
    const queue = this.queues.get(queueName) || [];

    if (subscribers.length === 0 || queue.length === 0) {
      return;
    }

    while (queue.length > 0) {
      const message = queue.shift();
      for (const subscriber of subscribers) {
        await this.runWithRetry(queueName, message, subscriber);
      }
    }
  }

  async subscribe(queueName, handler, options = {}) {
    await this.connect();

    if (!this.subscribers.has(queueName)) {
      this.subscribers.set(queueName, []);
    }

    this.subscribers.get(queueName).push({
      handler,
      options: {
        maxRetries: options.maxRetries || 3,
        deadLetterQueue: options.deadLetterQueue || `${queueName}.dlq`,
      },
    });

    logger.info('Background job subscriber registered', {
      queueName,
      mode: this.mode,
    });

    if (this.mode === 'rabbitmq' && this.channel) {
      await this.assertQueueTopology(queueName, options.deadLetterQueue || `${queueName}.dlq`);
      await this.channel.consume(queueName, async (rawMessage) => {
        if (!rawMessage) {
          return;
        }

        const parsedMessage = JSON.parse(rawMessage.content.toString());
        const succeeded = await this.runWithRetry(queueName, parsedMessage, {
          handler,
          options: {
            maxRetries: options.maxRetries || 3,
            deadLetterQueue: options.deadLetterQueue || `${queueName}.dlq`,
          },
        });

        if (succeeded) {
          this.channel.ack(rawMessage);
        } else {
          this.channel.nack(rawMessage, false, false);
        }
      });

      return;
    }

    await this.dispatchMemory(queueName);
  }

  async runWithRetry(queueName, message, subscriber) {
    const { handler, options } = subscriber;
    const maxRetries = options.maxRetries || 3;
    const deadLetterQueue = options.deadLetterQueue || `${queueName}.dlq`;

    try {
      logger.info('Processing background job', {
        queueName,
        messageId: message.id,
        attempt: message.attempt + 1,
      });

      await handler(message.payload, message);
      this.markProcessed(message.idempotencyKey);
      return true;
    } catch (error) {
      const nextAttempt = message.attempt + 1;
      logger.error('Background job failed', error, {
        queueName,
        messageId: message.id,
        attempt: nextAttempt,
      });

      if (nextAttempt >= maxRetries) {
        await this.sendToDeadLetterQueue(deadLetterQueue, {
          ...message,
          attempt: nextAttempt,
          failedAt: new Date().toISOString(),
          failureReason: error.message,
        });

        return false;
      }

      const retryMessage = {
        ...message,
        attempt: nextAttempt,
      };

      if (this.mode === 'rabbitmq' && this.channel) {
        this.channel.sendToQueue(queueName, Buffer.from(JSON.stringify(retryMessage)), {
          persistent: true,
        });
      } else {
        if (!this.queues.has(queueName)) {
          this.queues.set(queueName, []);
        }
        this.queues.get(queueName).push(retryMessage);
      }

      return false;
    }
  }

  async sendToDeadLetterQueue(queueName, message) {
    logger.warn('Sending message to dead-letter queue', {
      queueName,
      messageId: message.id,
    });

    if (this.mode === 'rabbitmq' && this.channel) {
      await this.assertQueueTopology(queueName, queueName);
      this.channel.publish('notification.dlx', queueName, Buffer.from(JSON.stringify(message)), {
        persistent: true,
      });
      return;
    }

    if (!this.queues.has(queueName)) {
      this.queues.set(queueName, []);
    }

    this.queues.get(queueName).push(message);
  }

  getStats() {
    const stats = {};

    for (const [queueName, messages] of this.queues.entries()) {
      stats[queueName] = {
        mode: this.mode,
        queuedMessages: messages.length,
        subscribers: this.subscribers.get(queueName)?.length || 0,
      };
    }

    return stats;
  }
}

export default new MessageQueue();
