import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireManager, AuthError } from "@/lib/guard";
import { logActivity } from "@/lib/log";

export const dynamic = "force-dynamic";

const schema = z.object({
  memberId: z.number().int().positive(),
  paid: z.boolean(),
});

// 분배금 선지급 완료 표시 토글 (주차 x 길드원)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let me;
  try {
    me = await requireManager();
  } catch (e) {
    if (e instanceof AuthError)
      return NextResponse.json({ message: e.message }, { status: e.status });
    throw e;
  }
  const { id } = await params;
  const weekId = Number(id);
  if (!Number.isInteger(weekId)) {
    return NextResponse.json({ message: "잘못된 요청입니다." }, { status: 400 });
  }
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "입력값을 확인하세요." }, { status: 400 });
  }
  const { memberId, paid } = parsed.data;

  if (paid) {
    await prisma.settlementPaid.upsert({
      where: { weekId_memberId: { weekId, memberId } },
      create: { weekId, memberId },
      update: {},
    });
  } else {
    await prisma.settlementPaid.deleteMany({ where: { weekId, memberId } });
  }
  const tm = await prisma.member.findUnique({ where: { id: memberId }, select: { name: true } });
  await logActivity({
    actorId: me.memberId,
    actorName: me.name,
    action: paid ? "지급 완료 표시" : "지급 완료 해제",
    detail: `주차 ${weekId} · ${tm?.name ?? memberId}`,
    targetMemberId: memberId,
  });
  return NextResponse.json({ ok: true, paid });
}
