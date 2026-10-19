import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireManager, AuthError } from "@/lib/guard";

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
  try {
    await requireManager();
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

  if (amount === 0) {
    await prisma.extraPay.deleteMany({ where: { weekId, memberId } });
    return NextResponse.json({ message: "ok", amount: 0 });
  }

  await prisma.extraPay.upsert({
    where: { weekId_memberId: { weekId, memberId } },
    create: { weekId, memberId, amount },
    update: { amount },
  });
  return NextResponse.json({ message: "ok", amount });
}
