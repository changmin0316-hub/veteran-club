import { requireManagerPage } from "@/lib/page-guard";

export const dynamic = "force-dynamic";

export default async function MatchingPage() {
  await requireManagerPage();
  return (
    <section>
      <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-700">
        레이븐2 한국 리전 어비스 2~5층 주단위 매칭 보드입니다. (층별 매칭 · 아군 브리핑 · 길드별 일정 · 로테이션 분석)
      </div>
      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
        <iframe
          src="/matching-board.html"
          title="어비스 2~5층 매칭 보드"
          className="h-[80vh] w-full border-0"
        />
      </div>
    </section>
  );
}
