# Campus Notification System

This file is the single complete deliverable for the assignment. The implementation in this repository follows clean architecture on the backend (`Controller -> Service -> Repository`) and a modular Next.js frontend.

# Stage 1

## Explanation

The API layer is designed for:

- predictable contracts
- stateless REST access
- real-time updates through WebSocket
- pagination and filtering for large datasets
- structured error handling
- request tracing with custom logging

Authentication is intentionally excluded. The backend assumes pre-authorized users and reads `X-Student-ID`.

## Design

### Naming conventions

- Base path: `/api/v1`
- Resource naming: plural nouns
- State change actions: sub-resource verbs only when they represent lifecycle changes

Examples:

- `GET /api/v1/notifications`
- `GET /api/v1/notifications/:id`
- `GET /api/v1/notifications/stats`
- `GET /api/v1/notifications/top`
- `PATCH /api/v1/notifications/:id/read`
- `PATCH /api/v1/notifications/read-all`
- `POST /api/v1/notifications`

### Headers

```http
Content-Type: application/json
X-Student-ID: 1042
X-Request-ID: optional-client-generated-id
```

### Core endpoints

#### 1. Get notifications with pagination and filter

```http
GET /api/v1/notifications?page=1&limit=10&notification_type=placement&status=unread&search=oracle
```

Response:

```json
{
  "success": true,
  "data": {
    "notifications": [
      {
        "_id": "66572f21a1a44f26083c9001",
        "studentId": 1042,
        "type": "placement",
        "title": "Oracle shortlist released",
        "description": "Check the shortlist and interview timeline.",
        "priority": "high",
        "isRead": false,
        "createdAt": "2026-05-05T09:15:00.000Z",
        "updatedAt": "2026-05-05T09:15:00.000Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 12,
      "totalRecords": 113,
      "limit": 10,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  },
  "meta": {
    "timestamp": "2026-05-05T11:30:00.000Z",
    "requestId": "cf0b4ca2-bcb3-48d6-88ce-58990b7c8708",
    "executionTime": "18ms",
    "unreadCount": 24
  }
}
```

Status codes:

- `200` success
- `400` invalid query parameters
- `500` server error

#### 2. Mark one notification as read

```http
PATCH /api/v1/notifications/:id/read
```

Response:

```json
{
  "success": true,
  "data": {
    "id": "66572f21a1a44f26083c9001",
    "isRead": true,
    "readAt": "2026-05-05T11:31:15.000Z"
  },
  "meta": {
    "timestamp": "2026-05-05T11:31:15.000Z",
    "requestId": "0f8a69aa-574f-4670-b8b9-5c7a6733a03e",
    "executionTime": "9ms"
  }
}
```

#### 3. Mark all as read

```http
PATCH /api/v1/notifications/read-all
Content-Type: application/json

{
  "type": "placement"
}
```

#### 4. Create notifications

```http
POST /api/v1/notifications
Content-Type: application/json

{
  "studentIds": [1042, 1043, 1044],
  "type": "placement",
  "title": "Microsoft interview schedule",
  "description": "Interview slots are available on the portal.",
  "priority": "high",
  "metadata": {
    "link": "https://campus.example.com/interviews/microsoft"
  },
  "sendEmail": true,
  "sendPushNotification": true
}
```

#### 5. Real-time system

Socket.IO room model:

- room name: `student:{studentId}`
- event names:
  - `notification:new`
  - `notification:updated`
  - `notification:deleted`
  - `notification:all-read`

## Code

Backend implementation:

- `backend/src/routes/notificationRoutes.js`
- `backend/src/controllers/NotificationController.js`
- `backend/src/middleware/index.js`
- `backend/src/utils/response.js`
- `backend/src/utils/logger.js`

Representative controller flow:

```js
const result = await notificationService.getNotifications(studentId, options);
const unreadCount = await notificationService.getUnreadCount(studentId);

return successResponse(
  res,
  req,
  200,
  {
    notifications: result.notifications,
    pagination: result.pagination,
  },
  {
    unreadCount: unreadCount.total,
  }
);
```

