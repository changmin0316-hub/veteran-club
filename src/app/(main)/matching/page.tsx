import { prisma } from "@/lib/db";
import { requireUserPage } from "@/lib/page-guard";
import MatchingClient, { type MatchGuildRow } from "./MatchingClient";

export const dynamic = "force-dynamic";

export default async function MatchingPage() {
  const me = await requireUserPage();
  const isManager = me.role === "ADMIN" || me.role === "COMMANDER";

  const guilds = await prisma.matchGuild.findMany({
    orderBy: [{ server: "asc" }, { grade: "desc" }, { name: "asc" }],
  });
  const rows: MatchGuildRow[] = guilds.map((g) => ({
    id: g.id,
    server: g.server,
    faction: g.faction,
    name: g.name,
    side: g.side as MatchGuildRow["side"],
    grade: g.grade,
  }));

  return (
    <section className="grid gap-5">
      {/* 주단위 매칭 보드 (분석) */}
      <div>
        <div className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-700">
          레이븐2 한국 리전 어비스 2~5층 주단위 매칭 보드입니다. (층별 매칭 · 아군 브리핑 · 길드별 일정 · 로테이션 분석)
        </div>
        <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
          <iframe
            id="matchBoard"
            src="/matching-board.html"
            title="어비스 2~5층 매칭 보드"
            className="h-[80vh] w-full border-0"
          />
        </div>
      </div>

      {/* 서버/길드 수기 등록·관리 (운영진·관리자 전용) */}
      {isManager && (
        <div>
          <h2 className="mb-2 text-sm font-bold text-neutral-700">서버별 길드 등록 · 관리</h2>
          <MatchingClient initial={rows} canApply={me.role === "ADMIN"} />
        </div>
      )}
    </section>
  );
}
