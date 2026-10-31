import { NextRequest, NextResponse } from "next/server";
import { recordMonthlySnapshot } from "@/lib/stats";

export const dynamic = "force-dynamic";

// 외부 스케줄러(Vercel Cron, 시스템 crontab 등)가 호출하는 스냅샷 엔드포인트.
// 인증: Authorization: Bearer <CRON_SECRET>  또는  ?key=<CRON_SECRET>
// Vercel Cron 은 CRON_SECRET 설정 시 Bearer 헤더를 자동으로 보낸다.
//
// 스케줄은 매일 15:00 UTC(= KST 0시)에 호출된다. 월별 기준선은 "매월 1일 0시(KST)"에만
// 남겨야 하므로, KST 날짜가 1일이 아니면 건너뛴다(?force=1 이면 즉시 기록, 관리자 수동용).
function kstDay(): number {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return kst.getUTCDate();
}

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

  // KST 1일 0시에만 기록(?force=1 이면 날짜 무관하게 즉시 기록)
  const force = req.nextUrl.searchParams.get("force") === "1";
  if (!force && kstDay() !== 1) {
    return NextResponse.json({ message: "skipped", reason: "KST 1일이 아님", at: new Date().toISOString() });
  }

  const count = await recordMonthlySnapshot(true);
  return NextResponse.json({ message: "ok", snapshot: count, at: new Date().toISOString() });
}

export const GET = handle;
export const POST = handle;
