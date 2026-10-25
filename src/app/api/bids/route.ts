import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, AuthError } from "@/lib/guard";

export const dynamic = "force-dynamic";

function handleAuth(e: unknown) {
  if (e instanceof AuthError)
    return NextResponse.json({ message: e.message }, { status: e.status });
  throw e;
}

// 현재 사용자의 특정 이벤트 신청 현황
export async function GET(req: NextRequest) {
  let me;
  try {
    me = await requireUser();
  } catch (e) {
    return handleAuth(e);
  }
  const eventId = Number(req.nextUrl.searchParams.get("eventId"));
  if (!Number.isInteger(eventId)) {
    return NextResponse.json({ message: "이벤트를 지정하세요." }, { status: 400 });
  }
  const bids = await prisma.bid.findMany({
    where: { memberId: me.memberId, eventItem: { eventId } },
    select: { eventItemId: true },
  });
  return NextResponse.json({ eventItemIds: bids.map((b) => b.eventItemId) });
}

const schema = z.object({
  eventId: z.number().int().positive(),
  eventItemIds: z.array(z.number().int().positive()).default([]),
});

// 신청 동기화: 선택한 아이템 집합으로 내 신청을 맞춤
export async function POST(req: NextRequest) {
  let me;
  try {
    me = await requireUser();
  } catch (e) {
    return handleAuth(e);
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "입력값을 확인하세요." }, { status: 400 });
  }
  const { eventId, eventItemIds } = parsed.data;

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) {
    return NextResponse.json({ message: "이벤트를 찾을 수 없습니다." }, { status: 404 });
  }
  if (!event.active) {
    return NextResponse.json(
      { message: "종료된 이벤트에는 신청할 수 없습니다." },
      { status: 400 }
    );
  }

  // 요청된 아이템이 이 이벤트의 것인지 검증
  const valid = await prisma.eventItem.findMany({
    where: { eventId, id: { in: eventItemIds } },
    select: { id: true },
  });
  const validIds = new Set(valid.map((v) => v.id));
  const targetIds = eventItemIds.filter((id) => validIds.has(id));

  // 군 전용 이벤트: 해당 군 길드원만 신규 신청 가능 (취소/비우기는 허용)
  if (event.guildId && targetIds.length > 0) {
    const m = await prisma.member.findUnique({
      where: { id: me.memberId },
      select: { guildId: true },
    });
    if (m?.guildId !== event.guildId) {
      return NextResponse.json(
        { message: "해당 군 소속 길드원만 신청할 수 있는 이벤트입니다." },
        { status: 403 }
      );
    }
  }

  // 출석 연동 이벤트: 해당 주차에 출석(1회 이상)한 길드원만 신규 입찰 가능.
  // (신청 취소/비우기는 자격과 무관하게 허용)
  if (event.weekId && targetIds.length > 0) {
    const attended = await prisma.attendanceRecord.findFirst({
      where: { weekId: event.weekId, memberId: me.memberId, count: { gt: 0 } },
      select: { id: true },
    });
    if (!attended) {
      return NextResponse.json(
        {
          message:
            "이 이벤트는 출석 연동 이벤트입니다. 해당 주차 출석 기록이 있어야 신청할 수 있습니다.",
        },
        { status: 403 }
      );
    }
  }

  const current = await prisma.bid.findMany({
    where: { memberId: me.memberId, eventItem: { eventId } },
    select: { id: true, eventItemId: true },
  });
  const currentIds = new Set(current.map((c) => c.eventItemId));

  const toAdd = targetIds.filter((id) => !currentIds.has(id));
  const toRemove = current
    .filter((c) => !targetIds.includes(c.eventItemId))
    .map((c) => c.id);

  await prisma.$transaction([
    ...(toRemove.length
      ? [prisma.bid.deleteMany({ where: { id: { in: toRemove } } })]
      : []),
    ...toAdd.map((eventItemId) =>
      prisma.bid.create({
        data: { memberId: me.memberId, eventItemId },
      })
    ),
  ]);

  return NextResponse.json({
    message: "ok",
    applied: targetIds,
    added: toAdd.length,
    removed: toRemove.length,
  });
}
