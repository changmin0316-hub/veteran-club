import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// 관리자 계정. 운영에서는 SEED_ADMIN_NAME / SEED_ADMIN_PASSWORD 환경변수로
// 지정하세요. (미지정 시 개발용 기본값 — 최초 로그인 후 반드시 변경)
const ADMIN_NAME = process.env.SEED_ADMIN_NAME ?? "VC원장";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "veteran1234";

const JOBS = [
  "엘리멘탈리스트",
  "디바인캐스터",
  "데스브링어",
  "건슬링어",
  "워로드",
  "뱅가드",
  "나이트레인저",
];

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function main() {
  console.log("🌱 seeding...");

  // 군(단)
  const guildDefs = [
    { order: 1, name: "베테랑1" },
    { order: 2, name: "베테랑2" },
    { order: 3, name: "배틀월드" },
  ];
  const guilds = [];
  for (const g of guildDefs) {
    guilds.push(
      await prisma.guild.upsert({
        where: { order: g.order },
        update: { name: g.name },
        create: g,
      })
    );
  }

  // 출석 카테고리
  const categories = [
    { name: "고대성채(5)", weight: 5, sortOrder: 1 },
    { name: "쟁탈전(5)", weight: 5, sortOrder: 2 },
    { name: "수일어비스12F(4)", weight: 4, sortOrder: 3 },
    { name: "수일어비스34F(5)", weight: 5, sortOrder: 4 },
    { name: "필드5성(3)", weight: 3, sortOrder: 5 },
    { name: "길드던전(3)", weight: 3, sortOrder: 6 },
  ];
  for (const c of categories) {
    const exists = await prisma.attendanceCategory.findFirst({
      where: { name: c.name },
    });
    if (!exists) await prisma.attendanceCategory.create({ data: c });
  }

  // 주차
  const week = await prisma.week.upsert({
    where: { number: 15 },
    update: {},
    create: { number: 15, name: "15주차", excludeRatio: 30 },
  });

  // 관리자 계정
  const adminHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  await prisma.member.upsert({
    where: { name: ADMIN_NAME },
    update: { passwordHash: adminHash, role: "ADMIN", guildId: guilds[0].id },
    create: {
      name: ADMIN_NAME,
      passwordHash: adminHash,
      role: "ADMIN",
      job: "엘리멘탈리스트",
      attack: 1391,
      defense: 904,
      accuracy: 925,
      legendSkill: true,
      guildId: guilds[0].id,
    },
  });

  // 샘플 길드원
  const sampleNames = [
    "VC과장",
    "VC꽃매",
    "VC큐피트",
    "VC파킹",
    "VC한방통닭",
    "VC공주힐러",
    "VC구피",
    "VC귀살",
    "VC그림자",
    "VC늘보",
  ];
  const memberPwHash = await bcrypt.hash("member1234", 10);
  for (let i = 0; i < sampleNames.length; i++) {
    const name = sampleNames[i];
    await prisma.member.upsert({
      where: { name },
      update: {},
      create: {
        name,
        passwordHash: memberPwHash,
        role: i < 2 ? "COMMANDER" : "MEMBER",
        job: JOBS[i % JOBS.length],
        attack: rand(800, 1300),
        defense: rand(600, 900),
        accuracy: rand(700, 950),
        legendSkill: Math.random() > 0.5,
        guildId: guilds[0].id,
      },
    });
  }

  // 아이템 + 이벤트
  const itemNames = [
    "끝없는 멸망의 검방패",
    "끝없는 멸망의 군화",
    "끝없는 멸망의 권총",
    "끝없는 멸망의 단검",
    "끝없는 멸망의 망토",
  ];
  const items = [];
  for (const name of itemNames) {
    items.push(
      await prisma.item.upsert({
        where: { name },
        update: {},
        create: { name, rarity: "전설", category: "무기", basePrice: 0 },
      })
    );
  }

  const existingEvent = await prisma.event.findFirst({
    where: { name: "1017 마레호노르5" },
  });
  if (!existingEvent) {
    const event = await prisma.event.create({
      data: { name: "1017 마레호노르5", active: true, weekId: week.id },
    });
    for (const item of items) {
      await prisma.eventItem.create({
        data: { eventId: event.id, itemId: item.id },
      });
    }
  }

  console.log("✅ seed 완료");
  console.log(`   관리자 로그인: ${ADMIN_NAME} / ${ADMIN_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
