# Render 배포 가이드 (gum_server)

## 개요

- **Web Service** 하나로 Node(Express) 서버를 띄웁니다.
- 무료 티는 유휴 시 슬립될 수 있어, 별도 **Uptime 모니터**나 **GitHub Actions**로 `/health`를 주기 호출하는 것을 권장합니다.
- **헬스 실패 시 Discord 알림**은 이 레포의 [`scripts/health-check-discord.js`](../scripts/health-check-discord.js) + [`.github/workflows/health-discord.yml`](../.github/workflows/health-discord.yml)를 사용합니다 (실패할 때만 웹훅 전송).

## Render 대시보드 설정

1. **New → Web Service**
2. GitHub 레포 연결 후 브랜치 선택
3. **Runtime**: Node
4. **Build Command**: `npm install`  
   (또는 `npm install --omit=dev` — 프로덕션만)
5. **Start Command**: `npm start` → `node server.js`
6. **Instance type**: Free (원하는 경우 유료로 슬립 없음)

### 환경 변수 (Environment)

| 이름 | 필수 | 설명 |
|------|------|------|
| `NODE_ENV` | 권장 | `production` |
| `PORT` | 아님 | Render가 자동 주입. 코드는 `process.env.PORT \|\| 3000` |
| `CORS_ORIGIN` | 선택 | 기본 `*` (프론트 도메인 확정 후 제한 권장) |

> `DISCORD_WEBHOOK_URL` / `HEALTH_URL` 은 **Render 앱 안에 넣을 필요 없음**. GitHub Actions 시크릿에만 넣으면 됩니다.

### Health Check (Render)

- **Health Check Path**: `/health`
- 간격은 Render 플랜에 맞게 설정

## 슬립 완화 (ping)

- **UptimeRobot**, **cron-job.org** 등에서 `GET https://<your-service>.onrender.com/health` 를 10~14분 간격으로 호출  
- Render 무료 정책·약관을 확인한 뒤 사용하세요.

## Discord 알림 (실패 시만)

1. Discord 서버 → 채널 설정 → 연동 → **웹후크** 생성 → URL 복사
2. GitHub 레포 → **Settings → Secrets and variables → Actions**
   - `HEALTH_URL`: `https://<your-render-host>/health`
   - `DISCORD_WEBHOOK_URL`: 위에서 복사한 URL
3. 워크플로 `Health check (Discord on failure)` 가 `cron`으로 스크립트 실행  
   - 정상: Discord로 아무 것도 안 보냄  
   - 비정상(HTTP 오류, 타임아웃, `status !== "ok"`): embed 알림 1건

로컬에서 수동 테스트:

```bash
HEALTH_URL=https://your-app.onrender.com/health DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/... npm run health:discord
```

## 참고

- API 전체 명세: 루트의 [`API.md`](../API.md)
- Railway 등 다른 PaaS도 동일하게 `PORT` + `npm start` 패턴이면 동작합니다.
