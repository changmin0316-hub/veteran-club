import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireManager, AuthError } from "@/lib/guard";

export const dynamic = "force-dynamic";

function handleAuth(e: unknown) {
  if (e instanceof AuthError)
    return NextResponse.json({ message: e.message }, { status: e.status });
  throw e;
}

// 이벤트에 등록된 입찰 아이템 목록
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireManager();
  } catch (e) {
    return handleAuth(e);
  }
  const { id } = await params;
  const items = await prisma.eventItem.findMany({
    where: { eventId: Number(id) },
    include: { item: true, _count: { select: { bids: true } } },
    orderBy: { id: "asc" },
  });
  return NextResponse.json({ items });
}

const addSchema = z.object({ itemId: z.number().int().positive() });

// 이벤트에 아이템 추가
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireManager();
  } catch (e) {
    return handleAuth(e);
  }
  const { id } = await params;
  const eventId = Number(id);
  const body = await req.json().catch(() => null);
  const parsed = addSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "아이템을 선택하세요." }, { status: 400 });
  }
  // 같은 아이템을 여러 개 중복 등록 허용 (중복 체크 없음)
  const eventItem = await prisma.eventItem.create({
    data: { eventId, itemId: parsed.data.itemId },
    include: { item: true, _count: { select: { bids: true } } },
  });
  return NextResponse.json({ eventItem }, { status: 201 });
}

// 이벤트에서 아이템 제거 (?eventItemId=)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireManager();
  } catch (e) {
    return handleAuth(e);
  }
  const { id } = await params;
  const eventItemId = Number(req.nextUrl.searchParams.get("eventItemId"));
  if (!Number.isInteger(eventItemId)) {
    return NextResponse.json({ message: "잘못된 대상입니다." }, { status: 400 });
  }
  await prisma.eventItem.delete({
    where: { id: eventItemId, eventId: Number(id) },
  });
  return NextResponse.json({ message: "ok" });
}
