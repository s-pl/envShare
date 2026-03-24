# Permission Errors

envShare uses role-based access control (RBAC) at the project level. Every member of a project has one of three roles.

---

## Roles

| Role | Description |
|------|-------------|
| **VIEWER** | Read-only access. Can list and pull secrets. Cannot push, delete, or manage members. |
| **DEVELOPER** | Can push (create/update) secrets and pull. Cannot delete secrets or manage members. |
| **ADMIN** | Full access. Can delete secrets, manage members, change roles, view audit log, and delete the project. |

---

## Error codes

| Code | HTTP | Meaning |
|------|------|---------|
| `FORBIDDEN` | 403 | Caller is not a member of this project at all |
| `FORBIDDEN_ROLE` | 403 | Caller is a member but their role is insufficient |
| `SELF_ROLE_CHANGE` | 400 | Admin tried to change their own role |
| `LAST_ADMIN` | 400 | Operation would leave the project without an admin |

---

## `FORBIDDEN`

The authenticated user has no `ProjectMember` record for the requested project. They may have been removed, or they are trying to access a project that was never shared with them.

```json
{ "error": "Access denied", "code": "FORBIDDEN", "status": 403 }
```

**Fix:** Ask a project ADMIN to add you via `POST /api/v1/projects/:id/members`.

---

## `FORBIDDEN_ROLE`

The user is a member but their role does not meet the minimum required for the operation.

```json
{
  "error": "Requires DEVELOPER role or higher",
  "code": "FORBIDDEN_ROLE",
  "status": 403
}
```

### Role requirements per operation

| Endpoint | Method | Minimum role |
|----------|--------|-------------|
| `GET /secrets` | GET | VIEWER |
| `GET /sync/:id/pull` | GET | VIEWER |
| `POST /sync/:id/push` | POST | DEVELOPER |
| `PATCH /secrets/:id/value` | PATCH | DEVELOPER |
| `PATCH /secrets/:id/shared` | PATCH | DEVELOPER |
| `DELETE /secrets/:id` | DELETE | ADMIN |
| `GET /members` | GET | VIEWER |
| `POST /members` | POST | ADMIN |
| `PATCH /members/:id` | PATCH | ADMIN |
| `DELETE /members/:id` | DELETE | ADMIN |
| `GET /audit` | GET | ADMIN |
| `DELETE /projects/:id` | DELETE | ADMIN |
| `GET /environments` | GET | VIEWER |
| `POST /environments` | POST | ADMIN |
| `PATCH /environments/:id` | PATCH | ADMIN |
| `DELETE /environments/:id` | DELETE | ADMIN |

---

## `SELF_ROLE_CHANGE`

An ADMIN is not allowed to demote or change their own role. This prevents accidental self-lockout.

```json
{
  "error": "You cannot change your own role",
  "code": "SELF_ROLE_CHANGE",
  "status": 400
}
```

**Fix:** Ask another ADMIN to change your role.

---

## `LAST_ADMIN`

Removing or demoting this member would leave the project with zero ADMINs. Without an ADMIN, no one can manage members, delete secrets, or view the audit log.

```json
{
  "error": "Cannot remove the last admin. Promote another member first.",
  "code": "LAST_ADMIN",
  "status": 400
}
```

**Fix:**
1. Promote another member to ADMIN: `PATCH /api/v1/projects/:id/members/:otherId` with `{ "role": "ADMIN" }`.
2. Then remove or demote the original admin.
