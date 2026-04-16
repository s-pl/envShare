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
import { environmentService } from './environmentService';

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

    // Every secret must belong to an environment. If none was provided, resolve
    // (or create) the default production environment for this project.
    const resolvedEnvId = environmentId
      ?? await environmentService.getOrCreate(projectId, 'production', '.env');

    return prisma.$transaction(async (tx) => {
      const result: PushResult = { created: [], updated: [], sharedUpdated: [] };

      const prepared = entries.map(e => ({ ...e, kHash: hashKey(e.key, projectKey) }));

      const existingSecrets = await tx.secret.findMany({
        where: {
          projectId,
          environmentId: resolvedEnvId,
          keyHash: { in: prepared.map(p => p.kHash) },
        },
      });
      const byHash = new Map(existingSecrets.map(s => [s.keyHash, s]));

      for (const { key, value, isShared, kHash } of prepared) {
        let secret = byHash.get(kHash) ?? null;

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
              environmentId: resolvedEnvId,
              comment: isShared ? '🌐 Shared value' : undefined,
              version: 1,
            },
          });
          byHash.set(kHash, secret);
          result.created.push(key);
        } else {
          // Only sync isShared changes — environmentId is now part of the key,
          // so it never needs patching here.
          const patch: Record<string, unknown> = {};
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
    const [secrets, environments] = await Promise.all([
      secretsService.listForUser(projectId, userId),
      prisma.environment.findMany({
        where: { projectId },
        select: { id: true, filePath: true, name: true },
      }),
    ]);

    const envById = new Map(
      environments.map((e: { id: string; filePath: string; name: string }) => [e.id, e]),
    );

    const result = secrets.map(s => {
      const env = envById.get(s.environmentId);
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
