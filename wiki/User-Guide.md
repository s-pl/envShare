# User Guide

envShare uses three project roles to control what each team member can do. This guide walks through every workflow available to each role.

---

## Role overview

| Role | Typical user | Summary |
|------|-------------|---------|
| **ADMIN** | Tech lead, project owner | Full control — manage members, environments, and secrets |
| **DEVELOPER** | Backend / fullstack engineer | Push, pull, and update values |
| **VIEWER** | Designer, QA, stakeholder | Read-only — pull secrets to a local `.env` file |

Roles are **per-project**. A user can be ADMIN on one project and VIEWER on another.

---

## Permission matrix

| Action | VIEWER | DEVELOPER | ADMIN |
|--------|:------:|:---------:|:-----:|
| Pull secrets | ✓ | ✓ | ✓ |
| View secret names | ✓ | ✓ | ✓ |
| View version history | ✓ | ✓ | ✓ |
| List members | ✓ | ✓ | ✓ |
| List environments | ✓ | ✓ | ✓ |
| Push secrets | | ✓ | ✓ |
| Set personal value | | ✓ | ✓ |
| Update shared value | | ✓ | ✓ |
| Create environment | | ✓ | ✓ |
| Invite member | | | ✓ |
| Change member role | | | ✓ |
| Remove member | | | ✓ |
| Delete secret | | | ✓ |
| Delete environment | | | ✓ |
| Delete project | | | ✓ |
| View audit log | | | ✓ |

> [!NOTE]
> Every user can always view their own login history and personal audit events, regardless of project role.

---

## ADMIN

### First-time setup

After creating a project you are automatically its ADMIN.

```bash
# 1. Create a project (interactive — asks for name and slug)
envshare project create

# 2. Link the CLI to this project directory
envshare init

# 3. Push your local .env
envshare push

# 4. Invite team members
envshare project invite alice@company.com --role DEVELOPER
envshare project invite bob@company.com   --role VIEWER
```

### Managing members

```bash
# List all members and their roles
envshare project members

# Invite a new member (DEVELOPER by default)
envshare project invite carol@company.com

# Promote or demote a member
envshare project set-role carol@company.com ADMIN
envshare project set-role alice@company.com VIEWER

# Remove a member from the project
envshare project remove bob@company.com
```

> [!WARNING]
> You cannot remove the last ADMIN or change your own role. Promote another member to ADMIN first.

### Managing environments

Environments are created automatically when you first push to them. Each environment maps to a file path.

```bash
# Push secrets to a staging environment
# Creates "staging" → .env.staging if it does not already exist
envshare push .env.staging --env staging
```

### Managing secrets

```bash
# Push all secrets from .env without prompts
envshare push --all

# Interactive push — choose which variables to include
envshare push

# Push a specific file to a named environment
envshare push .env.staging --env staging

# Preview what would be pushed without sending anything
envshare push --dry-run

# Delete a secret (asks for confirmation)
envshare delete DATABASE_URL

# Delete without confirmation
envshare delete DATABASE_URL --force

# View the full change history of a secret
envshare history DATABASE_URL
```

### Audit log

```bash
# View the project audit trail (last 50 events by default)
envshare audit

# Show more entries
envshare audit --limit 100

# Filter by date range
envshare audit --from 2026-01-01 --to 2026-12-31

# Filter by action type
envshare audit --action SECRETS_PUSHED

# Machine-readable JSON output
envshare audit --json
```

---

## DEVELOPER

As a DEVELOPER you can push and pull secrets and update values, but cannot add/remove members or delete secrets.

### Day-to-day workflow

```bash
# 1. Clone the project repository, then link the CLI
envshare init

# 2. Pull secrets — writes your personal values to the correct .env files
envshare pull

# 3. Edit your .env, then push changes back
envshare push
```

### Setting a personal value

Personal secrets have **individual values per developer** (e.g. a local database password). If the value is missing or you need to override it:

```bash
envshare set DATABASE_URL "postgres://localhost/myapp_dev"
```

### Updating a shared value

Shared secrets have **one value for the whole team** (e.g. a staging API key). Any DEVELOPER or ADMIN can update it:

```bash
envshare set STRIPE_PUBLIC_KEY "pk_test_..." --shared
```

> [!IMPORTANT]
> Updating a shared value immediately affects every teammate who runs `envshare pull` next.

### Pushing to a specific environment

```bash
# Push .env.staging and tag secrets as "staging"
envshare push .env.staging --env staging
```

