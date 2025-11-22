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

Choose your deployment mode:

### 🚀 Local Development (Recommended for Development)

PostgreSQL in Docker, Backend/Frontend with Bun:

```bash
# 1. Start PostgreSQL
docker compose -f docker-compose.postgres.yml up -d

# 2. Configure backend
cd backend
cp .env.example .env
# Edit .env and set DATABASE_URL to: postgresql://postgres:postgres@localhost:5432/personal_finance

# 3. Configure frontend
cd ../frontend
cp .env.local.example .env.local

# 4. Run (in separate terminals)
cd backend && bun run dev
cd frontend && bun run dev

# 5. Access http://localhost:3000
```

### 🐳 Local Docker Testing

Everything in Docker (for testing before deployment):

```bash
docker compose -f docker-compose.with-postgres.yml up --build -d
# Access http://localhost:3000
```

### ☁️ Production Deployment (Railway)

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for complete Railway deployment guide.

Quick version:
1. Create PostgreSQL database on Railway
2. Deploy backend + frontend from GitHub
3. Set environment variables (DATABASE_URL, JWT_SECRET, ENCRYPTION_KEY)
4. Done! Database tables created automatically

## Project Structure

```
open-personal-finance/
├── frontend/                          # Next.js frontend
│   ├── src/app/                      # App router pages
│   ├── src/components/               # React components
│   ├── src/contexts/                 # Auth context
│   └── src/services/                 # API client
├── backend/                           # Express.js backend
│   ├── src/routes/                   # API routes
│   ├── src/services/                 # Business logic
│   ├── src/models/schema.sql         # Database schema
│   └── src/config/initDatabase.ts    # Auto initialization
├── docker-compose.yml                 # Backend + Frontend (for production)
├── docker-compose.postgres.yml        # Local PostgreSQL only
├── docker-compose.with-postgres.yml   # All-in-one (for testing)
└── DEPLOYMENT.md                      # Detailed deployment guide
```

## Environment Variables

### Generate Secrets

```bash
# Generate random secrets
JWT_SECRET=$(openssl rand -base64 32)
ENCRYPTION_KEY=$(openssl rand -base64 32)
```

### Local Development

**backend/.env:**
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/personal_finance
JWT_SECRET=<your-random-secret>
ENCRYPTION_KEY=<your-random-secret>
FRONTEND_URL=http://localhost:3000
```

**frontend/.env.local:**
```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

### Railway Production

Set in Railway dashboard:
```env
DATABASE_URL=<railway-postgres-url>
JWT_SECRET=<your-random-secret>
ENCRYPTION_KEY=<your-random-secret>
FRONTEND_URL=https://your-app.railway.app
NEXT_PUBLIC_API_URL=https://your-app.railway.app/api
```

## Gmail OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable **Gmail API**
4. Configure **OAuth consent screen**
5. Create **OAuth 2.0 Client ID** (Web application)
6. Add redirect URI: `http://localhost:3000/oauth-callback` (or your production URL)
7. Copy **Client ID** and **Client Secret**
8. In the app settings, add your OAuth credentials

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user

### OAuth Management
- `POST /api/oauth/credentials` - Add OAuth credential
- `GET /api/oauth/credentials` - List credentials
- `GET /api/oauth/credentials/:id/auth-url` - Get Google auth URL
- `POST /api/oauth/callback` - Handle OAuth callback
- `GET /api/oauth/accounts` - List Gmail accounts

### Gmail
- `POST /api/gmail/accounts/:id/sync` - Sync emails

### Subscriptions
- `GET /api/subscriptions` - List subscriptions
- `GET /api/subscriptions/stats` - Get statistics
- `POST /api/subscriptions` - Create subscription
- `PUT /api/subscriptions/:id` - Update subscription
- `DELETE /api/subscriptions/:id` - Delete subscription
- `GET /api/subscriptions/categories` - List categories

## Security Features

- ✅ Passwords hashed with bcrypt (12 rounds)
- ✅ OAuth secrets encrypted with AES-256-GCM
- ✅ JWT tokens with 7-day expiration
- ✅ CORS protection
- ✅ Helmet security headers
- ✅ Automatic database initialization (no manual SQL)
- ✅ Environment-based configuration

## Documentation

- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Detailed deployment guide for Railway and other platforms
- **[specs.md](./specs.md)** - Original system specifications

## Troubleshooting

**Database connection errors:**
- Verify DATABASE_URL is correct
- Ensure database exists and is accessible
- Check PostgreSQL is running (for local development)

**Docker networking issues:**
- Use `docker-compose.with-postgres.yml` for local all-in-one testing
- For development, use `bun run dev` (not Docker) when PostgreSQL is separate

**Railway deployment:**
- See [DEPLOYMENT.md](./DEPLOYMENT.md) for step-by-step guide
- Ensure all environment variables are set
- Check build logs in Railway dashboard

## Contributing

This is a personal project, but issues and PRs are welcome!

## License

MIT