## Best practices

- Validate page and limit before hitting the database.
- Return consistent `success/data/meta` and `success/error/meta` envelopes.
- Emit request IDs and execution time in responses and logs.
- Keep controller code thin and push business logic into services.
- Never use `console.log`; use structured logging middleware.

# Stage 2

## Explanation

MongoDB is the primary database choice for this implementation because notifications are append-heavy, metadata can vary by notification type, and horizontal scaling is straightforward with sharding.

## Design

### Collections

#### `notifications`

Key fields:

- `studentId`
- `type`
- `title`
- `description`
- `priority`
- `isRead`
- `readAt`
- `createdAt`
- `updatedAt`
- `expiresAt`
- `metadata`
- `sender`

#### `notificationPreferences`

Key fields:

- `studentId`
- `emailNotifications`
- `pushNotifications`
- `smsNotifications`
- `notificationTypes`

### Indexing strategy

Implemented in `backend/src/models/Notification.js`:

```js
notificationSchema.index({ studentId: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ studentId: 1, type: 1, isRead: 1 });
notificationSchema.index({ type: 1, createdAt: -1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
notificationSchema.index({ title: 'text', description: 'text' });
```

### Relationships

- Student data is treated as an external upstream domain.
- Notifications reference `studentId` only, which keeps writes cheap and avoids expensive joins.
- Preferences are modeled separately because they change at a different rate from notifications.

### Sample queries

Unread notifications for one student:

```js
db.notifications.find({
  studentId: 1042,
  isRead: false
}).sort({ createdAt: -1 }).limit(10);
```

Unread counts by type:

```js
db.notifications.aggregate([
  { $match: { studentId: 1042, isRead: false } },
  { $group: { _id: '$type', count: { $sum: 1 } } }
]);
```

## Handling millions of records

- Shard on `studentId` for high-cardinality distribution.
- Use TTL via `expiresAt` for retention control.
- Archive cold data older than the operational window.
- Keep list queries paginated and projection-oriented.
- Use Redis for hot list pages and unread counters.

## Scaling strategies

### Sharding

- shard key: `studentId`
- benefit: targeted routing for student-specific reads
- risk: hot partitions if one tenant dominates traffic

### Partitioning

- logical partition by academic term or year for archival jobs
- useful before full sharding or alongside cold storage

### Caching

- cache list pages per student and filter combination
- cache unread counters separately
- invalidate on create, mark-read, mark-all-read, delete

## Code

- `backend/src/models/Notification.js`
- `backend/src/models/NotificationPreference.js`
- `backend/src/repositories/NotificationRepository.js`
- `backend/src/services/NotificationService.js`

## Best practices

- Prefer compound indexes matching real query shapes.
- Avoid indexing every field; it increases memory, disk, and write cost.
- Keep retention explicit; notification tables grow quickly.
- Separate operational data from analytics or audit data.

# Stage 3

## Explanation

Original query:

```sql
SELECT * FROM notifications
WHERE studentID = 1042 AND isRead = false
ORDER BY createdAt ASC;
```

## Design

### Why it is slow

- `SELECT *` reads wide rows even when the UI needs only a subset.
- Without a composite index, the database scans more records than necessary.
- Sorting after filtering is expensive if the index does not support `ORDER BY`.
- No pagination means the result set can explode for heavy users.

### Optimized relational version

```sql
SELECT id, studentID, type, title, description, priority, isRead, createdAt
FROM notifications
WHERE studentID = 1042
  AND isRead = false
ORDER BY createdAt DESC
LIMIT 10 OFFSET 0;
```

Recommended index:

```sql
CREATE INDEX idx_notifications_student_read_created_at
ON notifications (studentID, isRead, createdAt DESC);
```

### MongoDB equivalent used in this project

```js
Notification.find({
  studentId: 1042,
  isRead: false
})
  .sort('-createdAt')
  .limit(10)
  .lean();
```

### Why not index all columns

- every index adds write amplification
- every index consumes RAM and storage
- low-value indexes reduce cache efficiency
- unused indexes slow inserts and updates

