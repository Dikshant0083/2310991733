# Quick Start

## Local Development

```bash
cd backend
copy .env.example .env
npm install
npm run dev
```

`npm run dev` now uses a local helper that attempts to reclaim port `5000`
from stale backend listeners before starting nodemon, which prevents the
common `EADDRINUSE` crash during development.

The backend also preloads a development notification dataset for students
`1042` and `1043` unless `SEED_PRELOADED_NOTIFICATIONS=false`.

Use the default `MONGO_URI=mongodb://localhost:27017/campus_notifications`
when MongoDB is running locally without auth. If you are pointing the backend at
the Docker Compose MongoDB container instead, use the commented auth-enabled URI
from `backend/.env.example`.

```bash
cd frontend
copy .env.local.example .env.local
npm install
npm run dev
```

If Redis or RabbitMQ are not running locally, the backend still starts and uses
its no-cache / in-memory queue fallbacks.

## Docker

```bash
docker-compose up -d
```

## URLs

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:5000`
- Health: `http://localhost:5000/health`
- Readiness: `http://localhost:5000/ready`

## Common Commands

```bash
cd frontend
npm.cmd run type-check
npm.cmd run build
```

```bash
cd backend
node -e "import('./src/routes/notificationRoutes.js')"
```