### Viewing history

```bash
# See who changed a secret and when
envshare history STRIPE_PUBLIC_KEY
```

---

## VIEWER

VIEWERs have read-only access. They can pull secrets to their machine but cannot push or modify anything.

### Pulling secrets

```bash
# 1. Link the CLI to the project (run once per machine)
envshare init

# 2. Pull all secrets — writes .env files to the correct locations
envshare pull

# 3. Pull only a specific environment
envshare pull --env staging

# 4. Write everything to a single file
envshare pull --output .env.local
```

### What VIEWERs see

- **Shared secrets** — the decrypted value is written to the `.env` file.
- **Personal secrets (no value set)** — a placeholder comment is written instead:

  ```env
  DATABASE_URL=   # pending — run: envshare set DATABASE_URL "your-value"
  ```

  A DEVELOPER or ADMIN must set the personal value before it can be pulled. VIEWERs cannot set values.

---

## Secret types

### Personal secrets (`isShared: false`)

Each developer has their own encrypted copy of the value. Typical use cases: local database URLs, personal API tokens, per-machine port overrides.

```env
DATABASE_URL=postgres://myuser:mypass@localhost/myapp_dev
```

- **Set by**: the individual developer (DEVELOPER or ADMIN)
- **Visible to**: only the developer who set it
- **Push annotation**: no annotation — personal is the default

### Shared secrets (`isShared: true`)

One encrypted value for the whole project. Typical use cases: third-party API keys, feature flags, server-side URLs.

```env
STRIPE_PUBLIC_KEY=pk_live_abc123   # @shared
SENTRY_DSN=https://abc@sentry.io/1 # @shared
```

- **Set by**: any DEVELOPER or ADMIN
- **Visible to**: all project members
- **Push annotation**: `# @shared` in the `.env` file (or match a shared pattern in `.envshare.config.json`)

---

## Common scenarios

### Onboarding a new developer

**ADMIN** — invite the developer:

```bash
envshare project invite newdev@company.com --role DEVELOPER
```

**New developer** — set up the CLI and pull:

```bash
envshare register
envshare login
envshare init
envshare pull
```

**New developer** — set personal values for any pending secrets shown in the output:

```bash
envshare set DATABASE_URL "postgres://localhost/myapp_dev"
```

---

### Rotating a shared secret

Update the value directly:

```bash
envshare set STRIPE_SECRET_KEY "sk_live_new_key" --shared
```

Or update it in the `.env` file with the `# @shared` annotation and push:

```bash
envshare push
```

Notify teammates to pull:

```bash
# Each teammate runs:
envshare pull
```

---

### Giving QA read-only access

```bash
# ADMIN invites the QA engineer as VIEWER
envshare project invite qa@company.com --role VIEWER

# QA engineer sets up their machine
envshare login
envshare init
envshare pull --env staging
```

---

### Checking who changed a secret

ADMINs can browse the full project audit log:

```bash
envshare audit
envshare audit --from 2026-01-01 --action SECRETS_PUSHED
```

Any role can view the history of a specific key:

```bash
envshare history DATABASE_URL
```

---

## Full command reference

| Command | Description |
|---------|-------------|
| `envshare register` | Create a new account |
| `envshare login` | Authenticate with the server |
| `envshare url [url]` | Get or set the API server URL |
| `envshare project create` | Create a new project |
| `envshare project invite <email>` | Invite a member (`--role ADMIN\|DEVELOPER\|VIEWER`) |
| `envshare project members` | List project members and roles |
| `envshare project set-role <email> <role>` | Change a member's role |
| `envshare project remove <email>` | Remove a member from the project |
| `envshare project delete` | Permanently delete the project (ADMIN only) |
| `envshare init` | Link current directory to a project |
| `envshare push [file]` | Push `.env` variables (`--all`, `--env`, `--dry-run`) |
| `envshare pull` | Pull secrets to `.env` files (`--output`, `--env`) |
| `envshare set <key> <value>` | Set a personal value (`--shared` for shared) |
| `envshare list` | List secret keys (`--json`) |
| `envshare delete <key>` | Delete a secret (`--force`) |
| `envshare history <key>` | Show version history for a secret |
| `envshare audit` | Show audit log (`--limit`, `--from`, `--to`, `--action`, `--json`) |
| `envshare update` | Download and install the latest release |
| `envshare version` | Show version and environment info |

See [Permission-Errors.md](Permission-Errors.md) for the complete error code reference.
