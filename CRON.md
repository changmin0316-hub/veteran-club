# 월별 스탯 스냅샷 크론

매월 1일 각 길드원의 공격/방어/명중을 `MonthlyStat` 에 기록해, 길드원 표의 **전월 대비 증감**을 계산한다. 아래 3가지 방식 중 운영 환경에 맞는 것을 쓰면 된다(하나만 있으면 충분).

## 1) 자체 호스팅(long-running) — 인프로세스 크론 (기본값, 설정 불필요)

`next start`(또는 `next dev`)로 상시 구동되는 서버라면 `src/instrumentation.ts` 가 서버 시작 시
**매월 1일 00:00 (Asia/Seoul)** 스냅샷을 자동 기록한다. 추가 설정 없이 동작한다.

- 비활성화: 환경변수 `DISABLE_INPROCESS_CRON=true`

## 2) Vercel 등 서버리스 — Vercel Cron

서버리스에서는 상주 프로세스가 없으므로 외부 크론이 엔드포인트를 호출해야 한다.
`vercel.json` 에 크론이 정의돼 있다:

```json
{ "crons": [{ "path": "/api/cron/snapshot", "schedule": "0 0 1 * *" }] }
```

- Vercel 크론은 **UTC** 기준이다. `0 0 1 * *` = 매월 1일 00:00 UTC = **1일 09:00 KST**(여전히 KST로 1일).
- 환경변수 `CRON_SECRET` 를 설정하면 Vercel 이 `Authorization: Bearer <CRON_SECRET>` 를 자동으로 보낸다.
- 서버리스에서는 인프로세스 크론이 불필요하므로 `DISABLE_INPROCESS_CRON=true` 권장.

## 3) 자체 서버 + 시스템 crontab

엔드포인트 호출 방식:

```bash
0 0 1 * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://내도메인/api/cron/snapshot
```

또는 DB 직접 기록 스크립트(앱 서버 불필요, 같은 서버에서):

```bash
0 0 1 * * cd /path/to/veteran-club && node scripts/snapshot.mjs >> /var/log/vc-snapshot.log 2>&1
```

## 엔드포인트

`GET|POST /api/cron/snapshot`
- 인증: `Authorization: Bearer <CRON_SECRET>` 또는 `?key=<CRON_SECRET>`
- 동작: 이번 달 스냅샷을 현재 스탯으로 기록(기존 값 덮어씀) → `{ ok, snapshot: <기록 인원> }`
- 수동 실행: `npm run snapshot` (DB 직접) 또는 위 curl

> 스냅샷이 없는 달은 길드원 표 첫 조회 시 자동으로 한 번 생성(근사치)되지만,
> 정확한 "1일 0시" 기준선을 위해 위 크론 중 하나를 반드시 설정하는 것을 권장한다.
