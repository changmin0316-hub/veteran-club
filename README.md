# VETERAN CLUB — 길드 관리 웹앱 인수인계 문서

레이븐2 길드의 출석 / 분배(입찰·낙찰) / 정산 / 길드원·매칭 관리 웹 애플리케이션입니다.

- **운영 사이트:** https://veteran-club-two.vercel.app/login
- **GitHub 저장소:** https://github.com/changmin0316-hub/veteran-club (현재 소유 계정: `changmin0316-hub`)
- **배포:** Vercel (브랜치 `main` 푸시 시 자동 배포)

> ⚠️ 이 문서에는 **실제 비밀번호·비밀키·DB 접속 정보가 들어있지 않습니다.** 그 값들은 보안 경로(비밀번호 관리자, 암호화 메모 등)로 별도 전달해야 하며, "소유자가 직접 해야 할 일"로 아래에 표시했습니다.

> 🔐 **[보안 — 반드시 조치]** 과거에 실제 비밀값이 담긴 백업 파일(`.env.production.local.save`)이 실수로 Git에 커밋된 적이 있습니다. 현재는 추적에서 제거하고 `.gitignore`에 등록했지만, **값이 Git 히스토리에는 남아 GitHub에서 열람 가능**합니다. 따라서 아래 비밀값을 **모두 새로 교체(로테이션)** 하세요. 교체가 끝나면 노출된 값은 무력화됩니다.
> - **Neon DB 비밀번호** 재설정 → `DATABASE_URL` / `DATABASE_URL_UNPOOLED` 갱신(Vercel·로컬 모두)
> - **`SESSION_PASSWORD`** 새로 생성(기존 로그인 세션은 모두 로그아웃됨)
> - **`CRON_SECRET`** 새로 생성(Vercel 환경변수도 갱신)
> - (선택) BFG/`git filter-repo`로 히스토리에서 파일을 완전 삭제 후 강제 푸시 — 소유자 판단.

---

## 1. 프로젝트 소스코드

### 포함 파일
- 전체 소스(`src/`), 스타일(Tailwind), 설정 파일, `package.json` / `package-lock.json`(잠금 파일), Prisma 스키마, 정적 리소스(`public/`).
- **제외(의도적):** `node_modules/`(설치로 복원), `.next/`(빌드 산출물), `.env*`(비밀값), `prisma/*.db`(로컬 SQLite), `*.traineddata`(OCR 언어데이터 — 런타임 자동 다운로드). `.gitignore` 기준과 동일합니다.

### 전달 방법
- **ZIP:** 위 제외 항목을 뺀 소스 ZIP을 함께 제공합니다. 압축 해제 후 `npm install` → `.env` 설정 → 실행하면 됩니다.
- **GitHub(권장):** 저장소를 그대로 받는 것이 이력·배포 연동까지 넘기는 가장 깔끔한 방법입니다.
  - **[소유자가 할 일]** GitHub → 저장소 `Settings → Collaborators`에서 새 담당자 GitHub 계정을 **Write(또는 Admin)** 권한으로 초대하거나,
  - 조직/개인 간 **저장소 소유권 이전**(`Settings → General → Danger Zone → Transfer ownership`)을 진행합니다.

---

## 2. 실행 및 수정 방법

### 기술 스택 / 필요한 버전
| 항목 | 내용 |
|---|---|
| 프레임워크 | **Next.js 15** (App Router) |
| 언어 | **TypeScript 5**, **React 19** |
| 스타일 | **Tailwind CSS v4** |
| ORM / DB | **Prisma 6** + **PostgreSQL** (운영은 **Neon**) |
| 로그인 | **iron-session**(쿠키 세션) + **bcryptjs**(비밀번호 해시) |
| 입력검증 | **zod** |
| OCR(출석 이미지 인식) | **tesseract.js** |
| 런타임 | **Node.js 20 이상** 권장 (개발/검증은 Node 24에서 수행) |
| 패키지 매니저 | npm (저장소에 `package-lock.json` 포함) |

### 설치 · 실행 · 빌드
```bash
# 1) 의존성 설치 (postinstall 로 prisma generate 자동 실행)
npm install

# 2) 환경변수 설정 — .env.example 참고해서 .env 생성
cp .env.example .env   # 값 채우기 (DATABASE_URL 등)

# 3) DB 스키마 반영 (운영 DB에 테이블 생성/동기화)
npm run db:push

# 4) (선택) 초기 데이터 시드 — 관리자/군/카테고리 등 생성
npm run db:seed

# 5) 개발 서버
npm run dev            # http://localhost:3000 (기본 포트)

# 6) 운영 빌드 / 실행
npm run build          # prisma generate && next build
npm start              # next start
```
기타 스크립트: `npm run db:studio`(Prisma Studio로 DB 열람), `npm run lint`(ESLint), `npm run snapshot`(월별 스탯 스냅샷 수동 실행 — `scripts/snapshot.mjs`).

