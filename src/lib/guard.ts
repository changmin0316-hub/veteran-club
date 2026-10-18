import { getCurrentUser, type Role } from "@/lib/session";

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const RANK: Record<Role, number> = { MEMBER: 0, COMMANDER: 1, ADMIN: 2 };

/** 로그인 필수. 미로그인 시 401. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("로그인이 필요합니다.", 401);
  return user;
}

/** 관리 권한(사단장 이상) 필수. */
export async function requireManager() {
  const user = await requireUser();
  if (RANK[user.role] < RANK["COMMANDER"]) {
    throw new AuthError("권한이 없습니다.", 403);
  }
  return user;
}

/** 원장(ADMIN) 전용. */
export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new AuthError("원장 권한이 필요합니다.", 403);
  return user;
}

export function rank(role: Role) {
  return RANK[role];
}
