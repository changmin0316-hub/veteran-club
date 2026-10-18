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
  name: z.string().trim().min(1).max(100).optional(),
  rarity: z.string().trim().max(20).optional(),
  category: z.string().trim().max(20).optional(),
  basePrice: z.number().int().min(0).optional(),
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
  try {
    const item = await prisma.item.update({
      where: { id: Number(id) },
      data: parsed.data,
    });
    return NextResponse.json({ item });
  } catch {
    return NextResponse.json(
      { message: "이미 같은 이름의 아이템이 있을 수 있습니다." },
      { status: 409 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireManager();
  } catch (e) {
    return handleAuth(e);
  }
  const { id } = await params;
  await prisma.item.delete({ where: { id: Number(id) } });
  return NextResponse.json({ message: "ok" });
}
