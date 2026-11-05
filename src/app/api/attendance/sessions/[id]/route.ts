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
  categoryId: z.number().int().positive().optional(), // 카테고리 변경(선택)
});

// 세션 참석자/카테고리 수정 → 누적 출석(AttendanceRecord) 재계산.
// 기존 세션 기여분(옛 카테고리/옛 참석자)을 빼고 새 세션 기여분(새 카테고리/새 참석자)을 더한다.
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

  const { weekId, plays } = session;
  const oldCategoryId = session.categoryId;
  const newCategoryId = parsed.data.categoryId ?? oldCategoryId;

  if (newCategoryId !== oldCategoryId) {
    const cat = await prisma.attendanceCategory.findUnique({
      where: { id: newCategoryId },
    });
    if (!cat) {
      return NextResponse.json({ message: "카테고리를 찾을 수 없습니다." }, { status: 404 });
    }
  }

  const oldMembers = session.members.map((m) => m.memberId);
  const newMembers = parsed.data.memberIds;

  await prisma.$transaction([
    // 기존 기여분 제거: 옛 참석자 × 옛 카테고리 -plays
    ...oldMembers.map((memberId) =>
      prisma.attendanceRecord.updateMany({
        where: { weekId, memberId, categoryId: oldCategoryId },
        data: { count: { decrement: plays } },
      })
    ),
    // 새 기여분 추가: 새 참석자 × 새 카테고리 +plays
    ...newMembers.map((memberId) =>
      prisma.attendanceRecord.upsert({
        where: { weekId_memberId_categoryId: { weekId, memberId, categoryId: newCategoryId } },
        create: { weekId, memberId, categoryId: newCategoryId, count: plays },
        update: { count: { increment: plays } },
      })
    ),
    // 세션 자체 갱신(카테고리 + 참석자)
    prisma.attendanceSession.update({
      where: { id: sessionId },
      data: { categoryId: newCategoryId },
    }),
    prisma.attendanceSessionMember.deleteMany({ where: { sessionId } }),
    ...newMembers.map((memberId) =>
      prisma.attendanceSessionMember.create({ data: { sessionId, memberId } })
    ),
  ]);

  // 음수 보정(옛/새 카테고리 모두)
  await prisma.attendanceRecord.updateMany({
    where: { weekId, categoryId: { in: [oldCategoryId, newCategoryId] }, count: { lt: 0 } },
    data: { count: 0 },
  });

  const catChanged = newCategoryId !== oldCategoryId;
  const added = newMembers.filter((x) => !oldMembers.includes(x)).length;
  const removed = oldMembers.filter((x) => !newMembers.includes(x)).length;
  await logActivity({
    actorId: me.memberId,
    actorName: me.name,
    action: "출석 세션 수정",
    detail: `세션 ${sessionId} · 추가 ${added} / 제거 ${removed}${catChanged ? ` · 카테고리 변경` : ""}`,
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
