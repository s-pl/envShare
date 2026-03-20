# envShare

A self-hosted secrets management platform for teams. Share `.env` variables securely — no more secrets committed to Git or sent over Slack.

Secrets are split into two types:
- **Shared** — one value for the whole team (`DATABASE_URL`, `REDIS_URL`)
- **Personal** — each developer has their own (`AWS_ACCESS_KEY_ID`, `STRIPE_SECRET_KEY`)

Everything is encrypted at rest with **AES-256-GCM**. The encryption key never touches the database.

---

## Getting started

### Option A — Start your own project (you become Admin)

```bash
# 1. Install and point at your server
envshare install
envshare url http://your-server:3001

# 2. Create account
envshare register
envshare login

# 3. Create a project and link your folder
envshare project create
cd my-app
envshare init

# 4. Push your .env
envshare push

# 5. Invite teammates
envshare project invite colleague@example.com --role DEVELOPER
```

### Option B — Join an existing project (invited by an Admin)

```bash
# 1. Install and point at the same server
envshare install
envshare url http://your-server:3001

# 2. Create account
envshare register
envshare login

# 3. Ask your Admin to run:
#    envshare project invite you@example.com --role DEVELOPER

# 4. Once invited, link your folder and pull secrets
cd my-app
envshare init
envshare pull
```

Personal secrets not yet set show a warning in the `.env` file. Set your value with:

```bash
envshare set DATABASE_PASSWORD "my-local-value"
```

---

## Roles

| Role        | View secrets | Push / pull | Invite members | Delete project |
|-------------|:---:|:---:|:---:|:---:|
| **Admin**     | yes | yes | yes | yes |
| **Developer** | yes | yes | no  | no  |
| **Viewer**    | yes | no  | no  | no  |

---

## Architecture

```mermaid
flowchart LR
    subgraph workstation["Developer workstation"]
        CLI["envshare CLI\n(standalone binary)"]
    end

    subgraph server["Server · Docker Compose"]
        Caddy["Caddy\nTLS + reverse proxy\n(optional)"]
        API["Backend API\nExpress · Prisma\n:3000"]
        DB[("PostgreSQL 16\n:5432")]
    end

    GH["GitHub Releases\n(self-update)"]

    CLI -->|"HTTPS /api/v1/*"| Caddy
    Caddy -->|"/api/*"| API
    API --> DB
    CLI -.->|"envshare update"| GH
```

---

## Database schema

```mermaid
erDiagram
    User {
        string id PK
        string email
        string passwordHash
        string name
        datetime consentedAt
        int failedLoginAttempts
        datetime lockedUntil
    }
    Project {
        string id PK
        string name
        string slug
        string encryptedKey
    }
    ProjectMember {
        string id PK
        string projectId FK
        string userId FK
        enum role
    }
    Environment {
        string id PK
        string projectId FK
        string name
        string filePath
    }
    Secret {
        string id PK
        string projectId FK
        string environmentId FK
        string keyHash
        string encryptedKey
        boolean isShared
        string sharedEncryptedValue
        int version
    }
    UserSecretValue {
        string id PK
        string secretId FK
        string userId FK
        string encryptedValue
    }
    SecretVersion {
        string id PK
        string secretId FK
        string userId FK
        string action
        int version
    }
    RefreshToken {
        string id PK
        string userId FK
        string token
        datetime expiresAt
    }
    AuditLog {
        string id PK
        string actor
        string action
        string resourceType
        string resourceId
        datetime createdAt
    }

    User ||--o{ ProjectMember : "belongs to"
    Project ||--o{ ProjectMember : "has"
    Project ||--o{ Environment : "contains"
    Project ||--o{ Secret : "has"
    Environment |o--o{ Secret : "scopes"
    Secret ||--o{ UserSecretValue : "personal values"
    User ||--o{ UserSecretValue : "owns"
    Secret ||--o{ SecretVersion : "history"
    User ||--o{ RefreshToken : "sessions"
```

---

## Authentication flow

```mermaid
sequenceDiagram
    actor Dev as Developer
    participant CLI
    participant API
    participant DB

    Dev->>CLI: envshare login
    CLI->>API: POST /auth/login {email, password}
    API->>DB: SELECT user WHERE email = ?
    DB-->>API: user record
    API->>API: bcrypt.compare(password, hash)
    API->>DB: INSERT refresh_token
    API-->>CLI: {accessToken, refreshToken}
    CLI->>CLI: store tokens

    Note over CLI,API: Access token expires after 15 min

    CLI->>API: any request (expired token)
    API-->>CLI: 401 Unauthorized
    CLI->>API: POST /auth/refresh {refreshToken}
    API->>DB: DELETE old token (single-use)
    API->>DB: INSERT new refresh_token
    API-->>CLI: new {accessToken, refreshToken}
    CLI->>API: retry original request
```

---

## Push / pull flow

```mermaid
sequenceDiagram
    actor Dev as Developer
    participant CLI
    participant API
    participant DB

    Note over Dev,DB: Push
    Dev->>CLI: envshare push
    CLI->>CLI: parse .env, classify keys
    CLI->>API: POST /sync/:projectId/push
    API->>API: unwrapKey → projectKey
    loop each secret
        API->>API: encrypt(key, value)
        API->>DB: upsert secret + version
    end
    API-->>CLI: {created, updated}
    CLI-->>Dev: summary

    Note over Dev,DB: Pull
    Dev->>CLI: envshare pull
    CLI->>API: GET /sync/:projectId/pull
    API->>DB: SELECT secrets + personal values
    DB-->>API: encrypted records
    API->>API: decrypt all → plain key/value
    API-->>CLI: [{key, value, filePath}]
    CLI->>CLI: write .env files (mode 0600)
    CLI-->>Dev: files written
```

