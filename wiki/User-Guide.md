# User Guide — Roles & Permissions

envShare uses three roles to control what each team member can do within a project. This guide walks through every action available to each role.

---

## Role overview

| Role | Typical user | What they can do |
|------|-------------|-----------------|
| **ADMIN** | Tech lead, project owner | Full control — manage members, environments, and secrets |
| **DEVELOPER** | Backend / fullstack engineer | Push and pull secrets, update values |
| **VIEWER** | Designer, QA, stakeholder | Read-only access — pull secrets to their local `.env` |

Roles are **per-project**. A user can be ADMIN on one project and VIEWER on another.

---

## Permission matrix

| Action | VIEWER | DEVELOPER | ADMIN |
|--------|:------:|:---------:|:-----:|
| View project | ✅ | ✅ | ✅ |
| Pull secrets (`envshare pull`) | ✅ | ✅ | ✅ |
| List members | ✅ | ✅ | ✅ |
| List environments | ✅ | ✅ | ✅ |
| View secret history | ✅ | ✅ | ✅ |
| Push secrets (`envshare push`) | ❌ | ✅ | ✅ |
| Set personal value | ❌ | ✅ | ✅ |
| Update shared value | ❌ | ✅ | ✅ |
| Create environment | ❌ | ✅ | ✅ |
| Add member to project | ❌ | ❌ | ✅ |
| Change member role | ❌ | ❌ | ✅ |
| Remove member | ❌ | ❌ | ✅ |
| Delete secret | ❌ | ❌ | ✅ |
| Delete environment | ❌ | ❌ | ✅ |
| Delete project | ❌ | ❌ | ✅ |
| View project audit log | ❌ | ❌ | ✅ |

> **Own account events** — every user can always query their own login history and personal audit events, regardless of role.

---

## ADMIN

### First-time setup

After creating a project you are automatically its ADMIN.

```bash
# 1. Create a project (interactive — asks for name and slug)
envshare project create

# 2. Link the CLI to this project (run once per machine)
envshare init

# 3. Push your local .env to the server
envshare push

# 4. Invite team members
envshare project invite alice@company.com --role DEVELOPER
envshare project invite bob@company.com   --role VIEWER
```

### Managing members

```bash
# List all members and their roles
envshare project members

# Invite a new member (default role: DEVELOPER)
envshare project invite carol@company.com

# Promote a VIEWER to DEVELOPER
envshare project set-role carol@company.com DEVELOPER

# Demote a DEVELOPER to VIEWER
envshare project set-role alice@company.com VIEWER

# Remove a member from the project
envshare project remove bob@company.com
```

> You cannot remove the last ADMIN or change your own role. Promote another member to ADMIN first.

### Managing environments

Environments are created automatically when you push with `--env`. Each environment maps to a file path (e.g. `staging` → `.env.staging`).

```bash
# Push secrets to a staging environment (creates the environment if it doesn't exist)
envshare push .env.staging --env staging
```

### Managing secrets

```bash
# Push all secrets from .env (non-interactive — pushes everything)
envshare push --all

# Push interactively — choose which variables to push
envshare push

# Push a specific .env file to a specific environment
envshare push .env.staging --env staging

# Preview what would be pushed without sending
envshare push --dry-run

# Delete a specific secret (ADMIN only)
envshare delete DATABASE_URL

# Delete without confirmation prompt
envshare delete DATABASE_URL --force

# View the full change history of a secret
envshare history DATABASE_URL
```

### Audit log

```bash
# View the project audit trail (last 50 events)
envshare audit

# Show more entries
envshare audit --limit 100

# Filter by date range
envshare audit --from 2026-03-01 --to 2026-03-31

# Filter by action type
envshare audit --action SECRETS_PUSHED

# Machine-readable output
envshare audit --json
```

---

## DEVELOPER

As a DEVELOPER you can push and pull secrets and update values, but you cannot add/remove members or delete secrets.

### Day-to-day workflow

```bash
# 1. Clone the project repo, then link the CLI
envshare init

# 2. Pull secrets — writes your personal values to the correct .env files
envshare pull

# 3. Edit your .env, then push back any changes
envshare push
```

### Setting a personal value for a secret

Personal secrets have **individual values per developer** (e.g. a local database password). If the ADMIN pushed the key with no value, or if you need to override it:

```bash
envshare set DATABASE_URL "postgres://localhost/myapp_dev"
```

### Updating a shared value

Shared secrets have **one value for the whole team** (e.g. an API key for a third-party service). Any DEVELOPER can update it:

```bash
envshare set STRIPE_PUBLIC_KEY "pk_test_..." --shared
```

> Updating a shared value immediately affects every teammate who runs `envshare pull` next.

### Pushing to a specific environment

```bash
# Push secrets from .env.staging and tag them as "staging"
envshare push .env.staging --env staging
```

### Viewing history

