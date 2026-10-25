import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireManager, AuthError } from "@/lib/guard";
import { logActivity } from "@/lib/log";

export const dynamic = "force-dynamic";

const schema = z.object({
  weekId: z.number().int().positive(),
  categoryId: z.number().int().positive(),
  memberIds: z.array(z.number().int().positive()).min(1, "참석자를 선택하세요."),
  delta: z.number().int().default(1), // 보통 +1, 취소 정정 시 -1 가능
  time: z.string().trim().max(50).optional(),
  guildId: z.number().int().positive().nullable().optional(),
});

// 출석 등록: 선택한 참석자의 (주차, 카테고리) 출석 횟수를 delta 만큼 증가
export async function POST(req: NextRequest) {
  let me;
  try {
    me = await requireManager();
  } catch (e) {
    if (e instanceof AuthError)
      return NextResponse.json({ message: e.message }, { status: e.status });
    throw e;
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "입력값을 확인하세요." },
      { status: 400 }
    );
  }
  const { weekId, categoryId, memberIds, delta, time, guildId } = parsed.data;

  const week = await prisma.week.findUnique({ where: { id: weekId } });
  if (week?.settled) {
    return NextResponse.json(
      { message: "분배 완료된 주차는 출석 입력이 불가합니다." },
      { status: 409 }
    );
  }

  await prisma.$transaction(
    memberIds.map((memberId) =>
      prisma.attendanceRecord.upsert({
        where: {
          weekId_memberId_categoryId: { weekId, memberId, categoryId },
        },
        create: {
          weekId,
          memberId,
          categoryId,
          count: Math.max(0, delta),
        },
        update: { count: { increment: delta } },
      })
    )
  );

  // 음수로 내려간 경우 0으로 보정
  await prisma.attendanceRecord.updateMany({
    where: { weekId, categoryId, count: { lt: 0 } },
    data: { count: 0 },
  });

  // 등록 세션 기록 (사후 수정용) — delta>0 일 때만 세션으로 남김
  if (delta > 0) {
    await prisma.attendanceSession.create({
      data: {
        weekId,
        guildId: guildId ?? null,
        categoryId,
        time: time ?? "",
        plays: delta,
        actorName: me.name,
        members: { create: memberIds.map((memberId) => ({ memberId })) },
      },
    });
  }

  await logActivity({
    actorId: me.memberId,
    actorName: me.name,
    action: "출석 등록",
    detail: `${memberIds.length}명 (주차 ${weekId})`,
  });

  return NextResponse.json({ message: "ok", registered: memberIds.length });
}