---

## Encryption key hierarchy

```mermaid
graph TD
    M["MASTER_ENCRYPTION_KEY\nenv var — never stored in DB"]
    P["Project Key\nrandom 32 bytes per project\nstored encrypted in DB"]
    SK["Secret key name\nAES-256-GCM(keyName, projectKey)\n+ random IV + GCM tag"]
    SV["Shared value\nAES-256-GCM(value, projectKey)\n+ random IV + GCM tag"]
    PV["Personal value\nAES-256-GCM(value, projectKey)\n+ random IV + GCM tag"]
    KH["Key hash\nHMAC-SHA256(keyName, projectKey)\nfor deduplication only"]

    M -->|wrapKey / unwrapKey| P
    P --> SK
    P --> SV
    P --> PV
    P --> KH
```

---

## CLI reference

```bash
# Setup
envshare install                           # interactive first-time setup (URL + login)
envshare url http://your-server:3001       # set the backend URL
envshare register                          # create an account
envshare login                             # log in and store tokens
envshare init                              # link current directory to a project

# Daily workflow
envshare push                              # upload .env (interactive variable selection)
envshare push --yes                        # push all variables without prompts (CI-friendly)
envshare push --env staging                # tag secrets with environment name (e.g. staging)
envshare push --dry-run                    # preview what would be pushed without uploading
envshare pull                              # download secrets → write .env files
envshare pull --env staging                # pull only staging environment secrets
envshare set KEY "value"                   # set your personal value for a key

# Inspect
envshare list                              # list all secret keys in the linked project
envshare list --json                       # machine-readable JSON output
envshare history KEY                       # show version history for a key
envshare delete KEY                        # delete a secret (affects all members)
envshare audit                             # project audit log (ADMIN only)
envshare audit --limit 100 --action SECRETS_PUSHED

# Team
envshare project create                    # create a new project
envshare project list                      # list all projects you belong to
envshare project invite user@example.com --role DEVELOPER
envshare project members                   # list project members
envshare project set-role user@example.com ADMIN
envshare project remove user@example.com

# Terminal UI
envshare ui                                # open interactive TUI (browse secrets, push, config)

# Maintenance
envshare update --check                    # check for a newer release on GitHub
envshare update                            # download and replace the binary in-place
envshare version                           # show version and connection info
```

### Marking secrets as shared

```env
DATABASE_URL=postgres://user:pass@host/db  # @shared
API_SECRET=my-personal-key
```

Or via `.envshare.config.json`:

```json
{
  "sharedPatterns": ["*_URL", "*_HOST", "DB_*"],
  "ignoredKeys": ["NODE_ENV", "PORT"]
}
```

---

## Server setup (Docker)

```bash
# Generate keys
openssl rand -hex 32   # -> JWT_SECRET
openssl rand -hex 32   # -> MASTER_ENCRYPTION_KEY
```

Create `.env` in the project root:

```env
POSTGRES_PASSWORD=your_db_password
JWT_SECRET=<64-char hex>
MASTER_ENCRYPTION_KEY=<64-char hex>
ALLOWED_ORIGINS=*
API_URL=http://localhost:3001
```

> Never commit this file. Losing `MASTER_ENCRYPTION_KEY` means losing all secrets permanently.

```bash
docker compose up -d
docker compose exec backend npx prisma migrate deploy
```

### HTTPS (Caddy)

```bash
ENVSHARE_DOMAIN=secrets.yourdomain.com docker compose -f docker-compose.https.yml up -d
```

---

## Local files

| File | Purpose |
|------|---------|
| `~/.config/envshare/config.json` | API URL, auth tokens |
| `.envshare.json` | Links this folder to a project (add to `.gitignore`) |
| `.envshare.config.json` | Push config (shared patterns, ignored keys) |

---

## Security

Secrets encrypted with **AES-256-GCM** + random IV per secret. Master key never stored in the database. See [`SECURITY.md`](SECURITY.md) for the full threat model.

- JWT access tokens: **15 min**, memory only
- Refresh tokens: **single-use**, rotated on every refresh
- Passwords: **bcrypt** (12 rounds)
- Auth rate limit: **20 req / 15 min per IP**
- Account lockout after **10 failed attempts**
- Full **audit log** for every change (ISO 27001 A.12.4.1)

---

## Environment variables

| Variable | Required | Description |
|----------|:--------:|-------------|
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `POSTGRES_PASSWORD` | yes | DB password (Docker) |
| `JWT_SECRET` | yes | 64-char hex — signs JWTs |
| `MASTER_ENCRYPTION_KEY` | yes | 64-char hex — root encryption key |
| `ALLOWED_ORIGINS` | yes | CORS origins (comma-separated) |
| `API_URL` | yes | Backend URL |
| `PORT` | no | Backend port (default: `3000`) |
| `NODE_ENV` | no | `production` or `development` |
| `LOG_LEVEL` | no | Winston log level (default: `info`) |
| `AUDIT_LOG_RETENTION_DAYS` | no | Days to keep audit logs (default: `365`) |
| `TRUST_PROXY` | no | Set to `1` only behind a trusted reverse proxy |
