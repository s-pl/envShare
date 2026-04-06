<div align="center">

# envShare

**Self-hosted secrets management for development teams.**

Stop committing `.env` files to Git. Stop sending secrets over Slack.  
envShare encrypts every variable at rest and lets each developer pull exactly what they need.

[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker&logoColor=white)](https://docs.docker.com/compose)
[![AES-256-GCM](https://img.shields.io/badge/Encryption-AES--256--GCM-6366f1?style=flat-square&logo=letsencrypt&logoColor=white)](SECURITY.md)
[![License](https://img.shields.io/badge/License-MIT-22c55e?style=flat-square)](LICENSE)

</div>

---

## What it does

envShare is a **self-hosted** alternative to Doppler or 1Password Secrets. You run the server on your own infrastructure — your keys never leave your control.

Each secret can be one of two types:

| Type | Description | Examples |
|------|-------------|---------|
| **Shared** | One encrypted value for the whole team. Everyone pulls the same thing. | `DATABASE_URL`, `REDIS_URL`, `STRIPE_PUBLIC_KEY` |
| **Personal** | Each developer keeps their own encrypted copy. | `AWS_ACCESS_KEY_ID`, `STRIPE_SECRET_KEY`, local DB passwords |

All values are encrypted with **AES-256-GCM**. The master encryption key never touches the database — lose it and the data is unrecoverable.

---

## Architecture

```mermaid
flowchart TB
    subgraph dev["👩‍💻  Developer workstation"]
        direction LR
        CLI["envshare CLI\n─────────────\nstandalone binary\nno runtime needed"]
        DOTENV[".env files\n(mode 0600)"]
    end

    subgraph server["🖥️  Server  ·  Docker Compose"]
        direction TB
        Caddy["Caddy\n─────────────\nTLS termination\nauto-certificate\nreverse proxy"]
        API["Backend API\n─────────────\nExpress · Prisma\nport 3000 internal"]
        DB[("PostgreSQL 16\n─────────────\nall data\nencrypted at rest")]

        Caddy -->|"http://backend:3000"| API
        API -->|"connection pool"| DB
    end

    GH["GitHub Releases\n(self-update)"]

    CLI -->|"HTTPS · /api/v1/*"| Caddy
    CLI <-->|"read / write"| DOTENV
    CLI -.->|"envshare update"| GH

    style dev fill:#0f172a,stroke:#334155,color:#e2e8f0
    style server fill:#0f172a,stroke:#334155,color:#e2e8f0
    style CLI fill:#1e293b,stroke:#6366f1,color:#e2e8f0
    style DOTENV fill:#1e293b,stroke:#475569,color:#94a3b8
    style Caddy fill:#1e293b,stroke:#0ea5e9,color:#e2e8f0
    style API fill:#1e293b,stroke:#6366f1,color:#e2e8f0
    style DB fill:#1e293b,stroke:#4169E1,color:#e2e8f0
    style GH fill:#1e293b,stroke:#475569,color:#94a3b8
```

---

## Encryption key hierarchy

Three layers ensure that a database breach alone is useless to an attacker. The master key is never stored — it exists only as an environment variable on the server (ideally in a KMS).

```mermaid
flowchart TD
    MK["🔑  MASTER_ENCRYPTION_KEY\n─────────────────────────────────────\nenv var on server  ·  never in database\n32 random bytes  ·  store in KMS"]

    subgraph proj["Per-project  (stored encrypted in DB)"]
        PK["🗝️  Project Key\n─────────────────────────────\n32 random bytes on project creation\nwrapped by master key → AES-256-GCM\nstored as JSON in projects.encryptedKey"]
    end

    subgraph secrets["Per-secret  (stored in DB — encrypted)"]
        direction LR
        KN["📝  Key name\nAES-256-GCM\nrandom 128-bit IV"]
        SV["🌐  Shared value\nAES-256-GCM\nrandom 128-bit IV\none per secret"]
        PV["👤  Personal value\nAES-256-GCM\nrandom 128-bit IV\none per user"]
        KH["#️⃣  Key hash\nHMAC-SHA256\ndeduplication only\nno reversibility"]
    end

    MK -->|"unwrapKey()  →  AES-256-GCM decrypt"| PK
    PK -->|"encrypt(keyName, projectKey)"| KN
    PK -->|"encrypt(value, projectKey)"| SV
    PK -->|"encrypt(value, projectKey)"| PV
    PK -->|"HMAC-SHA256(keyName, projectKey)"| KH

    style MK fill:#1e1b4b,stroke:#6366f1,color:#e0e7ff
    style PK fill:#1e293b,stroke:#0ea5e9,color:#bae6fd
    style KN fill:#1e293b,stroke:#475569,color:#e2e8f0
    style SV fill:#1e293b,stroke:#22c55e,color:#dcfce7
    style PV fill:#1e293b,stroke:#f97316,color:#fed7aa
    style KH fill:#1e293b,stroke:#475569,color:#94a3b8
    style proj fill:#0f172a,stroke:#334155,color:#e2e8f0
    style secrets fill:#0f172a,stroke:#334155,color:#e2e8f0
```

> **Key rotation:** rotating the master key only requires re-wrapping project keys (fast). Secrets themselves do not need to be re-encrypted.

---

## Authentication flow

Access tokens live for 15 minutes in memory only. Refresh tokens are single-use and stored as **SHA-256 hashes** in the database — a breach exposes only hashes, not usable tokens.

```mermaid
sequenceDiagram
    actor Dev as Developer
    participant CLI as envshare CLI
    participant API as Backend API
    participant DB as PostgreSQL

    Note over CLI,DB: ── Initial login ───────────────────────────────────
    Dev->>CLI: envshare login
    CLI->>API: POST /auth/login  {email, password}  x-client: cli
    API->>DB: findUnique(email) — check lockout state
    API->>API: bcrypt.compare(password, hash) — constant-time
    API->>DB: INSERT refresh_token  {token: SHA256(raw), expiresAt, ip, ua}
    API->>DB: INSERT audit_log  {action: AUTH_LOGIN_SUCCESS, ip}
    API-->>CLI: {accessToken (JWT 15min), refreshToken (raw 80-hex)}
    CLI->>CLI: store refreshToken in config.json
    CLI->>CLI: keep accessToken in memory only

    Note over CLI,DB: ── Normal API request ──────────────────────────────
    CLI->>API: GET /api/v1/secrets/:id  Authorization: Bearer <accessToken>
    API-->>CLI: 200 OK — secret data

    Note over CLI,DB: ── Access token expired (15 min) ───────────────────
    CLI->>API: POST /auth/refresh  {refreshToken: raw}
    API->>DB: findUnique({token: SHA256(raw)}) — lookup by hash
    API->>DB: DELETE old token — single-use enforcement
    API->>DB: INSERT new_token  {token: SHA256(newRaw), ...}
    API-->>CLI: {new accessToken, new refreshToken}
    CLI->>CLI: update config.json with new refreshToken
    CLI->>API: ↩ retry original request with new accessToken
    API-->>CLI: 200 OK
```

---

## Push / pull flow

```mermaid
sequenceDiagram
    actor Dev as Developer
    participant CLI as envshare CLI
    participant API as Backend API
    participant DB as PostgreSQL

    Note over Dev,DB: ── Push ────────────────────────────────────────────
    Dev->>CLI: envshare push [file] [--all] [--env <name>]
    CLI->>CLI: scan for .env files (depth ≤ 10, skips symlinks)
    CLI->>CLI: parse .env — classify shared / personal by @shared tag & patterns
    CLI->>CLI: filter ignored keys from .envshare.config.json

    loop batches of 10 secrets
        CLI->>API: POST /sync/:projectId/push  {secrets[], filePath, environmentName}
        API->>DB: getOrCreate(environment, filePath)
        note right of API: single DB transaction
        loop each secret in batch
            API->>DB: findUnique(projectId + keyHash)
            alt new secret
                API->>DB: INSERT secret  {encryptedKey, keyHash, environmentId}
            else existing secret
                API->>DB: UPDATE secret  (environmentId, isShared if changed)
            end
            API->>DB: UPSERT shared_value / personal_value  (encrypted)
            API->>DB: INSERT secret_version  {action, actor, version}
        end
        API->>DB: INSERT audit_log  {SECRETS_PUSHED, actor, count}
        API-->>CLI: {created[], updated[], sharedUpdated[]}
        CLI-->>Dev: ████████████ 10/10  progress bar
    end
    CLI-->>Dev: ✔ .env  —  +8 new, 3 updated, 5 shared

    Note over Dev,DB: ── Pull ────────────────────────────────────────────
    Dev->>CLI: envshare pull [--env <name>] [--output <path>]
    CLI->>API: GET /sync/:projectId/pull[?env=staging]
    API->>DB: SELECT secrets WHERE projectId = ?  (+ personal values for this user)
    API->>DB: SELECT environments WHERE projectId = ?
    API->>API: decrypt all values with project key
    API->>API: personal value overrides shared value (if both exist)
    API-->>CLI: [{key, value, filePath, environmentName}]
    CLI->>CLI: group secrets by filePath
    loop each output file
        CLI->>CLI: path traversal check (refuse writes outside cwd)
        CLI->>CLI: writeFileSync(path, content, {mode: 0o600})
    end
    CLI-->>Dev: ✔ .env (8 vars)  ✔ .env.staging (4 vars)
```

---

## Database schema

```mermaid
erDiagram
    direction LR

    User {
        string  id              PK
        string  email           "unique"
        string  passwordHash    "bcrypt 12 rounds"
        string  name
        datetime consentedAt    "GDPR Art.7 consent"
        int     failedLoginAttempts
        datetime lockedUntil   "ISO 27001 A.9.4.2"
    }

    Project {
        string  id           PK
        string  name
        string  slug         "unique"
        string  encryptedKey "AES-256-GCM wrapped project key"
    }

    ProjectMember {
        string id        PK
        string projectId FK
        string userId    FK
        enum   role      "ADMIN | DEVELOPER | VIEWER"
    }

    Environment {
        string  id        PK
        string  projectId FK
        string  name      "human label: production, staging"
        string  filePath  ".env, .env.staging, apps/api/.env"
        string  description
    }

    Secret {
        string  id            PK
        string  projectId     FK
        string  environmentId FK
        string  keyHash       "HMAC-SHA256 — dedup, not reversible"
        string  encryptedKey  "AES-256-GCM key name"
        boolean isShared
        string  sharedEncryptedValue "null when personal only"
        int     version
    }

    UserSecretValue {
        string id            PK
        string secretId      FK
        string userId        FK
        string encryptedValue "AES-256-GCM personal value"
    }

    SecretVersion {
        string id        PK
        string secretId  FK
        string userId    FK
        string action    "created | updated | made_shared | made_personal"
        int    version
    }

    RefreshToken {
        string   id        PK
        string   token     "SHA-256 hash of raw token"
        string   userId    FK
        datetime expiresAt
        string   ipAddress "ISO 27001 A.12.4"
        string   userAgent
    }

    AuditLog {
        string   id           PK
        string   actor        "userId or system"
        string   action
        string   resourceType
        string   resourceId
        json     metadata
        string   ipAddress
        datetime createdAt
    }

    User           ||--o{ ProjectMember  : "belongs to"
    Project        ||--o{ ProjectMember  : "has"
    Project        ||--o{ Environment    : "has"
    Project        ||--o{ Secret         : "owns"
    Environment    |o--o{ Secret         : "groups"
    Secret         ||--o{ UserSecretValue : "personal values"
    User           ||--o{ UserSecretValue : "owns"
    Secret         ||--o{ SecretVersion  : "history"
    User           ||--o{ RefreshToken   : "sessions"
```

---

## Deploy

### Self-hosted with Docker Compose

**1. Generate secrets**

```bash
# Run each command separately — two different keys
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"  # → MASTER_ENCRYPTION_KEY
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"  # → JWT_SECRET
```

**2. Create `.env` in the project root**

```env
POSTGRES_PASSWORD=your_secure_db_password
JWT_SECRET=<64-char hex>
MASTER_ENCRYPTION_KEY=<64-char hex>
ALLOWED_ORIGINS=https://your-frontend.com
```

> **Warning:** `MASTER_ENCRYPTION_KEY` is the root of all encryption. Back it up to a KMS or encrypted vault. Losing it makes all stored secrets permanently unrecoverable.

**3. Start**

```bash
docker compose up -d
```

The API is available on port `3001`. Migrations run automatically on startup.

**4. HTTPS with automatic certificates (Caddy)**

```bash
ENVSHARE_DOMAIN=secrets.yourdomain.com docker compose -f docker-compose.https.yml up -d
```

---

## Install the CLI

The CLI is a standalone binary — no Node.js required on developer machines.

**macOS / Linux (Homebrew)**
```bash
brew install s-pl/envshare/envshare
```

**Windows (Scoop)**
```powershell
scoop bucket add envshare https://github.com/s-pl/scoop-envshare
scoop install envshare
```

**Linux (manual)**
```bash
sudo curl -fsSL https://github.com/s-pl/envShare/releases/latest/download/envshare-linux-x64 \
  -o /usr/local/bin/envshare && sudo chmod +x /usr/local/bin/envshare
```

Keep it up to date:
```bash
envshare update
```

---

## Quick start

### Starting a new project

```bash
# Point the CLI at your server
envshare url https://secrets.yourcompany.com

# Create your account and log in
envshare register
envshare login

# Create a project and link your repo
envshare project create
cd my-app
envshare init

# Push your .env (interactive variable selector, or use --all in CI)
envshare push
envshare push --all          # non-interactive, CI-friendly
envshare push --dry-run      # preview what would be uploaded

# Invite teammates
envshare project invite alice@company.com --role DEVELOPER
envshare project invite bob@company.com   --role VIEWER
```

### Joining an existing project

```bash
envshare url https://secrets.yourcompany.com
envshare register
envshare login

cd my-app
envshare init    # select your project from the list
envshare pull    # writes .env files with mode 0600
```

Any personal secrets not yet set will appear as empty with a hint:

```env
STRIPE_SECRET_KEY=   # not set — run: envshare set STRIPE_SECRET_KEY "sk_test_..."
```

---

## Marking secrets as shared

**Inline in `.env`** — add `# @shared` to any line:

```env
# Shared: everyone on the team gets the same value
DATABASE_URL=postgres://user:pass@host/db   # @shared
REDIS_URL=redis://host:6379                 # @shared

# Personal: each developer sets their own
AWS_ACCESS_KEY_ID=AKIA...
STRIPE_SECRET_KEY=sk_test_...
```

**Global rules in `.envshare.config.json`** — committed to version control:

```json
{
  "defaultFile": ".env",
  "sharedKeys":    ["NODE_ENV", "PORT"],
  "sharedPatterns": ["*_URL", "*_HOST", "DB_*"],
  "ignoredKeys":   ["LOCAL_OVERRIDE"]
}
```

Pattern matching is glob-style (`*` = any chars, `?` = one char) and case-insensitive.

---

## Roles

Roles are **per-project** — the same user can be Admin on one project and Viewer on another.

| Permission | Viewer | Developer | Admin |
|------------|:------:|:---------:|:-----:|
| View secret names and pull values | ✓ | ✓ | ✓ |
| View secret version history | ✓ | ✓ | ✓ |
| Push secrets | | ✓ | ✓ |
| Set personal values | | ✓ | ✓ |
| Create / manage environments | | ✓ | ✓ |
| Invite members | | | ✓ |
| Change member roles | | | ✓ |
| Delete secrets | | | ✓ |
| View audit log | | | ✓ |
| Delete project | | | ✓ |

---

## CLI reference

### Setup

| Command | Description |
|---------|-------------|
| `envshare url [url]` | Get or set the backend API URL |
| `envshare register` | Create a new account |
| `envshare login` | Authenticate and store tokens |
| `envshare init` | Link the current directory to a project |
| `envshare version` | Show version, server, and auth status |
| `envshare update` | Download and install the latest release |

### Daily workflow

| Command | Description |
|---------|-------------|
| `envshare push` | Upload `.env` — interactive variable selector |
| `envshare push --all` | Push every variable without prompts (CI-friendly) |
| `envshare push --yes` | Alias for `--all` |
| `envshare push --env staging` | Tag secrets with an environment name |
| `envshare push --dry-run` | Preview what would be pushed without uploading |
| `envshare pull` | Download secrets and write `.env` files |
| `envshare pull --env staging` | Pull only a specific environment |
| `envshare pull --output .env` | Write everything to a single file |
| `envshare set <KEY> <value>` | Set your personal value for a secret |

### Inspect & manage

| Command | Description |
|---------|-------------|
| `envshare list` | List all secret names for the current project |
| `envshare history <KEY>` | Full version history for a secret |
| `envshare delete <KEY>` | Delete a secret (Admin only) |
| `envshare delete <KEY> --force` | Delete without confirmation prompt |
| `envshare audit` | Project audit log (Admin only) |

### Team management

| Command | Description |
|---------|-------------|
| `envshare project create` | Create a new project |
| `envshare project invite <email> --role <role>` | Invite a team member |
| `envshare project members` | List current members and their roles |
| `envshare project set-role <email> <role>` | Change a member's role |
| `envshare project remove <email>` | Remove a member from the project |

### Interactive UI

```bash
envshare ui   # full-screen terminal UI — browse secrets, push, manage team
```

---

## Security

| Control | Detail |
|---------|--------|
| **Encryption at rest** | AES-256-GCM with a random 128-bit IV per secret. Authentication tag prevents silent tampering. |
| **Master key** | Never stored in the database. Server refuses to start without it. |
| **Project key** | 32 random bytes per project, wrapped by the master key and stored encrypted. |
| **Passwords** | bcrypt with 12 rounds. |
| **Access tokens** | 15-minute expiry. Kept in memory only — never written to disk. |
| **Refresh tokens** | Single-use, rotated on every refresh. Stored as **SHA-256 hashes** in the database — a breach exposes hashes, not usable tokens. |
| **Startup validation** | Server exits immediately if `JWT_SECRET` (<32 bytes) or `MASTER_ENCRYPTION_KEY` (not 64 hex chars) are misconfigured. |
| **Rate limiting** | 20 requests / 15 min on auth endpoints. Global 500 req / 15 min limit. |
| **Account lockout** | Locked for 30 minutes after 10 consecutive failed login attempts. Persists across restarts. |
| **Audit log** | Every push, pull, member change, and auth event is recorded with actor, IP, and timestamp (ISO 27001 A.12.4.1). |
| **GDPR** | Audit logs auto-purged after 365 days. Consent timestamp recorded at registration (Art. 7). Right to erasure (Art. 17) immediately revokes all sessions. |
| **Output file permissions** | `pull` writes `.env` files with mode `0600` (owner read/write only). Path traversal is rejected. |

Full threat model and ISO 27001 control mapping: [SECURITY.md](SECURITY.md)

---

## Server environment variables

| Variable | Required | Default | Description |
|----------|:--------:|---------|-------------|
| `MASTER_ENCRYPTION_KEY` | ✓ | — | 64-char hex (32 bytes). Root encryption key. **Store in KMS, never commit.** |
| `JWT_SECRET` | ✓ | — | Min 32 bytes. Signs access tokens. Rotation invalidates all active sessions. |
| `DATABASE_URL` | ✓ | — | PostgreSQL connection string. |
| `POSTGRES_PASSWORD` | ✓ | — | DB password (used by Docker Compose). |
| `ALLOWED_ORIGINS` | ✓ | — | Comma-separated CORS origins, e.g. `https://app.com`. |
| `PORT` | | `3000` | Port the backend listens on (inside Docker). |
| `NODE_ENV` | | `production` | Set to `development` for verbose error responses. |
| `LOG_LEVEL` | | `info` | Winston log level: `debug`, `info`, `warn`, `error`. |
| `AUDIT_LOG_RETENTION_DAYS` | | `365` | Days to retain audit log entries. Minimum recommended: `90`. |
| `TRUST_PROXY` | | `false` | Set to `1` when behind a trusted reverse proxy (Caddy, nginx). |
| `TOKEN_CLEANUP` | | `true` | Set to `false` to disable automatic expired-token cleanup. |
| `COOKIE_PATH` | | `/api/v1/auth` | Override refresh-token cookie path when API is served under a prefix. |

---

## Local files

These files are created on developer machines and should not be committed to version control.

| File | Location | Purpose |
|------|----------|---------|
| `config.json` | `~/.config/envshare-nodejs/` | Stores API URL and auth tokens. |
| `.envshare.json` | Project root | Links the directory to a project ID. Add to `.gitignore`. |
| `.envshare.config.json` | Project root | Optional push config (shared patterns, ignored keys). **Safe to commit.** |

---

<div align="center">

[![SECURITY.md](https://img.shields.io/badge/Read-Security%20Policy-6366f1?style=flat-square)](SECURITY.md)
[![Wiki](https://img.shields.io/badge/Read-Full%20Docs-6366f1?style=flat-square)](wiki/Home.md)
[![User Guide](https://img.shields.io/badge/Read-User%20Guide-6366f1?style=flat-square)](wiki/User-Guide.md)

</div>
