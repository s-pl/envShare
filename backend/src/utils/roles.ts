export const ROLES = ['VIEWER', 'DEVELOPER', 'ADMIN'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_WEIGHT: Record<Role, number> = {
  VIEWER: 0,
  DEVELOPER: 1,
  ADMIN: 2,
};

export function hasMinRole(actual: string, required: Role): boolean {
  return (ROLE_WEIGHT[actual as Role] ?? -1) >= ROLE_WEIGHT[required];
}
