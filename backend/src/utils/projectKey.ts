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
  if (!project) throw new AppError(404, 'Project not found');
  return unwrapKey(JSON.parse(project.encryptedKey), getMasterKey());
}
