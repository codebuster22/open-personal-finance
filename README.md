# Personal Finance App - Subscription Tracker

A self-hosted personal finance application focused on subscription management through Gmail integration. The system automatically extracts subscription information from emails using AI-powered detection.

## Features

- **Multi-Account Gmail Integration**: Connect unlimited Gmail accounts with individual OAuth credentials
- **AI-Powered Subscription Detection**: Automatically identify and extract subscription details from emails
- **Self-Hosted Deployment**: Complete control over your data with Docker containerization
- **Subscription Lifecycle Management**: Track, analyze, and manage recurring expenses
- **Dark Mode UI**: Modern interface with Tailwind CSS and shadcn/ui components

## Tech Stack

- **Frontend**: Next.js 16, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Express.js, TypeScript, Bun runtime
- **Database**: PostgreSQL
- **Authentication**: JWT-based with bcrypt password hashing
- **Email Processing**: Gmail API with OAuth 2.0
- **Deployment**: Docker containerization

## Quick Start

### Prerequisites

- [Bun](https://bun.sh/) v1.0+
- [Docker](https://www.docker.com/) and Docker Compose
- PostgreSQL 16+ (or use Docker)

### Development Setup

1. **Clone and install dependencies:**
   ```bash
   bun install
   ```

2. **Set up environment variables:**
   ```bash
   # Backend
   cp backend/.env.example backend/.env
   # Edit backend/.env with your values

   # Frontend
   cp frontend/.env.local.example frontend/.env.local
   ```

3. **Start PostgreSQL:**
   ```bash
   docker compose up postgres -d
   ```

4. **Initialize the database:**
   ```bash
   docker exec -i finance_db psql -U postgres -d personal_finance < backend/src/models/schema.sql
   ```

5. **Run development servers:**
   ```bash
   # Terminal 1 - Backend
   cd backend && bun run dev

   # Terminal 2 - Frontend
   cd frontend && bun run dev
   ```

6. Open http://localhost:3000

### Docker Deployment

1. **Configure environment:**
   ```bash
   cp backend/.env.example .env
   # Edit .env with production values
   ```

2. **Build and start:**
   ```bash
   docker compose up --build -d
   ```

3. Open http://localhost:3000

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
├── docker-compose.yml       # Docker orchestration
└── package.json            # Workspace configuration
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

## Environment Variables

### Backend (.env)
```env
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=personal_finance
DB_USER=postgres
DB_PASSWORD=postgres
JWT_SECRET=your-secret-key
ENCRYPTION_KEY=your-encryption-key
```

### Frontend (.env.local)
```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

## Security Features

- All passwords hashed with bcrypt (12 rounds)
- OAuth secrets encrypted with AES-256-GCM
- JWT tokens with 7-day expiration
- CORS protection
- Helmet security headers
- HTTP-only cookie support ready

## License

MIT
