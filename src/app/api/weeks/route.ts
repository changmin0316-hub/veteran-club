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

export async function GET() {
  try {
    await requireManager();
  } catch (e) {
    return handleAuth(e);
  }
  const weeks = await prisma.week.findMany({ orderBy: { number: "desc" } });
  return NextResponse.json({ weeks });
}

const createSchema = z.object({
  number: z.number().int().positive(),
  name: z.string().trim().max(50).optional(),
});

export async function POST(req: NextRequest) {
  try {
    await requireManager();
  } catch (e) {
    return handleAuth(e);
  }
  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "주차 번호를 확인하세요." }, { status: 400 });
  }
  const dup = await prisma.week.findUnique({
    where: { number: parsed.data.number },
  });
  if (dup) {
    return NextResponse.json({ message: "이미 있는 주차입니다." }, { status: 409 });
  }
  const week = await prisma.week.create({
    data: {
      number: parsed.data.number,
      name: parsed.data.name ?? `${parsed.data.number}주차`,
    },
  });
  return NextResponse.json({ week }, { status: 201 });
}
