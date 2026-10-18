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
  const guilds = await prisma.guild.findMany({ orderBy: { order: "asc" } });
  return NextResponse.json({ guilds });
}

const schema = z.object({
  order: z.number().int().positive(),
  name: z.string().trim().min(1, "길드명을 입력하세요.").max(50),
});

export async function POST(req: NextRequest) {
  try {
    await requireManager();
  } catch (e) {
    return handleAuth(e);
  }
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "입력값을 확인하세요." },
      { status: 400 }
    );
  }
  const dup = await prisma.guild.findUnique({ where: { order: parsed.data.order } });
  if (dup) {
    return NextResponse.json({ message: "이미 있는 군 번호입니다." }, { status: 409 });
  }
  const guild = await prisma.guild.create({ data: parsed.data });
  return NextResponse.json({ guild }, { status: 201 });
}