### 폴더 구조 & 화면별 수정 위치
```
veteran-club/
├─ prisma/schema.prisma      # DB 스키마(모델). 구조 변경 시 여기 수정 후 db:push
├─ prisma/seed.ts            # 초기 데이터(관리자·군·카테고리 등)
├─ public/matching-board.html# 매칭표 보드(어비스 2~5층 데이터·주차). 매칭 공지 갱신 시 여기 수정
├─ scripts/snapshot.mjs      # 월별 스탯 스냅샷 스크립트
└─ src/
   ├─ app/(main)/            # 로그인 후 각 화면(페이지)
   │  ├─ page.tsx            # 아이템 신청(홈)
   │  ├─ request/            # 분배 현황(낙찰/신청자 관리)
   │  ├─ event/              # 분배 등록(이벤트·입찰 아이템) ※관리자
   │  ├─ attendance/         # 출석 현황 / 출석 등록·기록
   │  ├─ closing/            # 주차(시즌) 결산 ※관리자
   │  ├─ adjustment/         # 분배금 정산 ※관리자
   │  ├─ awards/             # 낙찰 통계 / 기부·지급 통계
   │  ├─ users/              # 길드원 목록(스탯·증감)
   │  ├─ user/               # 내 정보 변경
   │  ├─ matching/           # 매칭표 페이지(보드 iframe + 수기 등록)
   │  ├─ config/             # 설정(주차·카테고리·군 관리) ※관리자
   │  ├─ logs/               # 활동 로그 ※관리자
   │  └─ NavTabs.tsx         # 상단 메뉴 탭(표시 권한)
   ├─ app/api/               # 서버 API 라우트(위 화면들의 백엔드)
   └─ lib/                   # 공통 로직
      ├─ db.ts               # Prisma 클라이언트(풀링 설정 포함)
      ├─ auth.ts / session.ts# 로그인/세션
      ├─ guard.ts / page-guard.ts # 권한 체크(ADMIN/COMMANDER/MEMBER)
      ├─ settlement.ts       # 분배금 정산 계산(군별 재원·제외비율 반영)
      ├─ stats.ts            # 월별 스탯 스냅샷·전월대비 증감
      └─ log.ts              # 활동 로그 기록
```
- **권한 체계:** `ADMIN`(관리자) > `COMMANDER`(운영진) > `MEMBER`(일반). 메뉴 노출은 `src/app/(main)/NavTabs.tsx`, 접근 차단은 각 페이지의 `page-guard`, API는 `guard`에서 제어합니다.

---

## 3. Vercel 배포 및 권한 전달

- **연결 저장소 / 브랜치:** GitHub `changmin0316-hub/veteran-club`, 배포 브랜치 **`main`**. `main`에 푸시하면 Vercel이 자동 빌드·배포합니다.
- **빌드 설정:** 빌드 명령 `npm run build`(= `prisma generate && next build`), 프레임워크 프리셋 **Next.js**. 별도 설정은 `vercel.json`에 있습니다.
- **크론:** `vercel.json`의 `crons`가 매일 **15:00 UTC(= 한국시간 0시)**에 `/api/cron/snapshot`을 호출합니다. 라우트 내부에서 한국시간 **1일**일 때만 월별 기준선 스냅샷을 기록합니다.
- **[소유자가 할 일] 권한/이전**
  - 팀원 추가: Vercel → 프로젝트 → `Settings → Members`(또는 팀 설정)에서 새 담당자를 초대.
  - 프로젝트 이전: Vercel → `Settings → General → Transfer`로 다른 계정/팀으로 이전.
  - GitHub 저장소 소유권을 넘기면, 새 소유자가 자신의 Vercel 계정에서 **Import**해 재연결하는 방법도 있습니다(환경변수는 재입력 필요).

---

## 4. 환경변수와 연결 서비스

### 환경변수 (`.env.example` 참고 — 실제 값은 미포함)
| 변수 | 용도 | 비고 |
|---|---|---|
| `DATABASE_URL` | 앱 런타임 DB 연결(풀링/pooled) | Neon의 `-pooler` 호스트 |
| `DATABASE_URL_UNPOOLED` | 마이그레이션/`db push`용 직접 연결 | `-pooler` 없는 호스트 |
| `SESSION_PASSWORD` | iron-session 쿠키 암호화 키(32자+) | `openssl rand -base64 48` |
| `CRON_SECRET` | 크론 엔드포인트 인증 | `openssl rand -hex 24` |
| `DISABLE_INPROCESS_CRON` | 서버리스에서 인프로세스 크론 끄기 | Vercel에서 `true` |
| `SEED_ADMIN_NAME` / `SEED_ADMIN_PASSWORD` | 시드 시 관리자 계정 | 시드 실행 때만 필요 |

