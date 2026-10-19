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

const schema = z.object({
  memberIds: z.array(z.number().int().positive()).default([]),
});

// 주차별 분배 제외 대상을 전달된 목록으로 교체
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
  const weekId = Number(id);
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "입력값을 확인하세요." }, { status: 400 });
  }

  const wk = await prisma.week.findUnique({ where: { id: weekId } });
  if (wk?.settled) {
    return NextResponse.json(
      { message: "분배 완료된 주차는 정산 입력이 불가합니다." },
      { status: 409 }
    );
  }

  await prisma.$transaction([
    prisma.settlementExclusion.deleteMany({ where: { weekId } }),
    ...parsed.data.memberIds.map((memberId) =>
      prisma.settlementExclusion.create({ data: { weekId, memberId } })
    ),
  ]);

  return NextResponse.json({ message: "ok", count: parsed.data.memberIds.length });
}