### Query for students with placement notifications in the last 7 days

Relational:

```sql
SELECT DISTINCT studentID
FROM notifications
WHERE type = 'placement'
  AND createdAt >= NOW() - INTERVAL '7 days';
```

MongoDB:

```js
db.notifications.distinct('studentId', {
  type: 'placement',
  createdAt: {
    $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
  },
});
```

## Code

- `backend/src/repositories/NotificationRepository.js`
- `backend/src/models/Notification.js`

## Best practices

- Index the leading equality filters first, then the sort field.
- Use pagination on every list endpoint.
- Use `lean()` for read-only Mongoose queries.
- Fetch only the fields the client needs.

# Stage 4

## Explanation

If the database is overloaded by frequent notification fetches, the fix is not one tool. It is a read-path strategy combining cache, pagination, push delivery, and read scaling.

## Design

### Redis caching

Implemented cache keys:

- `notif:student:{studentId}:list:{querystring}`
- `notif:student:{studentId}:stats`
- `notif:student:{studentId}:top:{limit}`

Tradeoff:

- benefit: lower read latency and reduced database pressure
- cost: invalidation complexity and risk of stale reads

### Pagination

Current API caps `limit` at `100`.

Tradeoff:

- benefit: protects the database and frontend memory
- cost: extra round-trips for long browsing sessions

### Lazy loading

Used on the frontend through page-based navigation and filtered fetches.

Tradeoff:

- benefit: smaller payloads and faster first paint
- cost: more UI state management

### WebSockets

Implemented with Socket.IO rooms per student.

Tradeoff:

- benefit: reduces polling and improves freshness
- cost: connection management and horizontal scaling complexity

### Read replicas

Recommended deployment strategy:

- primary: writes
- secondaries: heavy list reads and analytics

Tradeoff:

- benefit: higher read throughput
- cost: replication lag

### CDN

Not required for JSON APIs, but useful for:

- static frontend assets
- images inside notification metadata

Tradeoff:

- benefit: global asset acceleration
- cost: cache invalidation and deployment coordination

## Code

Caching and invalidation:

```js
const cacheKey = this.buildListCacheKey(studentId, options);
const cached = await this.readCache(cacheKey);
if (cached) return cached;

const result = await notificationRepository.findByStudentId(studentId, options);
await this.writeCache(cacheKey, 300, result);
```

Source files:

- `backend/src/services/NotificationService.js`
- `backend/src/config/redis.js`
- `backend/src/index.js`

## Best practices

- Keep cache TTL short for list pages.
- Use targeted invalidation, not blanket flushes.
- Push new notifications over WebSocket and let clients refresh selectively.
- Put large static files behind a CDN, not the application server.

# Stage 5

## Explanation

Problematic code:

```python
for student_id in student_ids:
    send_email()
    save_to_db()
    push_to_app()
```

## Design

### Issues

- tightly couples write path and delivery path
- one failed email can block database progress
- retries can create duplicates
- no dead-letter queue
- no observability for background work

### Should DB + email be together?

No. Database persistence and notification delivery should not be one blocking unit of work. The safer pattern is:

1. persist notification records
2. publish delivery jobs
3. let background workers handle email and push
4. use idempotency keys and retries

### Reliable architecture

- API writes notification documents
- service publishes `notification.delivery` jobs
- worker consumes jobs
- failed jobs retry up to `N` times
- final failures move to dead-letter queue
- logs capture request path and background job lifecycle

## Code

Queue abstraction:

- `backend/src/config/messageQueue.js`
- `backend/src/workers/notificationDeliveryWorker.js`

Representative code:

```js
await messageQueue.publish(
  'notification.delivery',
  {
    notificationId: String(notification._id),
    studentId: notification.studentId,
    channels: {
      inApp: true,
      email: Boolean(deliveryOptions.sendEmail),
      push: Boolean(deliveryOptions.sendPushNotification),
    },
  },
  {
    idempotencyKey: `notification:${notification._id}:delivery`,
  }
);
```

