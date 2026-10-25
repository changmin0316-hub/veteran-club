import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireManager, AuthError } from "@/lib/guard";
import { logActivity } from "@/lib/log";

export const dynamic = "force-dynamic";

const schema = z.object({
  memberId: z.number().int().positive(),
  amount: z.number().int().min(0),
});

// 주차별 특정 길드원 추가 분배금 설정(0이면 해제)
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
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "입력값을 확인하세요." }, { status: 400 });
  }
  const { memberId, amount } = parsed.data;

  const wk = await prisma.week.findUnique({ where: { id: weekId } });
  if (wk?.settled) {
    return NextResponse.json(
      { message: "분배 완료된 주차는 정산 입력이 불가합니다." },
      { status: 409 }
    );
  }

  if (amount === 0) {
    await prisma.extraPay.deleteMany({ where: { weekId, memberId } });
    await logActivity({
      actorId: me.memberId,
      actorName: me.name,
      action: "추가 분배금",
      detail: `주차 ${weekId} · 해제`,
      targetMemberId: memberId,
    });
    return NextResponse.json({ message: "ok", amount: 0 });
  }

  await prisma.extraPay.upsert({
    where: { weekId_memberId: { weekId, memberId } },
    create: { weekId, memberId, amount },
    update: { amount },
  });
  await logActivity({
    actorId: me.memberId,
    actorName: me.name,
    action: "추가 분배금",
    detail: `주차 ${weekId} · ${amount.toLocaleString()}원`,
    targetMemberId: memberId,
  });
  return NextResponse.json({ message: "ok", amount });
}
