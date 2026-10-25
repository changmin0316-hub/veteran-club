import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin, AuthError } from "@/lib/guard";
import { logActivity } from "@/lib/log";

export const dynamic = "force-dynamic";

const schema = z.object({
  eventItemId: z.number().int().positive(),
  winnerId: z.number().int().positive().nullable(),
});

// 아이템 낙찰자 지정/해제
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let me;
  try {
    me = await requireAdmin();
  } catch (e) {
    if (e instanceof AuthError)
      return NextResponse.json({ message: e.message }, { status: e.status });
    throw e;
  }

  const { id } = await params;
  const eventId = Number(id);
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "입력값을 확인하세요." }, { status: 400 });
  }

  const ei = await prisma.eventItem.findFirst({
    where: { id: parsed.data.eventItemId, eventId },
  });
  if (!ei) {
    return NextResponse.json({ message: "대상을 찾을 수 없습니다." }, { status: 404 });
  }

  // 낙찰자는 해당 아이템 신청자 중에서만 지정 가능 (해제는 null)
  if (parsed.data.winnerId !== null) {
    const bid = await prisma.bid.findFirst({
      where: { eventItemId: ei.id, memberId: parsed.data.winnerId },
    });
    if (!bid) {
      return NextResponse.json(
        { message: "신청자 중에서만 낙찰자를 지정할 수 있습니다." },
        { status: 400 }
      );
    }
  }

  await prisma.eventItem.update({
    where: { id: ei.id },
    data: { winnerId: parsed.data.winnerId },
  });

  const item = await prisma.item.findUnique({ where: { id: ei.itemId }, select: { name: true } });
  const winner = parsed.data.winnerId
    ? await prisma.member.findUnique({ where: { id: parsed.data.winnerId }, select: { name: true } })
    : null;
  await logActivity({
    actorId: me.memberId,
    actorName: me.name,
    action: parsed.data.winnerId ? "낙찰 지정" : "낙찰 취소",
    detail: `${item?.name ?? "아이템"}${winner ? ` → ${winner.name}` : ""}`,
    targetMemberId: parsed.data.winnerId ?? null,
  });

  return NextResponse.json({ message: "ok", winnerId: parsed.data.winnerId });
}
