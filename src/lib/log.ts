import { prisma } from "@/lib/db";

// 활동 로그 기록 (실패해도 본 작업에 영향 없도록 try/catch)
export async function logActivity(a: {
  actorId?: number | null;
  actorName: string;
  action: string;
  detail?: string;
  targetMemberId?: number | null;
}) {
  try {
    await prisma.activityLog.create({
      data: {
        actorId: a.actorId ?? null,
        actorName: a.actorName,
        action: a.action,
        detail: a.detail ?? "",
        targetMemberId: a.targetMemberId ?? null,
      },
    });
  } catch {
    // 로깅 실패는 무시
  }
}