Worker skeleton:

```js
await messageQueue.subscribe(
  'notification.delivery',
  async (payload, envelope) => {
    logger.info('Processing notification delivery job', {
      messageId: envelope.id,
      studentId: payload.studentId,
      notificationId: payload.notificationId,
    });
  },
  {
    maxRetries: 3,
    deadLetterQueue: 'notification.delivery.dlq',
  }
);
```

### Improved pseudocode

```text
POST /notifications
  -> validate request
  -> save notifications in DB
  -> for each saved notification:
       publish delivery job with idempotency key
       emit in-app socket event
  -> return 201 immediately

worker(notification.delivery)
  -> read job
  -> if idempotency key already processed: ack and stop
  -> send email / push / audit log
  -> on failure:
       retry until maxRetries
       move to DLQ after final failure
```

## Best practices

- Use idempotency keys on background jobs.
- Keep retries bounded and visible.
- Move poison messages to DLQ, never retry forever.
- Log queue publish, processing, retry, and DLQ transitions.

# Stage 6

## Explanation

Requirement: return top `N` unread notifications using in-memory data only, ordered by:

1. `Placement`
2. `Result`
3. `Event`
4. recency as tiebreaker

## Design

This is implemented with a min-heap so we do not fully sort large arrays when only the top `N` items are needed.

Complexity:

- full sort: `O(n log n)`
- min-heap top `N`: `O(n log k)` where `k = N`

## Code

Implemented in `backend/src/services/PriorityService.js`.

```js
const typeWeight = {
  placement: 3,
  result: 2,
  event: 1,
};

rankNotification(notification) {
  return {
    ...notification,
    priorityScore: typeWeight[notification.type] || 0,
    recencyScore: new Date(notification.createdAt).getTime(),
  };
}
```

Top `10` selection:

```js
const unreadNotifications = await notificationRepository.findUnreadByStudentId(studentId);
const topNotifications = priorityService.getTopNotifications(unreadNotifications, 10);
```

Pure in-memory example:

```js
const notifications = [
  { _id: '1', type: 'event', isRead: false, createdAt: '2026-05-05T08:00:00Z' },
  { _id: '2', type: 'placement', isRead: false, createdAt: '2026-05-05T09:00:00Z' },
  { _id: '3', type: 'result', isRead: false, createdAt: '2026-05-05T07:00:00Z' },
];

const top10 = priorityService.getTopNotifications(notifications, 10);
```

## Best practices

- Rank unread notifications only.
- Keep the comparator deterministic.
- Use a heap when `N` is small relative to total notifications.
- Cache the computed top list for short intervals.

# Stage 7

## Explanation

The frontend is a Next.js 14 application with Material UI. It supports:

- notification list view
- filter by type
- status filtering
- search
- pagination
- unread highlighting
- dedicated priority page
- real-time updates
- resilient API integration

## Design

### External API requirement

The required evaluation API is:

```text
http://20.207.122.201/evaluation-service/notifications
```

Required query params:

- `limit`
- `page`
- `notification_type`

The implementation proxies that feed through:

- `frontend/src/app/api/evaluation/notifications/route.ts`

This avoids browser CORS problems and keeps the client code stable.

### Frontend folder structure

```text
frontend/src
├── app
│   ├── api
│   │   ├── client-logs/route.ts
│   │   └── evaluation/notifications/route.ts
│   ├── notifications
│   │   ├── priority/page.tsx
│   │   ├── notifications.module.css
│   │   └── page.tsx
│   ├── layout.tsx
│   └── page.tsx
├── components
│   ├── Layout/AppShell.tsx
│   └── Notification
│       ├── NotificationCard.tsx
│       ├── NotificationFilters.tsx
│       └── NotificationList.tsx
├── hooks/useNotifications.ts
├── services
│   ├── notificationService.ts
│   └── socketService.ts
├── styles/globals.css
├── types/notification.ts
└── utils/logger.ts
```

### API integration strategy

- list page: external evaluation feed through Next proxy
- state-changing actions: internal backend API
- real-time events: Socket.IO backend

