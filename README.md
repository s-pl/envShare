# envShare

A self-hosted secrets management platform for teams. Share environment variables securely — no more `.env` files committed to Git or sent over Slack.

## How it works

envShare separates secrets into two types:

- **Shared** — same value for all team members (e.g. `DATABASE_URL`, `REDIS_URL`)
- **Personal** — each developer has their own value (e.g. `AWS_ACCESS_KEY_ID`, `STRIPE_SECRET_KEY`)

All secrets are encrypted at rest with **AES-256-GCM**. The encryption key never touches the database.

---

## Architecture

```
┌─────────────┐   ┌──────────────────┐   ┌────────────────────┐
│   CLI (esai) │   │  Web Dashboard   │   │  Backend (API)     │
│  Commander   │   │  React + Zustand │   │  Express + Prisma  │
└──────┬──────┘   └────────┬─────────┘   └────────┬───────────┘
       │                   │                        │
       └───────────────────┴────────────────────────┘
                           │
                    ┌──────▼──────┐
                    │  PostgreSQL  │
                    └─────────────┘
```

| Component  | Tech                                      | Port (dev) |
|------------|-------------------------------------------|------------|
| `backend/` | Node.js · Express · Prisma · PostgreSQL   | 3000       |
| `frontend/`| React 18 · TypeScript · Tailwind · Zustand| 5173       |
| `cli/`     | Node.js · Commander.js → `esai` command   | —          |

---

## Quick Start (Docker)

### 1. Generate secrets

```bash
# JWT secret (64 hex chars)
openssl rand -hex 32

# Master encryption key (exactly 64 hex chars = 32 bytes)
openssl rand -hex 32
```

### 2. Create `.env` file in the project root

```env
POSTGRES_PASSWORD=your_db_password
JWT_SECRET=<64-char hex string>
MASTER_ENCRYPTION_KEY=<64-char hex string>
ALLOWED_ORIGINS=http://localhost:5173
API_URL=http://localhost:3000
```

> **Never commit this file.** The `MASTER_ENCRYPTION_KEY` is the root of all encryption — losing it means losing all secrets.

### 3. Start the stack

```bash
docker compose up -d
```

This starts:
- **PostgreSQL 16** on port 5432 (internal)
- **Backend** on port 3001 → mapped from internal 3000
- **Frontend** (Nginx) on port 5173

### 4. Run database migrations

```bash
docker compose exec backend npx prisma migrate deploy
```

The app is now running at `http://localhost:5173`.

---

## HTTPS / Production (Caddy)

Use the included Caddy setup for automatic TLS via Let's Encrypt:

```bash
ESAI_DOMAIN=secrets.yourdomain.com docker compose -f docker-compose.https.yml up -d
```

The `Caddyfile` handles:
- TLS termination (auto cert from Let's Encrypt)
- Reverse proxy: `/api/*` → backend, everything else → frontend
- Security headers (HSTS, X-Frame-Options, etc.)

---

## Development (without Docker)

### Backend

```bash
cd backend
npm install
cp .env.example .env   # fill in your values
npx prisma migrate dev
npm run dev            # starts on :3000 with hot reload
```

### Frontend

```bash
cd frontend
npm install
# Set VITE_API_URL in .env or inline:
VITE_API_URL=http://localhost:3000 npm run dev   # starts on :5173
```

### CLI

```bash
cd cli
npm install
npm run build          # compiles TypeScript → dist/
npm link               # installs `esai` globally from local build

# Or run without installing:
npm run dev -- <command>
```

---

## CLI Reference (`esai`)

### Setup — first time

```bash
# 1. Point the CLI at your server (default: http://localhost:3000)
esai url http://localhost:3000

# 2. Create an account
esai register

# 3. Or log in to an existing account
esai login
```

### Project setup

```bash
# List all projects you belong to
esai projects

# Link your current directory to a project
# (creates .esai.json in the current folder)
esai init
```

### Daily workflow

```bash
# Upload your .env to the server
esai push

# Upload a specific file
esai push .env.local

# Preview what would be pushed (no changes made)
esai push --dry-run

# Download all secrets → writes .env
esai pull

# Write to a custom file
esai pull --output .env.production

# Set your personal value for a secret
esai set DATABASE_PASSWORD "my-local-password"

# Run a command with secrets injected (nothing written to disk)
esai run -- npm start
esai run -- docker compose up
```

### Utility

```bash
# View or change the API server URL
esai url
esai url https://secrets.yourdomain.com
```

---

## Marking secrets as shared

Two ways to tell envShare that a variable should be shared across the whole team:

**Option 1 — inline comment in your `.env`:**

```env
DATABASE_URL=postgres://user:pass@host/db  # @shared
REDIS_URL=redis://localhost:6379           # @shared
API_SECRET=my-personal-key                 # (personal, no tag needed)
```

**Option 2 — `.esai.config.json` in the project root:**

```json
{
  "defaultFile": ".env",
  "sharedPatterns": ["*_URL", "*_HOST", "DB_*"],
  "ignoredKeys": ["NODE_ENV", "PORT"]
}
```

Any key matching `sharedPatterns` is automatically marked as shared on push. Keys in `ignoredKeys` are skipped entirely.

---

## Local config files

| File | Location | Purpose |
|------|----------|---------|
| `~/.config/envsharesai/config.json` | Home dir | Stores API URL, auth tokens, user info |
| `.esai.json` | Project root | Links this directory to a project ID |
| `.esai.config.json` | Project root | Push configuration (shared patterns, ignored keys) |

Add `.esai.json` to `.gitignore` if you don't want the project link committed.

---

## Web Dashboard

Open `http://localhost:5173` in your browser.

- **Dashboard** — overview of all your projects
- **Secrets** — view, edit, and version secrets for a project
- **Members** — add/remove team members and assign roles (Admin, Developer, Viewer)
- **Push** — upload a `.env` from the browser
- **Audit logs** — full history of who changed what and when

---

## Roles

| Role        | View secrets | Push/pull | Manage members | Delete project |
|-------------|:---:|:---:|:---:|:---:|
| **Admin**     | ✓ | ✓ | ✓ | ✓ |
| **Developer** | ✓ | ✓ | ✗ | ✗ |
| **Viewer**    | ✓ | ✗ | ✗ | ✗ |

---

## Security

See [`SECURITY.md`](SECURITY.md) for the full threat model and key rotation guide.

Key points:
- Secrets encrypted with **AES-256-GCM** + per-secret random IV
- `MASTER_ENCRYPTION_KEY` is never stored in the database
- JWT access tokens expire in **15 minutes**, stored in memory (not localStorage)
- Refresh tokens are **HttpOnly cookies**, single-use, rotated on every refresh
- Passwords hashed with **bcrypt** (12 rounds)
- Rate limiting on auth endpoints (20 req / 15 min per IP)

---

## Environment variables reference

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✓ | PostgreSQL connection string |
| `POSTGRES_PASSWORD` | ✓ | DB password (used by Docker) |
| `JWT_SECRET` | ✓ | 64-char hex string for signing JWTs |
| `MASTER_ENCRYPTION_KEY` | ✓ | 64-char hex string (32 bytes) — root encryption key |
| `ALLOWED_ORIGINS` | ✓ | CORS origins (comma-separated) |
| `API_URL` | ✓ | Backend URL used by the frontend |
| `PORT` | — | Backend port (default: `3000`) |
| `NODE_ENV` | — | `production` or `development` |
| `LOG_LEVEL` | — | Winston log level (default: `info`) |
