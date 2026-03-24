# Resource Errors

Errors related to resources that do not exist, are in conflict, or have integrity constraints.

---

## Not found errors

| Code | HTTP | Resource |
|------|------|----------|
| `PROJECT_NOT_FOUND` | 404 | Project |
| `SECRET_NOT_FOUND` | 404 | Secret |
| `ENV_NOT_FOUND` | 404 | Environment |
| `NOT_FOUND` | 404 | User, session |
| `DB_NOT_FOUND` | 404 | Generic Prisma record |

All 404 responses follow the same shape:
```json
{ "error": "Secret not found", "code": "SECRET_NOT_FOUND", "status": 404 }
```

### `PROJECT_NOT_FOUND`

The project ID in the URL does not exist. Also returned internally when the project's encryption key wrapper cannot be loaded.

**Common causes:**
- The project was deleted after `envshare init` was run.
- The `.envshare.json` file contains a stale project ID.

**Fix:** Run `envshare init` to re-link to a valid project.

---

### `SECRET_NOT_FOUND`

The secret ID does not exist in the database, or it belongs to a different project.

---

### `ENV_NOT_FOUND`

The environment ID does not belong to the specified project.

---

## Conflict errors

### `MEMBER_ALREADY_EXISTS`
**HTTP 409**

The user you are trying to invite is already a member of the project.

```json
{
  "error": "alice@example.com is already a member",
  "code": "MEMBER_ALREADY_EXISTS",
  "status": 409
}
```

---

### `SECRET_IS_SHARED`
**HTTP 400**

A request attempted to set a **personal** value on a secret whose `isShared` flag is `true`. Shared secrets have exactly one value that all members see — they cannot have per-user values.

```json
{
  "error": "This secret is shared — update the shared value instead",
  "code": "SECRET_IS_SHARED",
  "status": 400
}
```

**When this happens via CLI:**

This was a known bug in versions < 1.0.7 where removing `# @shared` from a variable and re-pushing would hit this error. From 1.0.7 onwards, `envshare push` automatically syncs the `isShared` flag.

**Fix:** Update the CLI to version 1.0.7 or later.

---

### `ENV_LAST_REMAINING`
**HTTP 400**

Cannot delete the environment because it is the last one in the project. Every project must have at least one environment to store file-path associations.

```json
{
  "error": "Cannot delete the last environment. A project must have at least one.",
  "code": "ENV_LAST_REMAINING",
  "status": 400
}
```

**Fix:** Create a new environment, then delete the old one.

---

### `DB_CONSTRAINT`
**HTTP 409**

A database unique or foreign key constraint was violated. This is a lower-level error than the named conflict codes above; it appears when application-level checks don't catch a race condition.

```json
{ "error": "A record with this value already exists.", "code": "DB_CONSTRAINT", "status": 409 }
```

---

### `LAST_ADMIN`
**HTTP 400**

See [Permission Errors — LAST_ADMIN](Permission-Errors#last_admin).
