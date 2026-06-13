export type Role = "user" | "editor" | "admin";

const RANK: Record<Role, number> = { user: 0, editor: 1, admin: 2 };

export function hasRole(actual: Role, minimum: Role): boolean {
  return RANK[actual] >= RANK[minimum];
}
