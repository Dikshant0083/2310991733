import { createLogger } from '../utils/logger.js';

const logger = createLogger('PriorityService');

const typeWeight = {
  placement: 3,
  result: 2,
  event: 1,
};

class MinHeap {
  constructor(compare) {
    this.compare = compare;
    this.items = [];
  }

  size() {
    return this.items.length;
  }

  peek() {
    return this.items[0];
  }

  push(value) {
    this.items.push(value);
    this.bubbleUp(this.items.length - 1);
  }

  pop() {
    if (this.items.length === 0) {
      return null;
    }

    const top = this.items[0];
    const tail = this.items.pop();

    if (this.items.length > 0) {
      this.items[0] = tail;
      this.bubbleDown(0);
    }

    return top;
  }

  toArray() {
    return [...this.items];
  }

  bubbleUp(index) {
    let currentIndex = index;

    while (currentIndex > 0) {
      const parentIndex = Math.floor((currentIndex - 1) / 2);
      if (this.compare(this.items[currentIndex], this.items[parentIndex]) >= 0) {
        break;
      }

      [this.items[currentIndex], this.items[parentIndex]] = [
        this.items[parentIndex],
        this.items[currentIndex],
      ];

      currentIndex = parentIndex;
    }
  }

  bubbleDown(index) {
    let currentIndex = index;
    const length = this.items.length;

    while (true) {
      const left = currentIndex * 2 + 1;
      const right = currentIndex * 2 + 2;
      let candidate = currentIndex;

      if (left < length && this.compare(this.items[left], this.items[candidate]) < 0) {
        candidate = left;
      }

      if (right < length && this.compare(this.items[right], this.items[candidate]) < 0) {
        candidate = right;
      }

      if (candidate === currentIndex) {
        break;
      }

      [this.items[currentIndex], this.items[candidate]] = [
        this.items[candidate],
        this.items[currentIndex],
      ];

      currentIndex = candidate;
    }
  }
}

export class PriorityService {
  rankNotification(notification) {
    return {
      ...notification,
      priorityScore: typeWeight[notification.type] || 0,
      recencyScore: new Date(notification.createdAt).getTime(),
    };
  }

  comparePriority(a, b) {
    if (a.priorityScore !== b.priorityScore) {
      return a.priorityScore - b.priorityScore;
    }

    return a.recencyScore - b.recencyScore;
  }

  getTopNotifications(notifications, limit = 10) {
    const safeLimit = Math.min(50, Math.max(1, Number.parseInt(limit, 10) || 10));
    const heap = new MinHeap((a, b) => this.comparePriority(a, b));

    for (const notification of notifications) {
      if (notification.isRead) {
        continue;
      }

      const rankedNotification = this.rankNotification(notification);

      if (heap.size() < safeLimit) {
        heap.push(rankedNotification);
        continue;
      }

      if (this.comparePriority(rankedNotification, heap.peek()) > 0) {
        heap.pop();
        heap.push(rankedNotification);
      }
    }

    const topNotifications = heap
      .toArray()
      .sort((a, b) => this.comparePriority(b, a))
      .map(({ priorityScore, recencyScore, ...notification }) => notification);

    logger.debug('Computed top notifications in memory', {
      requested: safeLimit,
      returned: topNotifications.length,
    });

    return topNotifications;
  }
}

export default new PriorityService();
