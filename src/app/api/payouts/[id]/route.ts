import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireManager, AuthError } from "@/lib/guard";

export const dynamic = "force-dynamic";

function handleAuth(e: unknown) {
  if (e instanceof AuthError)
    return NextResponse.json({ message: e.message }, { status: e.status });
  throw e;
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
  const payoutId = Number(id);
  if (!Number.isInteger(payoutId)) {
    return NextResponse.json({ message: "잘못된 요청입니다." }, { status: 400 });
  }
  await prisma.payout.deleteMany({ where: { id: payoutId } });
  return NextResponse.json({ ok: true });
}
