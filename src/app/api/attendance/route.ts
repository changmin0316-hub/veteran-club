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
  weekId: z.number().int().positive(),
  entries: z
    .array(
      z.object({
        memberId: z.number().int().positive(),
        categoryId: z.number().int().positive(),
        count: z.number().int().min(0),
      })
    )
    .max(5000),
});

// 출석 기록 일괄 저장(업서트)
export async function POST(req: NextRequest) {
  try {
    await requireManager();
  } catch (e) {
    return handleAuth(e);
  }
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "입력값을 확인하세요." }, { status: 400 });
  }
  const { weekId, entries } = parsed.data;

  await prisma.$transaction(
    entries.map((e) =>
      prisma.attendanceRecord.upsert({
        where: {
          weekId_memberId_categoryId: {
            weekId,
            memberId: e.memberId,
            categoryId: e.categoryId,
          },
        },
        create: {
          weekId,
          memberId: e.memberId,
          categoryId: e.categoryId,
          count: e.count,
        },
        update: { count: e.count },
      })
    )
  );

  return NextResponse.json({ message: "ok", saved: entries.length });
}
