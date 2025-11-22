# Deployment Guide

This guide covers different deployment scenarios for the Personal Finance App.

## Table of Contents

- [Local Development](#local-development)
- [Local Docker Testing](#local-docker-testing)
- [Railway Deployment](#railway-deployment)

---

## Local Development

**Use Case**: Develop with PostgreSQL in Docker, backend/frontend running with bun

### Setup

1. **Start PostgreSQL:**
   ```bash
   docker compose -f docker-compose.postgres.yml up -d
   ```

2. **Configure Backend:**
   ```bash
   cd backend
   cp .env.example .env
   ```

   Edit `backend/.env`:
   ```env
   PORT=3001
   NODE_ENV=development
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/personal_finance
   JWT_SECRET=$(openssl rand -base64 32)
   ENCRYPTION_KEY=$(openssl rand -base64 32)
   FRONTEND_URL=http://localhost:3000
   ```

3. **Configure Frontend:**
   ```bash
   cd ../frontend
   cp .env.local.example .env.local
   ```

4. **Run Development Servers:**

   Terminal 1 - Backend:
   ```bash
   cd backend
   bun run dev
   ```

   Terminal 2 - Frontend:
   ```bash
   cd frontend
   bun run dev
   ```

5. **Access:** http://localhost:3000

---

## Local Docker Testing

**Use Case**: Test the full Docker setup locally before deploying

### Setup

1. **Use the all-in-one compose file:**
   ```bash
   docker compose -f docker-compose.with-postgres.yml up --build -d
   ```

2. **Access:** http://localhost:3000

3. **Stop:**
   ```bash
   docker compose -f docker-compose.with-postgres.yml down
   ```

---

## Railway Deployment

**Use Case**: Production deployment on Railway with external PostgreSQL

### Prerequisites

- Railway account (https://railway.app)
- GitHub repository with your code

### Step 1: Create PostgreSQL Database

1. Go to Railway Dashboard
2. Click "New Project"
3. Select "Provision PostgreSQL"
4. Once created, go to the PostgreSQL service
5. Click "Connect" tab
6. Copy the **"Postgres Connection URL"** (it looks like: `postgresql://user:pass@host:port/dbname`)

### Step 2: Deploy Backend + Frontend

1. In Railway, click "New" → "GitHub Repo"
2. Select your repository
3. Railway will detect it's a monorepo - click "Add Variables" to configure:

   **Environment Variables:**
   ```env
   DATABASE_URL=<paste your PostgreSQL connection URL>
   JWT_SECRET=<generate with: openssl rand -base64 32>
   ENCRYPTION_KEY=<generate with: openssl rand -base64 32>
   FRONTEND_URL=https://your-app.railway.app
   NEXT_PUBLIC_API_URL=https://your-app.railway.app/api
   PORT=3000
   ```

4. **Configure Build & Start:**

   In Railway Settings:
   - **Root Directory**: Leave empty (monorepo root)
   - **Build Command**:
     ```bash
     bun install && cd backend && bun run build && cd ../frontend && bun run build
     ```
   - **Start Command**:
     ```bash
     bun run start:prod
     ```

5. Add to root `package.json`:
   ```json
   {
     "scripts": {
       "start:prod": "concurrently \"bun --cwd backend run start\" \"bun --cwd frontend run start\""
     },
     "dependencies": {
       "concurrently": "^8.2.2"
     }
   }
   ```

6. Install concurrently:
   ```bash
   bun add concurrently
   ```

### Step 3: Alternative - Separate Services

If you prefer separate backend and frontend services on Railway:

#### Backend Service

1. Create new service from GitHub repo
2. Set **Root Directory**: `backend`
3. **Environment Variables:**
   ```env
   DATABASE_URL=<your PostgreSQL URL>
   JWT_SECRET=<random secret>
   ENCRYPTION_KEY=<random secret>
   FRONTEND_URL=https://your-frontend.railway.app
   PORT=3001
   ```
4. **Build Command**: `bun install && bun run build`
5. **Start Command**: `bun run start`

#### Frontend Service

1. Create new service from GitHub repo
2. Set **Root Directory**: `frontend`
3. **Environment Variables:**
   ```env
   NEXT_PUBLIC_API_URL=https://your-backend.railway.app/api
   ```
4. **Build Command**: `bun install && bun run build`
5. **Start Command**: `bun run start`

### Step 4: Deploy

1. Push to your GitHub repo
2. Railway will automatically build and deploy
3. Database tables will be created automatically on first run
4. Access your app at the Railway-provided URL

### Important Notes for Railway

- ✅ Database tables are created automatically
- ✅ Use the PostgreSQL connection URL from Railway
- ✅ Set proper CORS with FRONTEND_URL
- ✅ Generate strong JWT_SECRET and ENCRYPTION_KEY
- ❌ Don't hardcode secrets in code
- ❌ Don't commit .env files

---

## Environment Variables Reference

### Local Development

**backend/.env:**
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/personal_finance
JWT_SECRET=<random-32-bytes>
ENCRYPTION_KEY=<random-32-bytes>
FRONTEND_URL=http://localhost:3000
```

**frontend/.env.local:**
```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

### Railway Production

**All variables in Railway dashboard:**
```env
DATABASE_URL=<railway-postgres-url>
JWT_SECRET=<random-32-bytes>
ENCRYPTION_KEY=<random-32-bytes>
FRONTEND_URL=https://your-app.railway.app
NEXT_PUBLIC_API_URL=https://your-app.railway.app/api
PORT=3000
```

---

## Troubleshooting

### Railway: Database Connection Failed

- Verify DATABASE_URL is correct
- Check PostgreSQL service is running
- Ensure database exists

### Railway: Build Failed

- Check build logs in Railway dashboard
- Verify bun.lock is committed
- Try: `bun install` locally and commit lockfile

### Railway: Frontend Can't Reach Backend

- Verify NEXT_PUBLIC_API_URL is set correctly
- Check CORS settings (FRONTEND_URL in backend)
- Ensure both services are deployed

### Local: Backend Can't Connect to Docker PostgreSQL

- Use development mode (bun run dev) not Docker
- Or use docker-compose.with-postgres.yml for full Docker testing
