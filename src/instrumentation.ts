// Next.js 서버 시작 훅. 자체 호스팅(long-running) 서버에서 외부 의존성 없이
// 매월 1일 0시(Asia/Seoul)에 스탯 스냅샷을 기록한다. 30분마다 KST 날짜를 확인해
// 매월 1일 첫 틱에 한 번 force 스냅샷을 남긴다(월 1회).
// 서버리스(Vercel 등)에서는 상주 프로세스가 없으므로 vercel.json 크론 또는
// 외부 crontab 이 /api/cron/snapshot 을 호출하도록 한다.

declare global {
  // eslint-disable-next-line no-var
  var __vcSnapshotTimer: NodeJS.Timeout | undefined;
  // eslint-disable-next-line no-var
  var __vcLastSnapshotYm: string | undefined;
}

const CHECK_INTERVAL_MS = 30 * 60 * 1000; // 30분

// 현재 시각을 KST(UTC+9) 벽시계로 본 {ym, day}
function kstNow(): { ym: string; day: number } {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, "0");
  return { ym: `${y}-${m}`, day: kst.getUTCDate() };
}

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.DISABLE_INPROCESS_CRON === "true") return;
  if (global.__vcSnapshotTimer) return;

  const { recordMonthlySnapshot } = await import("@/lib/stats");

  const tick = async () => {
    try {
      const { ym, day } = kstNow();
      if (day === 1 && global.__vcLastSnapshotYm !== ym) {
        const n = await recordMonthlySnapshot(true);
        global.__vcLastSnapshotYm = ym;
        console.log(`[cron] ${ym} 월별 스탯 스냅샷 기록 완료: ${n}명`);
      }
    } catch (e) {
      console.error("[cron] 스냅샷 확인/기록 실패", e);
    }
  };

  global.__vcSnapshotTimer = setInterval(tick, CHECK_INTERVAL_MS);
  // unref: 크론 타이머가 프로세스 종료를 막지 않도록
  global.__vcSnapshotTimer.unref?.();
  void tick(); // 시작 시 1회 즉시 확인

  console.log(
    "[cron] 월별 스탯 스냅샷 스케줄러 등록됨 (매월 1일 00:00 KST, 30분 간격 확인)"
  );
}
