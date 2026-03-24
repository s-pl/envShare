/**
 * Secrets Service — simplified per-user model with optional shared values.
 *
 * Secret types:
 *   isShared=false  → each developer has their own value (personal credentials)
 *   isShared=true   → single shared value visible to all (server URLs, etc.)
 */
import { prisma } from '../utils/prisma';
import { encrypt, decrypt } from '../utils/crypto';
import { AppError } from '../middleware/errorHandler';
import { getProjectKey } from '../utils/projectKey';

export interface SecretView {
  id: string;
  key: string;
  value: string;
  isShared: boolean;
  hasPersonalValue: boolean;
  comment?: string | null;
  version: number;
  updatedAt: Date;
}

export interface VersionView {
  version: number;
  action: string;
  isShared: boolean;
  actor: { email: string; name: string } | null;
  createdAt: Date;
  value: string | null;
}

export const secretsService = {
  async listForUser(projectId: string, userId: string): Promise<SecretView[]> {
    const secrets = await prisma.secret.findMany({
      where: { projectId },
      include: { userValues: { where: { userId } } },
      orderBy: { createdAt: 'asc' },
    });

    const projectKey = await getProjectKey(projectId);

    return secrets.map((s) => {
      const keyName = decrypt({ encryptedData: s.encryptedKey, iv: s.keyIV, tag: s.keyTag }, projectKey);
      const userVal = s.userValues[0];

      let value = '';
      if (s.isShared && s.sharedEncryptedValue && s.sharedValueIV && s.sharedValueTag) {
        value = decrypt({ encryptedData: s.sharedEncryptedValue, iv: s.sharedValueIV, tag: s.sharedValueTag }, projectKey);
      } else if (userVal) {
        value = decrypt({ encryptedData: userVal.encryptedValue, iv: userVal.valueIV, tag: userVal.valueTag }, projectKey);
      }

      return {
        id: s.id,
        key: keyName,
        value,
        isShared: s.isShared,
        hasPersonalValue: !!userVal,
        comment: s.comment,
        version: s.version,
        updatedAt: s.updatedAt,
      };
    });
  },

  async setPersonalValue(secretId: string, value: string, userId: string): Promise<void> {
    const secret = await prisma.secret.findUnique({
      where: { id: secretId },
      select: { projectId: true, isShared: true },
    });
    if (!secret) throw new AppError(404, 'Secret not found', 'SECRET_NOT_FOUND');
    if (secret.isShared) throw new AppError(400, 'This secret is shared — update the shared value instead', 'SECRET_IS_SHARED');

    const projectKey = await getProjectKey(secret.projectId);
    const encVal = encrypt(value, projectKey);

    await prisma.userSecretValue.upsert({
      where: { secretId_userId: { secretId, userId } },
      create: { secretId, userId, encryptedValue: encVal.encryptedData, valueIV: encVal.iv, valueTag: encVal.tag },
      update: { encryptedValue: encVal.encryptedData, valueIV: encVal.iv, valueTag: encVal.tag },
    });
  },

  async setSharedValue(secretId: string, value: string, userId?: string): Promise<void> {
    const secret = await prisma.secret.findUnique({
      where: { id: secretId },
      select: { projectId: true, isShared: true, sharedEncryptedValue: true, version: true },
    });
    if (!secret) throw new AppError(404, 'Secret not found', 'SECRET_NOT_FOUND');

    const projectKey = await getProjectKey(secret.projectId);
    const encVal = encrypt(value, projectKey);

    const isFirstValue = !secret.sharedEncryptedValue;
    const newVersion = isFirstValue ? secret.version : secret.version + 1;

    await prisma.$transaction([
      prisma.secret.update({
        where: { id: secretId },
        data: {
          isShared: true,
          sharedEncryptedValue: encVal.encryptedData,
          sharedValueIV: encVal.iv,
          sharedValueTag: encVal.tag,
          version: newVersion,
        },
      }),
      prisma.secretVersion.create({
        data: {
          secretId,
          userId: userId ?? null,
          action: isFirstValue ? 'created' : 'updated',
          isShared: true,
          sharedEncryptedValue: encVal.encryptedData,
          sharedValueIV: encVal.iv,
          sharedValueTag: encVal.tag,
          version: newVersion,
        },
      }),
    ]);
  },

  async delete(secretId: string, userId?: string): Promise<void> {
    const secret = await prisma.secret.findUnique({
      where: { id: secretId },
      select: { projectId: true, encryptedKey: true, keyIV: true, keyTag: true, version: true },
    });
    if (!secret) throw new AppError(404, 'Secret not found', 'SECRET_NOT_FOUND');

    const projectKey = await getProjectKey(secret.projectId);
    const keyName = decrypt(
      { encryptedData: secret.encryptedKey, iv: secret.keyIV, tag: secret.keyTag },
      projectKey,
    );

    // Audit log survives after the secret (and its versions) are cascade-deleted
    await prisma.auditLog.create({
      data: {
        action: 'SECRET_DELETED',
        actor: userId ?? 'unknown',
        resourceId: secretId,
        resourceType: 'secret',
        metadata: { key: keyName, projectId: secret.projectId, version: secret.version },
      },
    });

    await prisma.secret.delete({ where: { id: secretId } });
  },

  async getHistory(secretId: string, projectId: string): Promise<VersionView[]> {
    const projectKey = await getProjectKey(projectId);

    const versions = await prisma.secretVersion.findMany({
      where: { secretId },
      include: { user: { select: { email: true, name: true } } },
      orderBy: { version: 'desc' },
    });

    return versions.map((v) => {
      let value: string | null = null;
      if (v.isShared && v.sharedEncryptedValue && v.sharedValueIV && v.sharedValueTag) {
        try {
          value = decrypt(
            { encryptedData: v.sharedEncryptedValue, iv: v.sharedValueIV, tag: v.sharedValueTag },
            projectKey,
          );
        } catch {
          value = null;
        }
      }
      return {
        version: v.version,
        action: v.action,
        isShared: v.isShared,
        actor: v.user ? { email: v.user.email, name: v.user.name } : null,
        createdAt: v.createdAt,
        value,
      };
    });
  },
};
