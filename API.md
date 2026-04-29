# API 명세서

껌딱지월드 서버 API 명세서

## 📋 목차

1. [REST API](#rest-api)
2. [에러 응답](#에러-응답)
3. [예제](#예제)

---

## REST API

### Base URL

```
http://localhost:3000
```

프로덕션: 배포 URL로 교체 (예: Render `https://<서비스명>.onrender.com`)

**모니터 할당·Stage3 시작·표시·체험 완료**는 아래 **REST API**만 사용합니다.

- 태블릿이 `POST /api/request-monitor`로 모니터를 받으면 서버는 **예약(`reservedWorry`)**만 두고 **`busy`는 켜지 않습니다.**
- 모니터(Stage3)가 시작될 때 `POST /api/monitors/:monitorId/start`를 호출하면 그때 **`busy`** + `currentWorry`가 됩니다.
- Stage6 종료·시작 화면 복귀 시 `POST .../complete`로 **`idle`** 로 돌리고, 대기자가 있으면 같은 모니터에 **다음 예약**만 합니다(다시 `start` 전까지 `idle`).

### 헤더

모든 요청은 JSON 형식:

```
Content-Type: application/json
```

### Supabase `votes` 테이블 (투표 API)

투표 API(`POST /api/votes`, `GET /api/votes/results`)는 아래 `votes` 테이블을 기준으로 동작합니다.

```sql
create table if not exists public.votes (
  id uuid primary key default gen_random_uuid(),
  candidate_no smallint not null check (candidate_no in (1, 2, 3)),
  session_id text null,
  client_id text null,
  created_at timestamptz not null default now()
);

create index if not exists idx_votes_candidate_no on public.votes (candidate_no);
create index if not exists idx_votes_created_at on public.votes (created_at);
```

중복 투표를 제한하려면 정책에 맞게 `session_id` 또는 `client_id`에 유니크 인덱스를 추가합니다.

### Supabase `game_scores` 테이블 (점수 API)

점수 API(`POST /api/scores`, `GET /api/scores/leaderboard`)는 아래 `game_scores` 테이블을 기준으로 동작합니다.

```sql
create table if not exists public.game_scores (
  id bigint generated always as identity primary key,
  user_id text not null,
  score integer not null check (score >= 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_game_scores_user_id on public.game_scores (user_id);
create index if not exists idx_game_scores_created_at on public.game_scores (created_at);
```

---

### 1. 헬스 체크

서버 상태 확인

**요청**

```http
GET /health
```

**응답**

```json
{
  "status": "ok",
  "timestamp": 1735392000000,
  "monitors": {
    "monitor-1": "idle",
    "monitor-2": "busy"
  },
  "queueLength": 3,
  "uptime": 3600.5
}
```

**필드 설명**

| 필드 | 타입 | 설명 |
|------|------|------|
| `status` | string | 서버 상태 (`"ok"`) |
| `timestamp` | number | 현재 타임스탬프 (밀리초) |
| `monitors` | object | 모니터 상태 (`"idle"` 또는 `"busy"`) |
| `queueLength` | number | 대기열 길이 |
| `uptime` | number | 서버 가동 시간 (초) |

---

### 1-1. 경량 ping (keepalive)

UptimeRobot·GitHub Actions 등에서 **슬립 방지**용으로 호출하기 좋은 최소 응답입니다. `/health`와 달리 큐·모니터 상세를 포함하지 않습니다.

**요청**

```http
GET /ping
```

**응답** `200`

```json
{
  "ok": true
}
```

---

### 2. 상태 조회 (`GET /status`)

**전체 모니터 객체**(예약·진행 중 고민 포함)를 한 번에 조회합니다. 운영·디버깅뿐 아니라, **모니터 시작 화면에서 “고민 도착” 토스트**를 띄울 때도 사용합니다.

**왜 필요한가**
예약만 잡힌 단계(`reservedWorry`만 있고 아직 `POST .../start` 전)에서는 **`GET /api/monitors/:monitorId/current`가 `status: "idle"`만** 줄 수 있습니다. 이 구간에서 “N번째 고민이 도착했습니다” 같은 안내가 필요하면, **해당 모니터의 `monitors[monitorId].reservedWorry`** 를 참고합니다.

**필드 일관성**
`reservedWorry`의 `worryId`·`svgUrl`·`sessionId`는 `POST .../start` 이후 **`GET .../current`의 `worry`**(및 `start` 응답의 `worry`)와 **같은 데이터 출처**입니다. (예약 시점에 서버가 넣은 값이 `start` 때 `currentWorry`로 올라갑니다.)

**운영 정책**
프로덕션에서 `GET /status`를 끄거나 응답을 축소할 경우, 모니터 앱은 이 토스트 경로를 쓸 수 없습니다. 그때는 **`GET .../current`에 예약 단계를 노출**하거나 **전용 경량 API**를 추가한 뒤, **본 문서(API.md)를 먼저 갱신**하고 클라이언트를 맞춥니다.

**요청**

```http
GET /status
```

**응답**

```json
{
  "monitors": {
    "monitor-1": {
      "status": "idle",
      "currentWorry": null,
      "reservedWorry": {
        "worryId": "12",
        "displaySeq": 12,
        "svgUrl": "https://example.com/a.svg",
        "sessionId": "sess"
      },
      "clientId": "tablet-uuid-001"
    },
    "monitor-2": {
      "status": "busy",
      "currentWorry": {
        "worryId": "67abc123...",
        "assignedAt": 1735392000000,
        "svgUrl": "https://example.com/worry.svg",
        "sessionId": "sess-uuid"
      },
      "reservedWorry": null,
      "clientId": "tablet-uuid-001"
    }
  },
  "queueLength": 2
}
```

**필드 설명**

| 필드 | 타입 | 설명 |
|------|------|------|
| `monitors` | object | 모니터 상세 상태 |
| `monitors[].status` | string | 모니터 상태 |
| `monitors[].currentWorry` | object\|null | Stage3 진행 중인 고민 (`busy`일 때) |
| `monitors[].reservedWorry` | object\|null | 태블릿/대기열에서 붙었으나 `start` 전 예약. **`worryId`·`svgUrl`·`sessionId`·`displaySeq`(선택)** 는 이후 `GET .../current`의 `worry`와 동일 의미 |
| `monitors[].clientId` | string\|null | 마지막 예약·할당 시 `clientId` |
| `queueLength` | number | 대기열 길이 |

**모니터 앱(시작 화면) 구현 힌트**

- **동일 URL**로 두 대를 띄울 때는 먼저 [2-1. 모니터 인스턴스 슬롯 배정](#2-1-모니터-인스턴스-슬롯-배정-동일-url)으로 `monitorId`를 받습니다.
- 그 `monitorId`로 `GET /status`를 주기적으로 호출(예: 1~2초)하거나, `GET /current` 폴링과 같은 주기로 함께 호출합니다.
- `reservedWorry != null` 이면 토스트: **`displaySeq`가 있으면** 「`${displaySeq}번째 고민이 도착했습니다`」, **없으면** 「고민이 도착했습니다」 등 — **`worryId` 전체를 문구에 넣지 않는 것을 권장** (긴 Edge `id`일 수 있음).
- `GET /current`가 `busy`이면 체험 중 UI는 **`current`의 `worry`** 를 우선(또는 `start` 직후 응답과 동일하게 처리).

---

### 2-1. 모니터 인스턴스 슬롯 배정 (동일 URL)

왼쪽·오른쪽 모니터가 **같은 gum-frontend URL**을 연 경우, 빌드마다 다른 환경변수를 줄 수 없으므로 **브라우저별 고정 ID**로 서버에 슬롯을 예약합니다.

**클라이언트**

1. 앱 최초 실행 시 `instanceId`를 생성(권장: `crypto.randomUUID()`)해 **`localStorage` 등에 영구 저장**.
2. 앱 부팅 시 `POST /api/monitor-instance/bind`에 `instanceId`를 보냄.
3. 응답의 `monitorId`로 이후 `GET /status`, `GET .../current`, `POST .../start`, `POST .../complete` 호출.

**규칙**

- **같은 `instanceId`** → 항상 **같은 `monitorId`** (재방문·새로고침 유지).
- 서버에 처음 붙는 순서대로 `monitor-1`, 다음은 `monitor-2`에 배정됩니다.
- **세 번째** 브라우저(서로 다른 `instanceId`)는 `409` — 전시 전 **두 대만** 열려 있어야 합니다.
- **서버 재시작** 시 매핑이 비워지므로, 다시 붙는 **순서**에 따라 왼쪽/오른쪽이 바뀔 수 있습니다. 전시 운영에서는 재시작 직후 두 모니터를 **한 번씩 새로고침**해 재배정하거나, 고정이 필요하면 추후 영속 저장·수동 지정 스펙을 추가합니다.

#### `POST /api/monitor-instance/bind`

**Body**

| 필드 | 필수 | 타입 | 설명 |
|------|------|------|------|
| `instanceId` | 예 | string | 브라우저별 고정 UUID 등 |

**응답 `200`**

```json
{
  "ok": true,
  "monitorId": "monitor-1",
  "monitorNumber": 1,
  "instanceId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**에러**

- `400` — `{ "error": "instanceId is required" }`
- `409` — `{ "error": "all monitor slots are claimed" }`

#### `GET /api/monitor-instance/bind?instanceId=<id>`

이미 배정된 경우 조회만 (새로고침 후 `monitorId` 복구).

**에러**

- `400` — `instanceId` 누락
- `404` — `{ "error": "instance not bound" }`

#### `POST /api/monitor-instance/release` (운영·개발 보조)

특정 브라우저 슬롯을 비웁니다. Body: `{ "instanceId": "..." }`. 응답 `200` `{ "ok": true }` (없던 id도 성공 처리).

**에러**

- `400` — `{ "error": "instanceId is required" }`

---

### 3. 모니터 할당 요청 (태블릿)

즉시 **빈 모니터**(idle이고 예약도 없음)가 있으면 그 모니터에 **예약**하고, 없으면 대기열에 넣습니다. 모니터가 `busy`가 되는 시점은 **`/start`** 입니다.

**요청**

```http
POST /api/request-monitor
Content-Type: application/json
```

**Body**

| 필드 | 필수 | 타입 | 설명 |
|------|------|------|------|
| `worryId` | 예 | string | 고민 ID (내부·동기화용. Edge `id`처럼 긴 문자열 가능) |
| `displaySeq` | 아니오 | number | **방문객 문구용 순번** (1 이상 정수). 있으면 모니터는 「N번째 고민」에 이 값을 쓰고, `worryId`는 화면에 노출하지 않아도 됨 |
| `svgUrl` | 아니오 | string\|null | SVG URL (모니터 표시용) |
| `sessionId` | 아니오 | string\|null | 세션 ID |
| `clientId` | 아니오 | string | 대기열 식별자. 없으면 서버가 `anonymous-...` 생성 |
| `monitorId` | 아니오 | string | **키오스크 고정 ID**(표준 UUID `8-4-4-4-12` 또는 `monitor-1` / `monitor-2`). 해당 슬롯이 `idle`이고 예약이 없을 때만 여기로 예약하고, 이미 점유·busy면 기존 규칙대로 다른 빈 슬롯 또는 대기열. **형식이 유효하지 않으면(예: `monitor-99`) 강제 에러 없이 일반 규칙(빈 슬롯 탐색→대기열)으로 처리** |

**응답 — 즉시 할당 (`assigned: true`)**

```json
{
  "assigned": true,
  "monitorId": "monitor-1",
  "monitorNumber": 1,
  "message": "👈 왼쪽 껌딱지월드로 가세요"
}
```

**태블릿 안내 (이 응답만 쓰면 됨)**

- **`message`**: 서버가 이미 왼쪽/오른쪽 문구를 넣어 줍니다 (`monitorNumber === 1` → 왼쪽, `2` → 오른쪽).
- **`monitorNumber`**: `1` 또는 `2` — UI에서 「**1번 모니터**로 가세요」「**2번 모니터**로 가세요」처럼 써도 됩니다.
- **`monitorId`**: 예약이 잡힌 슬롯 ID (`monitor-1` / `monitor-2` 또는 태블릿이 넘긴 UUID).
- **`monitorNumber`**: 레거시 두 대 전시일 때만 `1` / `2`. UUID 슬롯이면 `null`이며, 안내 문구는 `message`를 따릅니다.
- **`displaySeq`**: DB `strokes.seq` 등이 있으면 **반드시 같이 보내는 것을 권장**합니다. 없으면 모니터 토스트가 긴 `worryId` 문자열을 읽게 될 수 있습니다.
- **`POST /api/monitor-instance/bind`는 태블릿이 부르지 않습니다.** 동일 URL로 띄운 **모니터 PC 브라우저 두 대**가 “내가 1번 슬롯인지 2번 슬롯인지” 맞출 때만 사용합니다. 태블릿은 **`request-monitor` 응답만**으로 방문객 안내하면 됩니다.

**응답 — 대기 (`assigned: false`)**

```json
{
  "assigned": false,
  "queuePosition": 2,
  "clientId": "anonymous-1735392000123-abc12",
  "message": "2번째로 대기 중입니다"
}
```

**에러**

- `400` — `worryId` 누락: `{ "error": "worryId is required" }`
- `503` — 동적 모니터 슬롯 수가 상한(`MAX_MONITOR_REGISTRY_SIZE`, 기본 64) 초과: `{ "error": "monitor registry full" }`

---

### 4. 모니터 현재 표시 내용 조회 (폴링)

프론트(모니터 화면)가 1~2초 간격으로 호출합니다. **예약만 있고 Stage3가 아직이면** `status`는 `idle`이며 `worry`는 없습니다(시작 화면 등).

**요청**

```http
GET /api/monitors/:monitorId/current
```

`monitorId`: `monitor-1` \| `monitor-2` \| 표준 **UUID** (`xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`). 그 외 형식은 `400 invalid monitorId`.

**참고**: 아직 한 번도 예약·시작되지 않은 UUID에 대해 조회만 하면 `idle`이며, 이 요청만으로는 슬롯이 생기지 않습니다.

**응답 — 유휴**

```json
{
  "status": "idle"
}
```

**응답 — 사용 중**

```json
{
  "status": "busy",
  "worry": {
    "worryId": "67abc123...",
    "displaySeq": 78,
    "svgUrl": "https://example.com/worry.svg",
    "sessionId": "sess-uuid"
  }
}
```

`displaySeq`는 `request-monitor`에 넘긴 경우에만 포함됩니다. UI 문구는 **`displaySeq`가 있으면 「${displaySeq}번째 고민」**, 없으면 `worryId`를 쓰지 않고 「고민이 도착했습니다」 등 일반 문구를 권장합니다.

**에러**

- `400` — `{ "error": "invalid monitorId" }`

---

### 5. Stage3 시작 (모니터)

예약된 고민을 `currentWorry`로 올리고 **`busy`** 로 만듭니다. gum-frontend에서 Stage3 진입 시 호출합니다.

**요청**

```http
POST /api/monitors/:monitorId/start
Content-Type: application/json
```

Body: 생략 가능 `{}`

**응답 `200`**

```json
{
  "ok": true,
  "status": "busy",
  "worry": {
    "worryId": "67abc123...",
    "displaySeq": 78,
    "svgUrl": "https://example.com/worry.svg",
    "sessionId": "sess-uuid"
  }
}
```

**에러**

- `400` — `{ "error": "invalid monitorId" }`
- `409` — 예약 없음: `{ "error": "no reservation for this monitor" }`
- `409` — 이미 busy: `{ "error": "monitor already busy" }`
- `503` — `{ "error": "monitor registry full" }` (슬롯 상한; 일반적으로 드묾)

---

### 6. 모니터 체험 완료 (Stage6 종료)

모니터에서 체험 종료 시 호출. **진행 중 세션만** 해제(`idle`)하고, 대기 중인 다음 사용자가 있으면 같은 모니터에 **예약만** 붙입니다. 다음 사람의 `busy`는 **`/start`** 때 켜집니다.

**요청**

```http
POST /api/monitors/:monitorId/complete
```

**응답**

```json
{
  "ok": true,
  "assignedNext": true
}
```

`assignedNext`: 대기열에서 다음 사용자를 이 모니터에 **예약**했으면 `true`, 없으면 `false`.

**에러**

- `400` — `{ "error": "invalid monitorId" }`

---

### 7. 대기 순번 조회

`POST /api/request-monitor` 응답의 `clientId`로 대기 위치를 조회합니다.

**요청**

```http
GET /api/queue/position?clientId=<clientId>
```

**응답**

```json
{
  "queuePosition": 2
}
```

`queuePosition`: 대기열에 없으면 `0`.

**에러**

- `400` — `{ "error": "clientId is required" }`

---

### 8. 투표 등록 (Supabase)

투표 1건을 등록합니다. 취소는 `DELETE /api/votes/my`, 후보 변경은 `PUT /api/votes/my`를 사용하세요.

**요청**

```http
POST /api/votes
Content-Type: application/json
```

**Body**

| 필드 | 필수 | 타입 | 설명 |
|------|------|------|------|
| `candidate` | 예 | number | 선택 후보 번호 (`1`, `2`, `3`) |
| `clientId` | 예 | string | 디바이스 식별자 (localStorage 등에 영구 저장한 UUID 권장). `DELETE`·`PUT`·`GET /my`에 재사용 |
| `sessionId` | 아니오 | string | 세션 식별자 |

**응답 `200`**

```json
{
  "ok": true,
  "selectedCandidate": 2,
  "clientId": "tablet-uuid-001",
  "totalVotes": 128,
  "results": {
    "candidate1": 40,
    "candidate2": 55,
    "candidate3": 33
  },
  "updatedAt": "2026-03-31T09:10:11.123Z"
}
```

**필드 설명**

| 필드 | 타입 | 설명 |
|------|------|------|
| `ok` | boolean | 성공 여부 (`true`) |
| `selectedCandidate` | number | 방금 등록된 후보 번호 |
| `clientId` | string | 요청에 보낸 `clientId` 그대로 반환 |
| `totalVotes` | number | 전체 누적 투표수 |
| `results.candidate1~3` | number | 후보별 누적 투표수 |
| `updatedAt` | string | 집계 기준 시각 (ISO-8601) |

**에러**

- `400` — `clientId` 누락: `{ "error": "clientId is required" }`
- `400` — 후보값 누락/범위 오류: `{ "error": "candidate must be one of 1, 2, 3" }`
- `409` — DB 유니크 제약 위반 시: `{ "error": "duplicate vote" }`
- `500` — `{ "error": "Internal Server Error" }`

---

### 8-1. 내 투표 취소 (DELETE)

투표를 명시적으로 취소합니다. 투표가 없어도 에러 없이 `deleted: false`로 응답합니다.

**요청**

```http
DELETE /api/votes/my
Content-Type: application/json
```

**Body**

| 필드 | 필수 | 타입 | 설명 |
|------|------|------|------|
| `clientId` | 예 | string | 디바이스 식별자 |

**응답 `200`**

```json
{
  "ok": true,
  "deleted": true,
  "totalVotes": 127,
  "results": {
    "candidate1": 40,
    "candidate2": 54,
    "candidate3": 33
  },
  "updatedAt": "2026-03-31T09:10:12.000Z"
}
```

`deleted: false`이면 기존 투표가 없었음을 의미합니다.

**에러**

- `400` — `{ "error": "clientId is required" }`
- `500` — `{ "error": "Internal Server Error" }`

---

### 8-2. 내 투표 후보 변경 (PUT)

이미 투표한 후보를 다른 후보로 변경합니다. 기존 투표가 없으면 404.

**요청**

```http
PUT /api/votes/my
Content-Type: application/json
```

**Body**

| 필드 | 필수 | 타입 | 설명 |
|------|------|------|------|
| `clientId` | 예 | string | 디바이스 식별자 |
| `candidate` | 예 | number | 변경할 후보 번호 (`1`, `2`, `3`) |

**응답 `200`**

```json
{
  "ok": true,
  "selectedCandidate": 3,
  "totalVotes": 128,
  "results": {
    "candidate1": 40,
    "candidate2": 54,
    "candidate3": 34
  },
  "updatedAt": "2026-03-31T09:10:13.000Z"
}
```

**에러**

- `400` — `{ "error": "clientId is required" }`
- `400` — `{ "error": "candidate must be one of 1, 2, 3" }`
- `404` — 기존 투표 없음: `{ "error": "no vote to change" }`
- `500` — `{ "error": "Internal Server Error" }`

---

### 8-3. 내 투표 상태 조회

페이지 재진입 시 이미 투표한 후보가 있는지 확인합니다. (`POST /api/votes` upsert 없이 상태만 조회할 때 사용)

**요청**

```http
GET /api/votes/my?clientId=<clientId>
```

**응답 `200` — 투표 있음**

```json
{ "candidate": 2 }
```

**응답 `200` — 투표 없음**

```json
{ "candidate": null }
```

**에러**

- `400` — `{ "error": "clientId is required" }`
- `500` — `{ "error": "Internal Server Error" }`

---

### 9. 투표 집계 조회 (읽기 전용)

초기 진입, 새로고침, 전광판 동기화 시 현재 누적 투표수를 조회합니다.

**요청**

```http
GET /api/votes/results
```

**응답 `200`**

```json
{
  "totalVotes": 128,
  "results": {
    "candidate1": 40,
    "candidate2": 55,
    "candidate3": 33
  },
  "updatedAt": "2026-03-31T09:10:11.123Z"
}
```

**에러**

- `500` — `{ "error": "Internal Server Error" }`

---

### 10. 점수 등록 (Supabase)

점수 1건을 저장합니다. 입력한 `userId`가 이미 존재하면 서버가 자동으로 접미사(`2`, `3`, ...)를 붙여 **고유한 `userId`로 저장**합니다.

**요청**

```http
POST /api/scores
Content-Type: application/json
```

**Body**

| 필드 | 필수 | 타입 | 설명 |
|------|------|------|------|
| `userId` | 예 | string | 유저 식별자 (빈 문자열 불가, trim 후 사용). 기존과 중복되면 서버가 `userId2`, `userId3`처럼 변경 저장 |
| `score` | 예 | number | 0 이상의 정수 |

**응답 `201`**

```json
{
  "ok": true,
  "userId": "player-0012",
  "score": 120
}
```

`userId`는 **저장에 실제 사용된 값**입니다(중복 해소로 입력값과 달라질 수 있음).

**에러**

- `400` — `userId` 누락/공백: `{ "error": "userId is required" }`
- `400` — `score` 형식 오류(정수 아님 또는 음수): `{ "error": "score must be a non-negative integer" }`
- `500` — `{ "error": "Internal Server Error" }`

---

### 11. 리더보드 조회 (Supabase)

누적 점수 기준 리더보드를 조회합니다.

**요청**

```http
GET /api/scores/leaderboard
```

**응답 `200`**

```json
{
  "leaderboard": [
    {
      "id": 1,
      "userId": "player-001",
      "totalScore": 320
    },
    {
      "id": 2,
      "userId": "player-002",
      "totalScore": 280
    }
  ]
}
```

`leaderboard` 항목 구조(`id`, `userId`, `totalScore`)는 `ScoreService.getLeaderboard()` 구현을 따릅니다.

**에러**

- `500` — `{ "error": "Internal Server Error" }`

---


## 에러 응답

### HTTP 에러

**404 Not Found**

```json
{
  "error": "Not Found"
}
```

**500 Internal Server Error**

```json
{
  "error": "Internal Server Error"
}
```

---

## 예제

### 태블릿: 모니터 요청

```javascript
const base = 'http://localhost:3000';
const clientId = 'tablet-uuid-001';

const res = await fetch(`${base}/api/request-monitor`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    worryId: '75',
    svgUrl: 'https://example.com/worry.svg',
    sessionId: 'exhibition-2026',
    clientId
  })
});
const data = await res.json();
// assigned: true → monitorId로 안내 / false → queuePosition, 같은 clientId로 GET /api/queue/position 폴링
```

### 모니터: Stage3 시작 → 폴링 → Stage6 complete

```javascript
const base = 'http://localhost:3000';
const monitorId = 'monitor-1';

// Stage3 진입 시(시작 화면에서 체험으로 넘어갈 때)
await fetch(`${base}/api/monitors/${monitorId}/start`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: '{}'
});

