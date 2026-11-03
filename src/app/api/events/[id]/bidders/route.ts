import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin, AuthError } from "@/lib/guard";
import { logActivity } from "@/lib/log";

export const dynamic = "force-dynamic";

function handleAuth(e: unknown) {
  if (e instanceof AuthError)
    return NextResponse.json({ message: e.message }, { status: e.status });
  throw e;
}

const addSchema = z.object({
  eventItemId: z.number().int().positive(),
  memberId: z.number().int().positive(),
});

// 관리자: 특정 아이템에 신청자(입찰)를 강제로 추가
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let me;
  try {
    me = await requireAdmin();
  } catch (e) {
    return handleAuth(e);
  }
  const { id } = await params;
  const eventId = Number(id);
  const body = await req.json().catch(() => null);
  const parsed = addSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "입력값을 확인하세요." }, { status: 400 });
  }
  const { eventItemId, memberId } = parsed.data;

  // 아이템이 이 이벤트의 것인지 검증
  const ei = await prisma.eventItem.findFirst({
    where: { id: eventItemId, eventId },
    include: { item: true },
  });
  if (!ei) {
    return NextResponse.json({ message: "아이템을 찾을 수 없습니다." }, { status: 404 });
  }
  const member = await prisma.member.findUnique({ where: { id: memberId } });
  if (!member) {
    return NextResponse.json({ message: "길드원을 찾을 수 없습니다." }, { status: 404 });
  }

  // 이미 신청돼 있으면 그대로 둠(멱등)
  await prisma.bid.upsert({
    where: { eventItemId_memberId: { eventItemId, memberId } },
    create: { eventItemId, memberId },
    update: {},
  });

  await logActivity({
    actorId: me.memberId,
    actorName: me.name,
    action: "신청자 강제 추가",
    detail: `${ei.item.name} · ${member.name}`,
    targetMemberId: memberId,
  });

  return NextResponse.json({ message: "ok" });
}

// 관리자: 특정 아이템의 신청자(입찰) 제거
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let me;
  try {
    me = await requireAdmin();
  } catch (e) {
    return handleAuth(e);
  }
  const { id } = await params;
  const eventId = Number(id);
  const eventItemId = Number(req.nextUrl.searchParams.get("eventItemId"));
  const memberId = Number(req.nextUrl.searchParams.get("memberId"));
  if (!Number.isInteger(eventItemId) || !Number.isInteger(memberId)) {
    return NextResponse.json({ message: "입력값을 확인하세요." }, { status: 400 });
  }

  const ei = await prisma.eventItem.findFirst({
    where: { id: eventItemId, eventId },
    include: { item: true },
  });
  if (!ei) {
    return NextResponse.json({ message: "아이템을 찾을 수 없습니다." }, { status: 404 });
  }

  await prisma.bid.deleteMany({ where: { eventItemId, memberId } });
  // 제거된 길드원이 낙찰자였다면 낙찰도 해제
  if (ei.winnerId === memberId) {
    await prisma.eventItem.update({
      where: { id: eventItemId },
      data: { winnerId: null },
    });
  }

  const member = await prisma.member.findUnique({ where: { id: memberId } });
  await logActivity({
    actorId: me.memberId,
    actorName: me.name,
    action: "신청자 제거",
    detail: `${ei.item.name} · ${member?.name ?? memberId}`,
    targetMemberId: memberId,
  });

  return NextResponse.json({ message: "ok" });
}
