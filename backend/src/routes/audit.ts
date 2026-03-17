import { Router } from "express";
import { z } from "zod";
import { authenticate, AuthRequest } from "../middleware/auth";
import { auditService } from "../services/auditService";
import { prisma } from "../utils/prisma";
import { AppError } from "../middleware/errorHandler";

/**
 * Audit Router — /api/v1/audit
 *
 * ISO 27001 A.12.4.1 — Event Logging & Monitoring.
 * GDPR Art. 5(1)(f) — Integrity and confidentiality.
 *
 * Access control:
 *   • A user may only query audit logs for projects they are a member of,
 *     or their own account-level events (actor === their own userId).
 *   • Project-scoped queries are restricted to ADMIN members — regular
 *     developers and viewers cannot browse the full project audit trail.
 *   • Account-level events (resourceType = "user", resourceId = own userId)
 *     are always accessible to the subject — this fulfils GDPR Art. 15
 *     (right of access to data about oneself).
 */

export const auditRouter = Router();
auditRouter.use(authenticate);

// GET /api/v1/audit
//
// Query params:
//   resourceType  — filter by resource type (e.g. "project", "secret", "user")
//   resourceId    — filter by resource ID (project ID, secret ID, user ID…)
//   action        — filter by action string (e.g. "SECRETS_PUSHED")
//   from          — ISO-8601 lower bound on createdAt
//   to            — ISO-8601 upper bound on createdAt
//   limit         — max results (1–200, default 50)
//   offset        — pagination offset (default 0)
//
// Access rules (enforced below):
//   1. resourceId === caller's userId  → always allowed (own account events)
//   2. resourceId is a project ID where caller is ADMIN → allowed
//   3. Anything else → 403 FORBIDDEN
//
// If neither resourceId nor resourceType is provided, the response is scoped
// to the caller's own account events only (safe default).
auditRouter.get("/", async (req: AuthRequest, res, next) => {
  try {
    const query = z
      .object({
        resourceType: z.string().optional(),
        resourceId: z.string().optional(),
        action: z.string().optional(),
        from: z.string().datetime().optional(),
        to: z.string().datetime().optional(),
        limit: z.coerce.number().min(1).max(200).default(50),
        offset: z.coerce.number().min(0).default(0),
      })
      .parse(req.query);

    const callerId = req.user!.id;

    // ── Access control ──────────────────────────────────────────────────────
    //
    // Determine what the caller is actually allowed to see, and throw a 403
    // if they are asking for something outside that scope.
    //
    // We resolve the effective resourceId to filter on.  If the caller provides
    // a resourceId we validate it; if they don't, we default to their own userId
    // so they always see their own account events.

    let effectiveResourceId: string | undefined = query.resourceId;

    if (!query.resourceId) {
      // No resourceId supplied → default to the caller's own events
      effectiveResourceId = callerId;
    } else if (query.resourceId === callerId) {
      // Explicitly asking for own account events — always allowed
      effectiveResourceId = callerId;
    } else {
      // Caller is asking for a specific resource (likely a project).
      // They must be an ADMIN of that project.
      const membership = await prisma.projectMember.findUnique({
        where: {
          projectId_userId: {
            projectId: query.resourceId,
            userId: callerId,
          },
        },
        select: { role: true },
      });

      if (!membership) {
        throw new AppError(
          403,
          "You are not a member of the requested resource.",
          "FORBIDDEN",
        );
      }

      if (membership.role !== "ADMIN") {
        throw new AppError(
          403,
          "Only project ADMINs can view the project audit log.",
          "FORBIDDEN_ROLE",
        );
      }

      effectiveResourceId = query.resourceId;
    }

    // ── Query ───────────────────────────────────────────────────────────────
    const result = await auditService.query({
      resourceType: query.resourceType,
      resourceId: effectiveResourceId,
      action: query.action,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      limit: query.limit,
      offset: query.offset,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});
