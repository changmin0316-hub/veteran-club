import { NextRequest, NextResponse } from "next/server";
import { recordMonthlySnapshot } from "@/lib/stats";

export const dynamic = "force-dynamic";

// 외부 스케줄러(Vercel Cron, 시스템 crontab 등)가 호출하는 스냅샷 엔드포인트.
// 인증: Authorization: Bearer <CRON_SECRET>  또는  ?key=<CRON_SECRET>
// Vercel Cron 은 CRON_SECRET 설정 시 Bearer 헤더를 자동으로 보낸다.
async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { message: "CRON_SECRET 이 설정되지 않았습니다." },
      { status: 500 }
    );
  }

  const auth = req.headers.get("authorization");
  const key = req.nextUrl.searchParams.get("key");
  const ok = auth === `Bearer ${secret}` || key === secret;
  if (!ok) {
    return NextResponse.json({ message: "인증 실패" }, { status: 401 });
  }

  const count = await recordMonthlySnapshot(true);
  return NextResponse.json({ message: "ok", snapshot: count, at: new Date().toISOString() });
}

export const GET = handle;
export const POST = handle;
