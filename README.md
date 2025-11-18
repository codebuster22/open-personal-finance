# Personal Finance App - Subscription Tracker

A self-hosted personal finance application focused on subscription management through Gmail integration. The system automatically extracts subscription information from emails using AI-powered detection.

## Features

- **Multi-Account Gmail Integration**: Connect unlimited Gmail accounts with individual OAuth credentials
- **AI-Powered Subscription Detection**: Automatically identify and extract subscription details from emails
- **Self-Hosted Deployment**: Complete control over your data with Docker containerization
- **Subscription Lifecycle Management**: Track, analyze, and manage recurring expenses
- **Dark Mode UI**: Modern interface with Tailwind CSS and shadcn/ui components
- **Auto Database Initialization**: Tables are created automatically on first run

## Tech Stack

- **Frontend**: Next.js 16, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Express.js, TypeScript, Bun runtime
- **Database**: PostgreSQL 16+
- **Authentication**: JWT-based with bcrypt password hashing
- **Email Processing**: Gmail API with OAuth 2.0
- **Deployment**: Docker containerization

## Quick Start

### Prerequisites

- [Docker](https://www.docker.com/) and Docker Compose
- PostgreSQL database URL (from your provider or self-hosted)

### Docker Deployment (Recommended)

1. **Get a PostgreSQL database URL:**
   
   You can use any PostgreSQL provider:
   - **Neon** (https://neon.tech) - Free tier available
   - **Supabase** (https://supabase.com) - Free tier available
   - **Railway** (https://railway.app) - Free trial
   - **Self-hosted**: Use `docker-compose.postgres.yml` (see below)

2. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env and set your DATABASE_URL
   ```

   Example `.env`:
   ```env
   DATABASE_URL=postgresql://user:password@host:5432/dbname
   JWT_SECRET=your-random-secret-key-here
   ENCRYPTION_KEY=your-random-encryption-key-here
   ```

3. **Build and start:**
   ```bash
   docker compose up --build -d
   ```

4. **Access the app:**
   Open http://localhost:3000

   The backend will automatically:
   - ✓ Test the database connection
   - ✓ Create all required tables if they don't exist
   - ✓ Start the server

### Local PostgreSQL (Optional)

If you want to run PostgreSQL locally with Docker:

```bash
# Start PostgreSQL
docker compose -f docker-compose.postgres.yml up -d

# Then use this DATABASE_URL in your .env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/personal_finance

# Or in backend/.env for development
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/personal_finance
```

### Development Setup (Without Docker)

1. **Install dependencies:**
   ```bash
   bun install
   ```

2. **Set up PostgreSQL:**
   ```bash
   # Option A: Use docker-compose.postgres.yml
   docker compose -f docker-compose.postgres.yml up -d

   # Option B: Use your own PostgreSQL server
   # Just get the connection URL
   ```

3. **Configure backend:**
   ```bash
   cd backend
   cp .env.example .env
   # Edit .env and set DATABASE_URL
   ```

4. **Configure frontend:**
   ```bash
   cd ../frontend
   cp .env.local.example .env.local
   ```

5. **Run development servers:**
   
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

6. **Access the app:**
   Open http://localhost:3000

## Environment Variables

### Docker (.env in root)
```env
DATABASE_URL=postgresql://user:password@host:port/database
JWT_SECRET=your-secret-key
ENCRYPTION_KEY=your-encryption-key
FRONTEND_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

### Backend (backend/.env)
```env
PORT=3001
NODE_ENV=development
DATABASE_URL=postgresql://user:password@host:port/database
JWT_SECRET=your-secret-key
ENCRYPTION_KEY=your-encryption-key
FRONTEND_URL=http://localhost:3000
```

### Frontend (frontend/.env.local)
```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

## Gmail OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Gmail API
4. Configure OAuth consent screen
5. Create OAuth 2.0 credentials (Web application)
6. Add redirect URI: `http://localhost:3000/oauth-callback`
7. Copy Client ID and Client Secret to the app settings

## Project Structure

```
open-personal-finance/
├── frontend/                 # Next.js frontend
│   ├── src/
│   │   ├── app/             # App router pages
│   │   ├── components/      # React components
│   │   ├── contexts/        # React contexts
│   │   ├── lib/            # Utility functions
│   │   └── services/       # API services
│   └── Dockerfile
├── backend/                  # Express.js backend
│   ├── src/
│   │   ├── routes/         # API routes
│   │   ├── services/       # Business logic
│   │   ├── middleware/     # Express middleware
│   │   ├── models/         # Database schema
│   │   ├── config/         # Configuration
│   │   └── utils/          # Utilities
│   └── Dockerfile
├── docker-compose.yml           # Main compose file (backend + frontend)
├── docker-compose.postgres.yml  # Optional local PostgreSQL
└── package.json                # Workspace configuration
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user

### OAuth Management
- `POST /api/oauth/credentials` - Add OAuth credential
- `GET /api/oauth/credentials` - List OAuth credentials
- `DELETE /api/oauth/credentials/:id` - Remove credential
- `GET /api/oauth/credentials/:id/auth-url` - Get Google auth URL
- `POST /api/oauth/callback` - Handle OAuth callback
- `GET /api/oauth/accounts` - List connected Gmail accounts

### Gmail
- `POST /api/gmail/accounts/:id/sync` - Start email sync

### Subscriptions
- `GET /api/subscriptions` - List all subscriptions
- `POST /api/subscriptions` - Create subscription
- `GET /api/subscriptions/:id` - Get subscription
- `PUT /api/subscriptions/:id` - Update subscription
- `DELETE /api/subscriptions/:id` - Delete subscription
- `GET /api/subscriptions/stats` - Get statistics
- `GET /api/subscriptions/categories` - List categories

## Security Features

- All passwords hashed with bcrypt (12 rounds)
- OAuth secrets encrypted with AES-256-GCM
- JWT tokens with 7-day expiration
- CORS protection
- Helmet security headers
- Automatic database initialization (no manual SQL execution needed)

## Troubleshooting

**Database connection errors:**
- Verify your DATABASE_URL is correct
- Check if your database server is accessible
- Ensure the database exists

**Port conflicts:**
- Change ports in docker-compose.yml if 3000 or 3001 are in use

**Build failures:**
- Clear Docker cache: `docker compose down && docker system prune`
- Rebuild: `docker compose up --build -d`

## License

MIT
