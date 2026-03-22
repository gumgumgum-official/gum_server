# Render 배포 가이드 (gum_server)

## 개요

- **Web Service** 하나로 Node(Express) 서버를 띄웁니다.
- 무료 티는 약 **15분** 무요청 시 슬립 → 첫 요청이 느려질 수 있습니다.
- 이 레포는 다음을 제공합니다.
  - **`GET /health`** — 상세 헬스(Render 대시보드 Health Check Path로 사용)
  - **`GET /ping`** — 경량 keepalive ([`render-ping.yml`](../.github/workflows/render-ping.yml))
  - **실패 시만 Discord** — [`health-discord.yml`](../.github/workflows/health-discord.yml) + [`scripts/health-check-discord.js`](../scripts/health-check-discord.js)

**상세 문서**

- GitHub 시크릿·워크플로: **[GITHUB_ACTIONS_SETUP.md](./GITHUB_ACTIONS_SETUP.md)**
- Postman으로 API 전부 테스트: **[POSTMAN_GUIDE.md](./POSTMAN_GUIDE.md)**
- API 필드 명세: **[API.md](../API.md)**

---

## Render 대시보드 설정

1. **New → Web Service**
2. GitHub 레포 연결 후 브랜치 선택
3. **Runtime**: Node
4. **Build Command**: `npm install`  
   (또는 `npm install --omit=dev`)
5. **Start Command**: `npm start` → `node server.js`
6. **Instance type**: Free (필요 시 유료로 항상 온)

### 환경 변수 (Render)

| 이름 | 필수 | 설명 |
|------|------|------|
| `NODE_ENV` | 권장 | `production` |
| `PORT` | 아님 | Render가 자동 주입 (`process.env.PORT \|\| 3000`) |
| `CORS_ORIGIN` | 선택 | 코드상 기본은 `*` (프론트 도메인 확정 후 제한 권장) |

> `DISCORD_WEBHOOK_URL`, `SERVER_PUBLIC_URL` 은 **Render에 넣지 않아도 됩니다.** GitHub Actions 시크릿만 설정하면 됩니다.

### Health Check (Render)

- **Health Check Path**: `/health`  
- Render가 주기적으로 호출해 인스턴스 상태를 봅니다(플랜에 따라 다름).

---

## GitHub로 ping + 헬스 + Discord (배포 후 필수에 가깝게)

1. 배포 URL 확인: `https://<서비스명>.onrender.com`
2. 레포 **Settings → Secrets and variables → Actions** 에 다음 추가:

| Secret | 예시 | 설명 |
|--------|------|------|
| **`SERVER_PUBLIC_URL`** | `https://xxx.onrender.com` | 끝에 `/` 없음. **ping**(`.../ping`)과 헬스 URL 조합에 사용 |
| **`DISCORD_WEBHOOK_URL`** | Discord 웹훅 | 실패 알림용 |
| `HEALTH_URL` (선택) | `https://xxx.onrender.com/health` | 전체 URL을 직접 지정할 때만 |

3. **Actions** 탭에서 두 워크플로가 초록색으로 도는지 확인 (수동 **Run workflow** 가능).

자세한 단계·트러블슈팅: [GITHUB_ACTIONS_SETUP.md](./GITHUB_ACTIONS_SETUP.md)

---

## 외부 uptime 서비스 (선택)

GitHub Actions 외에 **UptimeRobot**, **cron-job.org** 등에서  
`GET https://<호스트>/ping` 또는 `/health` 를 **10~14분 간격**으로 호출해도 됩니다.  
서비스 약관·정책을 확인하세요.

---

## 로컬에서 Discord 헬스 스크립트 테스트

```bash
HEALTH_URL=https://your-app.onrender.com/health \
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/... \
npm run health:discord
```

- 정상: 터미널에만 `OK`, Discord로는 **전송 없음**
- 비정상: Discord에 embed 1건

---

## Postman

- 컬렉션: [`postman/gum_server.postman_collection.json`](../postman/gum_server.postman_collection.json)
- 가이드: [POSTMAN_GUIDE.md](./POSTMAN_GUIDE.md)

---

## 기타 PaaS

Railway 등도 `PORT` + `npm start` 패턴이면 동일합니다. Health path는 `/health` 권장.
