/**
 * Canonical list of player roles — synced with backend/lib/roles.ts
 * Add/remove roles here and in backend, then update both AGENTS.md files.
 */
export const PLAYER_ROLES = ["Applicant", "Member", "Officer", "Admin", "Waitlisted"] as const;
export const NON_MEMBER_ROLES = ["Applicant", "Waitlisted"] as const;

export type PlayerRole = (typeof PLAYER_ROLES)[number];

export function isPlayerRole(value: unknown): value is PlayerRole {
  return typeof value === "string" && (PLAYER_ROLES as readonly string[]).includes(value);
}

export function isNonMemberRole(role: string): boolean {
  return (NON_MEMBER_ROLES as readonly string[]).includes(role);
}
