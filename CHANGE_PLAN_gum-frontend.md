# gum-frontend 기능·연동 명세 (모니터 · gum_server REST)

이 문서는 `gumgumgum-official/gum-frontend` 레포에서 **모니터(왼쪽/오른쪽 단말)** 가 `gum_server`와 맞춰야 하는 **동작·API·에러 처리**를 정리합니다. (이 레포의 구현 체크리스트·기능명세로 쓸 수 있게 작성했습니다.)

> **정본 스펙**: [API.md](./API.md)  
> **역할 분리**: 모니터는 부팅 시 **`POST /api/monitor-instance/bind`**(동일 URL)로 `monitorId`를 받은 뒤, **`GET /api/monitors/:monitorId/current`**, **`POST .../start`**, **`POST .../complete`** 로 체험 흐름을 맞춥니다. **시작 화면 “도착” 토스트**에는 **`GET /status`**(해당 `monitorId`의 `reservedWorry`)를 추가로 씁니다. **`POST /api/request-monitor`** 는 **태블릿 전용**입니다.  
> **Stage2·Stage3·Stage6** 등은 **gum-frontend 화면 단계** 이름이며, 서버는 **`start` / `complete` 호출**과 `idle`/`busy`만 구분합니다.  
> 흐름 요약: [docs/MONITOR_USER_FLOW.md](./docs/MONITOR_USER_FLOW.md)  
> 레포 구조·라우트: [gum-frontend](https://github.com/gumgumgum-official/gum-frontend) README

---

## 서버와의 계약 (요약)

| 항목 | 내용 |
|------|------|
| Base URL | 개발: `http://localhost:3000` — 프로덕션은 배포된 `gum_server` URL (`GUM_SERVER_URL` 등 환경변수) |
| 프로토콜 | HTTP/HTTPS JSON, **Socket.io 없음** |
| 모니터 ID | 서버 상수 **`monitor-1`** \| **`monitor-2`** 만 유효. **동일 URL**로 두 대를 띄울 때는 앱 부팅 시 **`POST /api/monitor-instance/bind`** 로 `instanceId`(localStorage UUID)를 보내 배정받음 — [API.md](./API.md) §2-1. (선택: 전시장에서만 빌드별 환경변수로 고정해도 됨) |

### 상태 의미 (서버)

| 서버 상태 | `GET /current` | 의미 |
|-----------|----------------|------|
| 예약만 (`reservedWorry` 있음, `busy` 아님) | `status: "idle"` | 태블릿이 이 모니터에 고민을 붙여 둠. **아직 `start` 전** → 시작 화면 유지 |
| 체험 진행 (`busy`, `currentWorry` 있음) | `status: "busy"` + `worry` | `start` 이후 — SVG·문구 표시 |
| 비어 있음 | `status: "idle"` | 예약도 없음 |

**중요**: 태블릿이 `request-monitor`로 예약만 해도 **`GET /current`는 `idle`** 일 수 있습니다. 모니터가 **`POST .../start`** 한 뒤에만 **`busy`** 로 바뀝니다.

---

## 목표 (기능)

- **Stage2(빔 등)**: 기존 유지 (Storage·Realtime 등 — 제품 요구에 따름)
- **모니터 라우트**: 할당 표시·체험 시작·종료를 **gum_server REST** 로만 맞출 것
  - **체험 중 표시**: `GET .../current` 폴링 — `busy`일 때 `worry.svgUrl`·`worry.worryId`
  - **시작 화면 “도착” 토스트**: `GET /status`에서 **이 기기의 `monitorId` 키** 아래 `reservedWorry`가 있으면 표시 (`worryId`·`svgUrl`은 이후 `GET /current`의 `worry`와 동일 출처 — [API.md](./API.md) `GET /status` 절)
  - **보조**: Realtime/Storage fallback은 **예외·디버그용**으로만 (정상 경로는 서버 폴링과 일치)
- **문구**: **`reservedWorry.displaySeq` 또는 `worry.displaySeq`가 있으면** 「`${displaySeq}번째 고민이 도착했습니다`」. **없으면** 「고민이 도착했습니다」— 긴 Edge `worryId`를 그대로 붙이지 않음 ([API.md](./API.md) `displaySeq`)

### 시작 화면 구현 (`StartPage.jsx` 등)

1. **폴링**: `GET {base}/status` (간격은 `GET /current`와 맞추거나 1~2초).
2. `data.monitors[monitorId].reservedWorry` 가 **비어 있지 않으면** 토스트 — `reservedWorry.displaySeq` 있으면 「N번째」, 없으면 일반 문구 ( **`worryId` 원문 노출 비권장** ).
3. 체험 화면(Stage3 이후)에서는 기존대로 **`GET .../current`** 가 `busy`일 때 `worry`로 SVG·문구 표시.
4. `reservedWorry`가 있는데 아직 `start` 전이면 `current`는 `idle`일 수 있음 — **정상**이며, 토스트는 `/status` 기준으로만 띄우면 됨.

---

## 모니터가 호출하는 API (필드·응답)

### 1) `POST /api/monitors/:monitorId/start`

**언제**: 전시 연출상 “체험이 실제로 시작되는 순간”(예: Stage3 진입 직전·진입 시). **한 세션당 1회.**

**요청**

```http
POST {GUM_SERVER_URL}/api/monitors/{monitorId}/start
Content-Type: application/json
```

| 경로 | 값 |
|------|-----|
| `monitorId` | `monitor-1` 또는 `monitor-2` (이 기기에 고정) |

Body: `{}` 생략 가능(빈 객체도 됨).

**응답 `200`**

```json
{
  "ok": true,
  "status": "busy",
  "worry": {
    "worryId": "12",
    "svgUrl": "https://…",
    "sessionId": "…"
  }
}
```

- 응답의 `worry`는 **`GET /current`와 동일한 내용**으로 바로 UI에 써도 됨.

**에러**

| HTTP | body | 처리 가이드 |
|------|------|-------------|
| `400` | `{ "error": "invalid monitorId" }` | `monitorId` 설정 오류 |
| `409` | `{ "error": "no reservation for this monitor" }` | 이 모니터에 **예약 없음** — 태블릿 배정 전이거나 다른 모니터로 잘못 매핑됨 |
| `409` | `{ "error": "monitor already busy" }` | 이미 `start` 됨 — **이중 호출** 방지(플래그·idempotent 처리) |

---

### 2) `GET /api/monitors/:monitorId/current` (폴링)

**언제**: `start` 호출 **이후** 체험 화면이 보이는 동안 **약 1~2초 간격** (프로젝트 기존 간격에 맞춤).

**요청**

```http
GET {GUM_SERVER_URL}/api/monitors/{monitorId}/current
```

**응답 — 표시할 고민 없음 (시작 화면·예약만 있음·종료 직후 등)**

```json
{ "status": "idle" }
```

- **`worry` 필드 없음** — 예약만 있고 아직 `start` 안 한 경우도 **항상 이렇게만** 옵니다.

**응답 — 체험 중**

```json
{
  "status": "busy",
  "worry": {
    "worryId": "12",
    "svgUrl": "https://…",
    "sessionId": "…"
  }
}
```

**에러**

- `400` — `{ "error": "invalid monitorId" }`

**UI 규칙**

- `status === "busy"` 이고 `worry` 가 있으면: `svgUrl` 로 SVG 로드, `worryId` 로 문구
- `idle` 이면: **시작 화면/대기 화면** (예약만 있는 경우 포함 — 서버는 `reservedWorry`를 `/current`에 노출하지 않음)

---

### 3) `POST /api/monitors/:monitorId/complete`

**언제**: 체험 종료·**시작(대기) 화면으로 돌아갈 때** (예: Stage6 종료). **한 세션당 1회**를 권장.

**요청**

```http
POST {GUM_SERVER_URL}/api/monitors/{monitorId}/complete
```

Body 없음 가능.

**응답 `200`**

```json
{
  "ok": true,
  "assignedNext": true
}
```

| 필드 | 의미 |
|------|------|
| `assignedNext` | `true`: 대기열에서 다음 사용자를 **이 모니터에 예약만** 붙임. `false`: 대기 없음 |

- 다음 사람의 **`busy`는 자동이 아님** — 이후에도 **`POST .../start`** 를 다시 호출해야 `GET /current`가 `busy`가 됨.

**에러**

- `400` — `{ "error": "invalid monitorId" }`

**주의**: 정상 플로우에서는 **진행 중이던 `busy` 세션을 끝낼 때** 호출. UI에서 **완료 버튼/단계 전환**과 1:1로 묶는 것이 안전합니다.

---

## 권장 호출 순서 (한 세션)

1. **시작 화면** — 폴링만 하거나(선택), `idle` 이면 대기 UI
2. **체험 시작 직전** — `POST .../start` (성공 시 곧바로 `busy` 데이터 확보 가능)
3. **체험 중** — `GET .../current` 반복 폴링 — `busy` + `worry` 유지 시 표시 갱신
4. **체험 종료·시작 화면 복귀** — `POST .../complete`
5. 다음 관람자 — **1번부터 반복** (`start` → 폴링 → `complete`)

`complete` 직후 다음 사람이 예약만 붙었으면 **`GET /current`는 계속 `idle`** — 다시 **2번 `start`** 할 때까지 시작 화면 유지.

---

## 코드 스케치 (fetch)

```ts
const base = GUM_SERVER_URL.replace(/\/$/, '');
// 동일 URL: localStorage에 둔 instanceId로 bind
const instanceId = localStorage.getItem('gum_monitor_instance_id') ?? crypto.randomUUID();
localStorage.setItem('gum_monitor_instance_id', instanceId);
const bindRes = await fetch(`${base}/api/monitor-instance/bind`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ instanceId }),
});
const { monitorId } = await bindRes.json(); // 'monitor-1' | 'monitor-2'

// Stage3 진입(체험 시작)
const startRes = await fetch(`${base}/api/monitors/${monitorId}/start`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({}),
});
if (!startRes.ok) {
  const err = await startRes.json().catch(() => ({}));
  // 409 → 예약 없음 / 이미 busy — 로깅·사용자 안내
  return;
}
const started = await startRes.json();
// started.worry 로 즉시 표시 가능

// 폴링
const pollCurrent = async () => {
  const r = await fetch(`${base}/api/monitors/${monitorId}/current`);
  if (!r.ok) return;
  const data = await r.json();
  if (data.status === 'busy' && data.worry) {
    // data.worry.svgUrl, data.worry.worryId
  }
};

// Stage6 종료·시작 화면으로
await fetch(`${base}/api/monitors/${monitorId}/complete`, { method: 'POST' });
```

---

## 디버깅·운영 (선택)

| 메서드 | 경로 | 용도 |
|--------|------|------|
| GET | `/health` | 서버·큐 길이·uptime |
| GET | `/status` | 시작 화면 토스트용 `reservedWorry`, 디버깅용 전체 상태 |

프로덕션에서 과도한 폴링은 부하 — **1~2초 간격** 정도를 권장 ([API.md](./API.md)와 동일).

---

## 태블릿·서버 경계 (참고)

| 주체 | API |
|------|-----|
| 태블릿 | `POST /api/request-monitor`, (선택) `GET /api/queue/position` |
| 모니터 | `POST /api/monitor-instance/bind`, `start`, `current`, `complete`, (시작 화면) `GET /status` |

태블릿 쪽 상세: [CHANGE_PLAN_tablet-entry-card.md](./CHANGE_PLAN_tablet-entry-card.md)

---

## Fallback 정책

- Realtime·Storage만으로 “누가 이 모니터에 붙었는지”를 추측하면 **`reservedWorry` / `start` 타이밍**과 어긋날 수 있음
- **정상 경로**: 위 API 순서 준수
- Fallback은 **서버 장애·네트워크 일시 오류** 등에 한해 제한적으로 사용

---

## 스펙 변경 시

- **먼저 [API.md](./API.md)를 갱신**한 뒤, 본 문서와 [docs/MONITOR_USER_FLOW.md](./docs/MONITOR_USER_FLOW.md)를 맞춤
