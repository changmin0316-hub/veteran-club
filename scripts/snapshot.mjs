// 매월 1일 스탯 스냅샷 기록 (시스템 crontab / 수동 실행용).
// 경로 별칭 없이 Prisma 를 직접 사용하므로 `node scripts/snapshot.mjs` 로 실행 가능.
// crontab 예) 매월 1일 00:00 KST:  0 0 1 * *  cd /path/to/veteran-club && node scripts/snapshot.mjs >> /var/log/vc-snapshot.log 2>&1
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function ymOf(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

async function main() {
  const ym = ymOf();
  const members = await prisma.member.findMany({
    select: { id: true, attack: true, defense: true, accuracy: true },
  });
  await prisma.$transaction(
    members.map((m) =>
      prisma.monthlyStat.upsert({
        where: { memberId_ym: { memberId: m.id, ym } },
        create: {
          memberId: m.id,
          ym,
          attack: m.attack,
          defense: m.defense,
          accuracy: m.accuracy,
        },
        update: { attack: m.attack, defense: m.defense, accuracy: m.accuracy },
      })
    )
  );
  console.log(`[${new Date().toISOString()}] ${ym} 스냅샷 기록: ${members.length}명`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
