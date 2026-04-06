import { prisma } from './prisma';
import { getMasterKey, unwrapKey } from './crypto';
import { AppError } from '../middleware/errorHandler';

/**
 * Retrieves and decrypts the per-project AES-256-GCM key.
 * The project key is stored wrapped (encrypted) with the master key.
 */
export async function getProjectKey(projectId: string): Promise<string> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { encryptedKey: true },
  });
  if (!project) throw new AppError(404, 'Project not found', 'PROJECT_NOT_FOUND');

  let parsed: unknown;
  try {
    parsed = JSON.parse(project.encryptedKey);
  } catch {
    throw new AppError(500, 'Project key is corrupted and cannot be decrypted', 'ENCRYPTION_FAILED');
  }

  return unwrapKey(parsed as Parameters<typeof unwrapKey>[0], getMasterKey());
}
