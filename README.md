<div align="center">

# envShare

**Self-hosted secrets management for development teams.**

Stop committing secrets to Git. Stop sending `.env` files over Slack.
envShare encrypts every variable at rest and lets each developer pull exactly what they need.

[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker&logoColor=white)](https://docs.docker.com/compose)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)
[![AES-256-GCM](https://img.shields.io/badge/Encryption-AES--256--GCM-6366f1?style=flat-square&logo=letsencrypt&logoColor=white)](SECURITY.md)

</div>

---

## What it does

envShare is a **self-hosted** alternative to services like Doppler or 1Password Secrets. You run the server on your own infrastructure — your keys never leave your control.

Each secret variable can be either:

| Type | Description | Example |
|------|-------------|---------|
| **Shared** | One value for the whole team. Everyone pulls the same thing. | `DATABASE_URL`, `REDIS_URL`, `STRIPE_PUBLIC_KEY` |
| **Personal** | Each developer has their own encrypted copy. | `AWS_ACCESS_KEY_ID`, `STRIPE_SECRET_KEY`, local DB passwords |

Every value is encrypted with **AES-256-GCM**. The master encryption key never touches the database — lose it and the data is unrecoverable, so back it up.

---

## Deploy

### One-click

| Provider | Notes |
|----------|-------|
| [![Launch on AWS](https://img.shields.io/badge/Deploy%20to-AWS%20CloudFormation-FF9900?style=for-the-badge&logo=amazon-aws&logoColor=white)](https://console.aws.amazon.com/cloudformation/home#/stacks/new?stackName=envShare&templateURL=https%3A%2F%2Fraw.githubusercontent.com%2Fs-pl%2FenvShare%2Fmain%2Fdeploy%2Fcloudformation.yml) | EC2 (Amazon Linux 2023) + Docker Compose. ~10 min. |
| [![Deploy to Koyeb](https://www.koyeb.com/static/images/deploy/button.svg)](https://app.koyeb.com/deploy?type=github&repository=s-pl/envShare&branch=main&name=envshare) | Free tier, always-on, Docker native. |
| [![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/s-pl/envShare) | Managed API hosting + PostgreSQL add-on. |

> The AWS template provisions a single EC2 instance. You will be prompted for `MASTER_ENCRYPTION_KEY`, `JWT_SECRET`, and `POSTGRES_PASSWORD` during stack creation. See [`deploy/cloudformation.yml`](deploy/cloudformation.yml) for the full template.

### Self-hosted with Docker Compose

**1. Generate secrets**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"  # MASTER_ENCRYPTION_KEY
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"  # JWT_SECRET
```

**2. Create `.env` in the project root**

```env
POSTGRES_PASSWORD=your_db_password
JWT_SECRET=<64-char hex from above>
MASTER_ENCRYPTION_KEY=<64-char hex from above>
ALLOWED_ORIGINS=*
```

> **Warning:** Back up `MASTER_ENCRYPTION_KEY` securely. Losing it means losing access to every stored secret permanently.

**3. Start the server**

```bash
docker compose up -d
docker compose exec backend npx prisma migrate deploy
```

The API is now available on port `3001`.

**4. HTTPS with automatic certificates (Caddy)**

```bash
ENVSHARE_DOMAIN=secrets.yourdomain.com docker compose -f docker-compose.https.yml up -d
```

---

## Install the CLI

The CLI is a standalone binary — no Node.js required on developer machines.

```bash
# macOS (Apple Silicon)
curl -fsSL https://github.com/s-pl/envShare/releases/latest/download/envshare-macos-arm64 \
  -o ~/.local/bin/envshare && chmod +x ~/.local/bin/envshare

# macOS (Intel)
curl -fsSL https://github.com/s-pl/envShare/releases/latest/download/envshare-macos-x64 \
  -o ~/.local/bin/envshare && chmod +x ~/.local/bin/envshare

# Linux
curl -fsSL https://github.com/s-pl/envShare/releases/latest/download/envshare-linux-x64 \
  -o ~/.local/bin/envshare && chmod +x ~/.local/bin/envshare

# Windows (PowerShell)
Invoke-WebRequest https://github.com/s-pl/envShare/releases/latest/download/envshare-windows-x64.exe `
  -OutFile "$env:LOCALAPPDATA\Microsoft\WindowsApps\envshare.exe"
```

Or use the self-updater once it's installed:

```bash
envshare update
```

---

## Quick start

### Starting a new project (you become Admin)

```bash
# Point the CLI at your server
envshare url http://your-server:3001

# Create your account
envshare register
envshare login

# Create a project and link your repository
envshare project create
cd my-app
envshare init

# Push your .env — an interactive selector lets you choose which variables to upload
envshare push

# Invite teammates
envshare project invite alice@company.com --role DEVELOPER
envshare project invite bob@company.com   --role VIEWER
```

### Joining an existing project (invited by an Admin)

```bash
# Point at the same server
envshare url http://your-server:3001

# Create your account
envshare register
envshare login

# Link your local folder and pull secrets
cd my-app
envshare init
envshare pull
```

If any personal secrets are not yet set, the pulled `.env` will contain a placeholder:

```env
DATABASE_URL=  # pending — run: envshare set DATABASE_URL "your-value"
```

Set your value with:

```bash
envshare set DATABASE_URL "postgres://localhost/myapp_dev"
```

---

## Roles

Every project member has one of three roles. Roles are per-project — the same user can be Admin on one project and Viewer on another.

| Permission | Viewer | Developer | Admin |
|------------|:------:|:---------:|:-----:|
| View and pull secrets | yes | yes | yes |
| Push secrets | — | yes | yes |
| Set / update secret values | — | yes | yes |
| View secret history | yes | yes | yes |
| Create environments | — | yes | yes |
| Invite members | — | — | yes |
| Change member roles | — | — | yes |
| Delete secrets | — | — | yes |
| Delete project | — | — | yes |
| View project audit log | — | — | yes |

Full documentation: [wiki/User-Guide.md](wiki/User-Guide.md)

---

## How it works

### Architecture

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

### Encryption key hierarchy

Every secret goes through two layers of encryption. The master key (an environment variable on the server) wraps a per-project key, which encrypts each individual value. This means rotating the master key requires re-wrapping project keys, but secrets themselves do not need to be re-encrypted.

```mermaid
graph TD
    M["MASTER_ENCRYPTION_KEY\nenv var — never stored in DB"]
    P["Project Key\nrandom 32 bytes per project\nstored encrypted in DB"]
    SK["Secret key name\nAES-256-GCM + random IV"]
    SV["Shared value\nAES-256-GCM + random IV"]
    PV["Personal value\nAES-256-GCM + random IV"]
    KH["Key hash\nHMAC-SHA256 — deduplication only"]

    M -->|"wrapKey / unwrapKey"| P
    P --> SK
    P --> SV
    P --> PV
    P --> KH
```

### Authentication

Access tokens are short-lived (15 min) and stored in memory. Refresh tokens are single-use and rotated on every request, so a stolen token becomes invalid as soon as the real client uses it.

```mermaid
sequenceDiagram
    actor Dev as Developer
    participant CLI
    participant API
    participant DB

    Dev->>CLI: envshare login
    CLI->>API: POST /auth/login
    API->>DB: verify password (bcrypt)
    API->>DB: INSERT refresh_token
    API-->>CLI: accessToken + refreshToken
    CLI->>CLI: store tokens in config

    Note over CLI,API: 15 minutes later — access token expires

    CLI->>API: request with expired token
    API-->>CLI: 401 Unauthorized
    CLI->>API: POST /auth/refresh
    API->>DB: DELETE old token (single-use rotation)
    API->>DB: INSERT new refresh_token
    API-->>CLI: new accessToken + refreshToken
    CLI->>API: retry original request
```

### Push / pull

```mermaid
sequenceDiagram
    actor Dev as Developer
    participant CLI
    participant API
    participant DB

    Note over Dev,DB: Push
    Dev->>CLI: envshare push
    CLI->>CLI: parse .env, classify keys (shared / personal)
    CLI->>API: POST /sync/:projectId/push
    API->>API: unwrap project key with MASTER_ENCRYPTION_KEY
    loop each secret
        API->>API: AES-256-GCM encrypt(value, projectKey)
        API->>DB: upsert secret + create version record
    end
    API-->>CLI: { created, updated, sharedUpdated }
    CLI-->>Dev: progress bar + summary

    Note over Dev,DB: Pull
    Dev->>CLI: envshare pull
    CLI->>API: GET /sync/:projectId/pull
    API->>DB: SELECT secrets + this user's personal values
    API->>API: decrypt all values with project key
    API-->>CLI: [{ key, value, filePath, environmentName }]
    CLI->>CLI: group by filePath, write each .env (mode 0600)
    CLI-->>Dev: list of files written
```

---

## Security

[![AES-256-GCM](https://img.shields.io/badge/Encryption-AES--256--GCM-6366f1?style=flat-square)](SECURITY.md)
[![bcrypt](https://img.shields.io/badge/Passwords-bcrypt%2012%20rounds-6366f1?style=flat-square)](SECURITY.md)
[![JWT](https://img.shields.io/badge/Tokens-JWT%2015min%20%2B%20single--use%20refresh-6366f1?style=flat-square)](SECURITY.md)

| Control | Detail |
|---------|--------|
| Encryption at rest | AES-256-GCM with a random IV per secret. Authentication tag prevents tampering. |
| Master key | Never stored in the database. Server refuses to start without it. |
| Passwords | bcrypt with 12 rounds. |
| Access tokens | 15-minute expiry, kept in memory only — never written to disk. |
| Refresh tokens | Single-use. Rotated on every refresh. Stored as a hash in the database. |
| Rate limiting | 20 requests / 15 min on auth endpoints. Global 500 req / 15 min limit. |
| Account lockout | Locked after 10 consecutive failed login attempts. |
| Audit log | Every push, pull, and member change is recorded with actor, IP, and timestamp (ISO 27001 A.12.4.1). |
| GDPR | Audit logs auto-purged after 365 days (configurable). Consent recorded at registration. |

Full threat model: [SECURITY.md](SECURITY.md)

---

## CLI reference

### Setup

| Command | Description |
|---------|-------------|
| `envshare url <url>` | Set the backend API URL |
| `envshare register` | Create a new account |
| `envshare login` | Authenticate and store tokens |
| `envshare init` | Link the current directory to a project |
| `envshare version` | Show version, server URL, and auth status |
| `envshare update` | Download and install the latest release |

### Daily workflow

| Command | Description |
|---------|-------------|
| `envshare push` | Upload `.env` — interactive variable selector |
| `envshare push --all` | Push every variable without prompts (CI-friendly) |
| `envshare push --env staging` | Tag secrets with an environment name |
| `envshare push --dry-run` | Preview what would be pushed without uploading |
| `envshare pull` | Download secrets and write `.env` files |
| `envshare pull --env staging` | Pull only a specific environment |
| `envshare pull --output .env` | Write everything to a single file |
| `envshare set KEY "value"` | Set your personal value for a key |
| `envshare set KEY "value" --shared` | Update the shared value (visible to all) |

### Inspect

| Command | Description |
|---------|-------------|
| `envshare list` | List all secret key names in the project |
| `envshare history KEY` | Show the full version history of a secret |
| `envshare audit` | Show the project audit log (Admin only) |
| `envshare delete KEY` | Delete a secret from the project |

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

### Marking secrets as shared

Add `# @shared` to any line in your `.env`:

```env
# These are the same for everyone on the team
DATABASE_URL=postgres://user:pass@host/db   # @shared
REDIS_URL=redis://host:6379                 # @shared

# These are personal — each developer sets their own
AWS_ACCESS_KEY_ID=AKIA...
STRIPE_SECRET_KEY=sk_test_...
```

Or configure sharing rules globally in `.envshare.config.json`:

```json
{
  "sharedPatterns": ["*_URL", "*_HOST", "DB_*"],
  "ignoredKeys":    ["NODE_ENV", "PORT"]
}
```

---

## Server environment variables

| Variable | Required | Default | Description |
|----------|:--------:|---------|-------------|
| `MASTER_ENCRYPTION_KEY` | yes | — | 64-char hex. Wraps all project keys. Back this up. |
| `JWT_SECRET` | yes | — | 64-char hex. Signs access tokens. |
| `DATABASE_URL` | yes | — | PostgreSQL connection string. |
| `POSTGRES_PASSWORD` | yes | — | DB password (used by Docker Compose). |
| `ALLOWED_ORIGINS` | yes | — | Comma-separated CORS origins, e.g. `https://app.com`. |
| `PORT` | no | `3000` | Port the backend listens on inside Docker. |
| `NODE_ENV` | no | `production` | Set to `development` to enable verbose error responses. |
| `LOG_LEVEL` | no | `info` | Winston log level (`debug`, `info`, `warn`, `error`). |
| `AUDIT_LOG_RETENTION_DAYS` | no | `365` | Days before audit log entries are automatically purged. |
| `TRUST_PROXY` | no | `false` | Set to `1` when behind a trusted reverse proxy (Caddy, nginx). |
| `TOKEN_CLEANUP` | no | `true` | Set to `false` to disable automatic expired-token cleanup. |

---

## Local files

These files are created on developer machines — they should not be committed to version control.

| File | Location | Purpose |
|------|----------|---------|
| `config.json` | `~/.config/envshare-nodejs/` | Stores the API URL and auth tokens. |
| `.envshare.json` | Project root | Links the directory to a project ID. Add to `.gitignore`. |
| `.envshare.config.json` | Project root | Optional push config — shared patterns, ignored keys. |

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
        string secretId FK
        string userId FK
        string encryptedValue
    }
    SecretVersion {
        string secretId FK
        string userId FK
        string action
        int version
    }
    AuditLog {
        string actor
        string action
        string resourceType
        string resourceId
        datetime createdAt
    }

    User ||--o{ ProjectMember : ""
    Project ||--o{ ProjectMember : ""
    Project ||--o{ Environment : ""
    Project ||--o{ Secret : ""
    Environment |o--o{ Secret : ""
    Secret ||--o{ UserSecretValue : ""
    User ||--o{ UserSecretValue : ""
    Secret ||--o{ SecretVersion : ""
```

---

<div align="center">

[![SECURITY.md](https://img.shields.io/badge/Read-Security%20Policy-6366f1?style=flat-square)](SECURITY.md)
[![Wiki](https://img.shields.io/badge/Read-Full%20Docs-6366f1?style=flat-square)](wiki/Home.md)
[![User Guide](https://img.shields.io/badge/Read-User%20Guide-6366f1?style=flat-square)](wiki/User-Guide.md)

</div>
