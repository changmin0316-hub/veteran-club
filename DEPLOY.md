# VETERAN CLUB 운영 배포 가이드

새 도메인으로 운영하기 위한 배포 절차. 두 가지 경로를 제공합니다.
**A. Vercel(권장, 서버리스)** / **B. 자체 서버(VM/Docker, long-running)**

---

## 0. 사전 준비

- GitHub 저장소에 코드 푸시 (`veteran-club/`)
- **PostgreSQL 데이터베이스** 준비 (택1)
  - Neon / Supabase / Railway 등 매니지드 Postgres (Vercel과 궁합 좋음)
  - 또는 자체 Postgres 인스턴스
- 운영 도메인 (예: `club.mydomain.com`)

---

## 1. PostgreSQL 전환

개발은 SQLite, 운영은 PostgreSQL을 씁니다. 스키마는 두 DB 모두 호환됩니다.

1. `prisma/schema.prisma` 의 datasource provider 변경:
   ```prisma
   datasource db {
     provider = "postgresql"   // sqlite → postgresql
     url      = env("DATABASE_URL")
   }
   ```
2. 운영 `DATABASE_URL` 을 Postgres 주소로 설정 (아래 2번).
3. 스키마 반영 + 클라이언트 생성:
   ```bash
   npx prisma generate
   npx prisma db push          # 또는: npx prisma migrate deploy
   ```
4. 초기 데이터 시드(관리자·군·카테고리 등). **강력한 관리자 비번을 환경변수로 지정**:
   ```bash
   SEED_ADMIN_NAME="원장캐릭명" SEED_ADMIN_PASSWORD="강력한비밀번호" npm run db:seed
   ```
   > 시드는 군/출석 카테고리/주차/샘플 길드원까지 만듭니다. 운영에서 샘플 길드원이
   > 필요 없으면 `prisma/seed.ts` 의 샘플 생성 블록을 지우고 시드하세요.

---

## 2. 환경변수

`.env.production.example` 참고. 운영에 설정할 값:

| 변수 | 설명 |
|------|------|
| `DATABASE_URL` | 운영 PostgreSQL 연결 문자열 (sslmode=require 권장) |
| `SESSION_PASSWORD` | 세션 암호화 키(32자+). `openssl rand -base64 48 \| cut -c1-48` |
| `CRON_SECRET` | 크론 엔드포인트 인증 키. `openssl rand -hex 24` |
| `DISABLE_INPROCESS_CRON` | 서버리스(Vercel)에서는 `true` (외부 크론 사용) |

> 생성된 실제 값은 `.env.production.local`(gitignore됨)에 보관돼 있습니다.
> Vercel 배포 시 이 값들을 **Vercel 프로젝트 환경변수**에 넣습니다.

---

## 3-A. Vercel 배포 (권장)

1. Vercel 에서 GitHub 저장소 import. **Root Directory = `veteran-club`** 로 지정.
2. Framework: Next.js (자동 감지). Build Command/Install 은 기본값.
   - `build` 스크립트가 `prisma generate && next build` 라 Prisma 클라이언트가 자동 생성됩니다.
3. **환경변수** 추가: `DATABASE_URL`, `SESSION_PASSWORD`, `CRON_SECRET`, `DISABLE_INPROCESS_CRON=true`.
4. 배포(Deploy). 성공 후 최초 1회 DB 준비:
   - 로컬에서 운영 `DATABASE_URL` 로 `npx prisma db push` + 시드 실행(1번 참고), 또는
   - Vercel 의 배포 셸/CI 스텝에서 수행.
5. **크론**: `vercel.json` 에 `/api/cron/snapshot` 월 1회 크론이 이미 정의돼 있습니다.
   `CRON_SECRET` 이 설정되면 Vercel 이 `Authorization: Bearer` 를 자동 전송합니다.
   (Vercel 크론은 UTC 기준 — `0 0 1 * *` = 매월 1일 09:00 KST, 자세한 내용 `CRON.md`)

### 새 도메인 연결 (Vercel)
1. Vercel 프로젝트 → Settings → **Domains** → 운영 도메인 추가.
2. 안내되는 DNS 레코드를 도메인 등록기관에 설정:
   - 루트 도메인: A 레코드 `76.76.21.21` (Vercel 안내값 사용)
   - 서브도메인: CNAME → `cname.vercel-dns.com`
3. 전파 후 HTTPS 인증서가 자동 발급됩니다. (세션 쿠키 `secure` 가 운영에서 켜져 HTTPS 필수)

---

## 3-B. 자체 서버 배포 (VM/Docker)

1. 서버에 Node 20+ 설치, 코드 배치.
2. 환경변수 설정(`.env.production.local` 또는 시스템 환경변수). 자체 서버는
   인프로세스 크론을 쓰므로 `DISABLE_INPROCESS_CRON` 는 설정하지 않습니다(기본 동작).
3. 빌드 & 기동:
   ```bash
   npm ci
   npx prisma generate && npx prisma db push
   SEED_ADMIN_PASSWORD="강력한비밀번호" npm run db:seed   # 최초 1회
   npm run build
   npm run start            # 기본 3000 포트 (PORT 환경변수로 변경)
   ```
4. **리버스 프록시(nginx)** 로 도메인 연결 + HTTPS(Let's Encrypt):
   ```nginx
   server {
     server_name club.mydomain.com;
     location / { proxy_pass http://127.0.0.1:3000; proxy_set_header Host $host;
                  proxy_set_header X-Forwarded-For $remote_addr; }
   }
   ```
   `certbot --nginx -d club.mydomain.com` 로 인증서 발급.
5. 프로세스 관리: `pm2 start "npm run start" --name veteran-club` 등으로 상주.
   인프로세스 크론이 매월 1일 0시(KST) 스냅샷을 기록합니다(`CRON.md`).

---

## 4. 배포 후 체크리스트

- [ ] 관리자 로그인 → **비밀번호 변경**(내 정보) 및 시드 임시값 폐기
- [ ] `SESSION_PASSWORD` / `CRON_SECRET` 운영 값으로 설정했는가
- [ ] HTTPS 적용 확인 (세션 쿠키 secure)
- [ ] 월별 스냅샷 크론 동작 확인: `GET /api/cron/snapshot?key=<CRON_SECRET>` → `{ ok }`
- [ ] 설정(/config)에서 실제 주차·출석 카테고리·군·보스 구성
- [ ] 길드원 등록 및 권한(원장/사단장/길드원) 지정
- [ ] 로그인/입찰/출석등록/정산 흐름 스모크 테스트

---

## 참고
- 보안: 비밀번호 bcrypt 해싱, HttpOnly 세션 쿠키(7일), 로그인 rate-limit, 권한 기반 접근제어(RBAC), CSRF 완화(SameSite=Lax) 적용됨.
- 크론 상세: `CRON.md`