```bash
# See who changed a secret and when
envshare history STRIPE_PUBLIC_KEY
```

---

## VIEWER

VIEWERs have read-only access. They can pull secrets to their machine but cannot push changes or modify anything.

### Pulling secrets

```bash
# 1. Link the CLI to the project (run once)
envshare init

# 2. Pull all secrets — writes .env files in the correct locations
envshare pull

# 3. Pull only a specific environment
envshare pull --env staging

# 4. Pull everything into a single file
envshare pull --output .env.local
```

### What VIEWERs see

- **Shared secrets** — decrypted value is shown and written to the `.env` file.
- **Personal secrets** — a placeholder comment is written instead:
  ```
  DATABASE_URL=  # ⚠ pending — run: envshare set DATABASE_URL "your-value"
  ```
  The ADMIN or a DEVELOPER must set a personal value for each developer who needs it. VIEWERs cannot set values themselves.

---

## Secret types

Understanding the two secret types helps explain what each role can and cannot do.

### Personal secrets (`isShared: false`)

Each developer has their own encrypted copy of the value. Typical use cases: local database URLs, personal API tokens, local port overrides.

```
DATABASE_URL=postgres://myuser:mypass@localhost/mydb_dev
```

- **Set by**: the individual developer (DEVELOPER or ADMIN role)
- **Visible to**: only the developer who set it
- **Pushed as**: `KEY=value` (no `# @shared` annotation)

### Shared secrets (`isShared: true`)

One encrypted value for the whole project. Typical use cases: third-party API keys, feature flags, server-side URLs.

```
STRIPE_PUBLIC_KEY=pk_live_abc123   # @shared
SENTRY_DSN=https://abc@sentry.io/1 # @shared
```

- **Set by**: any DEVELOPER or ADMIN
- **Visible to**: all project members
- **Pushed as**: `KEY=value  # @shared` annotation in the `.env` file

---

## Common scenarios

### Onboarding a new developer

1. **(ADMIN)** Invite the developer to the project:
   ```bash
   envshare project invite newdev@company.com --role DEVELOPER
   ```
2. **(New developer)** Register a CLI account and link the project:
   ```bash
   envshare register
   envshare login
   envshare init
   ```
3. **(New developer)** Pull secrets:
   ```bash
   envshare pull
   ```
4. **(New developer)** Set personal values for any pending secrets shown in the output:
   ```bash
   envshare set DATABASE_URL "postgres://localhost/myapp_dev"
   ```

---

### Rotating a shared secret

1. Update the value directly:
   ```bash
   envshare set STRIPE_SECRET_KEY "sk_live_new_key" --shared
   ```
   Or update it in your `.env` with the `# @shared` annotation and push:
   ```bash
   envshare push
   ```
2. Notify teammates to pull:
   ```bash
   envshare pull
   ```

---

### Giving QA read-only access

```bash
# ADMIN invites the QA engineer as VIEWER
envshare project invite qa@company.com --role VIEWER

# QA engineer sets up their environment
envshare login
envshare init
envshare pull --env staging
```

---

### Checking who changed a secret

ADMINs can browse the full project audit log:

```bash
envshare audit
envshare audit --from 2026-03-01 --action SECRETS_PUSHED
```

Any role can view the history of a specific secret:

```bash
envshare history DATABASE_URL
```

---

## Interactive terminal UI

For a richer experience, launch the interactive terminal UI:

```bash
envshare ui
```

The TUI lets you browse projects, secrets, members, and environments using keyboard navigation. Requires an interactive terminal (not CI).

---

## CLI command reference

| Command | Description |
|---------|-------------|
| `envshare register` | Create a new account |
| `envshare login` | Authenticate with the server |
| `envshare url [url]` | Get or set the API server URL |
| `envshare project create` | Create a new project |
| `envshare project invite <email>` | Invite a member (`--role ADMIN\|DEVELOPER\|VIEWER`) |
| `envshare project members` | List project members |
| `envshare project set-role <email> <role>` | Change a member's role |
| `envshare project remove <email>` | Remove a member |
| `envshare init` | Link current directory to a project |
| `envshare push [file]` | Push `.env` variables (`--all`, `--env`, `--dry-run`) |
| `envshare pull` | Pull secrets to `.env` files (`--output`, `--env`) |
| `envshare set <key> <value>` | Set a personal value (`--shared` for shared) |
| `envshare list` | List secret keys (`--json`) |
| `envshare delete <key>` | Delete a secret (`--force`) |
| `envshare history <key>` | Show version history for a secret |
| `envshare audit` | Show audit log (`--limit`, `--from`, `--to`, `--action`, `--json`) |
| `envshare ui` | Launch interactive terminal UI |
| `envshare update` | Download latest release (`--check`) |
| `envshare version` | Show version and environment info |

See [Permission-Errors.md](Permission-Errors.md) for the full error reference.
