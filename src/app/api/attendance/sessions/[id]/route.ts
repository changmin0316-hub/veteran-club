import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireManager, AuthError } from "@/lib/guard";
import { logActivity } from "@/lib/log";

export const dynamic = "force-dynamic";

function handleAuth(e: unknown) {
  if (e instanceof AuthError)
    return NextResponse.json({ message: e.message }, { status: e.status });
  throw e;
}

const patchSchema = z.object({
  memberIds: z.array(z.number().int().positive()),
});

// 세션 참석자 수정 → 누적 출석(AttendanceRecord) 재계산
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let me;
  try {
    me = await requireManager();
  } catch (e) {
    return handleAuth(e);
  }
  const { id } = await params;
  const sessionId = Number(id);
  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "입력값을 확인하세요." }, { status: 400 });
  }
  const session = await prisma.attendanceSession.findUnique({
    where: { id: sessionId },
    include: { members: true, week: true },
  });
  if (!session) {
    return NextResponse.json({ message: "세션을 찾을 수 없습니다." }, { status: 404 });
  }
  if (session.week.settled) {
    return NextResponse.json(
      { message: "분배 완료된 주차는 출석 수정이 불가합니다." },
      { status: 409 }
    );
  }

  const { weekId, categoryId, plays } = session;
  const oldIds = new Set(session.members.map((m) => m.memberId));
  const newIds = new Set(parsed.data.memberIds);
  const added = [...newIds].filter((x) => !oldIds.has(x));
  const removed = [...oldIds].filter((x) => !newIds.has(x));

  await prisma.$transaction([
    // 추가: 누적 +plays
    ...added.map((memberId) =>
      prisma.attendanceRecord.upsert({
        where: { weekId_memberId_categoryId: { weekId, memberId, categoryId } },
        create: { weekId, memberId, categoryId, count: plays },
        update: { count: { increment: plays } },
      })
    ),
    // 제거: 누적 -plays
    ...removed.map((memberId) =>
      prisma.attendanceRecord.updateMany({
        where: { weekId, memberId, categoryId },
        data: { count: { decrement: plays } },
      })
    ),
    // 세션 참석자 교체
    prisma.attendanceSessionMember.deleteMany({ where: { sessionId } }),
    ...parsed.data.memberIds.map((memberId) =>
      prisma.attendanceSessionMember.create({ data: { sessionId, memberId } })
    ),
  ]);
  // 음수 보정
  await prisma.attendanceRecord.updateMany({
    where: { weekId, categoryId, count: { lt: 0 } },
    data: { count: 0 },
  });

  await logActivity({
    actorId: me.memberId,
    actorName: me.name,
    action: "출석 세션 수정",
    detail: `세션 ${sessionId} · 추가 ${added.length} / 제거 ${removed.length}`,
  });

  return NextResponse.json({ ok: true });
}

// 세션 삭제 → 참석자 누적 -plays 후 삭제
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let me;
  try {
    me = await requireManager();
  } catch (e) {
    return handleAuth(e);
  }
  const { id } = await params;
  const sessionId = Number(id);
  const session = await prisma.attendanceSession.findUnique({
    where: { id: sessionId },
    include: { members: true, week: true },
  });
  if (!session) {
    return NextResponse.json({ message: "세션을 찾을 수 없습니다." }, { status: 404 });
  }
  if (session.week.settled) {
    return NextResponse.json(
      { message: "분배 완료된 주차는 출석 수정이 불가합니다." },
      { status: 409 }
    );
  }
  const { weekId, categoryId, plays } = session;

  await prisma.$transaction([
    ...session.members.map((m) =>
      prisma.attendanceRecord.updateMany({
        where: { weekId, memberId: m.memberId, categoryId },
        data: { count: { decrement: plays } },
      })
    ),
    prisma.attendanceSession.delete({ where: { id: sessionId } }),
  ]);
  await prisma.attendanceRecord.updateMany({
    where: { weekId, categoryId, count: { lt: 0 } },
    data: { count: 0 },
  });

  await logActivity({
    actorId: me.memberId,
    actorName: me.name,
    action: "출석 세션 삭제",
    detail: `세션 ${sessionId} (${session.members.length}명 회수)`,
  });

  return NextResponse.json({ ok: true });
}
