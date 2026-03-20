/**
 * Sync Service — push/pull logic.
 *
 * Push: accepts optional environmentId to link secrets to a specific .env file.
 * Pull: returns secrets with their environment's filePath so the CLI knows
 *       where to write each variable.
 */
import { prisma } from '../utils/prisma';
import { encrypt, getMasterKey, unwrapKey, hashKey } from '../utils/crypto';
import { AppError } from '../middleware/errorHandler';
import { secretsService } from './secretsService';

async function getProjectKey(projectId: string): Promise<string> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { encryptedKey: true },
  });
  if (!project) throw new AppError(404, 'Project not found');
  return unwrapKey(JSON.parse(project.encryptedKey), getMasterKey());
}

export interface PushEntry {
  key: string;
  value: string;
  isShared: boolean;
}

export interface PushResult {
  created: string[];
  updated: string[];
  sharedUpdated: string[];
}

export const syncService = {
  async push(
    projectId: string,
    entries: PushEntry[],
    userId: string,
    environmentId?: string,
  ): Promise<PushResult> {
    const result: PushResult = { created: [], updated: [], sharedUpdated: [] };
    const projectKey = await getProjectKey(projectId);

    for (const { key, value, isShared } of entries) {
      const kHash = hashKey(key, projectKey);

      let secret = await prisma.secret.findUnique({
        where: { projectId_keyHash: { projectId, keyHash: kHash } },
      });

      const isNew = !secret;

      if (!secret) {
        const encKey = encrypt(key, projectKey);
        secret = await prisma.secret.create({
          data: {
            projectId,
            keyHash: kHash,
            encryptedKey: encKey.encryptedData,
            keyIV: encKey.iv,
            keyTag: encKey.tag,
            isShared,
            environmentId: environmentId ?? null,
            comment: isShared ? '🌐 Shared value' : undefined,
            version: 1,
          },
        });
        result.created.push(key);
      } else {
        // Update environmentId if newly provided
        if (environmentId && !secret.environmentId) {
          await prisma.secret.update({
            where: { id: secret.id },
            data: { environmentId },
          });
        }
        result.updated.push(key);
      }

      if (isShared) {
        await secretsService.setSharedValue(secret.id, value, userId);
        result.sharedUpdated.push(key);
      } else {
        await secretsService.setPersonalValue(secret.id, value, userId);

        if (isNew) {
          await prisma.secretVersion.create({
            data: {
              secretId: secret.id,
              userId,
              action: 'created',
              isShared: false,
              version: 1,
            },
          });
        }
      }
    }

    await prisma.auditLog.create({
      data: {
        action: 'SECRETS_PUSHED',
        actor: userId,
        resourceId: projectId,
        resourceType: 'project',
        metadata: {
          created: result.created.length,
          updated: result.updated.length,
          sharedUpdated: result.sharedUpdated.length,
          environmentId: environmentId ?? null,
        },
      },
    });

    return result;
  },

  async pull(projectId: string, userId: string, envFilter?: string) {
    const secrets = await secretsService.listForUser(projectId, userId);

    // Fetch environment filePaths for each secret
    const secretEnvMap = await prisma.secret.findMany({
      where: { projectId },
      select: { id: true, environmentId: true },
    });
    const envIdBySecretId = new Map(secretEnvMap.map(s => [s.id, s.environmentId]));

    const environments = await prisma.environment.findMany({
      where: { projectId },
      select: { id: true, filePath: true, name: true },
    });
    const envById = new Map(environments.map(e => [e.id, e]));

    const result = secrets.map(s => {
      const envId = envIdBySecretId.get(s.id);
      const env = envId ? envById.get(envId) : null;
      return {
        ...s,
        filePath: env?.filePath ?? '.env',
        environmentName: env?.name ?? 'production',
      };
    });

    if (envFilter) {
      return result.filter(s => s.environmentName === envFilter);
    }
    return result;
  },
};