const poll = async () => {
  const r = await fetch(`${base}/api/monitors/${monitorId}/current`);
  return r.json();
};

// 주기적으로 poll() → status === 'busy' 이면 worry.svgUrl 표시
// Stage6 종료·시작 화면 복귀 시:
await fetch(`${base}/api/monitors/${monitorId}/complete`, { method: 'POST' });
```

### 투표: 초기 상태 복원 → 등록·취소·변경

```javascript
const base = 'http://localhost:3000';
const clientId = 'tablet-uuid-001'; // localStorage 등에 영구 저장

// 페이지 진입 시 — 이미 투표한 후보가 있으면 UI에 선택 표시
const myRes = await fetch(`${base}/api/votes/my?clientId=${clientId}`);
const { candidate: currentCandidate } = await myRes.json();
// currentCandidate: 2 → 2번 선택 상태로 초기화 / null → 미투표

// 후보 클릭 시 — 신규 등록
const voted = await fetch(`${base}/api/votes`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ candidate: 2, clientId })
});
const result = await voted.json();
// result.selectedCandidate: 2, result.clientId, result.totalVotes, result.results

// 같은 후보 재클릭 → 취소
await fetch(`${base}/api/votes/my`, {
  method: 'DELETE',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ clientId })
});

// 다른 후보 클릭 → 변경
await fetch(`${base}/api/votes/my`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ clientId, candidate: 3 })
});
```

---

## 테스트

### cURL 예제

```bash
curl http://localhost:3000/health
curl http://localhost:3000/status
curl -X POST http://localhost:3000/api/request-monitor \
  -H "Content-Type: application/json" \
  -d '{"worryId":"test-1","clientId":"curl-client"}'
