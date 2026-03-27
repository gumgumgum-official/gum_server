# gum_server 변경사항 (REST + 폴링 기반 모니터 배정)

> **상태 (2026)**: 아래 설계는 **구현 완료**입니다. Socket.io는 제거되었고, 클라이언트는 **REST만** 사용합니다. 상세 엔드포인트·예제는 **[API.md](./API.md)** 를 기준으로 합니다.

이 문서는 당시 `gum_server`에서 **Socket.io 중심 구조를 제거하고, REST API + 폴링**으로 모니터 할당/대기열/체험 완료를 처리하기 위한 변경 배경과 계약을 정리합니다.

## 목표

- 모니터(Stage3)가 “글로벌 최신 1개”가 아니라 **서버가 배정한 특정 SVG 1개**를 표시하게 만들기
- 태블릿 제출 결과(Edge Function 응답)에서 받은 **`seq`(N번째 번호) + `svgUrl`**을 서버에 REST로 전달
- 모니터는 **주기적인 REST 폴링**으로 “지금 나에게 할당된 고민”을 확인하고, 있으면 `N번째 고민이 도착했습니다`와 함께 해당 SVG를 표시

## REST API 설계

### 1) 태블릿 → 모니터 할당 요청

- **엔드포인트**: `POST /api/request-monitor`
- **Request JSON**:

```json
{
  "worryId": "75",
  "svgUrl": "https://...",
  "sessionId": "exhibition-2026",
  "clientId": "tablet-uuid"
}
```

- **Response JSON**:
  - 즉시 할당: `assigned: true`, `monitorId`, `monitorNumber`, `message`
  - 대기: `assigned: false`, `queuePosition`, `clientId`(서버 생성 가능), `message`

### 2) 모니터 → 현재 할당 상태 폴링

- **엔드포인트**: `GET /api/monitors/:monitorId/current`
- idle: `{ "status": "idle" }`
- busy: `{ "status": "busy", "worry": { "worryId", "svgUrl", "sessionId" } }`

### 3) 모니터 → Stage3 시작

- **엔드포인트**: `POST /api/monitors/:monitorId/start`
- 예약(`reservedWorry`)을 `currentWorry`로 올리고 **`busy`**

### 4) 모니터 → 체험 완료 (Stage6)

- **엔드포인트**: `POST /api/monitors/:monitorId/complete`
- **Response**: `{ "ok": true, "assignedNext": true | false }`
- 내부: `release` → `dequeue` → 대기자 있으면 **`reserve`만** (즉시 `busy` 아님). 다음 세션은 **`start`** 호출 시 `busy`

### 5) 태블릿 → 대기 순번 조회

- **엔드포인트**: `GET /api/queue/position?clientId=...`
- 대기열에 없으면 `queuePosition: 0`

## 구현 요약 (현재 레포)

- **`server.js`**: `createApp()`으로 Express 앱 + `MonitorManager` / `QueueManager` 생성. `require.main === module`일 때만 `listen`.
- **Socket.io 없음** — 이벤트 기반 푸시·디바이스 등록·연결 끊김 시 대기열 정리 등은 **사용하지 않음**. 대기 만료는 `QueueManager` 타임아웃 콜백만 동작.
- **대기열 키**: `clientId`(태블릿이 넘기거나 서버가 `anonymous-...` 생성).

## 서버-프론트 계약(요약)

- `worryId`는 “N번째 번호(예: `strokes.seq` )”를 문자열로 전달.
- 태블릿: `POST /api/request-monitor`
- 모니터: Stage3 진입 시 `POST .../start` → `GET .../current` 폴링 → Stage6 후 `POST .../complete`
