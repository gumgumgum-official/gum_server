# gum_server 변경사항 (REST + 폴링, 예약/start/complete)

> **상태 (2026)**: 아래 설계는 **구현 완료**입니다. Socket.io 없음, **REST만**. 정본은 **[API.md](./API.md)** , 사용자 흐름 요약은 **[docs/MONITOR_USER_FLOW.md](./docs/MONITOR_USER_FLOW.md)** .

## 목표

- 모니터가 “글로벌 최신 1개”가 아니라 **서버가 배정한 특정 SVG 1개**만 쓰게 하기
- 태블릿이 **`seq` + `svgUrl`** 등을 `POST /api/request-monitor`로 넘기기
- 모니터 앱은 **`start` 이후** 폴링으로 `busy`·`worry`를 받아 표시하고, 끝나면 **`complete`**

## 서버 상태 모델 (핵심)

| 개념 | 의미 |
|------|------|
| **`reservedWorry`** | 태블릿/대기열에서 이 모니터에 붙은 고민. **`findAvailable()`에서 이 모니터는 제외** → 같은 모니터에 SVG 두 건 동시 할당 불가 |
| **`status: busy` + `currentWorry`** | `POST .../start` 이후, 폴링 `GET .../current`가 `busy`로 내려줌 |
| **`GET /current`의 `idle`** | 예약만 있어도 **`idle`** (worry 없음). 체험 노출은 모니터가 **`start` 호출 후** |

## REST API (요약)

### 1) `POST /api/request-monitor` (태블릿)

- 빈 모니터( idle + `reservedWorry` 없음 )가 있으면 **`reserve`** → 응답 `assigned: true`
- 없으면 대기열 `add` → `assigned: false` + `queuePosition` + `clientId`
- 선택 바디 **`displaySeq`**(1 이상 정수): `reservedWorry` / `currentWorry` / `GET /current`의 `worry`에 포함 → 모니터 「N번째」문구용 (`worryId`는 긴 id일 수 있음)

### 2) `GET /api/monitors/:monitorId/current` (모니터 폴링)

- `currentWorry` 없으면 항상 `{ "status": "idle" }`
- `start` 이후에만 `{ "status": "busy", "worry": { ... } }`

### 3) `POST /api/monitors/:monitorId/start` (모니터)

- 예약 → `currentWorry`, **`busy`**
- 예약 없음 / 이미 busy → `409`

### 4) `POST /api/monitors/:monitorId/complete` (모니터)

- `release` (체험 구간 종료 → idle, `currentWorry` 제거)
- `dequeue` 후 다음 사람 있으면 **`reserve`만** (즉시 `busy` 아님). 다음 사람도 **`start`** 필요

### 5) `GET /api/queue/position?clientId=...`

- 대기열에 없으면 `queuePosition: 0`

### 6) 모니터 인스턴스 바인딩 (동일 URL)

- `POST /api/monitor-instance/bind` — body `instanceId` → `monitor-1` / `monitor-2` 순차 배정, 동일 id는 고정
- `GET /api/monitor-instance/bind?instanceId=...` — 조회
- `POST /api/monitor-instance/release` — 슬롯 해제(보조)

## 구현 위치

- **`server.js`**: `createApp()`, 라우트만
- **`MonitorManager`**: `findAvailable`, `reserve`, `start`, `release`, `getStatus`
- **`QueueManager`**: FIFO, `clientId`, 타임아웃

## 서버-프론트 계약

- `worryId`는 보통 `strokes.seq` 문자열
- **태블릿**: `request-monitor`만 ( **`start`/`complete` 호출 안 함** )
- **모니터 앱 (gum-frontend)**: 체험 시작 직전 `start` → 폴링 → 끝나면 `complete`
