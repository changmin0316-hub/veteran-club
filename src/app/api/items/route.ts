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

// 아이템 검색 (?q=, ?limit=)
export async function GET(req: NextRequest) {
  try {
    await requireManager();
  } catch (e) {
    return handleAuth(e);
  }
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const limit = Math.min(
    Number(req.nextUrl.searchParams.get("limit")) || 30,
    100
  );
  const items = await prisma.item.findMany({
    where: q ? { name: { contains: q } } : undefined,
    orderBy: { name: "asc" },
    take: limit,
  });
  return NextResponse.json({ items });
}

const createSchema = z.object({
  name: z.string().trim().min(1, "아이템 이름을 입력하세요.").max(100),
  rarity: z.string().trim().max(20).default("일반"),
  category: z.string().trim().max(20).default("무기"),
  basePrice: z.number().int().min(0).default(0),
});

// 아이템 등록
export async function POST(req: NextRequest) {
  try {
    await requireManager();
  } catch (e) {
    return handleAuth(e);
  }
  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "입력값을 확인하세요." },
      { status: 400 }
    );
  }
  const dup = await prisma.item.findUnique({ where: { name: parsed.data.name } });
  if (dup) {
    return NextResponse.json(
      { message: "이미 존재하는 아이템입니다.", item: dup },
      { status: 409 }
    );
  }
  const item = await prisma.item.create({ data: parsed.data });
  return NextResponse.json({ item }, { status: 201 });
}
