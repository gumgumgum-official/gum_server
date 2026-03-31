# tablet-entry-card 변경사항 (REST 기반 모니터 배정 요청)

이 문서는 `gumgumgum-official/tablet-entry-card` 레포에서, Edge Function 제출 이후 **`gum_server`에 모니터 예약만 요청**하는 흐름을 정리합니다.

> **정본 스펙**: [API.md](./API.md) (요청/응답 필드·에러 코드)  
> **역할 분리**: 태블릿은 **`POST /api/request-monitor`** 와 (선택) **`GET /api/queue/position`** 만 사용합니다.  
> **`POST /api/monitors/:monitorId/start`**, **`POST .../complete`** 는 **gum-frontend(모니터 앱)** 전용입니다.  
> 흐름 요약: [docs/MONITOR_USER_FLOW.md](./docs/MONITOR_USER_FLOW.md)

---

## 서버와의 계약 (요약)

| 항목 | 내용 |
|------|------|
| Base URL | 개발: `http://localhost:3000` — 프로덕션은 배포된 `gum_server` URL (환경변수로 주입) |
| 프로토콜 | HTTP/HTTPS JSON, **Socket.io 없음** |
| 태블릿이 호출하는 엔드포인트 | `POST /api/request-monitor` (필수), `GET /api/queue/position` (대기 시 선택) |

즉시 빈 모니터가 있으면 서버는 **`reservedWorry`로 예약만** 하고, 모니터의 **`busy`는 켜지 않습니다.** (`GET /current`가 `busy`가 되는 시점은 모니터가 **`/start`** 를 호출한 뒤입니다.)

---

## 현재 흐름(태블릿 쪽, 확인됨)

- 태블릿은 strokes를 **Edge Function(`handwriting-to-svg`)** 에 POST
- Edge Function: Storage 업로드, Realtime broadcast, `strokes` insert
- 응답(기존): `SubmitResponse { id, storagePathSvg, broadcasted }` — **확장 시 `seq` 포함**

---

## 목표

- `seq`(N번째 번호)를 **DB·응답에서 안정적으로** 쓰기 (`worryId`로 서버에 전달)
- 제출 성공 직후 **`POST /api/request-monitor`** 로 모니터 **슬롯 예약** (같은 모니터에 다른 고민이 동시에 붙지 않도록 서버가 막음)

---

## 변경 요약

1. `strokes`에 `seq` (IDENTITY 등)
2. Edge Function 응답에 `seq` 포함 (idempotency 경로에서도 동일 `seq`)
3. 태블릿: 제출 성공 후 `request-monitor` 호출, UI에 `${seq}번째 고민…` 표시

---

## 상세 변경 (파일 단위)

### 1) Supabase DB 스키마/마이그레이션

- `strokes`에 `seq BIGINT GENERATED ALWAYS AS IDENTITY UNIQUE` (또는 프로젝트에 맞는 동일 목적 컬럼)

### 2) Edge Function (`handwriting-to-svg`)

- insert 후 `seq` 반환, idempotency 재요청 시에도 **같은 row의 `seq`** 반환
- 응답 예: `{ id, storagePathSvg, broadcasted, seq }`

### 3) 프론트 타입

- `SubmitResponse`에 `seq: number` (서버 `worryId`는 **문자열**이므로 `String(seq)` 로 통일 권장)

### 4) 환경변수

- `GUM_SERVER_URL` (또는 프로젝트 기존 명명) — **끝에 `/` 없이** base만 두고 경로는 코드에서 `/api/...` 로 붙이기

---

## `POST /api/request-monitor` (태블릿 필수 연동)

**요청**

```http
POST {GUM_SERVER_URL}/api/request-monitor
Content-Type: application/json
```

| 필드 | 필수 | 타입 | 설명 |
|------|------|------|------|
| `worryId` | **예** | string | 고민 ID — **`String(seq)`** 권장 |
| `svgUrl` | 아니오 | string \| null | 모니터 표시용 SVG 위치(Storage 공개 URL 등) |
| `sessionId` | 아니오 | string \| null | 세션 추적용 |
| `clientId` | 아니오 | string | **대기열 식별자**. 생략 시 대기열에만 넣을 때 서버가 `anonymous-<timestamp>-<랜덤>` 발급 |

