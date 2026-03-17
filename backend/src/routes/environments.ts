import { Router } from "express";
import { z } from "zod";
import { authenticate, AuthRequest } from "../middleware/auth";
import { environmentService } from "../services/environmentService";
import { prisma } from "../utils/prisma";
import { AppError } from "../middleware/errorHandler";

export const environmentsRouter = Router({ mergeParams: true });
environmentsRouter.use(authenticate);

async function requireMember(
  projectId: string,
  userId: string,
  minRole: "VIEWER" | "DEVELOPER" | "ADMIN" = "VIEWER",
) {
  const roleWeight: Record<string, number> = {
    VIEWER: 0,
    DEVELOPER: 1,
    ADMIN: 2,
  };
  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
  if (!member) throw new AppError(403, "Access denied", "FORBIDDEN");
  if (roleWeight[member.role] < roleWeight[minRole]) {
    throw new AppError(
      403,
      `Requires ${minRole} role or higher`,
      "FORBIDDEN_ROLE",
    );
  }
  return member;
}

// GET /api/v1/projects/:projectId/environments
environmentsRouter.get("/", async (req: AuthRequest, res, next) => {
  try {
    await requireMember(req.params.projectId, req.user!.id);
    const environments = await environmentService.list(req.params.projectId);
    res.json({ environments });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/projects/:projectId/environments
environmentsRouter.post("/", async (req: AuthRequest, res, next) => {
  try {
    await requireMember(req.params.projectId, req.user!.id, "DEVELOPER");

    const body = z
      .object({
        name: z.string().min(1).max(64),
        filePath: z.string().min(1).max(255),
        description: z.string().max(255).optional(),
      })
      .parse(req.body);

    const env = await environmentService.create(
      req.params.projectId,
      body.name,
      body.filePath,
      body.description,
    );
    res.status(201).json({ environment: env });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/projects/:projectId/environments/:envId
environmentsRouter.delete("/:envId", async (req: AuthRequest, res, next) => {
  try {
    await requireMember(req.params.projectId, req.user!.id, "ADMIN");
    await environmentService.delete(req.params.projectId, req.params.envId);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
