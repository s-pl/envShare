/**
 * Sync Service — push/pull logic.
 *
 * Push: accepts optional environmentId to link secrets to a specific .env file.
 * Pull: returns secrets with their environment's filePath so the CLI knows
 *       where to write each variable.
 */
import { prisma } from '../utils/prisma';
import { encrypt, hashKey } from '../utils/crypto';
import { getProjectKey } from '../utils/projectKey';
import { secretsService } from './secretsService';

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
    const projectKey = await getProjectKey(projectId);

    return prisma.$transaction(async (tx) => {
      const result: PushResult = { created: [], updated: [], sharedUpdated: [] };

      for (const { key, value, isShared } of entries) {
        const kHash = hashKey(key, projectKey);

        let secret = await tx.secret.findUnique({
          where: { projectId_keyHash: { projectId, keyHash: kHash } },
        });

        const isNew = !secret;

        if (!secret) {
          const encKey = encrypt(key, projectKey);
          secret = await tx.secret.create({
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
          // Sync environmentId and isShared if they changed
          const patch: Record<string, unknown> = {};
          if (environmentId && !secret.environmentId) patch.environmentId = environmentId;
          const isSharedFlipped = secret.isShared !== isShared;
          if (isSharedFlipped) patch.isShared = isShared;
          if (Object.keys(patch).length) {
            await tx.secret.update({ where: { id: secret.id }, data: patch });
          }
          // Record isShared change in history so the UI shows a "visibility changed" entry
          if (isSharedFlipped) {
            await tx.secretVersion.create({
              data: {
                secretId: secret.id,
                userId,
                action: isShared ? 'made_shared' : 'made_personal',
                isShared,
                version: secret.version,
              },
            });
          }
          result.updated.push(key);
        }

        // All value writes use `tx` so that newly created secrets (not yet
        // committed) are visible. Calling secretsService here would use the
        // global prisma client, which cannot see uncommitted rows in this tx.
        const encVal = encrypt(value, projectKey);

        if (isShared) {
          const isFirstValue = !secret.sharedEncryptedValue;
          const newVersion = isNew ? 1 : (isFirstValue ? secret.version : secret.version + 1);

          await tx.secret.update({
            where: { id: secret.id },
            data: {
              isShared: true,
              sharedEncryptedValue: encVal.encryptedData,
              sharedValueIV: encVal.iv,
              sharedValueTag: encVal.tag,
              version: newVersion,
            },
          });

          await tx.secretVersion.create({
            data: {
              secretId: secret.id,
              userId,
              action: isNew || isFirstValue ? 'created' : 'updated',
              isShared: true,
              sharedEncryptedValue: encVal.encryptedData,
              sharedValueIV: encVal.iv,
              sharedValueTag: encVal.tag,
              version: newVersion,
            },
          });

          result.sharedUpdated.push(key);
        } else {
          await tx.userSecretValue.upsert({
            where: { secretId_userId: { secretId: secret.id, userId } },
            create: {
              secretId: secret.id,
              userId,
              encryptedValue: encVal.encryptedData,
              valueIV: encVal.iv,
              valueTag: encVal.tag,
            },
            update: {
              encryptedValue: encVal.encryptedData,
              valueIV: encVal.iv,
              valueTag: encVal.tag,
            },
          });

          if (isNew) {
            await tx.secretVersion.create({
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

      await tx.auditLog.create({
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
    });
  },

  async pull(projectId: string, userId: string, envFilter?: string) {
    const secrets = await secretsService.listForUser(projectId, userId);

    // Fetch environment filePaths for each secret
    const secretEnvMap = await prisma.secret.findMany({
      where: { projectId },
      select: { id: true, environmentId: true },
    });
    const envIdBySecretId = new Map(
      secretEnvMap.map((s: { id: string; environmentId: string | null }) => [s.id, s.environmentId]),
    );

    const environments = await prisma.environment.findMany({
      where: { projectId },
      select: { id: true, filePath: true, name: true },
    });
    const envById = new Map(
      environments.map((e: { id: string; filePath: string; name: string }) => [e.id, e]),
    );

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
