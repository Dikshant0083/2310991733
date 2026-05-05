# Campus Notification System

Production-grade Campus Notification System built with:

- `Node.js + Express`
- `MongoDB`
- `Redis`
- `RabbitMQ-ready queue abstraction`
- `Next.js + Material UI`
- `Socket.IO`

## Quick Start

### Backend

```bash
cd backend
copy .env.example .env
npm install
npm run dev
```

The default backend example now targets a common local MongoDB instance on
`localhost:27017` without authentication. If you are using the Docker Compose
MongoDB service instead, switch to the commented auth-enabled `MONGO_URI` in
`backend/.env.example`.

The backend dev entrypoint now uses a small helper script to free stale
listeners on port `5000` before nodemon starts, which avoids repeated
`EADDRINUSE` crashes in local development.

On startup, the backend also preloads a small development dataset for students
`1042` and `1043`. The preload is idempotent and can be toggled with
`SEED_PRELOADED_NOTIFICATIONS=false`.

### Frontend

```bash
cd frontend
copy .env.local.example .env.local
npm install
npm run dev
```

Redis and RabbitMQ are optional in local development. When they are unavailable,
the backend continues with no-cache and in-memory queue fallbacks.

### Docker Compose

```bash
docker-compose up -d
```

## Important Files

- `docs/SYSTEM_DESIGN.md`: complete stage-by-stage solution
- `backend/src`: clean architecture backend
- `frontend/src`: Next.js frontend
- `backend/.env.example` and `frontend/.env.local.example`: sample configuration

## Verification

- Frontend type check: `npm.cmd run type-check`
- Frontend production build: `npm.cmd run build`
- Backend module import smoke check: import routes/services directly
- Backend preload sync: `cd backend && npm run seed`

## Notes

- Authentication is intentionally omitted. The backend assumes pre-authorized users via `X-Student-ID`.
- Frontend notification listing proxies the required evaluation feed through `frontend/src/app/api/evaluation/notifications/route.ts`.
- Logging avoids `console.log` and uses custom structured loggers on both backend and frontend.