### 사용 중인 외부 서비스 & 권한 전달
- **DB — Neon (PostgreSQL):** 운영 데이터 저장.
  - **[소유자가 할 일]** Neon 콘솔에서 프로젝트 멤버 초대 또는 소유권 이전, 접속 문자열(`DATABASE_URL`, `DATABASE_URL_UNPOOLED`)을 **보안 경로로** 전달.
- **로그인/세션 — iron-session:** 외부 서비스 아님(쿠키 기반). `SESSION_PASSWORD`만 공유하면 됩니다(별도 계정 없음).
- **파일 저장:** **별도 스토리지 서비스 미사용.** 길드원 장비/헤븐스톤 이미지 등은 **DB에 data URL 문자열**로 저장됩니다(외부 S3 등 없음).
- **OCR — tesseract.js:** 출석 이미지에서 캐릭터명 인식. 외부 API 키 불필요(브라우저에서 동작, 언어데이터는 런타임 자동 다운로드).
- **배포 — Vercel / 소스 — GitHub:** 위 3번 참고.
- 그 외 결제·메일·푸시 등 외부 API는 사용하지 않습니다.

---

## 5. 테스트 및 백업

### 테스트 계정
- 로그인 **아이디 = 캐릭터명**, 비밀번호는 각 길드원별로 설정됩니다(대소문자 무시).
- **관리자 계정:** 시드(`npm run db:seed`) 시 `SEED_ADMIN_NAME`/`SEED_ADMIN_PASSWORD`로 생성(미지정 시 개발 기본값 `VC원장` / `veteran1234` — **운영에서는 최초 로그인 후 즉시 변경**).
- **일반회원 테스트 계정:** 관리자로 로그인 → **길드원** 또는 **설정**에서 새 길드원 추가 후, 해당 계정으로 로그인해 테스트.
- **[소유자가 할 일]** 운영 사이트의 실제 관리자 비밀번호는 문서에 넣지 않았습니다. 새 담당자에게 **보안 경로로 직접 전달**하거나, 관리자 화면에서 테스트용 계정을 새로 만들어 전달하세요.

### 백업
- **코드:** Git으로 버전 관리됨. 수정 전 상태는 `git log`/`git revert`로 복구 가능. 큰 변경 전 브랜치 생성(`git switch -c 작업명`) 권장.
- **[소유자가 할 일] DB 백업:** Neon 콘솔의 **백업/브랜치(Point-in-time) 기능**으로 스냅샷을 만들거나, `pg_dump`로 덤프를 받아 두세요(수정·마이그레이션 전 필수). 예: `pg_dump "$DATABASE_URL_UNPOOLED" > backup.sql`.
- **스냅샷 기능(앱 내부):** 매월 1일 0시(KST) 길드원 스탯 기준선을 자동 저장(전월 대비 증감 표시용). 수동 실행은 `npm run snapshot` 또는 `/api/cron/snapshot?force=1`(관리자 시크릿 필요).

### 미완성/알려진 사항
- **매칭표 데이터는 수기 갱신:** `public/matching-board.html` 안의 2~5층 매칭 배열과 날짜·주차(`CUR`, `WSTART`)를 공지가 바뀔 때마다 직접 수정해야 합니다(자동 연동 아님).
- **OCR 출석 인식:** 보조 기능으로, 이미지 품질/폰트에 따라 인식률이 달라집니다. 인식 후 참석자를 수동 확인하는 것을 전제로 합니다.
- **2·3군 정산금:** 분배금 정산·제외비율은 **군별 개별 입력**이며, 입력하지 않은 군은 과거 전체값으로 폴백합니다. 주차별로 각 군 값을 입력해야 정확합니다.
- 그 외 치명적 오류로 알려진 항목은 현재 없습니다. 추가 이슈는 발견 시 이 문서에 기록하세요.

---

## 부록: 소유자만 할 수 있는 작업 체크리스트
새 담당자에게 넘길 때, 아래는 **현재 소유자 본인이** 직접 수행/전달해야 합니다.
- [ ] GitHub 저장소 Collaborator 추가 또는 소유권 이전
- [ ] Vercel 프로젝트 멤버 추가 또는 이전
- [ ] Neon(DB) 멤버 추가/이전 + 접속 문자열 전달(보안 경로)
- [ ] `SESSION_PASSWORD`, `CRON_SECRET` 등 비밀값 전달(보안 경로)
- [ ] 운영 관리자 계정 비밀번호 전달 또는 신규 관리자 계정 발급
- [ ] (권장) 인수인계 직전 DB 백업 1부 생성

> 참고: 저장소 루트의 `DEPLOY.md`, `CRON.md`에 배포/크론 관련 추가 메모가 있습니다.