curl http://localhost:3000/api/votes/my?clientId=curl-client
curl -X POST http://localhost:3000/api/votes \
  -H "Content-Type: application/json" \
  -d '{"candidate":2,"clientId":"curl-client"}'
curl -X DELETE http://localhost:3000/api/votes/my \
  -H "Content-Type: application/json" \
  -d '{"clientId":"curl-client"}'
curl -X PUT http://localhost:3000/api/votes/my \
  -H "Content-Type: application/json" \
  -d '{"clientId":"curl-client","candidate":3}'
curl http://localhost:3000/api/votes/results
curl -X POST http://localhost:3000/api/scores \
  -H "Content-Type: application/json" \
  -d '{"userId":"player-001","score":120}'
curl http://localhost:3000/api/scores/leaderboard
curl http://localhost:3000/api/monitors/monitor-1/current
curl -X POST http://localhost:3000/api/monitors/monitor-1/start
curl http://localhost:3000/api/monitors/monitor-1/current
curl -X POST http://localhost:3000/api/monitors/monitor-1/complete
```

로컬에서 시나리오 스크립트: `npm run test:client` (서버 실행 후 다른 터미널에서).

---

**마지막 업데이트**: 2026-04-30 (구현 정본: `server.js`, `src/services/VoteService.js`, `src/managers/MonitorManager.js`, `src/managers/QueueManager.js`, `src/utils/monitorId.js`)
