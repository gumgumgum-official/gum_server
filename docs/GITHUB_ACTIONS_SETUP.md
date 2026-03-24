# GitHub Actions 설정 가이드 (ping · 헬스 · Discord)

배포된 gum_server에 대해 다음 두 워크플로가 동작합니다.

| 워크플로 파일 | 역할 | 주기 (UTC) |
|---------------|------|------------|
| [`.github/workflows/render-ping.yml`](../.github/workflows/render-ping.yml) | **`GET /ping`** 만 호출 — checkout/npm 없음, **Render 슬립 방지** | 10분마다 |
| [`.github/workflows/health-discord.yml`](../.github/workflows/health-discord.yml) | **`GET /health`** 후 JSON 검증 — **실패 시에만** Discord 웹훅 | 5분마다 |

---

## 1. 사전 조건

- 코드가 **GitHub 레포**에 푸시되어 있음
- Render(또는 다른 호스트)에 서버가 떠 있고, 브라우저에서 `https://<호스트>/health` 가 동작함
- (Discord 알림을 쓸 경우) Discord 채널 **웹후크 URL** 준비

---

## 2. 시크릿 등록 위치

1. GitHub 레포지토리 페이지 열기
2. **Settings** (레포 설정)
3. 왼쪽 **Secrets and variables** → **Actions**
4. **New repository secret** 으로 아래 항목 추가

> **Fork된 레포**인 경우: 기본적으로 Actions가 제한될 수 있습니다. **Settings → Actions → General** 에서 Actions 사용을 허용했는지 확인하세요.

---

## 3. 필수 시크릿 정리

### `SERVER_PUBLIC_URL` (ping + 헬스 URL 자동 조합에 사용)

- **값 예시**: `https://your-app.onrender.com`
- **규칙**
  - `https://` 포함
  - **마지막에 `/` 붙이지 않음**
- **용도**
  - `render-ping.yml`: `GET ${SERVER_PUBLIC_URL}/ping`
  - `health-discord.yml`: `HEALTH_URL` 이 비어 있을 때 `${SERVER_PUBLIC_URL}/health` 로 자동 설정

### `DISCORD_WEBHOOK_URL` (Discord 알림용 — health-discord 워크플로만)

- Discord: 채널 톱니바퀴 → **연동** → **웹후크** → 새 웹후크 → URL 복사
- 값 형태: `https://discord.com/api/webhooks/...`
- **공개 저장소에 절대 커밋하지 마세요.**

### `HEALTH_URL` (선택 — 전체 URL을 직접 쓰고 싶을 때)

- 예: `https://your-app.onrender.com/health`
- 설정해 두면 **`SERVER_PUBLIC_URL`/health 보다 우선**합니다.
- 로드밸런서나 경로가 다른 경우에만 쓰면 됩니다.

**추천 조합**

| 목적 | 설정 |
|------|------|
| 최소 설정 | `SERVER_PUBLIC_URL` + `DISCORD_WEBHOOK_URL` |
| 헬스 URL만 따로 쓰고 싶음 | `HEALTH_URL` + `DISCORD_WEBHOOK_URL` + (`render-ping`용으로 `SERVER_PUBLIC_URL`도 권장) |

> `render-ping.yml` 은 **`SERVER_PUBLIC_URL`만** 참조합니다. ping만 돌리려면 반드시 `SERVER_PUBLIC_URL` 을 넣으세요.

---

## 4. 워크플로가 실제로 도는지 확인

1. 레포 **Actions** 탭
2. 왼쪽에서 **Render keepalive (ping)** 또는 **Health check (Discord on failure)** 선택
3. **Run workflow** (수동)로 `workflow_dispatch` 실행 가능한 워크플로는 즉시 테스트 가능
4. 초록 체크면 성공, 빨간 X면 로그(Logs)를 열어 `curl` 또는 `node` 오류 메시지 확인

**자주 나는 실패**

| 증상 | 원인 |
|------|------|
| `SERVER_PUBLIC_URL 시크릿이 비어` | ping 워크플로 — 시크릿 이름·값 확인 |
| `HEALTH_URL 또는 SERVER_PUBLIC_URL` | health 워크플로 — 둘 중 하나 필수 |
| `HEALTH_URL 과 DISCORD_WEBHOOK_URL 이 필요` | `DISCORD_WEBHOOK_URL` 미설정 |
| `HTTP 5xx` / `타임아웃 (100000ms)` | Render **콜드 스타트**가 30~50초까지 걸릴 수 있음. 스크립트 기본 대기는 **60초**(`HEALTH_TIMEOUT_MS`, 워크플로에도 동일). 그래도 부족하면 시크릿/환경에 `HEALTH_TIMEOUT_MS=90000` 등으로 늘리기 |

---

## 5. Cron 스케줄 (UTC)

GitHub Actions `schedule`은 **UTC** 기준입니다.

- `render-ping.yml`: `*/10 * * * *` → UTC 기준 10분마다
- `health-discord.yml`: `*/5 * * * *` → UTC 기준 5분마다

한국 시간(KST = UTC+9)으로 변환해 두면 운영 시간과 겹치는지 가늠할 수 있습니다.

> 무료 플랜에서는 스케줄이 **정확히 고정되지 않고** 지연될 수 있습니다. Render 슬립 방지에는 10분 주기 ping이면 보통 충분합니다(15분 무요청 슬립 전).

---

## 6. Actions 권한 (기본으로 대부분 OK)

- **Settings → Actions → General**
  - *Workflow permissions*: 기본적으로 읽기만 해도 이 워크플로는 동작합니다(외부 URL만 호출).
- Organization 정책에서 Actions를 막아 두었다면 관리자에게 허용을 요청하세요.

---

## 7. 로컬에서 Discord 스크립트만 테스트

```bash
export HEALTH_URL="https://your-app.onrender.com/health"
export DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/..."
# 선택 — 기본 60000ms. 콜드 스타트가 길면 예: 90000
# export HEALTH_TIMEOUT_MS=90000
npm run health:discord
```

성공 시 콘솔에 `OK` 와 타임스탬프, Discord에는 **아무 것도 안 갑니다**.
의도적으로 잘못된 `HEALTH_URL`을 넣으면 Discord에 실패 embed가 1건 옵니다.

---

## 8. 관련 문서

- [RENDER_DEPLOY.md](./RENDER_DEPLOY.md) — Render 빌드/시작/Health Check Path
- [POSTMAN_GUIDE.md](./POSTMAN_GUIDE.md) — API 수동 테스트
- [API.md](../API.md) — `/health`, `/ping` 명세