**성공 응답 A — 즉시 모니터 예약 (`assigned: true`)**

빈 모니터(idle + 예약 없음)가 있을 때. `monitorId`는 서버 상수 **`monitor-1`** | **`monitor-2`** 만 옵니다.

```json
{
  "assigned": true,
  "monitorId": "monitor-1",
  "monitorNumber": 1,
  "message": "👈 왼쪽 껌딱지월드로 가세요"
}
```

- `monitorNumber === 1` → `message` 는 왼쪽 안내, `2` → 오른쪽 안내 (`👉 오른쪽 껌딱지월드로 가세요`)

**성공 응답 B — 대기열 (`assigned: false`)**

즉시 넣을 모니터가 없을 때.

```json
{
  "assigned": false,
  "queuePosition": 2,
  "clientId": "anonymous-1735392000123-abc12",
  "message": "2번째로 대기 중입니다"
}
```

- **`clientId`**: 요청에 넣었으면 그 값이 쓰이고, 없으면 위처럼 서버가 새로 발급합니다. **대기 중 순번 폴링에 필요**하므로 응답의 `clientId`를 보관하세요.

**에러**

- `400` — `worryId` 누락: `{ "error": "worryId is required" }`

### 호출 예시 (fetch)

```ts
const base = GUM_SERVER_URL.replace(/\/$/, '');

const res = await fetch(`${base}/api/request-monitor`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    worryId: String(seq),
    svgUrl: storagePathSvg ?? null,
    sessionId: sessionId ?? null,
    clientId: tabletClientId ?? undefined, // 대기열 재조회를 위해 세션 고정 ID 권장
  }),
});

const data = await res.json();
if (!res.ok) {
  // data.error 등 처리
  return;
}

if (data.assigned) {
  // data.monitorId, data.monitorNumber, data.message 로 안내 UI
} else {
  // data.queuePosition, data.clientId 저장 후 아래 queue/position 폴링 가능
}
```

---

## `GET /api/queue/position` (대기 시 선택)

`assigned: false` 일 때, 사용자에게 **현재 대기 순번**을 갱신해 보여주려면 폴링합니다.

```http
GET {GUM_SERVER_URL}/api/queue/position?clientId=<URL 인코딩>
```

| 쿼리 | 필수 | 설명 |
|------|------|------|
| `clientId` | **예** | `request-monitor` 응답에 받은 `clientId` (문자열) |

**응답**

```json
{ "queuePosition": 2 }
```

- 대기열에 없거나 만료되면 **`0`** (서버 구현: `getPosition` 이 없을 때 0)

**에러**

- `400` — `{ "error": "clientId is required" }`

---

## UI·동작 권장사항

- 제출 직후: **`${seq}번째 고민이 추가되었습니다`** 등 (`seq` = Edge 응답)
- `assigned: true`: `message` 또는 `monitorNumber`로 왼쪽/오른쪽 안내
- `assigned: false`: 초기 `queuePosition` 표시 + 필요 시 수 초 간격으로 `queue/position` 폴링해 순번 갱신. (서버가 대기자를 모니터에 예약해 줄 때 **태블릿에 푸시는 없음** — 안내 UX는 기획에 맞게, 예: 순번·현장 안내)

---

## 태블릿이 호출하지 않는 것 (참고)

| 메서드 | 경로 | 담당 |
|--------|------|------|
| GET | `/api/monitors/:monitorId/current` | 모니터 앱 폴링 |
| POST | `/api/monitors/:monitorId/start` | 모니터 앱 (Stage3 진입) |
| POST | `/api/monitors/:monitorId/complete` | 모니터 앱 (체험 종료) |

모니터 쪽 상세: [CHANGE_PLAN_gum-frontend.md](./CHANGE_PLAN_gum-frontend.md)

---

## 기대 결과

- 태블릿·모니터 문구에 동일 `seq` 사용 (`worryId` 문자열로 일치)
- 태블릿은 **REST만**으로 모니터 슬롯 예약·대기열 식별 (`clientId` / `queuePosition`)
- 스펙 변경 시 **먼저 [API.md](./API.md)를 갱신**하고, 본 문서는 그에 맞춰 수정
