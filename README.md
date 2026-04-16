<div align="center">
<br>

# envShare

**Self-hosted secret management for development teams.**

Stop committing `.env` files to Git. Stop sending secrets over Slack.<br>
envShare encrypts every variable at rest and gives each developer exactly what they need.

<br>

[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker&logoColor=white)](https://docs.docker.com/compose)
[![Encryption](https://img.shields.io/badge/Encryption-AES--256--GCM-6366f1?style=flat-square)](SECURITY.md)
[![License](https://img.shields.io/badge/License-MIT-22c55e?style=flat-square)](LICENSE)

<br>

[Deploy](#deploy) &nbsp;·&nbsp; [Install CLI](#install-the-cli) &nbsp;·&nbsp; [Quick Start](#quick-start) &nbsp;·&nbsp; [CLI Reference](#cli-reference) &nbsp;·&nbsp; [Security](SECURITY.md) &nbsp;·&nbsp; [Docs](wiki/Home.md)

<br>
</div>

---

## Overview

envShare is a **self-hosted** alternative to Doppler or 1Password Secrets. You run the server — your keys never leave your infrastructure.

Each secret has one of two modes:

| Mode | Who gets the value | Typical use cases |
|------|--------------------|-------------------|
| **Shared** | One encrypted value, equal for all team members | `DATABASE_URL`, `REDIS_URL`, `STRIPE_PUBLIC_KEY` |
| **Personal** | Each developer stores their own encrypted copy | `AWS_ACCESS_KEY_ID`, local database passwords |

All values are encrypted with **AES-256-GCM**. The master encryption key never touches the database — lose it and the data is permanently unrecoverable.

---

## Architecture

```mermaid
flowchart TB
    subgraph dev["Developer workstation"]
        direction LR
        CLI["envshare CLI\n─────────────\nstandalone binary\nno runtime needed"]
        DOTENV[".env files\nmode 0600"]
    end

    subgraph server["Server  ·  Docker Compose"]
        direction TB
        Caddy["Caddy\n─────────────\nTLS termination\nauto-certificate\nreverse proxy"]
        API["Backend API\n─────────────\nExpress · Prisma\nport 3000 internal"]
        DB[("PostgreSQL 16\n─────────────\nall data\nencrypted at rest")]

        Caddy -->|"http://backend:3000"| API
        API -->|"connection pool"| DB
    end

    GH["GitHub Releases\nself-update"]

    CLI -->|"HTTPS  /api/v1/*"| Caddy
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

Three layers ensure that a database breach alone is useless to an attacker. The master key is never stored anywhere — it exists only as a server environment variable.

```mermaid
flowchart TD
    MK["MASTER_ENCRYPTION_KEY\n─────────────────────────────────────\nenv var on server  ·  never in database\n32 random bytes  ·  store in KMS"]

    subgraph proj["Per-project  (stored encrypted in DB)"]
        PK["Project Key\n─────────────────────────────\n32 random bytes on project creation\nwrapped by master key  ·  AES-256-GCM\nstored as JSON in projects.encryptedKey"]
    end

    subgraph secrets["Per-secret  (stored in DB — encrypted)"]
        direction LR
        KN["Key name\nAES-256-GCM\nrandom 128-bit IV"]
        SV["Shared value\nAES-256-GCM\nrandom 128-bit IV\none per secret"]
        PV["Personal value\nAES-256-GCM\nrandom 128-bit IV\none per user"]
        KH["Key hash\nHMAC-SHA256\ndeduplication only\nnot reversible"]
    end

    MK -->|"unwrapKey()  AES-256-GCM decrypt"| PK
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

> **Key rotation** — rotating the master key only requires re-wrapping project keys (fast, no re-encryption of individual secrets).

---

## Authentication flow

<details>
<summary>Expand sequence diagram</summary>

Access tokens live **15 minutes** in memory only. Refresh tokens are single-use and stored as **SHA-256 hashes** — a database breach exposes only hashes, not usable tokens.

```mermaid
sequenceDiagram
    actor Dev as Developer
    participant CLI as envshare CLI
    participant API as Backend API
    participant DB as PostgreSQL

    Note over CLI,DB: Initial login
    Dev->>CLI: envshare login
    CLI->>API: POST /auth/login  {email, password}
    API->>DB: findUnique(email) — check lockout state
    API->>API: bcrypt.compare(password, hash) — constant-time
    API->>DB: INSERT refresh_token  {token: SHA256(raw), expiresAt, ip, ua}
    API->>DB: INSERT audit_log  {AUTH_LOGIN_SUCCESS, ip}
    API-->>CLI: {accessToken (JWT 15min), refreshToken (raw 80-hex)}
    CLI->>CLI: store refreshToken in config.json
    CLI->>CLI: keep accessToken in memory only

    Note over CLI,DB: Normal API request
    CLI->>API: GET /api/v1/secrets/:id  Authorization: Bearer token
    API-->>CLI: 200 OK

    Note over CLI,DB: Access token expired (15 min)
    CLI->>API: POST /auth/refresh  {refreshToken: raw}
    API->>DB: findUnique({token: SHA256(raw)})
    API->>DB: DELETE old token — single-use enforcement
    API->>DB: INSERT new_token  {token: SHA256(newRaw)}
    API-->>CLI: {new accessToken, new refreshToken}
    CLI->>CLI: update config.json
    CLI->>API: retry original request
    API-->>CLI: 200 OK
```

</details>

---

## Push / pull flow

<details>
<summary>Expand sequence diagram</summary>

```mermaid
sequenceDiagram
    actor Dev as Developer
    participant CLI as envshare CLI
    participant API as Backend API
    participant DB as PostgreSQL

    Note over Dev,DB: Push
    Dev->>CLI: envshare push [file] [--all] [--env name]
    CLI->>CLI: scan for .env files (depth 10, skips symlinks)
    CLI->>CLI: parse .env — classify shared / personal
    CLI->>CLI: filter ignored keys from .envshare.config.json

    loop batches of 10 secrets (up to 3 concurrent)
        CLI->>API: POST /sync/:projectId/push  {secrets[], filePath, environmentName}
        API->>DB: getOrCreate(environment, filePath)
        note right of API: single DB transaction
        API->>DB: findMany(keyHash IN [...]) — batch lookup
        loop each secret in batch
            alt new secret
                API->>DB: INSERT secret  {encryptedKey, keyHash, environmentId}
            else existing secret
                API->>DB: UPDATE secret  (isShared if changed)
            end
            API->>DB: UPSERT value  (encrypted)
            API->>DB: INSERT secret_version
        end
        API->>DB: INSERT audit_log  {SECRETS_PUSHED, actor, count}
        API-->>CLI: {created[], updated[], sharedUpdated[]}
        CLI-->>Dev: progress bar
    end

    Note over Dev,DB: Pull
    Dev->>CLI: envshare pull [--env name] [--output path]
    CLI->>API: GET /sync/:projectId/pull[?env=staging]
    API->>DB: SELECT secrets  (+ personal values for this user)  [parallel]
    API->>DB: SELECT environments                                 [parallel]
    API->>API: decrypt all values with project key
    API->>API: personal value overrides shared value (if both exist)
    API-->>CLI: [{key, value, filePath, environmentName}]
    CLI->>CLI: group secrets by filePath
    loop each output file
        CLI->>CLI: path traversal check (refuse writes outside cwd)
        CLI->>CLI: writeFileSync(path, content, mode 0600)
    end
```

</details>

---

## Database schema

<details>
<summary>Expand ER diagram</summary>

```mermaid
erDiagram
    direction LR

    User {
        string   id                 PK
        string   email              "unique"
        string   passwordHash       "bcrypt 12 rounds"
        string   name
        datetime consentedAt        "GDPR Art.7 consent"
        int      failedLoginAttempts
        datetime lockedUntil        "ISO 27001 A.9.4.2"
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
        string  id          PK
        string  projectId   FK
        string  name        "production, staging, etc."
        string  filePath    ".env, .env.staging, apps/api/.env"
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
        string id             PK
        string secretId       FK
        string userId         FK
        string encryptedValue "AES-256-GCM personal value"
    }

    SecretVersion {
        string id       PK
        string secretId FK
        string userId   FK
        string action   "created | updated | made_shared | made_personal"
        int    version
    }

    RefreshToken {
        string   id        PK
        string   token     "SHA-256 hash of raw token"
        string   userId    FK
        datetime expiresAt
        string   ipAddress "ISO 27001 A.12.4"
    }

    AuditLog {
        string   id           PK
        string   actor        "userId or system"
        string   action
        string   resourceType
        string   resourceId
        json     metadata
        datetime createdAt
    }

    User           ||--o{ ProjectMember   : "belongs to"
    Project        ||--o{ ProjectMember   : "has"
    Project        ||--o{ Environment     : "has"
    Project        ||--o{ Secret          : "owns"
    Environment    |o--o{ Secret          : "groups"
    Secret         ||--o{ UserSecretValue : "personal values"
    User           ||--o{ UserSecretValue : "owns"
    Secret         ||--o{ SecretVersion   : "history"
    User           ||--o{ RefreshToken    : "sessions"
```

</details>

---

## Deploy

### Self-hosted with Docker Compose

**1. Generate secrets**

Run each command independently — two different keys are required:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# copy output → MASTER_ENCRYPTION_KEY

node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# copy output → JWT_SECRET
```

> [!IMPORTANT]
> `MASTER_ENCRYPTION_KEY` is the root of all encryption. Back it up to a KMS or encrypted vault before deploying. Losing it makes all stored secrets **permanently unrecoverable** — there is no reset path.

**2. Create `.env` in the project root**

```env
POSTGRES_PASSWORD=your_secure_db_password
JWT_SECRET=<64-char hex>
MASTER_ENCRYPTION_KEY=<64-char hex>
ALLOWED_ORIGINS=https://your-frontend.com
```

**3. Start**

```bash
docker compose up -d
```

The API is available on port `3001`. Database migrations run automatically on startup.

**4. HTTPS with automatic TLS (Caddy)**

```bash
ENVSHARE_DOMAIN=secrets.yourdomain.com \
  docker compose -f docker-compose.https.yml up -d
```

Caddy obtains and renews certificates automatically via Let's Encrypt.

---

## Install the CLI

The CLI is a standalone binary — no Node.js required on developer machines.

<details>
<summary>macOS / Linux — Homebrew</summary>

```bash
brew install s-pl/envshare/envshare
```

</details>

<details>
<summary>Windows — Scoop</summary>

```powershell
scoop bucket add envshare https://github.com/s-pl/scoop-envshare
scoop install envshare
```

</details>

<details>
<summary>Linux — manual install</summary>

```bash
sudo curl -fsSL \
  https://github.com/s-pl/envShare/releases/latest/download/envshare-linux-x64 \
  -o /usr/local/bin/envshare \
  && sudo chmod +x /usr/local/bin/envshare
```

</details>

Self-update once installed:

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

# Create a project and link this directory
envshare project create
envshare init

# Push your .env (interactive variable selector)
envshare push

# For CI pipelines — push all variables without prompts
envshare push --all

# Preview what would be uploaded without sending anything
envshare push --dry-run

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

> [!TIP]
> Any personal secrets not yet set will appear as empty with a hint in the generated file:
> ```env
> STRIPE_SECRET_KEY=   # pending — run: envshare set STRIPE_SECRET_KEY "sk_test_..."
> ```

---

## Marking secrets as shared

**Inline in `.env`** — append `# @shared` to any line:

```env
# Shared: the whole team pulls the same value
DATABASE_URL=postgres://user:pass@host/db   # @shared
REDIS_URL=redis://host:6379                 # @shared

# Personal: each developer sets their own
AWS_ACCESS_KEY_ID=AKIA...
STRIPE_SECRET_KEY=sk_test_...
```

**Project-wide rules in `.envshare.config.json`** — commit this file to version control:

```json
{
  "defaultFile": ".env",
  "sharedKeys":     ["NODE_ENV", "PORT"],
  "sharedPatterns": ["*_URL", "*_HOST", "DB_*"],
  "ignoredKeys":    ["LOCAL_OVERRIDE"]
}
```

Pattern syntax: `*` matches any number of characters, `?` matches exactly one. Matching is case-insensitive.

---

## Roles

Roles are **per-project** — the same user can be ADMIN on one project and VIEWER on another.

| Permission | VIEWER | DEVELOPER | ADMIN |
|------------|:------:|:---------:|:-----:|
| Pull secrets and view secret names | ✓ | ✓ | ✓ |
| View secret version history | ✓ | ✓ | ✓ |
| List project members | ✓ | ✓ | ✓ |
| Push secrets | | ✓ | ✓ |
| Set personal values | | ✓ | ✓ |
| Update shared values | | ✓ | ✓ |
| Create environments | | ✓ | ✓ |
| Invite members | | | ✓ |
| Change member roles | | | ✓ |
| Remove members | | | ✓ |
| Delete secrets | | | ✓ |
| Delete environments | | | ✓ |
| View audit log | | | ✓ |
| Delete project | | | ✓ |

---

## CLI reference

### Setup

| Command | Description |
|---------|-------------|
| <kbd>envshare url [url]</kbd> | Get or set the backend API URL |
| <kbd>envshare register</kbd> | Create a new account |
| <kbd>envshare login</kbd> | Authenticate and store tokens |
| <kbd>envshare init</kbd> | Link the current directory to a project |
| <kbd>envshare version</kbd> | Show CLI version, server version, and auth status |
| <kbd>envshare update</kbd> | Download and install the latest release |

### Secrets — daily workflow

| Command | Description |
|---------|-------------|
| <kbd>envshare push</kbd> | Upload `.env` — interactive variable selector |
| <kbd>envshare push --all</kbd> | Push every variable without prompts (CI-friendly) |
| <kbd>envshare push --yes</kbd> | Alias for `--all` |
| <kbd>envshare push --env staging</kbd> | Tag secrets with an environment name |
| <kbd>envshare push --dry-run</kbd> | Preview what would be pushed without uploading |
| <kbd>envshare pull</kbd> | Download secrets and write `.env` files |
| <kbd>envshare pull --env staging</kbd> | Pull only the specified environment |
| <kbd>envshare pull --output .env</kbd> | Write everything to a single file |
| <kbd>envshare set KEY value</kbd> | Set your personal value for a key |
| <kbd>envshare set KEY value --shared</kbd> | Update the shared value for a key |

### Inspect & manage

| Command | Description |
|---------|-------------|
| <kbd>envshare list</kbd> | List all secret names in the current project |
| <kbd>envshare history KEY</kbd> | Full version history for a secret |
| <kbd>envshare delete KEY</kbd> | Delete a secret (ADMIN only, asks for confirmation) |
| <kbd>envshare delete KEY --force</kbd> | Delete without confirmation |
| <kbd>envshare audit</kbd> | Project audit log (ADMIN only) |
| <kbd>envshare audit --limit 100</kbd> | Show more entries |
| <kbd>envshare audit --from 2026-01-01 --to 2026-12-31</kbd> | Filter by date range |
| <kbd>envshare audit --action SECRETS_PUSHED</kbd> | Filter by action type |
| <kbd>envshare audit --json</kbd> | Machine-readable output |

### Team management

| Command | Description |
|---------|-------------|
| <kbd>envshare project create</kbd> | Create a new project |
| <kbd>envshare project invite email --role ROLE</kbd> | Invite a team member (ADMIN \| DEVELOPER \| VIEWER) |
| <kbd>envshare project members</kbd> | List current members and their roles |
| <kbd>envshare project set-role email ROLE</kbd> | Change a member's role |
| <kbd>envshare project remove email</kbd> | Remove a member from the project |
| <kbd>envshare project delete</kbd> | Delete the project and all its secrets (ADMIN only) |

---

## Security

| Control | Implementation |
|---------|----------------|
| **Encryption at rest** | AES-256-GCM with a random 128-bit IV per secret. Authentication tag prevents silent tampering. |
| **Master key** | Never stored in the database. The server refuses to start without it. |
| **Project key** | 32 random bytes per project, wrapped by the master key and stored encrypted. |
| **Passwords** | bcrypt with 12 rounds. Minimum 12 characters enforced. |
| **Access tokens** | 15-minute expiry. Kept in memory only — never written to disk. |
| **Refresh tokens** | Single-use, rotated on every refresh. Stored as SHA-256 hashes — a breach exposes hashes, not usable tokens. |
| **Startup validation** | Server exits immediately if `JWT_SECRET` or `MASTER_ENCRYPTION_KEY` are missing or malformed. |
| **Rate limiting** | 20 requests / 15 min on auth endpoints. 500 req / 15 min global limit. |
| **Account lockout** | Locked for 30 minutes after 10 consecutive failed login attempts. Persists across restarts. |
| **Audit log** | Every push, pull, member change, and auth event is recorded with actor, IP, and timestamp (ISO 27001 A.12.4.1). |
| **GDPR** | Audit logs auto-purged after 365 days. Consent timestamp at registration (Art. 7). Right to erasure (Art. 17) revokes all sessions immediately. |
| **Output file permissions** | `pull` writes `.env` files with mode `0600` (owner read/write only). Path traversal is rejected. |

Full threat model and ISO 27001 control mapping: [SECURITY.md](SECURITY.md)

---

## Server environment variables

| Variable | Required | Default | Description |
|----------|:--------:|---------|-------------|
| `MASTER_ENCRYPTION_KEY` | ✓ | — | 64-char hex (32 bytes). Root encryption key. **Store in a KMS, never commit.** |
| `JWT_SECRET` | ✓ | — | Min 32 bytes. Signs access tokens. Rotation invalidates all active sessions. |
| `DATABASE_URL` | ✓ | — | PostgreSQL connection string. |
| `POSTGRES_PASSWORD` | ✓ | — | Database password (used by Docker Compose). |
| `ALLOWED_ORIGINS` | ✓ | — | Comma-separated CORS origins, e.g. `https://app.yourcompany.com`. |
| `PORT` | | `3000` | Port the backend listens on inside Docker. |
| `NODE_ENV` | | `production` | Set to `development` for verbose error responses. |
| `LOG_LEVEL` | | `info` | Winston log level: `debug` \| `info` \| `warn` \| `error`. |
| `AUDIT_LOG_RETENTION_DAYS` | | `365` | Days to retain audit log entries. Minimum recommended: `90`. |
| `TRUST_PROXY` | | `false` | Set to `1` when running behind a trusted reverse proxy (Caddy, nginx). |
| `TOKEN_CLEANUP` | | `true` | Set to `false` to disable automatic expired-token cleanup. |
| `COOKIE_PATH` | | `/api/v1/auth` | Override refresh-token cookie path when the API is served under a prefix. |

> [!WARNING]
> Never commit secrets to source control. Use a secrets manager or at minimum a `.env` file excluded from Git.

---

## Local files

These files are created on developer machines. Add them to `.gitignore` where noted.

| File | Location | Purpose | Commit? |
|------|----------|---------|:-------:|
| `config.json` | `~/.config/envshare-nodejs/` | Stores API URL and authentication tokens | — |
| `.envshare.json` | Project root | Links the directory to a project ID | No |
| `.envshare.config.json` | Project root | Push config: shared patterns, ignored keys | Yes |

---

<div align="center">

[![Security Policy](https://img.shields.io/badge/Read-Security%20Policy-6366f1?style=flat-square)](SECURITY.md)
[![Full Docs](https://img.shields.io/badge/Read-Full%20Docs-6366f1?style=flat-square)](wiki/Home.md)
[![User Guide](https://img.shields.io/badge/Read-User%20Guide-6366f1?style=flat-square)](wiki/User-Guide.md)

</div>
