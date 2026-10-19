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

const updateSchema = z.object({
  name: z.string().trim().max(50).optional(),
  excludeRatio: z.number().int().min(0).max(100).optional(),
  diamond: z.number().int().min(0).optional(),
  settled: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireManager();
  } catch (e) {
    return handleAuth(e);
  }
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "입력값을 확인하세요." },
      { status: 400 }
    );
  }
  const weekId = Number(id);
  const current = await prisma.week.findUnique({ where: { id: weekId } });
  if (!current) {
    return NextResponse.json({ message: "주차를 찾을 수 없습니다." }, { status: 404 });
  }

  const data = parsed.data;
  // 분배 완료(잠금)된 주차는 완료 해제 외의 값 수정 불가
  const editsContent =
    data.name !== undefined ||
    data.excludeRatio !== undefined ||
    data.diamond !== undefined;
  const unlocking = data.settled === false;
  if (current.settled && editsContent && !unlocking) {
    return NextResponse.json(
      { message: "분배 완료된 주차입니다. 수정하려면 먼저 완료를 취소하세요." },
      { status: 409 }
    );
  }

  const week = await prisma.week.update({
    where: { id: weekId },
    data,
  });
  return NextResponse.json({ week });
}
