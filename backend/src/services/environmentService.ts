import { prisma } from "../utils/prisma";
import { AppError } from "../middleware/errorHandler";

export interface EnvironmentView {
  id:          string;
  name:        string;
  filePath:    string;
  description: string | null;
  secretCount: number;
  createdAt:   Date;
  updatedAt:   Date;
}

export const environmentService = {

  async list(projectId: string): Promise<EnvironmentView[]> {
    const envs = await prisma.environment.findMany({
      where: { projectId },
      include: { _count: { select: { secrets: true } } },
      orderBy: { createdAt: "asc" },
    });

    return envs.map((e) => ({
      id:          e.id,
      name:        e.name,
      filePath:    e.filePath,
      description: e.description,
      secretCount: e._count.secrets,
      createdAt:   e.createdAt,
      updatedAt:   e.updatedAt,
    }));
  },

  async create(
    projectId: string,
    name:      string,
    filePath:  string,
    description?: string,
  ): Promise<EnvironmentView> {
    // Normalise: strip leading slash, trim whitespace
    const normPath = filePath.trim().replace(/^\/+/, "");
    const normName = name.trim();

    if (!normName)     throw new AppError(400, "Environment name is required",      "VALIDATION_ERROR");
    if (!normPath)     throw new AppError(400, "File path is required",              "VALIDATION_ERROR");
    if (normName.length > 64)
      throw new AppError(400, "Environment name must be 64 characters or fewer",   "VALIDATION_ERROR");

    const env = await prisma.environment.create({
      data: {
        projectId,
        name:        normName,
        filePath:    normPath,
        description: description?.trim() || null,
      },
      include: { _count: { select: { secrets: true } } },
    });

    return {
      id:          env.id,
      name:        env.name,
      filePath:    env.filePath,
      description: env.description,
      secretCount: env._count.secrets,
      createdAt:   env.createdAt,
      updatedAt:   env.updatedAt,
    };
  },

  async getOrCreate(
    projectId: string,
    name:      string,
    filePath:  string,
  ): Promise<string> {
    const normPath = filePath.trim().replace(/^\/+/, "") || ".env";
    const normName = name.trim() || "production";

    // Look up by name first, then fall back to filePath.
    // A project starts with a "production" environment at ".env", so pushing
    // ".env" without an explicit --env should reuse it rather than create a
    // duplicate that would violate @@unique([projectId, filePath]).
    const existing = await prisma.environment.findFirst({
      where: {
        projectId,
        OR: [
          { name: normName },
          { filePath: normPath },
        ],
      },
      select: { id: true },
    });

    if (existing) return existing.id;

    // Neither name nor filePath exists — create it. Handle the unlikely race
    // condition (two concurrent requests both miss the findFirst) gracefully.
    try {
      const created = await prisma.environment.create({
        data: { projectId, name: normName, filePath: normPath },
        select: { id: true },
      });
      return created.id;
    } catch (err: any) {
      if (err?.code === 'P2002') {
        // Lost the race — fetch whichever row won
        const winner = await prisma.environment.findFirst({
          where: { projectId, OR: [{ name: normName }, { filePath: normPath }] },
          select: { id: true },
        });
        if (winner) return winner.id;
      }
      throw err;
    }
  },

  async delete(projectId: string, environmentId: string): Promise<void> {
    const env = await prisma.environment.findUnique({
      where: { id: environmentId },
      select: { id: true, projectId: true, name: true },
    });

    if (!env || env.projectId !== projectId) {
      throw new AppError(404, "Environment not found", "NOT_FOUND");
    }

    // Prevent deleting the last environment in a project
    const count = await prisma.environment.count({ where: { projectId } });
    if (count <= 1) {
      throw new AppError(
        400,
        "Cannot delete the last environment. A project must have at least one.",
        "CONFLICT",
      );
    }

    await prisma.environment.delete({ where: { id: environmentId } });
  },
};
