# User Guide — Roles & Permissions

envShare uses three roles to control what each team member can do within a project. This guide walks through every action available to each role.

---

## Role overview

| Role | Typical user | What they can do |
|------|-------------|-----------------|
| **ADMIN** | Tech lead, project owner | Full control — manage members, environments, and secrets |
| **DEVELOPER** | Backend / fullstack engineer | Push and pull secrets, update values, create environments |
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
# 1. Link the CLI to this project (run once per machine)
envshare init

# 2. Push your local .env to the server
envshare push

# 3. Add team members
envshare members add alice@company.com --role DEVELOPER
envshare members add bob@company.com   --role VIEWER
```

### Managing members

```bash
# List all members and their roles
envshare members list

# Add a new member (default role: DEVELOPER)
envshare members add carol@company.com

# Promote a VIEWER to DEVELOPER
envshare members role carol@company.com DEVELOPER

# Demote a DEVELOPER to VIEWER
envshare members role alice@company.com VIEWER

# Remove a member
envshare members remove bob@company.com
```

> You cannot remove the last ADMIN or change your own role. Promote another member to ADMIN first.

### Managing environments

Each environment maps to a file path (e.g. `staging` → `.env.staging`).

```bash
# List environments in this project
envshare envs list

# Create a staging environment
envshare envs create staging --file .env.staging

# Delete an environment (secrets linked to it are unlinked, not deleted)
envshare envs delete staging
```

### Managing secrets

```bash
# Push all secrets from .env
envshare push

# Push only selected secrets (interactive selector)
envshare push --select

# Push secrets from a specific file to a specific environment
envshare push --file .env.staging --env staging

# Delete a specific secret (ADMIN only)
envshare delete DATABASE_URL

# View the full change history of a secret
envshare history DATABASE_URL
```

### Audit log

```bash
# View the project audit trail (last 50 events)
envshare audit --project <projectId>

# Filter by date range
envshare audit --project <projectId> --from 2026-03-01 --to 2026-03-31
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
envshare set STRIPE_PUBLIC_KEY "pk_test_..."
```

> Updating a shared value immediately affects every teammate who runs `envshare pull` next.

### Creating an environment

```bash
# Add a new environment (e.g. for a staging server)
envshare envs create staging --file .env.staging

# Push secrets to that environment
envshare push --file .env.staging --env staging
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

1. **(ADMIN)** Add the developer to the project:
   ```bash
   envshare members add newdev@company.com --role DEVELOPER
   ```
2. **(New developer)** Register a CLI account and link the project:
   ```bash
   envshare register
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

1. Update the value locally in your `.env`:
   ```
   STRIPE_SECRET_KEY=sk_live_new_key   # @shared
   ```
2. Push it:
   ```bash
   envshare push --select   # select only STRIPE_SECRET_KEY
   ```
3. Notify teammates to pull:
   ```bash
   envshare pull
   ```

---

### Giving QA read-only access

```bash
# ADMIN adds the QA engineer as VIEWER
envshare members add qa@company.com --role VIEWER

# QA engineer pulls the staging environment
envshare init
envshare pull --env staging
```

---

### Checking who changed a secret

Only ADMINs can browse the full project audit log:

```bash
envshare audit --project <projectId>
```

Any user can check their own activity:

```bash
envshare audit
```

---

## Error quick-reference

| Error code | Meaning | Who can fix it |
|------------|---------|----------------|
| `FORBIDDEN_ROLE` | Your role is too low for this action | ADMIN must promote you |
| `LAST_ADMIN` | Cannot remove the only ADMIN | Promote someone else first |
| `SELF_ROLE_CHANGE` | Cannot change your own role | Ask another ADMIN |
| `MEMBER_ALREADY_EXISTS` | User is already a member | No action needed |
| `SECRET_IS_SHARED` | Tried to set personal value on a shared secret | Use `envshare set KEY` without `# @shared` annotation |

See [Permission-Errors.md](Permission-Errors.md) for the full list.
