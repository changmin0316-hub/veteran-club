import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin, AuthError } from "@/lib/guard";
import { logActivity } from "@/lib/log";

export const dynamic = "force-dynamic";

const schema = z.object({ weekId: z.number().int().positive() });

// 주차별 출석 기록 전체 삭제 (관리자 전용, 되돌릴 수 없음)
export async function POST(req: NextRequest) {
  let me;
  try {
    me = await requireAdmin();
  } catch (e) {
    if (e instanceof AuthError)
      return NextResponse.json({ message: e.message }, { status: e.status });
    throw e;
  }
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "주차를 지정하세요." }, { status: 400 });
  }
  const week = await prisma.week.findUnique({ where: { id: parsed.data.weekId } });
  if (week?.settled) {
    return NextResponse.json(
      { message: "분배 완료된 주차는 출석 입력이 불가합니다." },
      { status: 409 }
    );
  }
  const r = await prisma.attendanceRecord.deleteMany({
    where: { weekId: parsed.data.weekId },
  });
  await logActivity({
    actorId: me.memberId,
    actorName: me.name,
    action: "출석 초기화",
    detail: `주차 ${parsed.data.weekId} · ${r.count}건 삭제`,
  });
  return NextResponse.json({ message: "ok", deleted: r.count });
}
