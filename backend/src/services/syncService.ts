/**
 * Sync Service — push/pull logic.
 *
 * Push behavior:
 *   - New key (not seen before)     → creates Secret + initial SecretVersion
 *   - isShared=true                 → updates shared value for everyone, records version
 *   - isShared=false                → updates only the pusher's personal value
 *
 * Pull behavior:
 *   - For each secret: return shared value OR user's personal value
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
  async push(projectId: string, entries: PushEntry[], userId: string): Promise<PushResult> {
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
            comment: isShared ? '🌐 Shared value' : undefined,
            version: 1,
          },
        });
        result.created.push(key);
      } else {
        result.updated.push(key);
      }

      if (isShared) {
        // setSharedValue handles versioning internally
        await secretsService.setSharedValue(secret.id, value, userId);
        result.sharedUpdated.push(key);
      } else {
        await secretsService.setPersonalValue(secret.id, value, userId);

        // Record initial version for new personal secrets
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
        },
      },
    });

    return result;
  },

  async pull(projectId: string, userId: string) {
    return secretsService.listForUser(projectId, userId);
  },
};
