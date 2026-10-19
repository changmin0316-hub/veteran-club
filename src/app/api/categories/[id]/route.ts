import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireManager, requireAdmin, AuthError } from "@/lib/guard";

export const dynamic = "force-dynamic";

function handleAuth(e: unknown) {
  if (e instanceof AuthError)
    return NextResponse.json({ message: e.message }, { status: e.status });
  throw e;
}

const schema = z.object({
  name: z.string().trim().min(1).max(50).optional(),
  weight: z.number().int().min(0).optional(),
  sortOrder: z.number().int().min(0).optional(),
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
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "입력값을 확인하세요." }, { status: 400 });
  }
  const category = await prisma.attendanceCategory.update({
    where: { id: Number(id) },
    data: parsed.data,
  });
  return NextResponse.json({ category });
}

// 삭제는 관리자(ADMIN) 전용 (관련 출석 기록도 함께 삭제됨)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
  } catch (e) {
    return handleAuth(e);
  }
  const { id } = await params;
  await prisma.attendanceCategory.delete({ where: { id: Number(id) } });
  return NextResponse.json({ message: "ok" });
}