## Code

Proxy route:

```ts
const upstreamUrl = new URL(evaluationEndpoint);
request.nextUrl.searchParams.forEach((value, key) => {
  upstreamUrl.searchParams.set(key, value);
});

const upstreamResponse = await fetch(upstreamUrl, {
  method: 'GET',
  headers: { Accept: 'application/json' },
  cache: 'no-store',
});
```

Hook usage:

```ts
const {
  notifications,
  loading,
  error,
  pagination,
  unreadCount,
  refresh,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} = useNotifications({
  page,
  limit,
  filters,
});
```

Priority page:

```ts
const response = await notificationService.getTopNotifications(10);
setNotifications(response);
```

## Best practices

- Proxy third-party feeds through the server when CORS is uncertain.
- Normalize API shapes before they reach components.
- Keep stateful logic in hooks, not inside visual components.
- Highlight unread items visually and semantically.
- Always show loading, empty, and error states.
- Keep responsive layout intentional for mobile and desktop.

# Bonus

## Backend folder structure

```text
backend/src
├── config
│   ├── database.js
│   ├── messageQueue.js
│   └── redis.js
├── controllers/NotificationController.js
├── middleware/index.js
├── models
│   ├── Notification.js
│   └── NotificationPreference.js
├── repositories/NotificationRepository.js
├── routes/notificationRoutes.js
├── services
│   ├── NotificationService.js
│   └── PriorityService.js
├── utils
│   ├── logger.js
│   ├── response.js
│   ├── socketEmitter.js
│   └── socketGateway.js
├── workers/notificationDeliveryWorker.js
└── index.js
```

## Sample environment files

Backend:

```env
NODE_ENV=development
PORT=5000
LOG_LEVEL=info
MONGO_URI=mongodb://root:password@localhost:27017/campus_notifications?authSource=admin
REDIS_HOST=localhost
REDIS_PORT=6379
RABBITMQ_URL=amqp://guest:guest@localhost:5672
FRONTEND_URL=http://localhost:3000
SOCKET_IO_CORS=http://localhost:3000
```

Frontend:

```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api/v1
NEXT_PUBLIC_SOCKET_URL=http://localhost:5000
NEXT_PUBLIC_STUDENT_ID=1042
NEXT_PUBLIC_CLIENT_LOG_ENDPOINT=/api/client-logs
NOTIFICATION_FEED_URL=http://20.207.122.201/evaluation-service/notifications
```

## Deployment approach

### Local

- `docker-compose.yml` for MongoDB, Redis, backend, frontend

### Containerized production

- backend and frontend have separate `Dockerfile`s
- readiness and health endpoints are exposed
- Kubernetes manifest available in `k8s/backend-deployment.yaml`

### Recommended production topology

1. frontend on Vercel or container platform
2. backend behind load balancer
3. MongoDB replica set or Atlas cluster
4. Redis for cache
5. RabbitMQ cluster for background delivery

## How to scale to millions of users

- shard `notifications` on `studentId`
- keep unread counters cached
- route list traffic to read replicas
- use short-lived cache entries for hot pages
- offload delivery work to queue consumers
- scale Socket.IO horizontally with a Redis adapter when needed
- archive cold data and enforce TTL retention

## Git commit strategy

Recommended commit format:

```text
feat(api): add notification detail endpoint
fix(cache): correct student cache invalidation pattern
perf(priority): compute top notifications with heap
docs(system-design): align stage deliverable with implementation
```

## Working implementation summary

Implemented and verified in this repository:

- clean backend layering
- custom structured logging
- request tracing and execution timing
- MongoDB indexing and repository queries
- Redis-backed cache flow
- RabbitMQ-ready background queue abstraction with retry and DLQ path
- in-memory heap-based priority ranking
- Next.js frontend with proxy route, filters, pagination, priority page, and real-time updates

## Verification completed

- `frontend`: `npm.cmd run type-check`
- `frontend`: `npm.cmd run build`
- `backend`: import smoke checks for routes, services, queue, and worker modules
